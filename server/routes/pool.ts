import { Router } from 'express';
import { getDb } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { createNotification } from './notifications';
import { sendCardMessage } from '../services/message';

const router = Router();

// ── 自动迁移: 添加 deleted_at 列 ──
try {
  const db0 = getDb();
  db0.exec("ALTER TABLE pool_tasks ADD COLUMN deleted_at DATETIME");
} catch(e) { /* column already exists */ }

// 绩效池任务列表 (只显示 proposal_status = 'approved' 且未删除的任务)
router.get('/tasks', authMiddleware, (req, res) => {
  const db = getDb();
  const { status, department } = req.query;
  let sql = "SELECT pt.*, u.name as creator_name FROM pool_tasks pt LEFT JOIN users u ON pt.created_by = u.id WHERE pt.proposal_status = 'approved' AND pt.deleted_at IS NULL";
  const params: any[] = [];
  if (status) { sql += ' AND pt.status = ?'; params.push(status); }
  if (department) { sql += ' AND pt.department = ?'; params.push(department); }
  sql += ' ORDER BY pt.created_at DESC';

  const tasks = db.prepare(sql).all(...params);

  // 附加参与者信息（含姓名）
  const result = tasks.map((t: any) => {
    const participants = db.prepare(
      'SELECT pp.user_id, u2.name as user_name FROM pool_participants pp LEFT JOIN users u2 ON pp.user_id = u2.id WHERE pp.pool_task_id = ?'
    ).all(t.id) as any[];
    return { ...t, participants, current_participants: participants.length, participant_names: participants.map((p: any) => p.user_name).filter(Boolean) };
  });

  return res.json({ code: 0, data: result });
});

// 人员榜单 (统计每个人参与的已完结任务，分为金额和积分)
router.get('/leaderboard', authMiddleware, (req, res) => {
  const db = getDb();
  const sql = `
    SELECT 
      u.id, u.name, d.name as department_name, u.title,
      COUNT(DISTINCT pp.pool_task_id) as total_tasks,
      SUM(CASE WHEN pt.reward_type = 'money' AND pt.status = 'closed' THEN pt.bonus ELSE 0 END) as total_money,
      SUM(CASE WHEN pt.reward_type = 'score' AND pt.status = 'closed' THEN pt.bonus ELSE 0 END) as total_score
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    LEFT JOIN pool_participants pp ON u.id = pp.user_id
    LEFT JOIN pool_tasks pt ON pp.pool_task_id = pt.id
    WHERE u.status = 'active'
    GROUP BY u.id
    ORDER BY total_money DESC, total_score DESC, total_tasks DESC
  `;
  const leaderboard = db.prepare(sql).all();
  return res.json({ code: 0, data: leaderboard });
});

// 员工提议新任务 (任何人都可以提)
router.post('/tasks/propose', authMiddleware, (req: AuthRequest, res) => {
  const { title, description, department, difficulty, reward_type, bonus, max_participants, is_draft } = req.body;
  if (!title) return res.status(400).json({ code: 400, message: '任务标题不能为空' });
  const db = getDb();

  // 新增列兼容：如果旧表没有新增列，尝试 ALTER TABLE
  try { db.exec("ALTER TABLE pool_tasks ADD COLUMN description TEXT"); } catch(e) {}
  try { db.exec("ALTER TABLE pool_tasks ADD COLUMN proposal_status TEXT DEFAULT 'approved'"); } catch(e) {}
  try { db.exec("ALTER TABLE pool_tasks ADD COLUMN hr_reviewer_id TEXT"); } catch(e) {}
  try { db.exec("ALTER TABLE pool_tasks ADD COLUMN admin_reviewer_id TEXT"); } catch(e) {}
  try { db.exec("ALTER TABLE pool_tasks ADD COLUMN reject_reason TEXT"); } catch(e) {}
  try { db.exec("ALTER TABLE pool_tasks ADD COLUMN reward_type TEXT DEFAULT 'money'"); } catch(e) {}

  const proposalStatus = is_draft ? 'draft' : 'pending_hr';

  const result = db.prepare(
    `INSERT INTO pool_tasks (title, description, department, difficulty, reward_type, bonus, max_participants, created_by, status, proposal_status) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`
  ).run(title, description || null, department || null, difficulty || 'normal', reward_type || 'money', bonus || 0, max_participants || 5, req.userId, proposalStatus);

  // 站内通知 HR + Admin
  const hrAdmins = db.prepare("SELECT id FROM users WHERE role IN ('hr', 'admin')").all() as any[];
  const hrAdminIds = hrAdmins.map((u: any) => u.id);
  const proposerName = (db.prepare('SELECT name FROM users WHERE id = ?').get(req.userId) as any)?.name || req.userId;
  if (hrAdminIds.length) {
    createNotification(hrAdminIds, 'proposal', '📋 新提案待审核', `${proposerName} 提议新任务「${title}」，建议奖金 ¥${bonus || 0}`, '/admin?module=pool');
    // 企微推送
    try { sendCardMessage(hrAdminIds, '📋 新提案待审核', `${proposerName} 提议新任务「${title}」\n建议奖金: ¥${bonus || 0}`, `${process.env.APP_URL || 'http://localhost:3000'}/admin`); } catch(e) {}
  }

  return res.json({ code: 0, message: '提案已提交，等待人事审核', data: { id: result.lastInsertRowid } });
});

