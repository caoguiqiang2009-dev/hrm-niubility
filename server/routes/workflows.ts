import { Router } from 'express';
import { getDb } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// 我发起的流程
router.get('/initiated', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const userId = req.userId;

  // Helper fn for attaching logs
  const attachLogs = (items: any[], type: string) => {
    if (items.length === 0) return items;
    const ids = items.map(i => i.id).join(',');
    if (type === 'perf_plan') {
      const logs = db.prepare(`SELECT * FROM perf_logs WHERE plan_id IN (${ids}) ORDER BY created_at ASC`).all();
      items.forEach(i => i.logs = logs.filter((l: any) => l.plan_id === i.id));
    }
    // pool_tasks log structure can be added here if implemented elsewhere
    return items;
  };

  // 1. 我发起的绩效计划
  let perfPlans = db.prepare(
    `SELECT pp.*, u.name as approver_name, 'perf_plan' as flow_type
     FROM perf_plans pp
     LEFT JOIN users u ON pp.approver_id = u.id
     WHERE pp.creator_id = ?
     ORDER BY pp.created_at DESC`
  ).all(userId);
  perfPlans = attachLogs(perfPlans, 'perf_plan');

  // 2. 我提交的提案
  const proposals = db.prepare(
    `SELECT pt.*, 'proposal' as flow_type,
       hr_u.name as hr_reviewer_name, admin_u.name as admin_reviewer_name
     FROM pool_tasks pt
     LEFT JOIN users hr_u ON pt.hr_reviewer_id = hr_u.id
     LEFT JOIN users admin_u ON pt.admin_reviewer_id = admin_u.id
     WHERE pt.created_by = ? AND pt.proposal_status IS NOT NULL AND pt.proposal_status != 'approved'
     ORDER BY pt.created_at DESC`
  ).all(userId);

  // 合并并排序
  const all = [...perfPlans, ...proposals].sort((a: any, b: any) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  return res.json({ code: 0, data: all });
});

// 待我审核的流程
router.get('/pending', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const userId = req.userId;
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId) as any;
  const role = user?.role || 'employee';

  const items: any[] = [];

  // Helper fn for attaching logs
  const attachLogs = (items: any[], type: string) => {
    if (items.length === 0) return items;
    const ids = items.map(i => i.id).join(',');
    if (type === 'perf_plan') {
      const logs = db.prepare(`SELECT * FROM perf_logs WHERE plan_id IN (${ids}) ORDER BY created_at ASC`).all();
      items.forEach(i => i.logs = logs.filter((l: any) => l.plan_id === i.id));
    }
    return items;
  };

  // 1. 待我审批的绩效计划
  let perfPending = db.prepare(
    `SELECT pp.*, u.name as creator_name, au.name as approver_name, 'perf_plan' as flow_type
     FROM perf_plans pp
     LEFT JOIN users u ON pp.creator_id = u.id
     LEFT JOIN users au ON pp.approver_id = au.id
     WHERE pp.approver_id = ? AND pp.status = 'pending_review'
     ORDER BY pp.created_at DESC`
  ).all(userId);
  perfPending = attachLogs(perfPending, 'perf_plan');
  items.push(...perfPending);

  // 2. 待我审核的提案 (HR可审 pending_hr, Admin可审 pending_admin)
  if (['hr', 'admin'].includes(role)) {
    const hrPending = db.prepare(
      `SELECT pt.*, u.name as creator_name, 'proposal' as flow_type,
         hr_u.name as hr_reviewer_name, admin_u.name as admin_reviewer_name
       FROM pool_tasks pt
       LEFT JOIN users u ON pt.created_by = u.id
       LEFT JOIN users hr_u ON pt.hr_reviewer_id = hr_u.id
       LEFT JOIN users admin_u ON pt.admin_reviewer_id = admin_u.id
       WHERE pt.proposal_status = 'pending_hr'
       ORDER BY pt.created_at DESC`
    ).all();
    items.push(...hrPending);
  }
  if (role === 'admin') {
    const adminPending = db.prepare(
      `SELECT pt.*, u.name as creator_name, 'proposal' as flow_type,
         hr_u.name as hr_reviewer_name, admin_u.name as admin_reviewer_name
       FROM pool_tasks pt
       LEFT JOIN users u ON pt.created_by = u.id
       LEFT JOIN users hr_u ON pt.hr_reviewer_id = hr_u.id
       LEFT JOIN users admin_u ON pt.admin_reviewer_id = admin_u.id
       WHERE pt.proposal_status = 'pending_admin'
       ORDER BY pt.created_at DESC`
    ).all();
    items.push(...adminPending);
  }

  items.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return res.json({ code: 0, data: items });
});

// 我已审核的流程
router.get('/reviewed', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const userId = req.userId;

  // Helper fn for attaching logs
  const attachLogs = (items: any[], type: string) => {
    if (items.length === 0) return items;
    const ids = items.map(i => i.id).join(',');
    if (type === 'perf_plan') {
      const logs = db.prepare(`SELECT * FROM perf_logs WHERE plan_id IN (${ids}) ORDER BY created_at ASC`).all();
      items.forEach(i => i.logs = logs.filter((l: any) => l.plan_id === i.id));
    }
    return items;
  };

  // 1. 我审批过的绩效计划
  let perfReviewed = db.prepare(
    `SELECT pp.*, u.name as creator_name, 'perf_plan' as flow_type
     FROM perf_plans pp
     LEFT JOIN users u ON pp.creator_id = u.id
     WHERE pp.approver_id = ? AND pp.status IN ('approved', 'rejected', 'assessed', 'in_progress', 'completed', 'pending_reward', 'pending_assessment')
     ORDER BY pp.updated_at DESC`
  ).all(userId);
  perfReviewed = attachLogs(perfReviewed, 'perf_plan');

  // 2. 我审核过的提案
  const proposalReviewed = db.prepare(
    `SELECT pt.*, u.name as creator_name, 'proposal' as flow_type,
       hr_u.name as hr_reviewer_name, admin_u.name as admin_reviewer_name
     FROM pool_tasks pt
     LEFT JOIN users u ON pt.created_by = u.id
     LEFT JOIN users hr_u ON pt.hr_reviewer_id = hr_u.id
     LEFT JOIN users admin_u ON pt.admin_reviewer_id = admin_u.id
     WHERE pt.hr_reviewer_id = ? OR pt.admin_reviewer_id = ?
     ORDER BY pt.created_at DESC`
  ).all(userId, userId);

  const all = [...perfReviewed, ...proposalReviewed].sort((a: any, b: any) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  return res.json({ code: 0, data: all });
});

// 抄送我的 (我收到的通知类型的流程)
router.get('/cc', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const userId = req.userId;

  // 从通知表中获取和流程相关的通知
  const ccItems = db.prepare(
    `SELECT * FROM notifications
     WHERE user_id = ? AND type IN ('proposal', 'perf', 'system')
     ORDER BY created_at DESC
     LIMIT 50`
  ).all(userId);
  return res.json({ code: 0, data: ccItems });
});

export default router;
