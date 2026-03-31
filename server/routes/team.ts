import { Router } from 'express';
import { getDb } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// 团队成员绩效总览
router.get('/:managerId/overview', authMiddleware, (req, res) => {
  const db = getDb();
  const members = db.prepare('SELECT id, name, title, avatar_url FROM users WHERE department_id IN (SELECT department_id FROM users WHERE id = ?)').all(req.params.managerId) as any[];

  const overview = members.map((m) => {
    const activePlans = db.prepare("SELECT COUNT(*) as count FROM perf_plans WHERE (',' || assignee_id || ',' LIKE '%,' || ? || ',%') AND status NOT IN ('draft', 'completed')").get(m.id) as any;
    const completedPlans = db.prepare("SELECT COUNT(*) as count FROM perf_plans WHERE (',' || assignee_id || ',' LIKE '%,' || ? || ',%') AND status = 'completed'").get(m.id) as any;
    const avgScore = db.prepare("SELECT AVG(score) as avg FROM perf_plans WHERE (',' || assignee_id || ',' LIKE '%,' || ? || ',%') AND score IS NOT NULL").get(m.id) as any;
    const overduePlans = db.prepare("SELECT COUNT(*) as count FROM perf_plans WHERE (',' || assignee_id || ',' LIKE '%,' || ? || ',%') AND deadline < date('now') AND status NOT IN ('completed')").get(m.id) as any;

    return {
      ...m,
      active_plans: activePlans?.count || 0,
      completed_plans: completedPlans?.count || 0,
      avg_score: avgScore?.avg ? Math.round(avgScore.avg * 10) / 10 : null,
      overdue_count: overduePlans?.count || 0,
    };
  });

  return res.json({ code: 0, data: overview });
});

// 下属成员列表
router.get('/:managerId/members', authMiddleware, (req, res) => {
  const db = getDb();
  const members = db.prepare(
    'SELECT id, name, title, avatar_url, role, status FROM users WHERE department_id IN (SELECT department_id FROM users WHERE id = ?)'
  ).all(req.params.managerId);
  return res.json({ code: 0, data: members });
});

export default router;
