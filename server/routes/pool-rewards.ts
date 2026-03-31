/**
 * 赏金榜奖励分配路由
 * POST /api/pool/rewards/initiate/:taskId  A 角色发起草稿
 * GET  /api/pool/rewards/:id               获取分配详情
 * PUT  /api/pool/rewards/:id               更新草稿
 * POST /api/pool/rewards/:id/submit        提交 HR 审核
 * POST /api/pool/rewards/:id/hr-review     HR 审核
 * POST /api/pool/rewards/:id/admin-confirm 总经理确认
 * GET  /api/pool/rewards                   台账列表（HR/Admin）
 * GET  /api/pool/rewards/task/:taskId      获取任务的奖励方案
 */
import { Router } from 'express';
import { getDb } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { sendMarkdownMessage } from '../services/message';

const router = Router();

const APP_URL = process.env.APP_URL || 'http://localhost:5173';

// ── 辅助：检查 A 角色
function getAccountable(db: any, taskId: number, userId: string) {
  return db.prepare(
    `SELECT * FROM pool_role_claims WHERE pool_task_id = ? AND user_id = ? AND role_name = 'A'`
  ).get(taskId, userId);
}

// ── 辅助：获取 R/A 成员（带 STAR 状态）
function getRaMembersWithStar(db: any, taskId: number) {
  const members = db.prepare(`
    SELECT prc.user_id, prc.role_name, u.name
    FROM pool_role_claims prc
    LEFT JOIN users u ON prc.user_id = u.id
    WHERE prc.pool_task_id = ? AND prc.role_name IN ('R', 'A')
  `).all(taskId) as any[];

  return members.map((m: any) => {
    const star = db.prepare(
      `SELECT is_submitted, submitted_at FROM pool_star_reports WHERE pool_task_id = ? AND user_id = ?`
    ).get(taskId, m.user_id) as any;
    return { ...m, star_submitted: star?.is_submitted === 1, star_submitted_at: star?.submitted_at };
  });
}

// POST /api/pool/rewards/initiate/:taskId — 发起草稿（幂等，已有则返回已有）
router.post('/initiate/:taskId', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const taskId = parseInt(req.params.taskId);
  const userId = req.userId!;

  if (!getAccountable(db, taskId, userId)) {
    return res.status(403).json({ code: 403, message: '仅 A 角色可发起奖励分配' });
  }

  const task = db.prepare('SELECT * FROM pool_tasks WHERE id = ?').get(taskId) as any;
  if (!task) return res.status(404).json({ code: 404, message: '任务不存在' });

  // 【风险1修复】仅允许 completed / terminated 状态发起奖励（删除 in_progress）
  if (!['completed', 'terminated'].includes(task.status)) {
    return res.status(400).json({ code: 400, message: '任务尚未完成或终止，无法发起奖励分配' });
  }

  // 检查所有 R/A 的 STAR 是否全部提交
  const members = getRaMembersWithStar(db, taskId);
  const unsubmitted = members.filter((m: any) => !m.star_submitted);
  if (unsubmitted.length > 0) {
    return res.status(400).json({
      code: 400,
      message: `以下成员尚未提交 STAR 报告：${unsubmitted.map((m: any) => m.name || m.user_id).join('、')}`,
      data: { unsubmitted }
    });
  }

  // 幂等：如已有草稿，直接返回
  const existing = db.prepare(
    `SELECT * FROM pool_reward_plans WHERE pool_task_id = ? AND initiator_id = ? AND status = 'draft'`
  ).get(taskId, userId) as any;

  if (existing) {
    const distributions = db.prepare(
      `SELECT prd.*, u.name FROM pool_reward_distributions prd LEFT JOIN users u ON prd.user_id = u.id WHERE prd.reward_plan_id = ?`
    ).all(existing.id);
    return res.json({ code: 0, data: { plan: existing, distributions, members } });
  }

  // 创建新草稿
  const result = db.prepare(`
    INSERT INTO pool_reward_plans (pool_task_id, initiator_id, total_bonus, reward_type, status)
    VALUES (?, ?, ?, ?, 'draft')
  `).run(taskId, userId, task.bonus || 0, task.reward_type || 'money');

  const planId = result.lastInsertRowid;

  // 预填每位 R/A 成员（金额0，等 A 填写）
  const insertDist = db.prepare(`
    INSERT INTO pool_reward_distributions (reward_plan_id, pool_task_id, user_id, role_name)
    VALUES (?, ?, ?, ?)
  `);
  for (const m of members) {
    insertDist.run(planId, taskId, m.user_id, m.role_name);
  }

  const plan = db.prepare('SELECT * FROM pool_reward_plans WHERE id = ?').get(planId);
  const distributions = db.prepare(
    `SELECT prd.*, u.name FROM pool_reward_distributions prd LEFT JOIN users u ON prd.user_id = u.id WHERE prd.reward_plan_id = ?`
  ).all(planId);

  return res.json({ code: 0, data: { plan, distributions, members } });
});

