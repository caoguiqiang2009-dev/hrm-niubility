import { Router, Response } from 'express';
import { getDb } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/tasks - 获取当前登录用户的任务
router.get('/', authMiddleware, (req: AuthRequest, res: Response) => {
  const db = getDb();
  const userId = req.userId;
  
  try {
    const tasks = db.prepare('SELECT * FROM tasks WHERE user_id = ?').all(userId);
    
    // Inject test assignments as tasks
    const pendingTests = db.prepare(`
        SELECT a.id, a.user_id, '【评测任务】 ' || b.title as title, b.description as description, 
        a.created_at as due_date, 'high' as priority, a.status, 'test_assignment' as type
        FROM test_assignments a
        JOIN test_banks b ON a.bank_id = b.id
        WHERE a.user_id = ? AND a.status = 'pending'
    `).all(userId);

    // Inject pending monthly evaluation tasks
    const pendingEvals = db.prepare(`
        SELECT r.id + 1000000 as id, r.reviewer_id as user_id, 
        '【月度考评】 ' || u.name || ' 的 ' || e.month || ' 绩效打分' as title, 
        '系统指派给您的月度发薪考评打分任务，请客观公正地进行百分制评价提交。' as description, 
        e.created_at as due_date, 'high' as priority, r.status, 'monthly_eval' as type
        FROM monthly_eval_reviewers r
        JOIN monthly_evaluations e ON r.evaluation_id = e.id
        JOIN users u ON e.user_id = u.id
        WHERE r.reviewer_id = ? AND r.status = 'pending'
    `).all(userId);
    
    const combined = [...tasks, ...pendingTests, ...pendingEvals].sort((a: any, b: any) => {
        const valA = a.status === 'pending' ? 1 : 2;
        const valB = b.status === 'pending' ? 1 : 2;
        if (valA !== valB) return valA - valB;
        if (!a.due_date && b.due_date) return 1;
        if (a.due_date && !b.due_date) return -1;
        return new Date(a.due_date || 0).getTime() - new Date(b.due_date || 0).getTime();
    });

    res.json(combined);
  } catch (err) {
    console.error('Failed to get tasks:', err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// POST /api/tasks - 创建新任务
router.post('/', authMiddleware, (req: AuthRequest, res: Response) => {
  const db = getDb();
  const userId = req.userId;
  const { title, description, due_date, priority } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  try {
    const result = db.prepare(
      'INSERT INTO tasks (user_id, title, description, due_date, priority, status) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(userId, title, description || null, due_date || null, priority || 'normal', 'pending');
    
    const newTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newTask);
  } catch (err) {
    console.error('Failed to create task:', err);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// PUT /api/tasks/:id - 更新任务状态等
router.put('/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  const db = getDb();
  const userId = req.userId;
  const taskId = req.params.id;
  const { title, description, due_date, priority, status } = req.body;

  try {
    // 检查任务归属
    const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(taskId, userId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const currentTask = task as any;
    
    db.prepare(`
      UPDATE tasks 
      SET title = ?, description = ?, due_date = ?, priority = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      title !== undefined ? title : currentTask.title,
      description !== undefined ? description : currentTask.description,
      due_date !== undefined ? due_date : currentTask.due_date,
      priority !== undefined ? priority : currentTask.priority,
      status !== undefined ? status : currentTask.status,
      taskId
    );

    const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    res.json(updatedTask);
  } catch (err) {
    console.error('Failed to update task:', err);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// DELETE /api/tasks/:id - 删除任务
router.delete('/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  const db = getDb();
  const userId = req.userId;
  const taskId = req.params.id;

  try {
    const result = db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(taskId, userId);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to delete task:', err);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

export default router;
