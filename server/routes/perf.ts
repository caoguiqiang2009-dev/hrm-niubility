import { Router } from 'express';
import { getDb } from '../config/database';
import { authMiddleware, AuthRequest, isSuperAdmin, isGM } from '../middleware/auth';
import { transitionPlan, getAssessmentJudge } from '../services/workflow';
import { getUserEffectivePerms } from './permissions';
import { logAudit } from '../services/audit-logger';

const router = Router();

// 创建绩效计划
router.post('/plans', authMiddleware, async (req: AuthRequest, res) => {
  const { title, description, category, assignee_id, approver_id, department_id, difficulty, deadline, quarter, alignment, target_value, collaborators, attachments } = req.body;
  const db = getDb();

  // 兼容旧表
  try { db.exec("ALTER TABLE perf_plans ADD COLUMN collaborators TEXT"); } catch(e) {}
  try { db.exec("ALTER TABLE perf_plans ADD COLUMN attachments TEXT DEFAULT '[]'"); } catch(e) {}

  const attachmentsStr = attachments ? (typeof attachments === 'string' ? attachments : JSON.stringify(attachments)) : '[]';

  // 流程2: 员工自主申报时，本人必须是A（负责人）
  // 判断逻辑：当 assignee_id 为空或等于创建者时，视为个人目标
  const isPersonalGoal = !assignee_id || assignee_id === req.userId;
  const finalApproverId = isPersonalGoal ? req.userId : (approver_id || req.userId);

  const result = db.prepare(
    `INSERT INTO perf_plans (title, description, category, creator_id, assignee_id, approver_id, department_id, difficulty, deadline, quarter, alignment, target_value, collaborators, attachments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(title, description, category, req.userId, assignee_id || req.userId, finalApproverId, department_id, difficulty, deadline, quarter, alignment, target_value, collaborators || null, attachmentsStr);

  // 流程异常检测：创建时缺少审批人则通知HR
  const issues: string[] = [];
  if (!approver_id) issues.push('缺少审批人(直属上级)');
  const creatorDeptId = department_id || (db.prepare('SELECT department_id FROM users WHERE id = ?').get(req.userId) as any)?.department_id;
  if (creatorDeptId) {
    const dept = db.prepare('SELECT leader_user_id FROM departments WHERE id = ?').get(creatorDeptId) as any;
    if (!dept?.leader_user_id) issues.push('所属部门无负责人');
  }
  if (issues.length > 0) {
    const { WorkflowEngine } = await import('../services/workflow-engine');
    const { createNotification } = await import('./notifications');
    const adminIds = WorkflowEngine.getUsersByRoleTag('hrbp').concat(WorkflowEngine.getUsersByRoleTag('gm'));
    const uniqueIds = Array.from(new Set(adminIds));
    const creatorName = (db.prepare('SELECT name FROM users WHERE id = ?').get(req.userId) as any)?.name || req.userId;
    if (uniqueIds.length > 0) {
      createNotification(uniqueIds, 'workflow_error', '⚠️ 流程节点异常', `${creatorName} 创建的绩效计划「${title}」${issues.join('、')}，请前往流程异常管理修复`, '/admin');
    }
  }

  return res.json({ code: 0, data: { id: result.lastInsertRowid } });
});

// 查询绩效列表
router.get('/plans', authMiddleware, (req: AuthRequest, res) => {
  const { status, quarter, category, userId } = req.query;
  const db = getDb();
  let sql = `
    SELECT p.*,
      uc.name AS creator_name,
      ua.name AS approver_name,
      us.name AS assignee_name
    FROM perf_plans p
    LEFT JOIN users uc ON uc.id = p.creator_id
    LEFT JOIN users ua ON ua.id = p.approver_id
    LEFT JOIN users us ON us.id = p.assignee_id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (status) { sql += ' AND p.status = ?'; params.push(status); }
  if (quarter) { sql += ' AND p.quarter = ?'; params.push(quarter); }
  if (category) { sql += ' AND p.category = ?'; params.push(category); }
  if (userId) { sql += " AND (p.creator_id = ? OR (',' || p.assignee_id || ',' LIKE '%,' || ? || ',%'))"; params.push(userId, userId); }

  sql += ' ORDER BY p.created_at DESC';
  const plans = db.prepare(sql).all(...params) as any[];

  // 虚拟混入“赏金榜”任务作为专项任务
  if (!status && userId && (!category || category === '专项任务')) {
    const claims = db.prepare(`
      SELECT rc.*, pt.title, pt.description, pt.status as pt_status, pt.deadline as pt_deadline, pt.progress as pt_progress, pt.bonus, pt.creator_id, pt.created_at as pt_created_at
      FROM pool_role_claims rc
      JOIN pool_tasks pt ON rc.pool_task_id = pt.id
      WHERE rc.user_id = ? AND rc.status = 'approved' AND pt.status != 'draft' AND pt.status != 'rejected'
    `).all(userId) as any[];

    if (claims.length > 0) {
      const virtualPlans = claims.map(c => {
        let mappedStatus = 'in_progress';
        if (['open', 'published', 'pending', 'in_progress'].includes(c.pt_status)) mappedStatus = 'in_progress';
        else if (['reviewing', 'completed', 'pending_assessment', 'pending_dept_review'].includes(c.pt_status)) mappedStatus = 'completed';
        else if (['settled', 'closed', 'approved'].includes(c.pt_status)) mappedStatus = 'approved';
        else mappedStatus = c.pt_status;

        return {
          id: `pool_${c.id}`,
          title: c.title,
          description: c.description || '',
          category: '专项任务',
          status: mappedStatus,
          progress: c.pt_progress || 0,
        target_value: `赏金榜角色：${c.role_name}`,
        deadline: c.pt_deadline || '',
        quarter: '',
        creator_id: c.creator_id,
        assignee_id: c.user_id,
        assignee_name: '',
        bonus: c.bonus || 0,
        created_at: c.created_at || c.pt_created_at,
          is_pool: true
        };
      });

      plans.push(...virtualPlans);
      // 重新按时间倒序
      plans.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
  }

  return res.json({ code: 0, data: plans });
});

// 绩效计划详情
router.get('/plans/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const plan = db.prepare(`
    SELECT p.*,
      uc.name AS creator_name,
      ua.name AS approver_name,
      us.name AS assignee_name
    FROM perf_plans p
    LEFT JOIN users uc ON uc.id = p.creator_id
    LEFT JOIN users ua ON ua.id = p.approver_id
    LEFT JOIN users us ON us.id = p.assignee_id
    WHERE p.id = ?
  `).get(req.params.id) as any;
  if (!plan) return res.status(404).json({ code: 404, message: '绩效计划不存在' });

  // GAP-4: Compute and attach judge info for assessed/in_progress plans
  if (plan.approver_id && ['in_progress', 'pending_assessment'].includes(plan.status)) {
    try {
      const { judgeId, reason } = getAssessmentJudge(plan.approver_id);
      if (judgeId) {
        const judge = db.prepare('SELECT name FROM users WHERE id = ?').get(judgeId) as any;
        plan.judge_id = judgeId;
        plan.judge_name = judge?.name || judgeId;
        plan.judge_reason = reason;
      }
    } catch { /* ignore */ }
  }

  return res.json({ code: 0, data: plan });
});

// 编辑绩效计划 (草稿 or 被驳回均可编辑)
router.put('/plans/:id', authMiddleware, (req: AuthRequest, res) => {
  const { title, description, category, difficulty, deadline, quarter, alignment, target_value, collaborators, attachments } = req.body;
  const db = getDb();

  const attachmentsStr = attachments !== undefined ? (typeof attachments === 'string' ? attachments : JSON.stringify(attachments)) : undefined;
  const updates = ['title=?', 'description=?', 'category=?', 'difficulty=?', 'deadline=?', 'quarter=?', 'alignment=?', 'target_value=?', 'collaborators=?', 'updated_at=?'];
  const params = [title, description, category, difficulty, deadline, quarter, alignment, target_value, collaborators || null, new Date().toISOString()];
  
  if (attachmentsStr !== undefined) {
    updates.push('attachments=?');
    params.push(attachmentsStr);
  }
  params.push(req.params.id);

  db.prepare(`UPDATE perf_plans SET ${updates.join(', ')} WHERE id = ? AND status IN ('draft', 'rejected')`).run(...params);

  return res.json({ code: 0, message: '更新成功' });
});

// 驳回后重新提交 (rejected -> draft -> pending_review)
router.post('/plans/:id/resubmit', authMiddleware, async (req: AuthRequest, res) => {
  const db = getDb();
  const plan = db.prepare('SELECT * FROM perf_plans WHERE id = ?').get(req.params.id) as any;
  if (!plan) return res.status(404).json({ code: 404, message: '计划不存在' });
  if (plan.status !== 'rejected' && plan.status !== 'returned') return res.status(400).json({ code: 400, message: '只有被驳回或退回的计划可以重新提交' });

  // 更新字段
  const { title, description, category, target_value, deadline, collaborators } = req.body;
  if (title) {
    db.prepare(
      `UPDATE perf_plans SET title=?, description=?, category=?, target_value=?, deadline=?, collaborators=?, reject_reason=NULL, updated_at=? WHERE id = ?`
    ).run(title, description, category, target_value, deadline, collaborators || null, new Date().toISOString(), req.params.id);
  } else {
    db.prepare(`UPDATE perf_plans SET reject_reason=NULL, updated_at=? WHERE id = ?`).run(new Date().toISOString(), req.params.id);
  }

  // 利用引擎重算审批链
  const { WorkflowEngine, WORKFLOWS } = await import('../services/workflow-engine');
  const nodes = WorkflowEngine.resolveAssignees(WORKFLOWS.PERF_PLAN, { initiatorId: plan.creator_id, deptId: plan.department_id });
  const node2 = nodes.find(n => n.seq === 2);
  const node3 = nodes.find(n => n.seq === 3);
  let nextStatus = 'pending_review';
  let firstApproverId = node2?.assignees?.[0] || null;

  if (node2?.isSkipped || !firstApproverId) {
    nextStatus = 'pending_dept_review';
    let secondApproverId = node3?.assignees?.[0] || null;
    if (node3?.isSkipped || !secondApproverId) {
      nextStatus = 'approved';
    } else {
      db.prepare('UPDATE perf_plans SET dept_head_id = ? WHERE id = ?').run(secondApproverId, plan.id);
    }
  } else {
    db.prepare('UPDATE perf_plans SET approver_id = ? WHERE id = ?').run(firstApproverId, plan.id);
  }

  // 触发一次 draft 转换方便统一日志（如果需要的话，但不影响逻辑。直接基于引擎推送最终状态）
  await transitionPlan(plan.id, 'draft', req.userId!, { comment: '系统强制状态重置为草稿' });

  if (nextStatus === 'pending_review') {
      await transitionPlan(plan.id, 'pending_review', req.userId!);
  } else if (nextStatus === 'pending_dept_review') {
      await transitionPlan(plan.id, 'pending_review', req.userId!);
      await transitionPlan(plan.id, 'pending_dept_review', req.userId!);
  } else {
      await transitionPlan(plan.id, 'pending_review', req.userId!);
      await transitionPlan(plan.id, 'approved', req.userId!);
  }

  db.prepare('INSERT INTO perf_logs (plan_id, user_id, action, old_value, new_value, comment) VALUES (?, ?, ?, ?, ?, ?)').run(
    req.params.id, req.userId, 'resubmit', plan.status, nextStatus, '修改后重新提交审批'
  );
  logAudit({ businessType: 'perf_plan', businessId: Number(req.params.id), actorId: req.userId!, action: 'resubmit', fromStatus: plan.status, toStatus: nextStatus });

  return res.json({ code: 0, message: nextStatus === 'approved' ? '免审通过' : '已重新提交审批' });
});

// 撤回：在审批人未审核前，发起人可以撤回
router.post('/plans/:id/withdraw', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const plan = db.prepare('SELECT * FROM perf_plans WHERE id = ?').get(req.params.id) as any;
  if (!plan) return res.status(404).json({ code: 404, message: '计划不存在' });
  if (plan.creator_id !== req.userId) return res.status(403).json({ code: 403, message: '只有发起人可以撤回' });
  if (plan.status !== 'pending_review') return res.json({ code: 400, message: '当前状态不可撤回，仅待审核状态可撤回' });

  db.prepare("UPDATE perf_plans SET status = 'draft', updated_at = ? WHERE id = ?").run(new Date().toISOString(), req.params.id);
  db.prepare('INSERT INTO perf_logs (plan_id, user_id, action, old_value, new_value, comment) VALUES (?, ?, ?, ?, ?, ?)').run(
    req.params.id, req.userId, 'withdraw', 'pending_review', 'draft', '发起人主动撤回'
  );
  logAudit({ businessType: 'perf_plan', businessId: Number(req.params.id), actorId: req.userId!, action: 'withdraw', fromStatus: 'pending_review', toStatus: 'draft' });

  return res.json({ code: 0, message: '已撤回，可重新编辑后提交' });
});

// 退回：被指派人退回上级下发的绩效 (in_progress → returned)
router.post('/plans/:id/return', authMiddleware, async (req: AuthRequest, res) => {
  const { reason } = req.body;
  const db = getDb();
  const plan = db.prepare('SELECT * FROM perf_plans WHERE id = ?').get(req.params.id) as any;
  if (!plan) return res.status(404).json({ code: 404, message: '计划不存在' });
  if (plan.assignee_id !== req.userId) return res.status(403).json({ code: 403, message: '只有被指派人可以退回' });
  if (plan.status !== 'in_progress') return res.json({ code: 400, message: '只有进行中的任务可以退回' });

  const result = await transitionPlan(Number(req.params.id), 'returned', req.userId!, { comment: reason || '被指派人退回' });
  return res.json({ code: result.success ? 0 : 400, message: result.success ? '已退回，发起人将收到通知' : result.message });
});

// 删除草稿
router.delete('/plans/:id', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const plan = db.prepare('SELECT * FROM perf_plans WHERE id = ?').get(req.params.id) as any;
  if (!plan) return res.status(404).json({ code: 404, message: '计划不存在' });
  if (plan.creator_id !== req.userId) return res.status(403).json({ code: 403, message: '只有创建人可以删除' });
  if (plan.status !== 'draft') return res.json({ code: 400, message: '只有草稿可以删除' });

  db.prepare('DELETE FROM perf_logs WHERE plan_id = ?').run(req.params.id);
  db.prepare('DELETE FROM perf_plans WHERE id = ?').run(req.params.id);
  return res.json({ code: 0, message: '草稿已删除' });
});

// 提交审批
router.post('/plans/:id/submit', authMiddleware, async (req: AuthRequest, res) => {
  const db = getDb();
  const isAdminOrGM = isGM(req.userId) || isSuperAdmin(req.userId);
  const plan = db.prepare('SELECT * FROM perf_plans WHERE id = ?').get(req.params.id) as any;
  if (!plan) return res.status(404).json({ code: 404, message: '计划不存在' });

  const { WorkflowEngine, WORKFLOWS } = await import('../services/workflow-engine');

  // 【Admin/GM 免审兜底直通】
  if (isAdminOrGM) {
    await transitionPlan(Number(req.params.id), 'pending_review', req.userId!);
    await transitionPlan(Number(req.params.id), 'approved', req.userId!);
    // 抄送 HRBP
    const hrbps = WorkflowEngine.getUsersByRoleTag('hrbp');
    if (hrbps.length > 0) {
      const { createNotification } = await import('./notifications');
      createNotification(hrbps, 'workflow_cc', '✅ 特权节点审批通过（抄送）', `【总经理特批】${plan.title} 已直接进入执行阶段`, '/perf');
    }
    return res.json({ code: 0, message: '特权免签通过，已通知 HRBP 备案' });
  }

  // ── 接入 Workflow Engine ──
  const nodes = WorkflowEngine.resolveAssignees(WORKFLOWS.PERF_PLAN, { initiatorId: plan.creator_id, deptId: plan.department_id });
  const node2 = nodes.find(n => n.seq === 2); // 一审: 直属负责
  const node3 = nodes.find(n => n.seq === 3); // 二审: 跨级负责

  let nextStatus = 'pending_review';
  let firstApproverId = node2?.assignees?.[0] || null;

  if (node2?.isSkipped || !firstApproverId) {
    // 一审自动跳过 → 进入二审
    nextStatus = 'pending_dept_review';
    let secondApproverId = node3?.assignees?.[0] || null;
    if (node3?.isSkipped || !secondApproverId) {
      // 二审也跳过 → 全部跳过自动通过
      nextStatus = 'approved';
    } else {
      db.prepare('UPDATE perf_plans SET dept_head_id = ? WHERE id = ?').run(secondApproverId, plan.id);
    }
  } else {
    // 正常进入一审
    db.prepare('UPDATE perf_plans SET approver_id = ? WHERE id = ?').run(firstApproverId, plan.id);
  }

  // 触发状态流转（产生 logs 和企微消息推送）
  if (nextStatus === 'pending_review') {
      await transitionPlan(plan.id, 'pending_review', req.userId!);
  } else if (nextStatus === 'pending_dept_review') {
      await transitionPlan(plan.id, 'pending_review', req.userId!);
      await transitionPlan(plan.id, 'pending_dept_review', req.userId!);
  } else {
      await transitionPlan(plan.id, 'pending_review', req.userId!);
      await transitionPlan(plan.id, 'approved', req.userId!);
  }

  return res.json({ code: 0, message: nextStatus === 'approved' ? '系统自动免审流转到执行中' : '已提交审批' });
});

// 审批通过
router.post('/plans/:id/approve', authMiddleware, async (req: AuthRequest, res) => {
  const db = getDb();
  const planId = Number(req.params.id);
  const plan = db.prepare('SELECT * FROM perf_plans WHERE id = ?').get(planId) as any;
  if (!plan) return res.status(404).json({ code: 404, message: '计划不存在' });

  const { WorkflowEngine, WORKFLOWS } = await import('../services/workflow-engine');
  const nodes = WorkflowEngine.resolveAssignees(WORKFLOWS.PERF_PLAN, { initiatorId: plan.creator_id, deptId: plan.department_id });
  const node2 = nodes.find(n => n.seq === 2); // 一审: 直属负责
  const node3 = nodes.find(n => n.seq === 3); // 二审: 跨级负责

  const isAdminOrGM = isGM(req.userId) || isSuperAdmin(req.userId);

  // 发起人自身拦截 (若非最高权限兜底)
  if (plan.creator_id === req.userId && !isAdminOrGM) {
    return res.status(403).json({ code: 403, message: '发起人不能审批自己提交的计划' });
  }

  if (plan.status === 'pending_review') {
    // 一审节点阶段校验
    const node2Assignees = node2?.assignees || [];
    if (!node2Assignees.includes(req.userId) && !isAdminOrGM && req.userId !== plan.approver_id) {
       return res.status(403).json({ code: 403, message: '您不在本节点的审批群组内，不能越级审批' });
    }

    // 引擎检测二审是否应该自动跳过
    let secondApproverId = node3?.assignees?.[0] || null;
    let skipNode3 = node3?.isSkipped || !secondApproverId || secondApproverId === req.userId || secondApproverId === plan.creator_id;
    
    // Auto-escalation 回落如果引擎计算出的结果无效
    if (skipNode3) {
      if (secondApproverId) db.prepare('UPDATE perf_plans SET dept_head_id = ? WHERE id = ?').run(secondApproverId, planId);
      const result = await transitionPlan(planId, 'approved', req.userId!);
      return res.json({ code: result.success ? 0 : 400, message: result.message });
    } else {
      // 成功递交二审
      db.prepare('UPDATE perf_plans SET dept_head_id = ? WHERE id = ?').run(secondApproverId, planId);
      const result = await transitionPlan(planId, 'pending_dept_review', req.userId!);
      const deptHeadName = (db.prepare('SELECT name FROM users WHERE id = ?').get(secondApproverId) as any)?.name || '下一级负责人';
      return res.json({ code: result.success ? 0 : 400, message: result.success ? `节点审批完成，已自动发往「${deptHeadName}」处理` : result.message });
    }
  } else if (plan.status === 'pending_dept_review') {
    // 二审节点阶段校验
    const node3Assignees = node3?.assignees || [];
    if (!node3Assignees.includes(req.userId) && !isAdminOrGM && req.userId !== plan.dept_head_id) {
      return res.status(403).json({ code: 403, message: '您无权处理该跨级审批节点' });
    }
    const result = await transitionPlan(planId, 'approved', req.userId!);
    return res.json({ code: result.success ? 0 : 400, message: result.message });
  }

  const result = await transitionPlan(planId, 'approved', req.userId!);
  return res.json({ code: result.success ? 0 : 400, message: result.message });
});

// 驳回
router.post('/plans/:id/reject', authMiddleware, async (req: AuthRequest, res) => {
  const db = getDb();
  const planId = Number(req.params.id);
  const plan = db.prepare('SELECT * FROM perf_plans WHERE id = ?').get(planId) as any;
  if (!plan) return res.status(404).json({ code: 404, message: '计划不存在' });

  const { WorkflowEngine, WORKFLOWS } = await import('../services/workflow-engine');
  const nodes = WorkflowEngine.resolveAssignees(WORKFLOWS.PERF_PLAN, { initiatorId: plan.creator_id, deptId: plan.department_id });
  const node2 = nodes.find(n => n.seq === 2);
  const node3 = nodes.find(n => n.seq === 3);

  const isAdminOrGM = isGM(req.userId) || isSuperAdmin(req.userId);

  // ── 禁止自审驳回 ──
  if (plan.creator_id === req.userId && !isAdminOrGM) {
    return res.status(403).json({ code: 403, message: '发起人不能驳回自己提交的计划' });
  }
  
  // ── 节点校验 ──
  if (plan.status === 'pending_review') {
    const node2Assignees = node2?.assignees || [];
    if (!node2Assignees.includes(req.userId) && !isAdminOrGM && plan.approver_id !== req.userId) {
      return res.status(403).json({ code: 403, message: '您不是本计划当前节点的审批人，不能越级操作' });
    }
  } else if (plan.status === 'pending_dept_review') {
    const node3Assignees = node3?.assignees || [];
    if (!node3Assignees.includes(req.userId) && !isAdminOrGM && plan.dept_head_id !== req.userId) {
      return res.status(403).json({ code: 403, message: '您无权在该节点进行驳回操作' });
    }
  } else {
    return res.status(400).json({ code: 400, message: `当前状态 (${plan.status}) 不支持驳回` });
  }

  const result = await transitionPlan(planId, 'rejected', req.userId!, { comment: req.body.reason });
  return res.json({ code: result.success ? 0 : 400, message: result.message });
});

// 统一审批操作 (approve / reject / assess / reward)
router.post('/plans/:id/review', authMiddleware, async (req: AuthRequest, res) => {
  const { action, reason, score, bonus, attachments, transfer_to } = req.body;
  const planId = Number(req.params.id);

  if (action === 'transfer' && transfer_to) {
    const db = (await import('../config/database')).getDb();
    const plan = db.prepare('SELECT status FROM perf_plans WHERE id = ?').get(planId) as any;
    if (!plan) return res.status(404).json({ code: 404, message: '计划不存在' });

    let updateSql = '';
    if (plan.status === 'pending_review' || plan.status === 'published') {
      updateSql = 'UPDATE perf_plans SET approver_id = ? WHERE id = ?';
    } else if (plan.status === 'pending_dept_review') {
      updateSql = 'UPDATE perf_plans SET dept_head_id = ? WHERE id = ?';
    } else {
      return res.status(400).json({ code: 400, message: '当前阶段不可转办' });
    }

    db.prepare(updateSql).run(transfer_to, planId);

    const { createNotification } = await import('./notifications');
    const transferUser = db.prepare('SELECT name FROM users WHERE id = ?').get(transfer_to) as any;
    const operatorUser = db.prepare('SELECT name FROM users WHERE id = ?').get(req.userId) as any;
    
    if (transferUser) {
      createNotification([transfer_to], 'workflow_transfer', '🔄 绩效考核转办', `${operatorUser?.name || '管理员'} 将一个目标考评流程转交给了您，请核实。`, '/my-workflows');
      try { 
        const { sendCardMessage } = await import('../services/message');
        const p = db.prepare('SELECT title FROM perf_plans WHERE id = ?').get(planId) as any;
        sendCardMessage([transfer_to], '🔄 审批节点转办通知', `${operatorUser?.name || '管理员'} 把考核任务「${p?.title}」移交给了您\n> 留言附注: ${reason || '请阅审'}`, `${process.env.APP_URL || 'http://localhost:3000'}/my-workflows`); 
      } catch(e) {}
    }
    return res.json({ code: 0, message: `任务考核已顺利移交至 ${transferUser?.name}` });
  }

  const db = getDb();

  switch (action) {
    case 'approve': {
      const result = await transitionPlan(planId, 'approved', req.userId!, { attachments });
      return res.json({ code: result.success ? 0 : 400, message: result.message });
    }
    case 'reject': {
      const result = await transitionPlan(planId, 'rejected', req.userId!, { comment: reason, attachments });
      return res.json({ code: result.success ? 0 : 400, message: result.message });
    }
    case 'assess': {
      // 流程5核心防腐：评级官避嫌溯源
      const plan4assess = db.prepare('SELECT * FROM perf_plans WHERE id = ?').get(planId) as any;
      if (!plan4assess) return res.status(404).json({ code: 404, message: '计划不存在' });

      // 仅负责人A可发起验收（但评分操作是上级做的）
      if (plan4assess.status === 'in_progress') {
        // 发起验收总结 → 限执行人(R)或责任人(A)
        const isR = typeof plan4assess.assignee_id === 'string' && plan4assess.assignee_id.toLowerCase().includes(String(req.userId).toLowerCase());
        const isA = typeof plan4assess.approver_id === 'string' && plan4assess.approver_id.toLowerCase() === String(req.userId).toLowerCase();

        if (!isR && !isA && !isGM(req.userId) && !isSuperAdmin(req.userId)) {
          return res.status(403).json({ code: 403, message: '仅执行人(R)或责任人(A)可发起验收总结' });
        }
        const step1 = await transitionPlan(planId, 'pending_assessment', req.userId!);
        return res.json({ code: step1.success ? 0 : 400, message: step1.success ? '已发起验收总结，等待上级评级' : step1.message });
      }

      if (plan4assess.status === 'pending_assessment') {
        // 打分操作 → 必须是评级官（A的上级）
        const { judgeId, reason } = getAssessmentJudge(plan4assess.approver_id);
        const isAdminOrGM = isGM(req.userId) || isSuperAdmin(req.userId);
        if (!isAdminOrGM && req.userId !== judgeId) {
          const judgeName = judgeId ? (db.prepare('SELECT name FROM users WHERE id = ?').get(judgeId) as any)?.name || judgeId : '未找到';
          return res.status(403).json({ code: 403, message: `您无权评分。本单评级官为：${judgeName}(${reason})` });
        }
        const result = await transitionPlan(planId, 'assessed', req.userId!, { score, attachments });
        if (result.success) {
          // 流程5：评级后直接结案，不走发钱环节
          await transitionPlan(planId, 'completed', req.userId!);
        }
        return res.json({ code: result.success ? 0 : 400, message: result.success ? '评级完成，任务已结案' : result.message });
      }

      return res.status(400).json({ code: 400, message: `当前状态 (${plan4assess.status}) 不支持评分操作` });
    }
    case 'reward': {
      // 注意：日常绩效不再走此环节（流程5已取消），保留兼容但返回提示
      return res.status(400).json({ code: 400, message: '日常绩效评级后直接结案，无需经过发钱环节。悬赏任务请使用 /pool/rewards 流程' });
    }
    case 'return': {
      // Allow returning to returned status, passing attachments too (custom logic if needed)
      const result = await transitionPlan(planId, 'returned', req.userId!, { comment: reason, attachments });
      return res.json({ code: result.success ? 0 : 400, message: result.message });
    }
    default:
      return res.status(400).json({ code: 400, message: `未知操作: ${action}` });
  }
});

// ═══════════════════════════════════════════════════════
// 流程1: 团队内派发任务 — 签收机制
// ═══════════════════════════════════════════════════════

// 主管下发任务 → pending_receipt
router.post('/plans/:id/dispatch', authMiddleware, async (req: AuthRequest, res) => {
  const db = getDb();
  const planId = Number(req.params.id);
  const plan = db.prepare('SELECT * FROM perf_plans WHERE id = ?').get(planId) as any;
  if (!plan) return res.status(404).json({ code: 404, message: '计划不存在' });
  if (plan.creator_id !== req.userId && !isGM(req.userId) && !isSuperAdmin(req.userId)) {
    return res.status(403).json({ code: 403, message: '仅任务创建人可下发任务' });
  }
  if (plan.status !== 'draft') return res.status(400).json({ code: 400, message: '仅草稿可下发' });

  // 收集需要签收的人员名单 (R + A)
  const pendingUsers: string[] = [];
  if (plan.assignee_id) {
    const assigneeIds = plan.assignee_id.split(',').filter(Boolean);
    pendingUsers.push(...assigneeIds);
  }
  if (plan.approver_id && !pendingUsers.includes(plan.approver_id)) {
    pendingUsers.push(plan.approver_id);
  }

  if (pendingUsers.length === 0) {
    return res.status(400).json({ code: 400, message: '请先设置执行人(R)和负责人(A)' });
  }

  // 初始化签收状态
  const receiptStatus: Record<string, string> = {};
  for (const uid of pendingUsers) {
    receiptStatus[uid] = 'pending';
  }

  db.prepare(`UPDATE perf_plans SET status = 'pending_receipt', receipt_status = ?, updated_at = ? WHERE id = ?`)
    .run(JSON.stringify(receiptStatus), new Date().toISOString(), planId);

  // 记录日志
  db.prepare('INSERT INTO perf_logs (plan_id, user_id, action, old_value, new_value, comment) VALUES (?, ?, ?, ?, ?, ?)')
    .run(planId, req.userId, 'dispatch', 'draft', 'pending_receipt', `下发至 ${pendingUsers.length} 人`);

  // 推送待签收通知
  const { createNotification } = await import('./notifications');
  const creatorName = (db.prepare('SELECT name FROM users WHERE id = ?').get(req.userId) as any)?.name || req.userId;
  createNotification(pendingUsers, 'workflow_pending', '📥 新任务待查收', `${creatorName} 给您下发了任务「${plan.title}」，请确认查收`, '/my-goals');

  return res.json({ code: 0, message: `任务已下发，等待 ${pendingUsers.length} 人签收` });
});

// R/A 签收确认
router.post('/plans/:id/confirm-receipt', authMiddleware, async (req: AuthRequest, res) => {
  const db = getDb();
  const planId = Number(req.params.id);
  const plan = db.prepare('SELECT * FROM perf_plans WHERE id = ?').get(planId) as any;
  if (!plan) return res.status(404).json({ code: 404, message: '计划不存在' });
  if (plan.status !== 'pending_receipt') return res.status(400).json({ code: 400, message: '当前状态非待签收' });

  let receiptStatus: Record<string, string> = {};
  try { receiptStatus = JSON.parse(plan.receipt_status || '{}'); } catch {}

  if (!receiptStatus[req.userId!]) {
    return res.status(403).json({ code: 403, message: '您不在签收名单中' });
  }
  if (receiptStatus[req.userId!] === 'confirmed') {
    return res.json({ code: 0, message: '您已签收过' });
  }

  receiptStatus[req.userId!] = 'confirmed';
  db.prepare(`UPDATE perf_plans SET receipt_status = ?, updated_at = ? WHERE id = ?`)
    .run(JSON.stringify(receiptStatus), new Date().toISOString(), planId);

  db.prepare('INSERT INTO perf_logs (plan_id, user_id, action, old_value, new_value, comment) VALUES (?, ?, ?, ?, ?, ?)')
    .run(planId, req.userId, 'confirm_receipt', 'pending', 'confirmed', '已确认查收');

  // 检查是否全部签收
  const allConfirmed = Object.values(receiptStatus).every(s => s === 'confirmed');
  if (allConfirmed) {
    const { createNotification } = await import('./notifications');
    // 通知 A 可以发车了
    if (plan.approver_id) {
      createNotification([plan.approver_id], 'workflow_pending', '🟢 全员已签收', `任务「${plan.title}」所有成员已确认签收，您可以发起任务了`, '/my-goals');
    }
  }

  return res.json({ code: 0, message: '签收成功' + (allConfirmed ? '，全员已到齐' : '') });
});

// R/A 拒签
router.post('/plans/:id/reject-receipt', authMiddleware, async (req: AuthRequest, res) => {
  const db = getDb();
  const planId = Number(req.params.id);
  const { reason } = req.body;
  const plan = db.prepare('SELECT * FROM perf_plans WHERE id = ?').get(planId) as any;
  if (!plan) return res.status(404).json({ code: 404, message: '计划不存在' });
  if (plan.status !== 'pending_receipt') return res.status(400).json({ code: 400, message: '当前状态非待签收' });

  let receiptStatus: Record<string, string> = {};
  try { receiptStatus = JSON.parse(plan.receipt_status || '{}'); } catch {}

  if (!receiptStatus[req.userId!]) {
    return res.status(403).json({ code: 403, message: '您不在签收名单中' });
  }

  receiptStatus[req.userId!] = 'rejected';
  // 拒签 → 退回给发派主管重新编辑
  db.prepare(`UPDATE perf_plans SET status = 'draft', receipt_status = ?, reject_reason = ?, updated_at = ? WHERE id = ?`)
    .run(JSON.stringify(receiptStatus), reason || '成员拒签', new Date().toISOString(), planId);

  db.prepare('INSERT INTO perf_logs (plan_id, user_id, action, old_value, new_value, comment) VALUES (?, ?, ?, ?, ?, ?)')
    .run(planId, req.userId, 'reject_receipt', 'pending_receipt', 'draft', reason || '拒绝签收');

  // 通知主管
  const { createNotification } = await import('./notifications');
  const rejecterName = (db.prepare('SELECT name FROM users WHERE id = ?').get(req.userId) as any)?.name || req.userId;
  createNotification([plan.creator_id], 'workflow_error', '🔴 任务签收被拒', `${rejecterName} 拒绝签收任务「${plan.title}」，原因：${reason || '未说明'}`, '/my-goals');

  return res.json({ code: 0, message: '已拒签，任务退回给主管重新编辑' });
});

// A 独占发车权：全员签收后，仅 A 可将 pending_receipt → in_progress
router.post('/plans/:id/start-task', authMiddleware, async (req: AuthRequest, res) => {
  const db = getDb();
  const planId = Number(req.params.id);
  const plan = db.prepare('SELECT * FROM perf_plans WHERE id = ?').get(planId) as any;
  if (!plan) return res.status(404).json({ code: 404, message: '计划不存在' });
  if (plan.status !== 'pending_receipt') return res.status(400).json({ code: 400, message: '当前状态非待签收' });

  // 发车权限: 允许负责人(A)或执行人(R)发车
  const isR = typeof plan.assignee_id === 'string' && plan.assignee_id.toLowerCase().includes(String(req.userId).toLowerCase());
  const isA = typeof plan.approver_id === 'string' && plan.approver_id.toLowerCase() === String(req.userId).toLowerCase();
  
  if (!isR && !isA && !isGM(req.userId) && !isSuperAdmin(req.userId)) {
    return res.status(403).json({ code: 403, message: '仅执行人(R)或负责人(A)可发起任务' });
  }

  // 检查全员签收
  let receiptStatus: Record<string, string> = {};
  try { receiptStatus = JSON.parse(plan.receipt_status || '{}'); } catch {}
  const pendingUsers = Object.entries(receiptStatus).filter(([_, s]) => s !== 'confirmed');
  if (pendingUsers.length > 0) {
    const names = pendingUsers.map(([uid]) => {
      const u = db.prepare('SELECT name FROM users WHERE id = ?').get(uid) as any;
      return u?.name || uid;
    });
    return res.status(400).json({ code: 400, message: `以下成员尚未签收: ${names.join('、')}` });
  }

  const result = await transitionPlan(planId, 'in_progress', req.userId!);
  if (result.success) {
    db.prepare('INSERT INTO perf_logs (plan_id, user_id, action, old_value, new_value, comment) VALUES (?, ?, ?, ?, ?, ?)')
      .run(planId, req.userId, 'start_task', 'pending_receipt', 'in_progress', 'A发车，任务启动');
  }

  return res.json({ code: result.success ? 0 : 400, message: result.success ? '🚀 任务已启动！' : result.message });
});

// 更新进度
router.put('/plans/:id/progress', authMiddleware, (req: AuthRequest, res) => {
  const { progress, comment } = req.body;
  const db = getDb();
  const plan = db.prepare('SELECT progress FROM perf_plans WHERE id = ?').get(req.params.id) as any;
  if (!plan) return res.status(404).json({ code: 404, message: '计划不存在' });

  db.prepare('UPDATE perf_plans SET progress = ?, updated_at = ? WHERE id = ?').run(progress, new Date().toISOString(), req.params.id);
  db.prepare('INSERT INTO perf_logs (plan_id, user_id, action, old_value, new_value, comment) VALUES (?, ?, ?, ?, ?, ?)').run(req.params.id, req.userId, 'progress_update', String(plan.progress), String(progress), comment);
  logAudit({ businessType: 'perf_plan', businessId: Number(req.params.id), actorId: req.userId!, action: 'progress_update', extra: { from: plan.progress, to: progress } });

  return res.json({ code: 0, message: '进度已更新' });
});

// 进度日志
router.get('/plans/:id/logs', authMiddleware, (req, res) => {
  const db = getDb();
  const logs = db.prepare(
    `SELECT pl.*, u.name as user_name FROM perf_logs pl LEFT JOIN users u ON pl.user_id = u.id WHERE pl.plan_id = ? ORDER BY pl.created_at ASC`
  ).all(req.params.id);
  return res.json({ code: 0, data: logs });
});

// 我的待审批列表
router.get('/my-approvals', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const plans = db.prepare("SELECT * FROM perf_plans WHERE approver_id = ? AND status = 'pending_review' ORDER BY created_at DESC").all(req.userId);
  return res.json({ code: 0, data: plans });
});

// 历史绩效记录
router.get('/history', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const plans = db.prepare("SELECT * FROM perf_plans WHERE (creator_id = ? OR (',' || assignee_id || ',' LIKE '%,' || ? || ',%')) AND status = 'completed' ORDER BY created_at DESC").all(req.userId, req.userId);
  return res.json({ code: 0, data: plans });
});

// 我的团队及成员任务状态
router.get('/team-status', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const currentUser = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId) as any;
  if (!currentUser) return res.status(401).json({ code: 401, message: '未授权' });

  let subordinates: any[] = [];
  const perms = getUserEffectivePerms(req.userId!);
  const canViewDept = perms.includes('view_dept_data');

  const userRow = db.prepare('SELECT department_id FROM users WHERE id = ?').get(req.userId) as any;
  const userDeptId = userRow?.department_id;

  // ── 优先：检查是否存在自定义团队可视范围配置 ──────────────────────────
  // 如果 HR/管理员为该用户配置了自定义范围，完全替换部门推算逻辑
  const scopeRows = db.prepare(
    'SELECT member_id FROM team_view_scopes WHERE manager_id = ?'
  ).all(req.userId) as any[];

  if (scopeRows.length > 0) {
    const memberIds = scopeRows.map((r: any) => r.member_id);
    const placeholders = memberIds.map(() => '?').join(',');
    subordinates = db.prepare(
      `SELECT id, name, title, avatar_url, role FROM users WHERE id IN (${placeholders}) AND status = ?`
    ).all(...memberIds, 'active');
  } else {
  // ── 默认：按部门归属推算 ──────────────────────────────────────────────
  const leaderDepts = db.prepare('SELECT id FROM departments WHERE leader_user_id = ?').all(req.userId) as any[];
  
  let deptIds = new Set<any>();
  if (userDeptId) deptIds.add(userDeptId);
  leaderDepts.forEach(d => deptIds.add(d.id));
  
  const finalDeptIds = Array.from(deptIds);

  if (finalDeptIds.length > 0) {
    if (canViewDept) {
      const placeholders = finalDeptIds.map(() => '?').join(',');
      subordinates = db.prepare(
        `SELECT id, name, title, avatar_url, role FROM users WHERE department_id IN (${placeholders}) AND status = ?`
      ).all(...finalDeptIds, 'active');
    } else {
      const allowedDeptIds = Array.from(deptIds).filter(id => id !== userDeptId || leaderDepts.some(ld => ld.id === id));
      let baseSubordinates = db.prepare(
        `SELECT id, name, title, avatar_url, role FROM users WHERE id = ? AND status = ?`
      ).all(req.userId, 'active');

      if (allowedDeptIds.length > 0) {
        const placeholders = allowedDeptIds.map(() => '?').join(',');
        const extraSubordinates = db.prepare(
          `SELECT id, name, title, avatar_url, role FROM users WHERE department_id IN (${placeholders}) AND status = ? AND id != ?`
        ).all(...allowedDeptIds, 'active', req.userId);
        baseSubordinates = baseSubordinates.concat(extraSubordinates);
      }
      subordinates = baseSubordinates;
    }
  } else {
    subordinates = db.prepare(
        `SELECT id, name, title, avatar_url, role FROM users WHERE id = ? AND status = ?`
    ).all(req.userId, 'active');
  }
  } // end else (default dept logic)

  // 使用真实数据：平均分 + 任务列表
  for (let sub of subordinates) {
    const plans = db.prepare(`SELECT id, title, status, deadline, progress, description, target_value, category, quarter, score, bonus FROM perf_plans WHERE (',' || assignee_id || ',' LIKE '%,' || ? || ',%') AND status != 'draft' ORDER BY deadline ASC`).all(sub.id);
    sub.tasks = plans;
    const avgScore = (db.prepare("SELECT AVG(score) as avg FROM perf_plans WHERE (',' || assignee_id || ',' LIKE '%,' || ? || ',%') AND score IS NOT NULL").get(sub.id) as any)?.avg;
    sub.score = avgScore ? Math.round(avgScore * 10) / 10 : null;
  }

  return res.json({ code: 0, data: subordinates });
});

export default router;