// GET /api/pool/rewards/task/:taskId — 获取某任务的奖励方案
router.get('/task/:taskId', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const taskId = parseInt(req.params.taskId);
  const userId = req.userId!;

  const plan = db.prepare(
    `SELECT prp.*, u.name as initiator_name
     FROM pool_reward_plans prp LEFT JOIN users u ON prp.initiator_id = u.id
     WHERE prp.pool_task_id = ? ORDER BY prp.created_at DESC LIMIT 1`
  ).get(taskId) as any;

  if (!plan) return res.json({ code: 0, data: null });

  const distributions = db.prepare(
    `SELECT prd.*, u.name FROM pool_reward_distributions prd LEFT JOIN users u ON prd.user_id = u.id WHERE prd.reward_plan_id = ?`
  ).all(plan.id);

  const members = getRaMembersWithStar(db, taskId);

  return res.json({ code: 0, data: { plan, distributions, members } });
});

// GET /api/pool/rewards/:id — 获取分配详情
router.get('/:id', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const planId = parseInt(req.params.id);
  const userId = req.userId!;
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId) as any;

  const plan = db.prepare('SELECT * FROM pool_reward_plans WHERE id = ?').get(planId) as any;
  if (!plan) return res.status(404).json({ code: 404, message: '分配方案不存在' });

  const isOwner = plan.initiator_id === userId;
  const isHRAdmin = ['hr', 'admin'].includes(user?.role);
  if (!isOwner && !isHRAdmin) return res.status(403).json({ code: 403, message: '无权查看' });

  const distributions = db.prepare(
    `SELECT prd.*, u.name FROM pool_reward_distributions prd LEFT JOIN users u ON prd.user_id = u.id WHERE prd.reward_plan_id = ?`
  ).all(planId);

  const members = getRaMembersWithStar(db, plan.pool_task_id);

  return res.json({ code: 0, data: { plan, distributions, members } });
});

// PUT /api/pool/rewards/:id — 更新草稿
router.put('/:id', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const planId = parseInt(req.params.id);
  const userId = req.userId!;

  const plan = db.prepare('SELECT * FROM pool_reward_plans WHERE id = ?').get(planId) as any;
  if (!plan || plan.status !== 'draft') return res.status(400).json({ code: 400, message: '只能修改草稿状态的方案' });
  if (plan.initiator_id !== userId) return res.status(403).json({ code: 403, message: '无权修改' });

  const { distributions, attachments } = req.body;

  // 校验奖金总额
  if (distributions) {
    const total = (distributions as any[]).reduce((s: number, d: any) => s + (Number(d.bonus_amount) || 0), 0);
    if (total > plan.total_bonus) {
      return res.status(400).json({
        code: 400,
        message: `分配奖金 ¥${total} 超出奖金池 ¥${plan.total_bonus}，超出 ¥${(total - plan.total_bonus).toFixed(2)}`
      });
    }

    // 更新每人分配
    for (const d of distributions as any[]) {
      db.prepare(`
        UPDATE pool_reward_distributions
        SET bonus_amount = ?, perf_score = ?
        WHERE reward_plan_id = ? AND user_id = ?
      `).run(Number(d.bonus_amount) || 0, Number(d.perf_score) || 0, planId, d.user_id);
    }
  }

  if (attachments !== undefined) {
    db.prepare(`UPDATE pool_reward_plans SET attachments = ?, updated_at = ? WHERE id = ?`)
      .run(JSON.stringify(attachments), new Date().toISOString(), planId);
  }

  return res.json({ code: 0, message: '草稿已保存' });
});