// 授权用户直接发布任务
router.post('/tasks/publish', authMiddleware, (req: AuthRequest, res) => {
  const { title, description, department, difficulty, reward_type, bonus, max_participants } = req.body;
  if (!title) return res.status(400).json({ code: 400, message: '任务标题不能为空' });
  const db = getDb();

  // 校验权限
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId) as any;
  if (!user || !['admin', 'hr', 'supervisor'].includes(user.role)) {
    return res.status(403).json({ code: 403, message: '权限不足，无法直接发布任务' });
  }

  // 新增列兼容
  try { db.exec("ALTER TABLE pool_tasks ADD COLUMN description TEXT"); } catch(e) {}
  try { db.exec("ALTER TABLE pool_tasks ADD COLUMN proposal_status TEXT DEFAULT 'approved'"); } catch(e) {}
  try { db.exec("ALTER TABLE pool_tasks ADD COLUMN hr_reviewer_id TEXT"); } catch(e) {}
  try { db.exec("ALTER TABLE pool_tasks ADD COLUMN admin_reviewer_id TEXT"); } catch(e) {}
  try { db.exec("ALTER TABLE pool_tasks ADD COLUMN reject_reason TEXT"); } catch(e) {}
  try { db.exec("ALTER TABLE pool_tasks ADD COLUMN reward_type TEXT DEFAULT 'money'"); } catch(e) {}

  const result = db.prepare(
    `INSERT INTO pool_tasks (title, description, department, difficulty, reward_type, bonus, max_participants, created_by, status, proposal_status) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', 'approved')`
  ).run(title, description || null, department || null, difficulty || 'normal', reward_type || 'money', bonus || 0, max_participants || 5, req.userId);

  // 全员通知新任务
  const allUserIds = (db.prepare("SELECT id FROM users").all() as any[]).map(u => u.id);
  if (allUserIds.length) {
    createNotification(allUserIds, 'pool_task', '📢 新公司级任务', `绩效池已发布新任务「${title}」，快来认领吧！`, '/company');
    try { sendCardMessage(allUserIds, '📢 新公司级任务', `绩效池已发布新任务「${title}」\n快来认领吧！`, `${process.env.APP_URL || 'http://localhost:3000'}/company`); } catch(e) {}
  }

  return res.json({ code: 0, message: '任务已直接发布到绩效池', data: { id: result.lastInsertRowid } });
});

// 提案列表 (HR/Admin 查看)
router.get('/proposals', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const { status: propStatus } = req.query;
  let sql = "SELECT pt.*, u.name as creator_name FROM pool_tasks pt LEFT JOIN users u ON pt.created_by = u.id WHERE pt.proposal_status != 'approved'";
  const params: any[] = [];
  if (propStatus) { sql += ' AND pt.proposal_status = ?'; params.push(propStatus); }
  sql += ' ORDER BY pt.created_at DESC';
  const proposals = db.prepare(sql).all(...params);
  return res.json({ code: 0, data: proposals });
});

// 我的提案
router.get('/my-proposals', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const proposals = db.prepare("SELECT * FROM pool_tasks WHERE created_by = ? ORDER BY created_at DESC").all(req.userId);
  return res.json({ code: 0, data: proposals });
});

