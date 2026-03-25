import { Router } from 'express';
import { getDb } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// 绩效池任务列表
router.get('/tasks', authMiddleware, (req, res) => {
  const db = getDb();
  const { status, department } = req.query;
  let sql = 'SELECT * FROM pool_tasks WHERE 1=1';
  const params: any[] = [];
  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (department) { sql += ' AND department = ?'; params.push(department); }
  sql += ' ORDER BY created_at DESC';

  const tasks = db.prepare(sql).all(...params);

  // 附加参与者信息
  const result = tasks.map((t: any) => {
    const participants = db.prepare('SELECT user_id FROM pool_participants WHERE pool_task_id = ?').all(t.id);
    return { ...t, participants, current_participants: participants.length };
  });

  return res.json({ code: 0, data: result });
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

// 创建绩效池任务 (HR / Admin)
router.post('/tasks', authMiddleware, (req: AuthRequest, res) => {
  const { title, department, difficulty, bonus, max_participants } = req.body;
  if (!title || !bonus) return res.status(400).json({ code: 400, message: '任务名称和奖金不能为空' });
  const db = getDb();
  const result = db.prepare(
    'INSERT INTO pool_tasks (title, department, difficulty, bonus, max_participants, created_by) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(title, department || null, difficulty || 'normal', bonus, max_participants || 5, req.userId);
  return res.json({ code: 0, data: { id: result.lastInsertRowid } });
});

// 关闭绩效池任务
router.post('/tasks/:id/close', authMiddleware, (_req, res) => {
  const db = getDb();
  db.prepare("UPDATE pool_tasks SET status = 'closed' WHERE id = ?").run(_req.params.id);
  return res.json({ code: 0, message: '已关闭' });
});

export default router;