// POST /api/pool/rewards/:id/submit — 提交 HR 审核
router.post('/:id/submit', authMiddleware, async (req: AuthRequest, res) => {
  const db = getDb();
  const planId = parseInt(req.params.id);
  const userId = req.userId!;

  const plan = db.prepare('SELECT * FROM pool_reward_plans WHERE id = ?').get(planId) as any;
  if (!plan || plan.status !== 'draft') return res.status(400).json({ code: 400, message: '只能提交草稿状态的方案' });
  if (plan.initiator_id !== userId) return res.status(403).json({ code: 403, message: '无权提交' });

  // 提交前最终校验 STAR
  const members = getRaMembersWithStar(db, plan.pool_task_id);
  const unsubmitted = members.filter((m: any) => !m.star_submitted);
  if (unsubmitted.length > 0) {
    return res.status(400).json({
      code: 400,
      message: `以下成员 STAR 未提交，无法提交奖励方案：${unsubmitted.map((m: any) => m.name || m.user_id).join('、')}`
    });
  }

  // 提交前检查附件
  const attachments = JSON.parse(plan.attachments || '[]');
  if (attachments.length === 0) {
    return res.status(400).json({ code: 400, message: '请上传至少一份验收附件后再提交' });
  }

  const now = new Date().toISOString();
  db.prepare(`UPDATE pool_reward_plans SET status = 'pending_hr', updated_at = ? WHERE id = ?`).run(now, planId);

  const task = db.prepare('SELECT title FROM pool_tasks WHERE id = ?').get(plan.pool_task_id) as any;
  const operator = db.prepare('SELECT name FROM users WHERE id = ?').get(userId) as any;

  // 通知所有 HR
  const hrs = db.prepare(`SELECT id FROM users WHERE role IN ('hr', 'admin')`).all() as any[];
  try {
    await sendMarkdownMessage(
      hrs.map((u: any) => u.id),
      `**🎯 奖励分配方案待审核**\n\n> **任务：**${task?.title}\n> **发起人：**${operator?.name}\n> **总奖金：**¥${plan.total_bonus}\n\n请在系统中审核此奖励分配方案\n[👉 立即审核](${APP_URL}/pool)`
    );
  } catch {}

  return res.json({ code: 0, message: '已提交 HR 审核，等待审核结果' });
});

// POST /api/pool/rewards/:id/hr-review — HR 审核
router.post('/:id/hr-review', authMiddleware, async (req: AuthRequest, res) => {
  const db = getDb();
  const planId = parseInt(req.params.id);
  const userId = req.userId!;

  const plan = db.prepare('SELECT * FROM pool_reward_plans WHERE id = ?').get(planId) as any;
  if (!plan || plan.status !== 'pending_hr') return res.status(400).json({ code: 400, message: '状态不符' });

  const { isGM, isSuperAdmin } = await import('../middleware/auth');
  const isAdminOrGM = isGM(userId) || isSuperAdmin(userId);

  const { WorkflowEngine, WORKFLOWS } = await import('../services/workflow-engine');
  const nodes = WorkflowEngine.resolveAssignees(WORKFLOWS.REWARD_PLAN, { initiatorId: plan.initiator_id });
  const node2 = nodes.find(n => n.seq === 2); // HRBP
  const hrbpIds = node2?.assignees || [];

  if (!hrbpIds.includes(userId) && !isAdminOrGM) {
     return res.status(403).json({ code: 403, message: '仅分配的 HRBP 或高管可审核' });
  }

  const user = db.prepare('SELECT role, name FROM users WHERE id = ?').get(userId) as any;

  const { action, comment, distributions } = req.body;
  if (!['approve', 'reject'].includes(action)) return res.status(400).json({ code: 400, message: '无效操作' });

  const now = new Date().toISOString();

  // 允许 HR 调整分配明细
  if (distributions && action === 'approve') {
    const total = (distributions as any[]).reduce((s: number, d: any) => s + (Number(d.bonus_amount) || 0), 0);
    if (total > plan.total_bonus) {
      return res.status(400).json({ code: 400, message: `调整后分配总额 ¥${total} 超出奖金池` });
    }
    for (const d of distributions as any[]) {
      db.prepare(`UPDATE pool_reward_distributions SET bonus_amount = ?, perf_score = ? WHERE reward_plan_id = ? AND user_id = ?`)
        .run(Number(d.bonus_amount) || 0, Number(d.perf_score) || 0, planId, d.user_id);
    }
  }

  const newStatus = action === 'approve' ? 'pending_admin' : 'draft';
  db.prepare(`
    UPDATE pool_reward_plans SET status = ?, hr_reviewer_id = ?, hr_comment = ?, hr_reviewed_at = ?, updated_at = ? WHERE id = ?
  `).run(newStatus, userId, comment || '', now, now, planId);

  const task = db.prepare('SELECT title FROM pool_tasks WHERE id = ?').get(plan.pool_task_id) as any;

  if (action === 'approve') {
    // 通知总经理
    const admins = db.prepare(`SELECT id FROM users WHERE role = 'admin'`).all() as any[];
    try {
      await sendMarkdownMessage(
        admins.map((u: any) => u.id),
        `**🎯 奖励分配方案待最终确认**\n\n> **任务：**${task?.title}\n> **HR 审核：**${user?.name} 已通过\n> **总奖金：**¥${plan.total_bonus}\n\n请最终确认并批准此方案\n[👉 立即确认](${APP_URL}/pool)`
      );
    } catch {}
  } else {
    // 通知发起人驳回
    try {
      await sendMarkdownMessage(
        [plan.initiator_id],
        `**❌ 奖励分配方案被驳回**\n\n> **任务：**${task?.title}\n> **HR 审核意见：**${comment || '无'}\n\n请修改后重新提交\n[👉 查看详情](${APP_URL}/pool)`
      );
    } catch {}
  }

  return res.json({ code: 0, message: action === 'approve' ? '已通过，等待总经理确认' : '已驳回，已通知发起人' });
});

