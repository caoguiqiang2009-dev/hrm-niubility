import { Router } from 'express';
import { getDb } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// ── 查询所有流程异常的绩效计划 ──
router.get('/broken', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId) as any;
  if (!user || !['admin', 'hr'].includes(user.role)) {
    return res.status(403).json({ code: 403, message: '仅管理员或HR可查看' });
  }

  // 查询所有非终态(非 completed/rejected/rewarded)的绩效计划
  const plans = db.prepare(`
    SELECT pp.*, 
           u1.name as creator_name, u1.department_id as creator_dept_id,
           u2.name as approver_name,
           u3.name as assignee_name,
           u4.name as dept_head_name,
           d.name as dept_name, d.leader_user_id as dept_leader_id
    FROM perf_plans pp
    LEFT JOIN users u1 ON pp.creator_id = u1.id
    LEFT JOIN users u2 ON pp.approver_id = u2.id
    LEFT JOIN users u3 ON pp.assignee_id = u3.id
    LEFT JOIN users u4 ON pp.dept_head_id = u4.id
    LEFT JOIN departments d ON (pp.department_id = d.id OR u1.department_id = d.id)
    WHERE pp.status NOT IN ('completed', 'rejected', 'rewarded')
    ORDER BY pp.created_at DESC
  `).all() as any[];

  // 检测异常
  const broken = plans.filter(p => {
    // 1. 需要审批人但没有 approver_id
    if (['draft', 'pending_review', 'in_progress', 'pending_assessment'].includes(p.status) && !p.approver_id) return true;
    // 2. 需要部门负责人二审但没有
    if (p.status === 'pending_dept_review' && !p.dept_head_id) return true;
    // 3. 没有执行人
    if (['approved', 'in_progress'].includes(p.status) && !p.assignee_id) return true;
    // 4. 部门没有负责人 (将来会卡住)
    if (!p.dept_leader_id && p.status !== 'in_progress') return true;
    return false;
  }).map(p => ({
    ...p,
    issues: [
      ...(!p.approver_id ? ['缺少审批人(直属上级)'] : []),
      ...(!p.dept_head_id && p.status === 'pending_dept_review' ? ['缺少部门负责人(二审)'] : []),
      ...(!p.assignee_id && ['approved', 'in_progress'].includes(p.status) ? ['缺少执行人'] : []),
      ...(!p.dept_leader_id ? ['所属部门无负责人'] : []),
    ]
  }));

  // 同时查询提案的异常
  const proposals = db.prepare(`
    SELECT pt.*, u.name as creator_name
    FROM pool_tasks pt
    LEFT JOIN users u ON pt.created_by = u.id
    WHERE pt.proposal_status IN ('pending_hr', 'pending_admin')
      AND pt.deleted_at IS NULL
    ORDER BY pt.created_at DESC
  `).all() as any[];

  return res.json({ code: 0, data: { plans: broken, proposals, total: broken.length + proposals.length } });
});

// ── 手动修复：指派审批人 ──
router.post('/fix/:planId', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId) as any;
  if (!user || !['admin', 'hr'].includes(user.role)) {
    return res.status(403).json({ code: 403, message: '仅管理员或HR可操作' });
  }

  const { approver_id, assignee_id, dept_head_id } = req.body;
  const planId = Number(req.params.planId);
  const plan = db.prepare('SELECT * FROM perf_plans WHERE id = ?').get(planId) as any;
  if (!plan) return res.status(404).json({ code: 404, message: '计划不存在' });

  const fields: string[] = [];
  const values: any[] = [];

  if (approver_id) { fields.push('approver_id = ?'); values.push(approver_id); }
  if (assignee_id) { fields.push('assignee_id = ?'); values.push(assignee_id); }
  if (dept_head_id) { fields.push('dept_head_id = ?'); values.push(dept_head_id); }

  if (fields.length === 0) return res.json({ code: 400, message: '未提供修复数据' });

  fields.push("updated_at = datetime('now')");
  values.push(planId);
  db.prepare(`UPDATE perf_plans SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  // 如果同时指定了部门负责人，更新部门表
  if (dept_head_id && plan.department_id) {
    db.prepare('UPDATE departments SET leader_user_id = ? WHERE id = ? AND (leader_user_id IS NULL OR leader_user_id = "")').run(dept_head_id, plan.department_id);
  }

  // 如果用户没有 department_id，自动补上
  if (plan.creator_id) {
    const creator = db.prepare('SELECT department_id FROM users WHERE id = ?').get(plan.creator_id) as any;
    if (creator && creator.department_id && !plan.department_id) {
      db.prepare('UPDATE perf_plans SET department_id = ? WHERE id = ?').run(creator.department_id, planId);
    }
  }

  return res.json({ code: 0, message: '流程节点已修复' });
});

// ── 手动修复：设置部门负责人 ──
router.post('/fix-dept/:deptId', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId) as any;
  if (!user || !['admin', 'hr'].includes(user.role)) {
    return res.status(403).json({ code: 403, message: '仅管理员或HR可操作' });
  }

  const { leader_user_id } = req.body;
  if (!leader_user_id) return res.json({ code: 400, message: '请指定负责人' });

  db.prepare('UPDATE departments SET leader_user_id = ? WHERE id = ?').run(leader_user_id, req.params.deptId);
  return res.json({ code: 0, message: '部门负责人已更新' });
});

// ── 获取所有用户列表（用于下拉选择） ──
router.get('/users', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const users = db.prepare("SELECT id, name, role, department_id FROM users WHERE status != 'inactive' ORDER BY name").all();
  return res.json({ code: 0, data: users });
});

export default router;
