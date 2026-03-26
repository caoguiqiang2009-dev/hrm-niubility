import { Router } from 'express';
import { getDb } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { transitionPlan } from '../services/workflow';

const router = Router();

// 创建绩效计划
router.post('/plans', authMiddleware, (req: AuthRequest, res) => {
  const { title, description, category, assignee_id, approver_id, department_id, difficulty, deadline, quarter, alignment, target_value, collaborators } = req.body;
  const db = getDb();

  // 兼容旧表
  try { db.exec("ALTER TABLE perf_plans ADD COLUMN collaborators TEXT"); } catch(e) {}

  const result = db.prepare(
    `INSERT INTO perf_plans (title, description, category, creator_id, assignee_id, approver_id, department_id, difficulty, deadline, quarter, alignment, target_value, collaborators) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(title, description, category, req.userId, assignee_id || req.userId, approver_id, department_id, difficulty, deadline, quarter, alignment, target_value, collaborators || null);

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
  const { title, description, category, difficulty, deadline, quarter, alignment, target_value, collaborators } = req.body;
  const db = getDb();

  db.prepare(
    `UPDATE perf_plans SET title=?, description=?, category=?, difficulty=?, deadline=?, quarter=?, alignment=?, target_value=?, collaborators=?, updated_at=? WHERE id = ? AND status IN ('draft', 'rejected')`
  ).run(title, description, category, difficulty, deadline, quarter, alignment, target_value, collaborators || null, new Date().toISOString(), req.params.id);

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

// 提交审批
router.post('/plans/:id/submit', authMiddleware, async (req: AuthRequest, res) => {
  const result = await transitionPlan(Number(req.params.id), 'pending_review', req.userId!);
  return res.json({ code: result.success ? 0 : 400, message: result.message });
});

// 审批通过
router.post('/plans/:id/approve', authMiddleware, async (req: AuthRequest, res) => {
  const result = await transitionPlan(Number(req.params.id), 'approved', req.userId!);
  return res.json({ code: result.success ? 0 : 400, message: result.message });
});

// 驳回
router.post('/plans/:id/reject', authMiddleware, async (req: AuthRequest, res) => {
  const result = await transitionPlan(Number(req.params.id), 'rejected', req.userId!, { comment: req.body.reason });
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
  const logs = db.prepare('SELECT * FROM perf_logs WHERE plan_id = ? ORDER BY created_at DESC').all(req.params.id);
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
  if (['admin', 'hr'].includes(currentUser.role)) {
    subordinates = db.prepare('SELECT id, name, title, avatar_url, role FROM users WHERE status = ? AND id != ?').all('active', req.userId);
  } else {
    const departments = db.prepare('SELECT id, parent_id FROM departments').all() as any[];
    const leaderDepts = db.prepare('SELECT id FROM departments WHERE leader_user_id = ?').all(req.userId) as any[];
    
    let deptIds = leaderDepts.map(d => d.id);
    
    const findChildren = (parentIds: number[]) => {
      const children = departments.filter(d => parentIds.includes(d.parent_id)).map(d => d.id);
      if (children.length > 0) {
        children.forEach(c => {
          if (!deptIds.includes(c)) deptIds.push(c);
        });
        findChildren(children);
      }
    };
    findChildren([...deptIds]);

    if (deptIds.length > 0) {
      const placeholders = deptIds.map(() => '?').join(',');
      subordinates = db.prepare(
        `SELECT id, name, title, avatar_url, role FROM users WHERE department_id IN (${placeholders}) AND status = ? AND id != ?`
      ).all(...deptIds, 'active', req.userId);
    }
  }

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
