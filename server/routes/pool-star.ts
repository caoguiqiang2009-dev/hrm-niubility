/**
 * 赏金榜 STAR 报告路由
 * POST   /api/pool/star/:taskId        提交/更新自己的 STAR（R/A 角色）
 * GET    /api/pool/star/:taskId/mine   获取我的 STAR
 * GET    /api/pool/star/:taskId        获取任务所有人 STAR（A/HR/Admin）
 * POST   /api/pool/star/:taskId/remind 催办未填成员（A角色）
 */
import { Router } from 'express';
import { getDb } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { sendMarkdownMessage } from '../services/message';

const router = Router();

// ── 辅助：获取任务的 R/A 成员列表
function getRaMembers(db: any, taskId: number) {
  return db.prepare(`
    SELECT prc.user_id, prc.role_name, u.name, u.id as uid
    FROM pool_role_claims prc
    LEFT JOIN users u ON prc.user_id = u.id
    WHERE prc.pool_task_id = ? AND prc.role_name IN ('R', 'A')
  `).all(taskId) as any[];
}

// ── 辅助：检查当前用户是否是 R 或 A
function isRaRole(db: any, taskId: number, userId: string) {
  const claim = db.prepare(
    `SELECT * FROM pool_role_claims WHERE pool_task_id = ? AND user_id = ? AND role_name IN ('R', 'A')`
  ).get(taskId, userId) as any;
  return claim || null;
}

// ── 辅助：检查当前用户是否是 A
function isAccountable(db: any, taskId: number, userId: string) {
  return db.prepare(
    `SELECT * FROM pool_role_claims WHERE pool_task_id = ? AND user_id = ? AND role_name = 'A'`
  ).get(taskId, userId);
}

