import { Router } from 'express';
import { getDb } from '../config/database';
import { authMiddleware, AuthRequest, isSuperAdmin, isGM, isHRBP } from '../middleware/auth';

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
      const logs = db.prepare(`SELECT pl.*, u.name as user_name FROM perf_logs pl LEFT JOIN users u ON pl.user_id = u.id WHERE pl.plan_id IN (${ids}) ORDER BY pl.created_at ASC`).all();
      items.forEach(i => i.logs = logs.filter((l: any) => l.plan_id === i.id));
    }
    // pool_tasks log structure can be added here if implemented elsewhere
    return items;
  };

  // 1. 我发起的绩效计划（creator_id = 我）
  let myPerfPlans = db.prepare(
    `SELECT pp.*, cu.name as creator_name, u.name as approver_name, 'perf_plan' as flow_type,
            'initiated' as source_type
     FROM perf_plans pp
      LEFT JOIN users cu ON pp.creator_id = cu.id
     LEFT JOIN users u ON pp.approver_id = u.id
     WHERE pp.creator_id = ?
     ORDER BY pp.created_at DESC`
  ).all(userId);
  myPerfPlans = attachLogs(myPerfPlans, 'perf_plan');

  // 1b. 分配给我的绩效计划（assignee_id = 我 AND creator_id ≠ 我）
  let assignedToMe = db.prepare(
    `SELECT pp.*, cu.name as creator_name, u.name as approver_name, 'perf_plan' as flow_type,
            'assigned' as source_type
     FROM perf_plans pp
      LEFT JOIN users cu ON pp.creator_id = cu.id
     LEFT JOIN users u ON pp.approver_id = u.id
     WHERE (',' || pp.assignee_id || ',' LIKE '%,' || ? || ',%') AND pp.creator_id != ? AND pp.status != 'draft'
     ORDER BY pp.created_at DESC`
  ).all(userId, userId);
  assignedToMe = attachLogs(assignedToMe, 'perf_plan');

  // 合并我相关的绩效计划（去重）
  const perfPlanMap = new Map<number, any>();
  [...myPerfPlans, ...assignedToMe].forEach((p: any) => { if (!perfPlanMap.has(p.id)) perfPlanMap.set(p.id, p); });
  const perfPlans = Array.from(perfPlanMap.values());

  // 2. 我提交的提案
  const proposals = db.prepare(
    `SELECT pt.*, 'proposal' as flow_type,
       hr_u.name as hr_reviewer_name, admin_u.name as admin_reviewer_name,
       'initiated' as source_type
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
  const user = db.prepare('SELECT name FROM users WHERE id = ?').get(userId) as any;
  const currentUserName = user?.name || userId;
  const isUserGM = isGM(userId);
  const isUserHRBP = isHRBP(userId);

  const items: any[] = [];

  // Helper fn for attaching logs
  const attachLogs = (items: any[], type: string) => {
    if (items.length === 0) return items;
    const ids = items.map(i => i.id).join(',');
    if (type === 'perf_plan') {
      const logs = db.prepare(`SELECT pl.*, u.name as user_name FROM perf_logs pl LEFT JOIN users u ON pl.user_id = u.id WHERE pl.plan_id IN (${ids}) ORDER BY pl.created_at ASC`).all();
      items.forEach(i => i.logs = logs.filter((l: any) => l.plan_id === i.id));
    }
    return items;
  };

  // 1. 待我审批的绩效计划（【风隖7修复】服务端过滤自己发起的）
  let perfPending = db.prepare(
    `SELECT pp.*, u.name as creator_name, au.name as approver_name, 'perf_plan' as flow_type
     FROM perf_plans pp
     LEFT JOIN users u ON pp.creator_id = u.id
     LEFT JOIN users au ON pp.approver_id = au.id
     WHERE ((pp.approver_id = ? AND pp.status = 'pending_review')
         OR (pp.dept_head_id = ? AND pp.status = 'pending_dept_review'))
       AND pp.creator_id != ?
     ORDER BY pp.created_at DESC`
  ).all(userId, userId, userId);
  perfPending = attachLogs(perfPending, 'perf_plan');
  items.push(...perfPending);

  // 2. 待我审核的提案 (HR可审 pending_hr, Admin可审 pending_admin)【风隖7修复：过滤自己提交的提案】
  if (isUserHRBP || isUserGM) {
    const hrPending = db.prepare(
      `SELECT pt.*, u.name as creator_name, 'proposal' as flow_type,
         hr_u.name as hr_reviewer_name, admin_u.name as admin_reviewer_name
       FROM pool_tasks pt
       LEFT JOIN users u ON pt.created_by = u.id
       LEFT JOIN users hr_u ON pt.hr_reviewer_id = hr_u.id
       LEFT JOIN users admin_u ON pt.admin_reviewer_id = admin_u.id
       WHERE pt.proposal_status = 'pending_hr'
         AND pt.created_by != ?
       ORDER BY pt.created_at DESC`
    ).all(userId);
    hrPending.forEach((p: any) => { p.pending_reviewer_name = currentUserName; });
    items.push(...hrPending);
  }
  if (isUserGM) {
    const adminPending = db.prepare(
      `SELECT pt.*, u.name as creator_name, 'proposal' as flow_type,
         hr_u.name as hr_reviewer_name, admin_u.name as admin_reviewer_name
       FROM pool_tasks pt
       LEFT JOIN users u ON pt.created_by = u.id
       LEFT JOIN users hr_u ON pt.hr_reviewer_id = hr_u.id
       LEFT JOIN users admin_u ON pt.admin_reviewer_id = admin_u.id
       WHERE pt.proposal_status = 'pending_admin'
         AND pt.created_by != ?
       ORDER BY pt.created_at DESC`
    ).all(userId);
    adminPending.forEach((p: any) => { p.pending_reviewer_name = currentUserName; });
    items.push(...adminPending);
  }

  // 3. 待我审核的加入申请 (HR/Admin)
  if (isUserHRBP || isUserGM) {
    try {
      const joinPending = db.prepare(
        `SELECT jr.*, u.name as creator_name, pt.title as task_title, 'pool_join' as flow_type
         FROM pool_join_requests jr
         LEFT JOIN users u ON jr.user_id = u.id
         LEFT JOIN pool_tasks pt ON jr.pool_task_id = pt.id
         WHERE jr.status = 'pending'
         ORDER BY jr.created_at DESC`
      ).all();
      joinPending.forEach((j: any) => {
        j.title = `${j.creator_name || j.user_id} 申请加入「${j.task_title || '任务#' + j.pool_task_id}」`;
        j.proposal_status = 'pending';
        j.pending_reviewer_name = currentUserName;
      });
      items.push(...joinPending);
    } catch (e) {
      console.warn('[workflows/pending] pool_join_requests查询跳过:', (e as any)?.message);
    }

    // 4. 奖励分配方案审核（HR审 pending_hr / Admin审 pending_admin）
    try {
      if (isUserHRBP || isUserGM) {
        const rewardHrPending = db.prepare(
          `SELECT prp.*, pt.title as task_title, u.name as creator_name, 'reward_plan' as flow_type
           FROM pool_reward_plans prp
           LEFT JOIN pool_tasks pt ON prp.pool_task_id = pt.id
           LEFT JOIN users u ON prp.initiator_id = u.id
           WHERE prp.status = 'pending_hr'
             AND prp.initiator_id != ?
           ORDER BY prp.updated_at DESC`
        ).all(userId);
        rewardHrPending.forEach((r: any) => {
          r.title = `「${r.task_title}」奖励分配方案 (HR审核)`;
          r.pending_reviewer_name = currentUserName;
        });
        items.push(...rewardHrPending);
      }
      if (isUserGM) {
        const rewardAdminPending = db.prepare(
          `SELECT prp.*, pt.title as task_title, u.name as creator_name, 'reward_plan' as flow_type
           FROM pool_reward_plans prp
           LEFT JOIN pool_tasks pt ON prp.pool_task_id = pt.id
           LEFT JOIN users u ON prp.initiator_id = u.id
           WHERE prp.status = 'pending_admin'
             AND prp.initiator_id != ?
           ORDER BY prp.updated_at DESC`
        ).all(userId);
        rewardAdminPending.forEach((r: any) => {
          r.title = `「${r.task_title}」奖励分配方案 (总经理确认)`;
          r.pending_reviewer_name = currentUserName;
        });
        items.push(...rewardAdminPending);
      }
    } catch (e) {
      console.warn('[workflows/pending] pool_reward_plans查询跳过:', (e as any)?.message);
    }
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
      const logs = db.prepare(`SELECT pl.*, u.name as user_name FROM perf_logs pl LEFT JOIN users u ON pl.user_id = u.id WHERE pl.plan_id IN (${ids}) ORDER BY pl.created_at ASC`).all();
      items.forEach(i => i.logs = logs.filter((l: any) => l.plan_id === i.id));
    }
    return items;
  };

  // 1. 我审批过的绩效计划
  let perfReviewed = db.prepare(
    `SELECT pp.*, u.name as creator_name, 'perf_plan' as flow_type
     FROM perf_plans pp
     LEFT JOIN users u ON pp.creator_id = u.id
     WHERE (pp.approver_id = ? AND pp.status IN ('pending_dept_review', 'approved', 'rejected', 'assessed', 'in_progress', 'completed', 'pending_reward', 'pending_assessment'))
        OR (pp.dept_head_id = ? AND pp.status IN ('approved', 'rejected', 'assessed', 'in_progress', 'completed', 'pending_reward', 'pending_assessment'))
     ORDER BY pp.updated_at DESC`
  ).all(userId, userId);
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

  // 3. 我审核过的加入申请
  let joinReviewed: any[] = [];
  try {
    joinReviewed = db.prepare(
      `SELECT jr.*, u.name as creator_name, pt.title as task_title, 'pool_join' as flow_type
       FROM pool_join_requests jr
       LEFT JOIN users u ON jr.user_id = u.id
       LEFT JOIN pool_tasks pt ON jr.pool_task_id = pt.id
       WHERE jr.reviewer_id = ? AND jr.status IN ('approved', 'rejected')
       ORDER BY jr.reviewed_at DESC`
    ).all(userId);
    joinReviewed.forEach((j: any) => {
      j.title = `${j.creator_name || j.user_id} 申请加入「${j.task_title || '任务#' + j.pool_task_id}」`;
      j.proposal_status = j.status;
    });
  } catch (e) {
    console.warn('[workflows/reviewed] pool_join_requests查询跳过:', (e as any)?.message);
  }

  const all = [...perfReviewed, ...proposalReviewed, ...joinReviewed].sort((a: any, b: any) =>
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