// 撤回提案：在 HR 未审核前，发起人可以撤回
router.post('/proposals/:id/withdraw', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const proposal = db.prepare('SELECT * FROM pool_tasks WHERE id = ? AND created_by = ?').get(req.params.id, req.userId) as any;
  if (!proposal) return res.status(404).json({ code: 404, message: '提案不存在' });
  if (!['pending_hr', 'pending_admin'].includes(proposal.proposal_status)) {
    return res.json({ code: 400, message: '当前状态不可撤回，仅待审核状态可撤回' });
  }

  db.prepare("UPDATE pool_tasks SET proposal_status = 'draft' WHERE id = ?").run(req.params.id);
  return res.json({ code: 0, message: '提案已撤回，可重新编辑后提交' });
});

// 修改提案 (草稿 or 被驳回均可编辑)
router.post('/proposals/:id/resubmit', authMiddleware, (req: AuthRequest, res) => {
  const { title, description, reward_type, bonus } = req.body;
  const db = getDb();

  const proposal = db.prepare('SELECT * FROM pool_tasks WHERE id = ? AND created_by = ?').get(req.params.id, req.userId) as any;
  if (!proposal) return res.status(404).json({ code: 404, message: '提案不存在' });
  if (!['draft', 'rejected'].includes(proposal.proposal_status)) {
    return res.status(400).json({ code: 400, message: '只能重新提交草稿或被驳回的提案' });
  }

  // Edit and set status back to pending_hr
  db.prepare(
    `UPDATE pool_tasks SET title=?, description=?, reward_type=?, bonus=?, proposal_status='pending_hr', reject_reason=NULL WHERE id = ?`
  ).run(title || proposal.title, description || proposal.description, reward_type || proposal.reward_type, bonus || proposal.bonus, proposal.id);

  // Notify HR
  const hrAdmins = db.prepare("SELECT id FROM users WHERE role IN ('hr', 'admin')").all() as any[];
  const hrAdminIds = hrAdmins.map((u: any) => u.id);
  const proposerName = (db.prepare('SELECT name FROM users WHERE id = ?').get(req.userId) as any)?.name || req.userId;
  if (hrAdminIds.length) {
    createNotification(hrAdminIds, 'proposal', '📋 提案重新提交', `${proposerName} 借修后重新提交了提案「${title || proposal.title}」`, '/admin?module=pool');
  }

  return res.json({ code: 0, message: '提案已重新提交' });
});

// 仅保存修改 (不流转状态)
router.put('/proposals/:id', authMiddleware, (req: AuthRequest, res) => {
  const { title, description, reward_type, bonus } = req.body;
  const db = getDb();

  const proposal = db.prepare('SELECT * FROM pool_tasks WHERE id = ? AND created_by = ?').get(req.params.id, req.userId) as any;
  if (!proposal) return res.status(404).json({ code: 404, message: '提案不存在' });
  if (!['draft', 'rejected'].includes(proposal.proposal_status)) {
    return res.status(400).json({ code: 400, message: '只能修改草稿或被驳回的提案' });
  }

  db.prepare(
    `UPDATE pool_tasks SET title=?, description=?, reward_type=?, bonus=? WHERE id = ?`
  ).run(title || proposal.title, description || proposal.description, reward_type || proposal.reward_type, bonus || proposal.bonus, proposal.id);

  return res.json({ code: 0, message: '提案已保存' });
});

