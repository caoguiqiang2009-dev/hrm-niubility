import { Router } from 'express';
import { getDb } from '../config/database';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// ── GET /api/team-scope/:managerId
// 获取某人的自定义可视成员配置（返回成员 id 列表）
router.get('/:managerId', authMiddleware, requireRole('admin', 'hr'), (req, res) => {
  const db = getDb();
  const rows = db.prepare(
    'SELECT member_id FROM team_view_scopes WHERE manager_id = ? ORDER BY member_id'
  ).all(req.params.managerId) as any[];

  return res.json({
    code: 0,
    data: {
      manager_id: req.params.managerId,
      member_ids: rows.map(r => r.member_id),
      has_override: rows.length > 0,
    }
  });
});

// ── PUT /api/team-scope/:managerId
// 保存（完全替换）某人的可视成员配置
// body: { member_ids: string[] }
router.put('/:managerId', authMiddleware, requireRole('admin', 'hr'), (req: AuthRequest, res) => {
  const { member_ids } = req.body as { member_ids: string[] };
  if (!Array.isArray(member_ids)) {
    return res.status(400).json({ code: 400, message: '参数错误：member_ids 必须是数组' });
  }

  const db = getDb();
  const managerId = req.params.managerId;

  // 验证 manager 存在
  const manager = db.prepare("SELECT id FROM users WHERE id = ?").get(managerId) as any;
  if (!manager) return res.status(404).json({ code: 404, message: '用户不存在' });

  // 完全替换：先删旧记录，再批量插入新记录
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM team_view_scopes WHERE manager_id = ?').run(managerId);
    const insert = db.prepare(
      'INSERT OR IGNORE INTO team_view_scopes (manager_id, member_id) VALUES (?, ?)'
    );
    for (const memberId of member_ids) {
      // 验证 member 存在
      const member = db.prepare("SELECT id FROM users WHERE id = ?").get(memberId) as any;
      if (member) insert.run(managerId, memberId);
    }
  });
  tx();

  const saved = (db.prepare('SELECT COUNT(*) as c FROM team_view_scopes WHERE manager_id = ?').get(managerId) as any).c;
  return res.json({ code: 0, message: `团队可视范围已更新（${saved} 人）`, data: { count: saved } });
});

// ── DELETE /api/team-scope/:managerId
// 清除配置，恢复默认部门推算
router.delete('/:managerId', authMiddleware, requireRole('admin', 'hr'), (req, res) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM team_view_scopes WHERE manager_id = ?').run(req.params.managerId);
  return res.json({
    code: 0,
    message: result.changes > 0 ? '自定义配置已清除，将恢复默认部门可视范围' : '该用户原本无自定义配置'
  });
});

// ── GET /api/team-scope  (列出所有已配置的 manager)
router.get('/', authMiddleware, requireRole('admin', 'hr'), (_req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT tvs.manager_id, u.name as manager_name, u.title, u.department_id,
           d.name as dept_name, COUNT(tvs.member_id) as member_count
    FROM team_view_scopes tvs
    LEFT JOIN users u ON tvs.manager_id = u.id
    LEFT JOIN departments d ON u.department_id = d.id
    GROUP BY tvs.manager_id
    ORDER BY u.name
  `).all() as any[];
  return res.json({ code: 0, data: rows });
});

export default router;
