/**
 * 流程异常管理 — HR 专用
 * 功能：检测卡点流程、重新分派、强制推进
 */
import { Router } from 'express';
import { getDb } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { transitionPlan } from '../services/workflow';
import { sendMarkdownMessage } from '../services/message';

const router = Router();

// 权限中间件 — 仅 HR 和 Admin 可访问
function hrGuard(req: AuthRequest, res: any, next: any) {
  const db = getDb();
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId) as any;
  if (!['hr', 'admin'].includes(user?.role)) {
    return res.status(403).json({ code: 403, message: '无权限，仅限 HR/管理员' });
  }
  next();
}

// ─── 检测卡点流程 ────────────────────────────────────────────
// GET /api/workflow-exceptions/stuck
// 返回所有「超过 stuckDays 天未推进」的异常流程
router.get('/stuck', authMiddleware, hrGuard, (req: AuthRequest, res) => {
  const db = getDb();
  const stuckDays = parseInt(req.query.days as string) || 3; // 默认3天
  const cutoff = new Date(Date.now() - stuckDays * 24 * 60 * 60 * 1000).toISOString();

  const stuckItems: any[] = [];

  // 1. 卡住的绩效计划 (超时 OR 无审批人)
  const stuckPlans = db.prepare(`
    SELECT 
      pp.id, pp.title, pp.status, pp.updated_at, pp.creator_id, pp.approver_id, pp.deadline,
      cu.name as creator_name,
      au.name as approver_name,
      au.status as approver_status,
      d.name as dept_name,
      'perf_plan' as flow_type,
      CAST((julianday('now') - julianday(pp.updated_at)) AS INTEGER) as stuck_days
    FROM perf_plans pp
    LEFT JOIN users cu ON pp.creator_id = cu.id AND cu.deleted_at IS NULL
    LEFT JOIN users au ON pp.approver_id = au.id AND au.deleted_at IS NULL
    LEFT JOIN departments d ON cu.department_id = d.id
    WHERE pp.status IN ('pending_review', 'pending_dept_review', 'submitted')
      AND (
        pp.updated_at < ?          -- 超时卡点
        OR pp.approver_id IS NULL  -- 无审批人（无需等时间，立即显示）
        OR au.status = 'resigned'  -- 审批人已离职
      )
    ORDER BY pp.updated_at ASC
  `).all(cutoff) as any[];

  stuckPlans.forEach(p => {
    const risk = p.approver_status === 'resigned' ? 'critical' 
               : !p.approver_id ? 'critical'
               : p.stuck_days >= 7 ? 'high' 
               : 'medium';
    stuckItems.push({ ...p, risk });
  });

  // 2. 卡住的绩效池提案
  try {
    const stuckProposals = db.prepare(`
      SELECT 
        pt.id, pt.title, pt.proposal_status as status, pt.updated_at,
        pt.created_by as creator_id, pt.hr_reviewer_id, pt.admin_reviewer_id,
        cu.name as creator_name,
        hr_u.name as hr_reviewer_name,
        hr_u.status as hr_status,
        'proposal' as flow_type,
        CAST((julianday('now') - julianday(pt.updated_at)) AS INTEGER) as stuck_days
      FROM pool_tasks pt
      LEFT JOIN users cu ON pt.created_by = cu.id
      LEFT JOIN users hr_u ON pt.hr_reviewer_id = hr_u.id
      WHERE pt.proposal_status IN ('pending_hr', 'pending_admin')
        AND pt.updated_at < ?
      ORDER BY pt.updated_at ASC
    `).all(cutoff) as any[];

    stuckProposals.forEach(p => {
      const risk = p.stuck_days >= 7 ? 'high' : 'medium';
      const approverName = p.status === 'pending_hr' ? 'HR' 
                         : p.status === 'pending_admin' ? '总经理' : '待指定';
      stuckItems.push({ ...p, risk, approver_name: approverName });
    });
  } catch {}

  // 3. 卡住的加入申请
  try {
    const stuckJoins = db.prepare(`
      SELECT 
        jr.id, jr.pool_task_id, jr.status, jr.created_at as updated_at,
        jr.user_id as creator_id,
        u.name as creator_name,
        pt.title,
        'pool_join' as flow_type,
        CAST((julianday('now') - julianday(jr.created_at)) AS INTEGER) as stuck_days
      FROM pool_join_requests jr
      LEFT JOIN users u ON jr.user_id = u.id
      LEFT JOIN pool_tasks pt ON jr.pool_task_id = pt.id
      WHERE jr.status = 'pending'
        AND jr.created_at < ?
      ORDER BY jr.created_at ASC
    `).all(cutoff) as any[];

    stuckJoins.forEach(j => {
      stuckItems.push({ ...j, risk: j.stuck_days >= 7 ? 'high' : 'medium', approver_name: 'HR' });
    });
  } catch {}

  // 按风险级别和卡点天数排序
  stuckItems.sort((a, b) => {
    const riskOrder = { critical: 0, high: 1, medium: 2 };
    const aOrder = riskOrder[a.risk as keyof typeof riskOrder] ?? 3;
    const bOrder = riskOrder[b.risk as keyof typeof riskOrder] ?? 3;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return b.stuck_days - a.stuck_days;
  });

  return res.json({
    code: 0,
    data: {
      items: stuckItems,
      summary: {
        total: stuckItems.length,
        critical: stuckItems.filter(i => i.risk === 'critical').length,
        high: stuckItems.filter(i => i.risk === 'high').length,
        medium: stuckItems.filter(i => i.risk === 'medium').length,
      }
    }
  });
});