// 审批提案 (两级: HR审核 → Admin复核)
router.post('/proposals/:id/review', authMiddleware, (req: AuthRequest, res) => {
  const { action, reason } = req.body;
  const db = getDb();
  const proposal = db.prepare('SELECT * FROM pool_tasks WHERE id = ?').get(req.params.id) as any;
  if (!proposal) return res.status(404).json({ code: 404, message: '提案不存在' });

  const reviewer = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId) as any;
  if (!reviewer) return res.status(401).json({ code: 401, message: '未授权' });

  if (action === 'approve') {
    if (proposal.proposal_status === 'pending_hr') {
      // HR 审核通过 → 流转到 Admin
      if (!['hr', 'admin'].includes(reviewer.role)) {
        return res.status(403).json({ code: 403, message: '仅 HR 或管理员可审核' });
      }
      db.prepare("UPDATE pool_tasks SET proposal_status = 'pending_admin', hr_reviewer_id = ? WHERE id = ?").run(req.userId, proposal.id);
      // 通知管理员有新的待复核提案
      const admins = db.prepare("SELECT id FROM users WHERE role = 'admin'").all() as any[];
      const adminIds = admins.map((u: any) => u.id);
      if (adminIds.length) {
        createNotification(adminIds, 'proposal', '🔍 提案待复核', `「${proposal.title}」已通过人事审核，请进行总经理复核`, '/admin?module=pool');
        try { sendCardMessage(adminIds, '🔍 提案待复核', `「${proposal.title}」已通过人事审核\n请进行总经理复核`, `${process.env.APP_URL || 'http://localhost:3000'}/admin`); } catch(e) {}
      }
      // 通知提案人进度
      createNotification([proposal.created_by], 'proposal', '✅ 提案通过人事审核', `您的提案「${proposal.title}」已通过人事审核，正在等待总经理复核`, '/company');
      return res.json({ code: 0, message: '人事审核通过，已转交总经理复核' });
    }
    if (proposal.proposal_status === 'pending_admin') {
      // Admin 复核通过 → 生效
      if (reviewer.role !== 'admin') {
        return res.status(403).json({ code: 403, message: '仅管理员可复核' });
      }
      db.prepare("UPDATE pool_tasks SET proposal_status = 'approved', status = 'open', admin_reviewer_id = ? WHERE id = ?").run(req.userId, proposal.id);
      // 通知提案人已通过
      createNotification([proposal.created_by], 'proposal', '🎉 提案已通过', `您的提案「${proposal.title}」已通过总经理复核，任务已发布到绩效池！`, '/company');
      try { sendCardMessage([proposal.created_by], '🎉 提案已通过', `您的提案「${proposal.title}」已通过总经理复核\n任务已发布到绩效池！`, `${process.env.APP_URL || 'http://localhost:3000'}/company`); } catch(e) {}
      return res.json({ code: 0, message: '总经理复核通过，任务已发布到绩效池' });
    }
    return res.status(400).json({ code: 400, message: `当前状态 ${proposal.proposal_status} 不可审批` });
  }

  if (action === 'reject') {
    if (!['pending_hr', 'pending_admin'].includes(proposal.proposal_status)) {
      return res.status(400).json({ code: 400, message: '当前状态不可驳回' });
    }
    const rejector = proposal.proposal_status === 'pending_hr' ? 'hr_reviewer_id' : 'admin_reviewer_id';
    db.prepare(`UPDATE pool_tasks SET proposal_status = 'rejected', ${rejector} = ?, reject_reason = ? WHERE id = ?`).run(req.userId, reason || '未说明', proposal.id);
    // 通知提案人被驳回
    createNotification([proposal.created_by], 'proposal', '❌ 提案被驳回', `您的提案「${proposal.title}」被驳回，原因：${reason || '未说明'}`, '/company');
    try { sendCardMessage([proposal.created_by], '❌ 提案被驳回', `您的提案「${proposal.title}」被驳回\n原因: ${reason || '未说明'}`, `${process.env.APP_URL || 'http://localhost:3000'}/company`); } catch(e) {}
    return res.json({ code: 0, message: '提案已驳回' });
  }

  return res.status(400).json({ code: 400, message: `未知操作: ${action}` });
});

// 加入绩效池任务
router.post('/tasks/:id/join', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const task = db.prepare('SELECT * FROM pool_tasks WHERE id = ?').get(req.params.id) as any;

  if (!task) return res.status(404).json({ code: 404, message: '任务不存在' });

  const currentCount = (db.prepare('SELECT COUNT(*) as c FROM pool_participants WHERE pool_task_id = ?').get(task.id) as any)?.c || 0;
  if (currentCount >= task.max_participants) {
    return res.status(400).json({ code: 400, message: '参与人数已满' });
  }

  const existing = db.prepare('SELECT * FROM pool_participants WHERE pool_task_id = ? AND user_id = ?').get(task.id, req.userId);
  if (existing) return res.status(400).json({ code: 400, message: '已参与该任务' });

  db.prepare('INSERT INTO pool_participants (pool_task_id, user_id) VALUES (?, ?)').run(task.id, req.userId);

  if (currentCount + 1 >= task.max_participants) {
    db.prepare("UPDATE pool_tasks SET status = 'in_progress' WHERE id = ?").run(task.id);
  }

  return res.json({ code: 0, message: '加入成功' });
});