// POST /api/pool/rewards/:id/admin-confirm — 总经理确认
router.post('/:id/admin-confirm', authMiddleware, async (req: AuthRequest, res) => {
  const db = getDb();
  const planId = parseInt(req.params.id);
  const userId = req.userId!;

  const plan = db.prepare('SELECT * FROM pool_reward_plans WHERE id = ?').get(planId) as any;
  if (!plan || plan.status !== 'pending_admin') return res.status(400).json({ code: 400, message: '状态不符' });

  const { isGM, isSuperAdmin } = await import('../middleware/auth');
  const isAdminOrGM = isGM(userId) || isSuperAdmin(userId);

  const { WorkflowEngine, WORKFLOWS } = await import('../services/workflow-engine');
  const nodes = WorkflowEngine.resolveAssignees(WORKFLOWS.REWARD_PLAN, { initiatorId: plan.initiator_id });
  const node3 = nodes.find(n => n.seq === 3); // GM
  const adminIds = node3?.assignees || [];

  if (!adminIds.includes(userId) && !isAdminOrGM) {
     return res.status(403).json({ code: 403, message: '仅分配的总经理/高管可最终确认' });
  }

  const user = db.prepare('SELECT role, name FROM users WHERE id = ?').get(userId) as any;

  const { action, comment } = req.body;
  if (!['approve', 'reject'].includes(action)) return res.status(400).json({ code: 400, message: '无效操作' });

  const now = new Date().toISOString();

  if (action === 'reject') {
    // 退回 HR 重审
    db.prepare(`
      UPDATE pool_reward_plans SET status = 'pending_hr', admin_comment = ?, updated_at = ? WHERE id = ?
    `).run(comment || '', now, planId);
    return res.json({ code: 0, message: '已退回 HR 重审' });
  }

  // 批准：计算 pay_period = 下个月
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  const payPeriod = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  db.prepare(`
    UPDATE pool_reward_plans
    SET status = 'approved', admin_reviewer_id = ?, admin_comment = ?, admin_reviewed_at = ?, pay_period = ?, updated_at = ?
    WHERE id = ?
  `).run(userId, comment || '', now, payPeriod, now, planId);

  // 【风险4修复】Admin 批准奖励 → 同步任务状态为 rewarded
  db.prepare(`UPDATE pool_tasks SET status = 'rewarded' WHERE id = ?`).run(plan.pool_task_id);

  const task = db.prepare('SELECT title FROM pool_tasks WHERE id = ?').get(plan.pool_task_id) as any;
  const distributions = db.prepare(
    `SELECT prd.*, u.name FROM pool_reward_distributions prd LEFT JOIN users u ON prd.user_id = u.id WHERE prd.reward_plan_id = ?`
  ).all(planId) as any[];

  // 给每位 R/A 发奖励通知
  try {
    for (const d of distributions) {
      if (!d.user_id) continue;
      let msg = `**🎉 恭喜！您有一笔任务奖励即将发放**\n\n> **任务：**${task?.title}\n> **发放月份：**${payPeriod}`;
      if (d.bonus_amount > 0) msg += `\n> **奖金：**¥${d.bonus_amount}`;
      if (d.perf_score > 0) msg += `\n> **绩效加分：**+${d.perf_score}分`;
      msg += `\n\n将随 ${payPeriod} 工资一并发放，请留意到账情况`;
      await sendMarkdownMessage([d.user_id], msg);
    }
  } catch {}

  return res.json({ code: 0, message: `奖励方案已批准，将于 ${payPeriod} 发放` });
});