// ─── 强制转派审批人 ──────────────────────────────────────────
// POST /api/workflow-exceptions/reassign
router.post('/reassign', authMiddleware, hrGuard, async (req: AuthRequest, res) => {
  const { flowType, flowId, newApproverId, reason } = req.body;
  if (!flowType || !flowId || !newApproverId) {
    return res.status(400).json({ code: 400, message: '缺少必要参数' });
  }

  const db = getDb();
  const operator = db.prepare('SELECT name FROM users WHERE id = ?').get(req.userId) as any;
  const newApprover = db.prepare('SELECT name FROM users WHERE id = ?').get(newApproverId) as any;

  if (!newApprover) {
    return res.status(404).json({ code: 404, message: '新审批人不存在' });
  }

  try {
    if (flowType === 'perf_plan') {
      const plan = db.prepare('SELECT * FROM perf_plans WHERE id = ?').get(flowId) as any;
      if (!plan) return res.status(404).json({ code: 404, message: '计划不存在' });

      // 更新审批人
      db.prepare('UPDATE perf_plans SET approver_id = ?, updated_at = ? WHERE id = ?')
        .run(newApproverId, new Date().toISOString(), flowId);

      // 记录日志
      db.prepare('INSERT INTO perf_logs (plan_id, user_id, action, comment) VALUES (?, ?, ?, ?)')
        .run(flowId, req.userId, 'reassign', `HR异常管理：将审批人转派给 ${newApprover.name}。原因：${reason || '未说明'}`);

      // 通知新审批人
      try {
        await sendMarkdownMessage([newApproverId],
          `**🔄 审批任务转派通知**\n\n>**计划名称：**${plan.title}\n>**操作人：**${operator?.name || req.userId}（HR）\n>**原因：**${reason || '流程异常恢复'}\n\n请尽快处理此审批任务\n[👉 前往审批](${process.env.APP_URL}/workflows)`
        );
      } catch {}

    } else if (flowType === 'proposal') {
      const proposal = db.prepare('SELECT * FROM pool_tasks WHERE id = ?').get(flowId) as any;
      if (!proposal) return res.status(404).json({ code: 404, message: '提案不存在' });

      const field = proposal.proposal_status === 'pending_hr' ? 'hr_reviewer_id' : 'admin_reviewer_id';
      db.prepare(`UPDATE pool_tasks SET ${field} = ?, updated_at = ? WHERE id = ?`)
        .run(newApproverId, new Date().toISOString(), flowId);

      try {
        await sendMarkdownMessage([newApproverId],
          `**🔄 审批任务转派通知**\n\n>**提案名称：**${proposal.title}\n>**操作人：**${operator?.name || req.userId}（HR）\n>**原因：**${reason || '流程异常恢复'}\n\n请尽快处理此审批任务\n[👉 前往审批](${process.env.APP_URL}/workflows)`
        );
      } catch {}
    }

    return res.json({ code: 0, message: `已成功转派给 ${newApprover.name}` });
  } catch (err: any) {
    return res.status(500).json({ code: 500, message: err.message });
  }
});