// 创建绩效池任务 (HR / Admin 直接创建，无需审批)
router.post('/tasks', authMiddleware, (req: AuthRequest, res) => {
  const { title, description, department, difficulty, bonus, max_participants } = req.body;
  if (!title || !bonus) return res.status(400).json({ code: 400, message: '任务名称和奖金不能为空' });
  const db = getDb();
  const result = db.prepare(
    "INSERT INTO pool_tasks (title, description, department, difficulty, bonus, max_participants, created_by, proposal_status) VALUES (?, ?, ?, ?, ?, ?, ?, 'approved')"
  ).run(title, description || null, department || null, difficulty || 'normal', bonus, max_participants || 5, req.userId);
  return res.json({ code: 0, data: { id: result.lastInsertRowid } });
});

// 关闭绩效池任务
router.post('/tasks/:id/close', authMiddleware, (_req, res) => {
  const db = getDb();
  db.prepare("UPDATE pool_tasks SET status = 'closed' WHERE id = ?").run(_req.params.id);
  return res.json({ code: 0, message: '已关闭' });
});

// 回收站列表 (仅管理员/HR)
router.get('/tasks/trash', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId) as any;
  if (!user || !['admin', 'hr'].includes(user.role)) {
    return res.status(403).json({ code: 403, message: '仅管理员或HR可查看回收站' });
  }
  const tasks = db.prepare(
    "SELECT pt.*, u.name as creator_name FROM pool_tasks pt LEFT JOIN users u ON pt.created_by = u.id WHERE pt.deleted_at IS NOT NULL ORDER BY pt.deleted_at DESC"
  ).all();
  return res.json({ code: 0, data: tasks });
});

// 软删除 → 移入回收站 (仅管理员/HR)
router.delete('/tasks/:id', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId) as any;
  if (!user || !['admin', 'hr'].includes(user.role)) {
    return res.status(403).json({ code: 403, message: '仅管理员或HR可删除任务' });
  }
  const task = db.prepare('SELECT id, title FROM pool_tasks WHERE id = ? AND deleted_at IS NULL').get(req.params.id) as any;
  if (!task) return res.status(404).json({ code: 404, message: '任务不存在' });

  db.prepare("UPDATE pool_tasks SET deleted_at = datetime('now') WHERE id = ?").run(task.id);
  return res.json({ code: 0, message: `任务「${task.title}」已移入回收站` });
});

// 从回收站恢复 (仅管理员/HR)
router.post('/tasks/:id/restore', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId) as any;
  if (!user || !['admin', 'hr'].includes(user.role)) {
    return res.status(403).json({ code: 403, message: '权限不足' });
  }
  const task = db.prepare('SELECT id, title FROM pool_tasks WHERE id = ? AND deleted_at IS NOT NULL').get(req.params.id) as any;
  if (!task) return res.status(404).json({ code: 404, message: '任务不在回收站中' });

  db.prepare('UPDATE pool_tasks SET deleted_at = NULL WHERE id = ?').run(task.id);
  return res.json({ code: 0, message: `任务「${task.title}」已恢复` });
});

// 永久删除 (仅管理员/HR)
router.delete('/tasks/:id/purge', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId) as any;
  if (!user || !['admin', 'hr'].includes(user.role)) {
    return res.status(403).json({ code: 403, message: '权限不足' });
  }
  const task = db.prepare('SELECT id, title FROM pool_tasks WHERE id = ? AND deleted_at IS NOT NULL').get(req.params.id) as any;
  if (!task) return res.status(404).json({ code: 404, message: '任务不在回收站中' });

  db.prepare('DELETE FROM pool_participants WHERE pool_task_id = ?').run(task.id);
  db.prepare('DELETE FROM pool_tasks WHERE id = ?').run(task.id);
  return res.json({ code: 0, message: `任务「${task.title}」已永久删除` });
});

export default router;
