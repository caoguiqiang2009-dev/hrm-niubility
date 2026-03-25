import { Router } from 'express';
import { getDb } from '../config/database';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// 默认权限矩阵定义
const DEFAULT_PERMISSIONS = [
  // 功能模块权限
  { key: 'view_dashboard', label: '查看仪表盘', module: '功能模块', admin: true, hr: true, manager: true, employee: true },
  { key: 'view_team_perf', label: '团队绩效管理', module: '功能模块', admin: true, hr: true, manager: true, employee: false },
  { key: 'view_company_pool', label: '公司绩效池', module: '功能模块', admin: true, hr: true, manager: true, employee: true },
  { key: 'view_panorama', label: '全景仪表盘', module: '功能模块', admin: true, hr: true, manager: true, employee: false },
  { key: 'view_admin', label: '管理后台', module: '功能模块', admin: true, hr: true, manager: false, employee: false },
  { key: 'view_org_chart', label: '组织关系图', module: '功能模块', admin: true, hr: true, manager: true, employee: true },
  // 操作权限
  { key: 'create_perf_plan', label: '发起绩效目标', module: '操作权限', admin: true, hr: true, manager: true, employee: true },
  { key: 'approve_perf_plan', label: '审批绩效计划', module: '操作权限', admin: true, hr: true, manager: true, employee: false },
  { key: 'push_goal_to_member', label: '向下派发目标', module: '操作权限', admin: true, hr: true, manager: true, employee: false },
  { key: 'manage_salary', label: '工资表管理', module: '操作权限', admin: true, hr: true, manager: false, employee: false },
  { key: 'send_message', label: '群发通知消息', module: '操作权限', admin: true, hr: true, manager: false, employee: false },
  // 数据字段权限
  { key: 'view_salary_data', label: '查看薪资数据', module: '字段权限', admin: true, hr: true, manager: false, employee: false },
  { key: 'view_perf_scores', label: '查看绩效评分', module: '字段权限', admin: true, hr: true, manager: true, employee: false },
  { key: 'view_bonus_amount', label: '查看奖金金额', module: '字段权限', admin: true, hr: true, manager: true, employee: false },
  { key: 'view_other_dept', label: '查看其他部门数据', module: '字段权限', admin: true, hr: true, manager: false, employee: false },
  { key: 'edit_org_info', label: '编辑组织架构信息', module: '字段权限', admin: true, hr: true, manager: false, employee: false },
];

// 获取权限矩阵
router.get('/', authMiddleware, requireRole('admin', 'hr'), (_req, res) => {
  const db = getDb();
  // 读取数据库中的覆盖配置
  const overrides = db.prepare('SELECT * FROM permission_overrides').all() as any[];
  const overrideMap: Record<string, any> = {};
  for (const o of overrides) overrideMap[o.key] = o;

  const result = DEFAULT_PERMISSIONS.map(perm => ({
    ...perm,
    admin: overrideMap[perm.key]?.admin_val !== undefined ? !!overrideMap[perm.key].admin_val : perm.admin,
    hr: overrideMap[perm.key]?.hr_val !== undefined ? !!overrideMap[perm.key].hr_val : perm.hr,
    manager: overrideMap[perm.key]?.manager_val !== undefined ? !!overrideMap[perm.key].manager_val : perm.manager,
    employee: overrideMap[perm.key]?.employee_val !== undefined ? !!overrideMap[perm.key].employee_val : perm.employee,
  }));

  return res.json({ code: 0, data: result });
});

// 更新权限配置
router.put('/', authMiddleware, requireRole('admin'), (req: AuthRequest, res) => {
  const { permissions } = req.body as { permissions: typeof DEFAULT_PERMISSIONS };
  if (!Array.isArray(permissions)) return res.status(400).json({ code: 400, message: '参数错误' });
  
  const db = getDb();
  const upsert = db.prepare(`
    INSERT INTO permission_overrides (key, admin_val, hr_val, manager_val, employee_val)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      admin_val = excluded.admin_val,
      hr_val = excluded.hr_val,
      manager_val = excluded.manager_val,
      employee_val = excluded.employee_val,
      updated_at = CURRENT_TIMESTAMP
  `);

  const tx = db.transaction(() => {
    for (const p of permissions) {
      upsert.run(p.key, p.admin ? 1 : 0, p.hr ? 1 : 0, p.manager ? 1 : 0, p.employee ? 1 : 0);
    }
  });
  tx();

  return res.json({ code: 0, message: '权限配置已保存' });
});

// 检查当前用户是否有某权限
router.get('/check/:key', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId) as any;
  if (!user) return res.status(401).json({ code: 401 });

  const role = user.role;
  const override = db.prepare('SELECT * FROM permission_overrides WHERE key = ?').get(req.params.key) as any;
  const def = DEFAULT_PERMISSIONS.find(p => p.key === req.params.key);
  if (!def) return res.json({ code: 0, data: { allowed: false } });

  const allowed = override
    ? !!(override as any)[`${role}_val`]
    : !!(def as any)[role];

  return res.json({ code: 0, data: { allowed, role } });
});

export default router;
