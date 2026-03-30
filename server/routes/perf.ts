import { Router } from 'express';
import { getDb } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { transitionPlan } from '../services/workflow';
import { getUserEffectivePerms } from './permissions';

const router = Router();

// 创建绩效计划
router.post('/plans', authMiddleware, (req: AuthRequest, res) => {
  const { title, description, category, assignee_id, approver_id, department_id, difficulty, deadline, quarter, alignment, target_value, collaborators, attachments } = req.body;
  const db = getDb();

  // 兼容旧表
  try { db.exec("ALTER TABLE perf_plans ADD COLUMN collaborators TEXT"); } catch(e) {}
  try { db.exec("ALTER TABLE perf_plans ADD COLUMN attachments TEXT DEFAULT '[]'"); } catch(e) {}

  const attachmentsStr = attachments ? (typeof attachments === 'string' ? attachments : JSON.stringify(attachments)) : '[]';

  const result = db.prepare(
    `INSERT INTO perf_plans (title, description, category, creator_id, assignee_id, approver_id, department_id, difficulty, deadline, quarter, alignment, target_value, collaborators, attachments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(title, description, category, req.userId, assignee_id || req.userId, approver_id, department_id, difficulty, deadline, quarter, alignment, target_value, collaborators || null, attachmentsStr);

  // 流程异常检测：创建时缺少审批人则通知HR
  const issues: string[] = [];
  if (!approver_id) issues.push('缺少审批人(直属上级)');
  const creatorDeptId = department_id || (db.prepare('SELECT department_id FROM users WHERE id = ?').get(req.userId) as any)?.department_id;
  if (creatorDeptId) {
    const dept = db.prepare('SELECT leader_user_id FROM departments WHERE id = ?').get(creatorDeptId) as any;
    if (!dept?.leader_user_id) issues.push('所属部门无负责人');
  }
  if (issues.length > 0) {
    const { createNotification } = require('./notifications');
    const hrAdmins = db.prepare("SELECT id FROM users WHERE role IN ('hr', 'admin')").all() as any[];
    const hrIds = hrAdmins.map((u: any) => u.id);
    const creatorName = (db.prepare('SELECT name FROM users WHERE id = ?').get(req.userId) as any)?.name || req.userId;
    if (hrIds.length > 0) {
      createNotification(hrIds, 'workflow_error', '⚠️ 流程节点异常', `${creatorName} 创建的绩效计划「${title}」${issues.join('、')}，请前往流程异常管理修复`, '/admin');
    }
  }

  return res.json({ code: 0, data: { id: result.lastInsertRowid } });
});

// 查询绩效列表
router.get('/plans', authMiddleware, (req: AuthRequest, res) => {
  const { status, quarter, category, userId } = req.query;
  const db = getDb();
  let sql = 'SELECT * FROM perf_plans WHERE 1=1';
  const params: any[] = [];

  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (quarter) { sql += ' AND quarter = ?'; params.push(quarter); }
  if (category) { sql += ' AND category = ?'; params.push(category); }
  if (userId) { sql += ' AND (creator_id = ? OR assignee_id = ?)'; params.push(userId, userId); }

  sql += ' ORDER BY created_at DESC';
  const plans = db.prepare(sql).all(...params);
  return res.json({ code: 0, data: plans });
});

// 绩效计划详情
router.get('/plans/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const plan = db.prepare('SELECT * FROM perf_plans WHERE id = ?').get(req.params.id);
  if (!plan) return res.status(404).json({ code: 404, message: '绩效计划不存在' });
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
router.post('/plans/:id/resubmit', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const plan = db.prepare('SELECT * FROM perf_plans WHERE id = ?').get(req.params.id) as any;
  if (!plan) return res.status(404).json({ code: 404, message: '计划不存在' });
  if (plan.status !== 'rejected') return res.json({ code: 400, message: '只有被驳回的计划可以重新提交' });

  // 更新字段（如果 body 有新内容）
  const { title, description, category, target_value, deadline, collaborators } = req.body;
  if (title) {
    db.prepare(
      `UPDATE perf_plans SET title=?, description=?, category=?, target_value=?, deadline=?, collaborators=?, status='pending_review', reject_reason=NULL, updated_at=? WHERE id = ?`
    ).run(title, description, category, target_value, deadline, collaborators || null, new Date().toISOString(), req.params.id);
  } else {
    db.prepare(
      `UPDATE perf_plans SET status='pending_review', reject_reason=NULL, updated_at=? WHERE id = ?`
    ).run(new Date().toISOString(), req.params.id);
  }

  db.prepare('INSERT INTO perf_logs (plan_id, user_id, action, old_value, new_value, comment) VALUES (?, ?, ?, ?, ?, ?)').run(
    req.params.id, req.userId, 'resubmit', 'rejected', 'pending_review', '员工修改后重新提交审批'
  );

  return res.json({ code: 0, message: '已重新提交审批' });
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
  const result = await transitionPlan(Number(req.params.id), 'pending_review', req.userId!);
  return res.json({ code: result.success ? 0 : 400, message: result.message });
});

// 审批通过
router.post('/plans/:id/approve', authMiddleware, async (req: AuthRequest, res) => {
  const db = getDb();
  const planId = Number(req.params.id);
  const plan = db.prepare('SELECT * FROM perf_plans WHERE id = ?').get(planId) as any;
  if (!plan) return res.status(404).json({ code: 404, message: '计划不存在' });

  if (plan.status === 'pending_review') {
    let deptHeadId = null;
    if (plan.department_id) {
      const dept = db.prepare('SELECT leader_user_id FROM departments WHERE id = ?').get(plan.department_id) as any;
      if (dept && dept.leader_user_id) deptHeadId = dept.leader_user_id;
    }

    if (!deptHeadId || deptHeadId === req.userId || deptHeadId === plan.creator_id) {
      if (deptHeadId) db.prepare('UPDATE perf_plans SET dept_head_id = ? WHERE id = ?').run(deptHeadId, planId);
      const result = await transitionPlan(planId, 'approved', req.userId!);
      return res.json({ code: result.success ? 0 : 400, message: result.message });
    } else {
      db.prepare('UPDATE perf_plans SET dept_head_id = ? WHERE id = ?').run(deptHeadId, planId);
      const result = await transitionPlan(planId, 'pending_dept_review', req.userId!);
      return res.json({ code: result.success ? 0 : 400, message: result.message });
    }
  } else if (plan.status === 'pending_dept_review') {
    if (plan.dept_head_id !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ code: 403, message: '无权限' });
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

  if (plan.status === 'pending_dept_review') {
    if (plan.dept_head_id !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ code: 403, message: '无权限' });
    }
  }

  const result = await transitionPlan(planId, 'rejected', req.userId!, { comment: req.body.reason });
  return res.json({ code: result.success ? 0 : 400, message: result.message });
});

// 统一审批操作 (approve / reject / assess / reward)
router.post('/plans/:id/review', authMiddleware, async (req: AuthRequest, res) => {
  const { action, reason, score, bonus } = req.body;
  const planId = Number(req.params.id);

  switch (action) {
    case 'approve': {
      const result = await transitionPlan(planId, 'approved', req.userId!);
      return res.json({ code: result.success ? 0 : 400, message: result.message });
    }
    case 'reject': {
      const result = await transitionPlan(planId, 'rejected', req.userId!, { comment: reason });
      return res.json({ code: result.success ? 0 : 400, message: result.message });
    }
    case 'assess': {
      // pending_assessment → assessed
      const step1 = await transitionPlan(planId, 'pending_assessment', req.userId!);
      if (!step1.success) return res.json({ code: 400, message: step1.message });
      const result = await transitionPlan(planId, 'assessed', req.userId!, { score });
      return res.json({ code: result.success ? 0 : 400, message: result.message });
    }
    case 'reward': {
      const step1 = await transitionPlan(planId, 'pending_reward', req.userId!, { bonus });
      if (!step1.success) return res.json({ code: 400, message: step1.message });
      const result = await transitionPlan(planId, 'completed', req.userId!);
      return res.json({ code: result.success ? 0 : 400, message: result.message });
    }
    default:
      return res.status(400).json({ code: 400, message: `未知操作: ${action}` });
  }
});

// 更新进度
router.put('/plans/:id/progress', authMiddleware, (req: AuthRequest, res) => {
  const { progress, comment } = req.body;
  const db = getDb();
  const plan = db.prepare('SELECT progress FROM perf_plans WHERE id = ?').get(req.params.id) as any;
  if (!plan) return res.status(404).json({ code: 404, message: '计划不存在' });

  db.prepare('UPDATE perf_plans SET progress = ?, updated_at = ? WHERE id = ?').run(progress, new Date().toISOString(), req.params.id);
  db.prepare('INSERT INTO perf_logs (plan_id, user_id, action, old_value, new_value, comment) VALUES (?, ?, ?, ?, ?, ?)').run(req.params.id, req.userId, 'progress_update', String(plan.progress), String(progress), comment);

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
  const plans = db.prepare("SELECT * FROM perf_plans WHERE (creator_id = ? OR assignee_id = ?) AND status = 'completed' ORDER BY created_at DESC").all(req.userId, req.userId);
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
    const plans = db.prepare(`SELECT id, title, status, deadline, progress, description, target_value, category, quarter, score, bonus FROM perf_plans WHERE assignee_id = ? AND status != 'draft' ORDER BY deadline ASC`).all(sub.id);
    sub.tasks = plans;
    const avgScore = (db.prepare("SELECT AVG(score) as avg FROM perf_plans WHERE assignee_id = ? AND score IS NOT NULL").get(sub.id) as any)?.avg;
    sub.score = avgScore ? Math.round(avgScore * 10) / 10 : null;
  }

  return res.json({ code: 0, data: subordinates });
});

export default router;