// POST /api/pool/rewards/:id/mark-paid — 【风险6】HR/Admin 确认实际发放
router.post('/:id/mark-paid', authMiddleware, async (req: AuthRequest, res) => {
  const db = getDb();
  const planId = parseInt(req.params.id);
  const userId = req.userId!;
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId) as any;

  if (!['hr', 'admin'].includes(user?.role)) {
    return res.status(403).json({ code: 403, message: '仅 HR/Admin 可确认发放' });
  }

  const plan = db.prepare('SELECT * FROM pool_reward_plans WHERE id = ?').get(planId) as any;
  if (!plan) return res.status(404).json({ code: 404, message: '方案不存在' });
  if (plan.status !== 'approved') {
    return res.status(400).json({ code: 400, message: '仅已批准的方案可标记发放' });
  }

  const now = new Date().toISOString();
  db.prepare(`UPDATE pool_reward_plans SET status = 'paid', paid_at = ?, updated_at = ? WHERE id = ?`).run(now, now, planId);
  // 同步每人 paid_at
  db.prepare(`UPDATE pool_reward_distributions SET paid_at = ? WHERE reward_plan_id = ?`).run(now, planId);

  const task = db.prepare('SELECT title FROM pool_tasks WHERE id = ?').get(plan.pool_task_id) as any;
  const distributions = db.prepare(
    `SELECT prd.user_id, prd.bonus_amount, prd.perf_score FROM pool_reward_distributions prd WHERE prd.reward_plan_id = ?`
  ).all(planId) as any[];

  try {
    for (const d of distributions) {
      if (!d.user_id) continue;
      let msg = `**✅ 任务奖励已确认发放**\n\n> **任务：**${task?.title}\n> **发放时间：**${now.slice(0, 10)}`;
      if (d.bonus_amount > 0) msg += `\n> **奖金：**¥${d.bonus_amount}`;
      if (d.perf_score > 0) msg += `\n> **绩效加分：**+${d.perf_score}分`;
      await sendMarkdownMessage([d.user_id], msg);
    }
  } catch {}

  return res.json({ code: 0, message: '已标记为已发放' });
});


// GET /api/pool/rewards — 台账列表（HR/Admin）
router.get('/', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const userId = req.userId!;
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId) as any;

  const isHRAdmin = ['hr', 'admin'].includes(user?.role);
  if (!isHRAdmin) return res.status(403).json({ code: 403, message: '无权限' });

  const { status, pay_period } = req.query;
  let sql = `
    SELECT prp.*, pt.title as task_title, pt.bonus as task_bonus,
           u.name as initiator_name, u.name as creator_name
    FROM pool_reward_plans prp
    LEFT JOIN pool_tasks pt ON prp.pool_task_id = pt.id
    LEFT JOIN users u ON prp.initiator_id = u.id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (status) { sql += ` AND prp.status = ?`; params.push(status); }
  if (pay_period) { sql += ` AND prp.pay_period = ?`; params.push(pay_period); }
  sql += ` ORDER BY prp.updated_at DESC LIMIT 100`;

  const plans = db.prepare(sql).all(...params) as any[];

  return res.json({ code: 0, data: plans });
});

export default router;