// ─── 强制推进（代审批/代驳回）─────────────────────────────────
// POST /api/workflow-exceptions/force-advance
router.post('/force-advance', authMiddleware, hrGuard, async (req: AuthRequest, res) => {
  const { flowType, flowId, action, reason } = req.body;
  // action: 'approve' | 'reject' | 'close'
  if (!flowType || !flowId || !action) {
    return res.status(400).json({ code: 400, message: '缺少必要参数' });
  }
  if (!reason || reason.trim().length < 5) {
    return res.status(400).json({ code: 400, message: '强制推进必须填写原因（至少5个字）' });
  }

  const db = getDb();
  const operator = db.prepare('SELECT name, role FROM users WHERE id = ?').get(req.userId) as any;
  const auditComment = `[HR异常管理] ${operator?.name} 强制${action === 'approve' ? '通过' : action === 'reject' ? '驳回' : '关闭'}。原因：${reason}`;

  try {
    if (flowType === 'perf_plan') {
      const plan = db.prepare('SELECT * FROM perf_plans WHERE id = ?').get(flowId) as any;
      if (!plan) return res.status(404).json({ code: 404, message: '计划不存在' });

      const targetStatus = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'rejected';
      const result = await transitionPlan(flowId, targetStatus, req.userId, { comment: auditComment });

      if (result.success) {
        // 通知发起人
        const notifyUser = plan.creator_id;
        const emoji = action === 'approve' ? '✅' : '❌';
        try {
          await sendMarkdownMessage([notifyUser],
            `**${emoji} 流程异常恢复通知**\n\n>**计划名称：**${plan.title}\n>**处理结果：**${action === 'approve' ? '已通过' : '已驳回'}\n>**操作人：**${operator?.name || 'HR'}（流程异常管理）\n>**原因：**${reason}\n\n如有疑问，请联系人事部门`
          );
        } catch {}
        return res.json({ code: 0, message: '强制推进成功' });
      } else {
        return res.status(400).json({ code: 400, message: result.message });
      }

    } else if (flowType === 'proposal') {
      const proposal = db.prepare('SELECT * FROM pool_tasks WHERE id = ?').get(flowId) as any;
      if (!proposal) return res.status(404).json({ code: 404, message: '提案不存在' });

      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      db.prepare(`
        UPDATE pool_tasks 
        SET proposal_status = ?, 
            ${action === 'approve' ? 'admin_reviewer_id' : 'rejecter_id'} = ?,
            reject_reason = ?,
            updated_at = ?
        WHERE id = ?
      `).run(newStatus, req.userId, action !== 'approve' ? auditComment : null, new Date().toISOString(), flowId);

      // 通知发起人
      try {
        const emoji = action === 'approve' ? '✅' : '❌';
        await sendMarkdownMessage([proposal.created_by],
          `**${emoji} 流程异常恢复通知**\n\n>**提案名称：**${proposal.title}\n>**处理结果：**${action === 'approve' ? '已通过' : '已驳回'}\n>**操作人：**${operator?.name || 'HR'}（流程异常管理）\n>**原因：**${reason}`
        );
      } catch {}

      return res.json({ code: 0, message: '强制推进成功' });

    } else if (flowType === 'pool_join') {
      db.prepare(`UPDATE pool_join_requests SET status = ?, reviewer_id = ?, reviewed_at = ? WHERE id = ?`)
        .run(action === 'approve' ? 'approved' : 'rejected', req.userId, new Date().toISOString(), flowId);
      return res.json({ code: 0, message: '强制推进成功' });
    }

    return res.status(400).json({ code: 400, message: '不支持的流程类型' });
  } catch (err: any) {
    return res.status(500).json({ code: 500, message: err.message });
  }
});

// ─── 流程异常操作日志 ─────────────────────────────────────────
// GET /api/workflow-exceptions/audit-log
router.get('/audit-log', authMiddleware, hrGuard, (req: AuthRequest, res) => {
  const db = getDb();

  // 从 perf_logs 中找 HR 异常管理操作记录
  const logs = db.prepare(`
    SELECT pl.*, pp.title as plan_title, u.name as operator_name
    FROM perf_logs pl
    LEFT JOIN perf_plans pp ON pl.plan_id = pp.id
    LEFT JOIN users u ON pl.user_id = u.id
    WHERE pl.comment LIKE '[HR异常管理]%'
    ORDER BY pl.created_at DESC
    LIMIT 100
  `).all();

  return res.json({ code: 0, data: logs });
});

export default router;
