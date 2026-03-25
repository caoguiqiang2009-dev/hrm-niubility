import { Router } from 'express';
import { getDb } from '../config/database';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth';
import { getDepartmentList, getDepartmentMembers } from '../services/wecom';

const router = Router();

// 全量同步组织架构 (仅管理员)
router.post('/sync', authMiddleware, requireRole('admin', 'hr'), async (_req, res) => {
  try {
    const db = getDb();
    const departments = await getDepartmentList();

    const deptStmt = db.prepare(`INSERT OR REPLACE INTO departments (id, name, parent_id) VALUES (?, ?, ?)`);
    const userStmt = db.prepare(
      `INSERT OR REPLACE INTO users (id, name, title, department_id, avatar_url, mobile, email, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const syncTransaction = db.transaction(() => {
      for (const dept of departments) {
        deptStmt.run(dept.id, dept.name, dept.parentid || 0);
      }
    });
    syncTransaction();

    // 同步各部门成员
    let memberCount = 0;
    for (const dept of departments) {
      try {
        const members = await getDepartmentMembers(dept.id);
        const memberTransaction = db.transaction(() => {
          for (const m of members) {
            userStmt.run(m.userid, m.name, m.position || '', dept.id, m.avatar || '', m.mobile || '', m.email || '', new Date().toISOString());
            memberCount++;
          }
        });
        memberTransaction();
      } catch (e) {
        console.error(`同步部门 ${dept.name} 成员失败:`, e);
      }
    }

    return res.json({ code: 0, data: { departments: departments.length, members: memberCount } });
  } catch (error: any) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取组织树
router.get('/tree', authMiddleware, (_req, res) => {
  const db = getDb();
  const departments = db.prepare('SELECT * FROM departments ORDER BY sort_order').all() as any[];
  const userCounts = db.prepare('SELECT department_id, COUNT(*) as count FROM users GROUP BY department_id').all() as any[];

  const countMap: Record<number, number> = {};
  for (const uc of userCounts) countMap[uc.department_id] = uc.count;

  function buildTree(parentId: number): any[] {
    return departments
      .filter((d) => d.parent_id === parentId)
      .map((d) => ({
        ...d,
        member_count: countMap[d.id] || 0,
        children: buildTree(d.id),
      }));
  }

  return res.json({ code: 0, data: buildTree(0) });
});

// 部门详情 + 成员
router.get('/departments/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const dept = db.prepare('SELECT * FROM departments WHERE id = ?').get(req.params.id);
  const members = db.prepare('SELECT id, name, title, avatar_url, role, status FROM users WHERE department_id = ?').all(req.params.id);

  if (!dept) return res.status(404).json({ code: 404, message: '部门不存在' });
  return res.json({ code: 0, data: { ...(dept as Record<string, any>), members } });
});

// 用户详情
router.get('/users/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, name, title, department_id, avatar_url, mobile, email, role, status FROM users WHERE id = ?').get(req.params.id);

  if (!user) return res.status(404).json({ code: 404, message: '用户不存在' });
  return res.json({ code: 0, data: user });
});

// 更新用户信息 (HR / Admin)
router.put('/users/:id', authMiddleware, requireRole('admin', 'hr'), (req: AuthRequest, res) => {
  const { name, title, mobile, email, role, status } = req.body;
  const db = getDb();
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ code: 404, message: '用户不存在' });

  db.prepare('UPDATE users SET name=?, title=?, mobile=?, email=?, role=?, status=? WHERE id=?')
    .run(name, title, mobile, email, role, status, req.params.id);
  return res.json({ code: 0, message: '更新成功' });
});

export default router;
