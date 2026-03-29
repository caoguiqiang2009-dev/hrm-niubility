import express from 'express';
import { getDb } from '../config/database';
import { verifyToken } from '../middleware/auth';

const router = express.Router();

router.use(verifyToken);

// GET /api/perf/stats/overview?month=YYYY-MM
router.get('/overview', (req, res) => {
  const { month } = req.query;
  const db = getDb();
  
  if (!month) {
    return res.status(400).json({ code: 1, message: '请提供查询月份，格式例如 2026-03' });
  }

  try {
    // 拉取活动员工以及本月有绩效记录的员工（防止离职员工遗漏工资单）
    const users = db.prepare(`
      SELECT id, name, department_id 
      FROM users 
      WHERE status = 'active' OR id IN (
        SELECT assignee_id FROM perf_plans WHERE status = 'completed' AND (strftime('%Y-%m', rewarded_at) = ? OR strftime('%Y-%m', assessed_at) = ?)
      )
    `).all(month, month) as any[];

    const depts = db.prepare('SELECT id, name FROM departments').all() as any[];
    const deptMap = depts.reduce((acc, d) => ({...acc, [d.id]: d.name}), {} as Record<string, string>);

    // 获取当月已结算的绩效任务作为总计和明细依据
    // 注意：以 rewarded_at 或者 assessed_at 为结算周期基准
    const plans = db.prepare(`
      SELECT id, title, score, bonus, assignee_id, status 
      FROM perf_plans 
      WHERE status = 'completed' AND (strftime('%Y-%m', rewarded_at) = ? OR strftime('%Y-%m', assessed_at) = ?)
    `).all(month, month) as any[];

    // 拼装每位员工的绩效统计与来源明细
    const statsResult = users.map(u => {
      const userTasks = plans.filter(p => p.assignee_id === u.id);
      const total_score = userTasks.reduce((sum, t) => sum + (t.score || 0), 0);
      const total_bonus = userTasks.reduce((sum, t) => sum + (t.bonus || 0), 0);
      
      return {
        user_id: u.id,
        user_name: u.name,
        department_name: deptMap[u.department_id] || '未分配',
        total_score,
        total_bonus,
        tasks: userTasks.map(t => ({
          id: `TASK-${t.id}`,
          title: t.title,
          score: t.score || 0,
          bonus: t.bonus || 0
        }))
      };
    });

    // 默认按照总奖金倒序，再按考评倒序
    statsResult.sort((a, b) => b.total_bonus - a.total_bonus || b.total_score - a.total_score);

    res.json({ code: 0, data: statsResult, message: '查询成功' });
  } catch (err: any) {
    console.error('Perf Stats Error:', err);
    res.status(500).json({ code: 1, message: '核算绩效数据时发生错误' });
  }
});

export default router;