// POST /api/pool/star/:taskId — 提交/更新我的 STAR
router.post('/:taskId', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const taskId = parseInt(req.params.taskId);
  const userId = req.userId!;

  // 鉴权：必须是 R 或 A
  const claim = isRaRole(db, taskId, userId);
  if (!claim) {
    return res.status(403).json({ code: 403, message: '仅 R/A 角色可填写 STAR 报告' });
  }

  // 已提交的不允许修改
  const existing = db.prepare(
    `SELECT * FROM pool_star_reports WHERE pool_task_id = ? AND user_id = ?`
  ).get(taskId, userId) as any;
  if (existing?.is_submitted === 1) {
    return res.status(400).json({ code: 400, message: 'STAR 已提交，不允许再修改' });
  }

  const { situation, task_desc, action, result, submit } = req.body;
  const now = new Date().toISOString();

  if (existing) {
    db.prepare(`
      UPDATE pool_star_reports
      SET situation = ?, task_desc = ?, action = ?, result = ?,
          is_submitted = ?, submitted_at = ?, reward_plan_id = NULL
      WHERE pool_task_id = ? AND user_id = ?
    `).run(
      situation || '', task_desc || '', action || '', result || '',
      submit ? 1 : 0, submit ? now : null,
      taskId, userId
    );
  } else {
    db.prepare(`
      INSERT INTO pool_star_reports (pool_task_id, user_id, role_name, situation, task_desc, action, result, is_submitted, submitted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(taskId, userId, claim.role_name, situation || '', task_desc || '', action || '', result || '', submit ? 1 : 0, submit ? now : null);
  }

  // 如果是提交（不是草稿），更新 pool_role_claims.status
  if (submit) {
    db.prepare(`UPDATE pool_role_claims SET status = 'star_submitted' WHERE pool_task_id = ? AND user_id = ?`).run(taskId, userId);

    // 检查是否所有 R/A 都提交了，通知 A
    const members = getRaMembers(db, taskId);
    const unsubmitted = members.filter((m: any) => {
      const report = db.prepare(`SELECT is_submitted FROM pool_star_reports WHERE pool_task_id = ? AND user_id = ?`).get(taskId, m.user_id) as any;
      return !report || report.is_submitted !== 1;
    });

    if (unsubmitted.length === 0) {
      // 所有 STAR 已提交，通知 A 角色可以发起奖励分配
      const aMembers = members.filter((m: any) => m.role_name === 'A');
      if (aMembers.length > 0) {
        const task = db.prepare('SELECT title FROM pool_tasks WHERE id = ?').get(taskId) as any;
        try {
          sendMarkdownMessage(
            aMembers.map((m: any) => m.user_id),
            `**🎯 所有 STAR 报告已提交！**\n\n> **任务：**${task?.title}\n> 所有参与成员的 STAR 报告已全部完成\n\n现在可以发起**奖励分配方案**了！\n[👉 发起奖励分配](${process.env.APP_URL}/pool)`
          );
        } catch {}
      }
    }
  }

  return res.json({ code: 0, message: submit ? 'STAR 报告已提交' : '草稿已保存' });
});

// GET /api/pool/star/:taskId/mine — 获取我的 STAR
router.get('/:taskId/mine', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const taskId = parseInt(req.params.taskId);
  const userId = req.userId!;

  const report = db.prepare(
    `SELECT * FROM pool_star_reports WHERE pool_task_id = ? AND user_id = ?`
  ).get(taskId, userId);

  return res.json({ code: 0, data: report || null });
});

// GET /api/pool/star/:taskId — 获取任务所有人 STAR（A角色/HR/Admin）
router.get('/:taskId', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const taskId = parseInt(req.params.taskId);
  const userId = req.userId!;

  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId) as any;
  const isA = isAccountable(db, taskId, userId);
  const isHRAdmin = ['hr', 'admin'].includes(user?.role);

  if (!isA && !isHRAdmin) {
    return res.status(403).json({ code: 403, message: '仅 A 角色/HR/Admin 可查看所有 STAR' });
  }

  const members = getRaMembers(db, taskId);
  const reports = db.prepare(
    `SELECT sr.*, u.name FROM pool_star_reports sr LEFT JOIN users u ON sr.user_id = u.id WHERE sr.pool_task_id = ?`
  ).all(taskId) as any[];

  const reportMap = new Map(reports.map((r: any) => [r.user_id, r]));
  const result = members.map((m: any) => ({
    ...m,
    star: reportMap.get(m.user_id) || null,
    star_submitted: (reportMap.get(m.user_id) as any)?.is_submitted === 1,
  }));

  return res.json({ code: 0, data: result });
});

// POST /api/pool/star/:taskId/remind — A 角色催办未填成员
router.post('/:taskId/remind', authMiddleware, async (req: AuthRequest, res) => {
  const db = getDb();
  const taskId = parseInt(req.params.taskId);
  const userId = req.userId!;

  if (!isAccountable(db, taskId, userId)) {
    return res.status(403).json({ code: 403, message: '仅 A 角色可催办' });
  }

  const members = getRaMembers(db, taskId);
  const unsubmitted = members.filter((m: any) => {
    const r = db.prepare(`SELECT is_submitted FROM pool_star_reports WHERE pool_task_id = ? AND user_id = ?`).get(taskId, m.user_id) as any;
    return !r || r.is_submitted !== 1;
  });

  if (unsubmitted.length === 0) {
    return res.json({ code: 0, message: '所有成员已完成 STAR 填写' });
  }

  const task = db.prepare('SELECT title FROM pool_tasks WHERE id = ?').get(taskId) as any;
  const operator = db.prepare('SELECT name FROM users WHERE id = ?').get(userId) as any;

  try {
    await sendMarkdownMessage(
      unsubmitted.map((m: any) => m.user_id),
      `**⏰ STAR 报告催办提醒**\n\n> **任务：**${task?.title}\n> **催办人：**${operator?.name}\n\n请尽快完成 STAR 绩效报告填写，这是发放任务奖励的必要条件！\n[👉 立即填写](${process.env.APP_URL}/pool)`
    );
  } catch {}

  return res.json({ code: 0, message: `已催办 ${unsubmitted.length} 位成员`, data: unsubmitted.map((m: any) => m.name || m.user_id) });
});

export default router;
