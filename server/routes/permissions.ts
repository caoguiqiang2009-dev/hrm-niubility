import { Router } from 'express';
import { getDb } from '../config/database';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// ── 所有可配置权限项定义 ──────────────────────────────────────────────
export const ALL_PERMISSIONS = [
  // 功能模块
  { key: 'view_dashboard',    label: '查看仪表盘',      module: '功能模块', defaultRoles: ['admin','hr','manager','employee'] },
  { key: 'view_personal',     label: '个人管理中心',    module: '功能模块', defaultRoles: ['admin','hr','manager','employee'] },
  { key: 'view_team_perf',    label: '团队绩效管理',    module: '功能模块', defaultRoles: ['admin','hr','manager'] },
  { key: 'view_company_pool', label: '公司绩效池',      module: '功能模块', defaultRoles: ['admin','hr','manager','employee'] },
  { key: 'view_hr_map',       label: '人力地图',        module: '功能模块', defaultRoles: ['admin','hr','manager','employee'] },
  { key: 'view_panorama',     label: '全景仪表盘',      module: '功能模块', defaultRoles: ['admin','hr','manager'] },
  { key: 'view_admin',        label: '管理后台',        module: '功能模块', defaultRoles: ['admin','hr'] },
  { key: 'view_org_chart',    label: '组织关系图',      module: '功能模块', defaultRoles: ['admin','hr','manager','employee'] },
  // 管理专属模块
  { key: 'module_monthly_eval',      label: '月度考评系统',          module: '管理专属模块', defaultRoles: ['admin','hr'] },
  { key: 'module_monthly_eval_score',label: '月度考评 - 待审阅打分', module: '管理专属模块', defaultRoles: ['admin','hr','manager'] },
  { key: 'module_monthly_eval_view', label: '月度考评 - 百分制测评', module: '管理专属模块', defaultRoles: ['admin','hr'] },
  { key: 'module_task_mgmt',         label: '任务管理',              module: '管理专属模块', defaultRoles: ['admin','hr','manager'] },
  { key: 'module_task_approval',     label: '任务管理 - 审批流程',   module: '管理专属模块', defaultRoles: ['admin','hr','manager'] },
  { key: 'module_task_eval',         label: '任务管理 - 评分管理',   module: '管理专属模块', defaultRoles: ['admin','hr'] },
  { key: 'module_competency',        label: '能力大盘',              module: '管理专属模块', defaultRoles: ['admin','hr'] },
  { key: 'module_competency_model',  label: '能力大盘 - 自定义模型', module: '管理专属模块', defaultRoles: ['admin'] },
  { key: 'module_competency_eval',   label: '能力大盘 - 综合评估',   module: '管理专属模块', defaultRoles: ['admin','hr','manager'] },
  { key: 'module_perf_calc',         label: '绩效核算',              module: '管理专属模块', defaultRoles: ['admin','hr'] },
  { key: 'module_perf_calc_view',    label: '绩效核算 - 汇总计算',   module: '管理专属模块', defaultRoles: ['admin','hr'] },
  { key: 'module_perf_calc_drill',   label: '绩效核算 - 穿透溯源',   module: '管理专属模块', defaultRoles: ['admin','hr','manager'] },
  { key: 'module_proposal_review',   label: '提案审议',              module: '管理专属模块', defaultRoles: ['admin','hr','manager'] },
  { key: 'module_proposal_approve',  label: '提案审议 - 提案审批',   module: '管理专属模块', defaultRoles: ['admin','hr','manager'] },
  { key: 'module_proposal_pool',     label: '提案审议 - 奖金池管理', module: '管理专属模块', defaultRoles: ['admin','hr'] },
  // 操作权限
  { key: 'create_perf_plan',  label: '发起绩效目标',    module: '操作权限', defaultRoles: ['admin','hr','manager','employee'] },
  { key: 'approve_perf_plan', label: '审批绩效计划',    module: '操作权限', defaultRoles: ['admin','hr','manager'] },
  { key: 'push_goal_to_member',label: '向下派发目标',   module: '操作权限', defaultRoles: ['admin','hr','manager'] },
  { key: 'manage_perf_pool',  label: '发布/删除绩效池任务', module: '操作权限', defaultRoles: ['admin','hr','manager'] },
  { key: 'delete_perf_task',  label: '删除绩效池任务(仅管理员)', module: '操作权限', defaultRoles: ['admin'] },
  { key: 'manage_salary',     label: '工资表管理',      module: '操作权限', defaultRoles: ['admin','hr'] },
  { key: 'send_message',      label: '群发通知消息',    module: '操作权限', defaultRoles: ['admin','hr'] },
  // 字段权限
  { key: 'view_salary_data',  label: '查看薪资数据',    module: '字段权限', defaultRoles: ['admin','hr'] },
  { key: 'view_perf_scores',  label: '查看绩效评分',    module: '字段权限', defaultRoles: ['admin','hr','manager'] },
  { key: 'view_bonus_amount', label: '查看奖金金额',    module: '字段权限', defaultRoles: ['admin','hr','manager'] },
  { key: 'view_dept_data',    label: '查看本部门数据',  module: '字段权限', defaultRoles: ['admin','hr','manager','employee'] },
  { key: 'view_other_dept',   label: '查看跨部门数据',  module: '字段权限', defaultRoles: ['admin','hr'] },
  { key: 'edit_org_info',     label: '编辑组织架构',    module: '字段权限', defaultRoles: ['admin','hr'] },
];

// ── 获取某用户的有效权限（角色默认 + 个人覆盖） ───────────────────────
export function getUserEffectivePerms(userId: string): string[] {
  const db = getDb();
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId) as any;
  if (!user) return [];

  // 1. 角色的默认权限
  const roleDefaults = ALL_PERMISSIONS
    .filter(p => p.defaultRoles.includes(user.role))
    .map(p => p.key);

  // 2. 个人覆盖（allowed=1 表示额外授予，allowed=0 表示剥夺）
  const overrides = db.prepare('SELECT perm_key, allowed FROM user_perm_overrides WHERE user_id = ?').all(userId) as any[];
  const overrideMap: Record<string, number> = {};
  for (const o of overrides) overrideMap[o.perm_key] = o.allowed;

  const result = new Set(roleDefaults);
  for (const [key, allowed] of Object.entries(overrideMap)) {
    if (allowed) result.add(key);
    else result.delete(key);
  }
  return [...result];
}

// ── 获取某用户的权限管辖范围配置 ───────────────────────────────────────
export function getUserPermScopes(userId: string): Record<string, any> {
  const db = getDb();
  const overrides = db.prepare('SELECT perm_key, scope_config FROM user_perm_overrides WHERE user_id = ? AND allowed = 1 AND scope_config IS NOT NULL').all(userId) as any[];
  const scopes: Record<string, any> = {};
  for (const o of overrides) {
    try {
      scopes[o.perm_key] = JSON.parse(o.scope_config);
    } catch { /* ignore bad JSON */ }
  }
  return scopes;
}

// ── GET /api/permissions/definitions ─────────────────────────────────
// 返回所有权限项列表（给前端渲染用）
router.get('/definitions', authMiddleware, requireRole('admin', 'hr'), (_req, res) => {
  return res.json({ code: 0, data: ALL_PERMISSIONS });
});

// ── GET /api/permissions/me ───────────────────────────────────────────
// 返回当前登录用户自己的有效权限 key 列表（不限角色，任何登录用户可用）
router.get('/me', authMiddleware, (req: AuthRequest, res) => {
  const effective = getUserEffectivePerms(req.userId!);
  const scopes = getUserPermScopes(req.userId!);
  return res.json({ code: 0, data: { keys: effective, scopes } });
});

// ── GET /api/permissions/user/:userId ────────────────────────────────
// 返回某用户的有效权限 key 列表
router.get('/user/:userId', authMiddleware, requireRole('admin', 'hr'), (req, res) => {
  const effective = getUserEffectivePerms(req.params.userId);
  const scopes = getUserPermScopes(req.params.userId);
  return res.json({ code: 0, data: { keys: effective, scopes } });
});


// ── PUT /api/permissions/user/:userId ────────────────────────────────
// 保存某用户的权限覆盖（传入该用户最终拥有的 key 列表）
router.put('/user/:userId', authMiddleware, requireRole('admin', 'hr'), (req: AuthRequest, res) => {
  const { grantedKeys, grantedScopes = {} } = req.body as { grantedKeys: string[], grantedScopes?: Record<string, any> };
  if (!Array.isArray(grantedKeys)) return res.status(400).json({ code: 400, message: '参数错误' });

  const db = getDb();
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.params.userId) as any;
  if (!user) return res.status(404).json({ code: 404, message: '用户不存在' });

  // 计算角色默认权限
  const roleDefaults = new Set(
    ALL_PERMISSIONS.filter(p => p.defaultRoles.includes(user.role)).map(p => p.key)
  );
  const grantedSet = new Set(grantedKeys);

  // 删除旧的覆盖记录，重新写入
  db.prepare('DELETE FROM user_perm_overrides WHERE user_id = ?').run(req.params.userId);

  const insert = db.prepare('INSERT INTO user_perm_overrides (user_id, perm_key, allowed, scope_config) VALUES (?, ?, ?, ?)');
  const tx = db.transaction(() => {
    for (const perm of ALL_PERMISSIONS) {
      const inGranted = grantedSet.has(perm.key);
      const inDefault = roleDefaults.has(perm.key);
      const scopeStr = grantedScopes[perm.key] ? JSON.stringify(grantedScopes[perm.key]) : null;
      
      // 只有在与角色默认不同，或者有自定义范围时，才需要记录在 override 表里
      if (inGranted !== inDefault || (inGranted && scopeStr)) {
        insert.run(req.params.userId, perm.key, inGranted ? 1 : 0, scopeStr);
      }
    }
  });
  tx();

  return res.json({ code: 0, message: '权限已保存' });
});

// ── PUT /api/permissions/department/:deptId ──────────────────────────
// 批量设置某部门所有成员的权限
router.put('/department/:deptId', authMiddleware, requireRole('admin', 'hr'), (req: AuthRequest, res) => {
  const { grantedKeys } = req.body as { grantedKeys: string[] };
  if (!Array.isArray(grantedKeys)) return res.status(400).json({ code: 400, message: '参数错误' });

  const db = getDb();
  const members = db.prepare("SELECT id, role FROM users WHERE department_id = ? AND status = 'active'").all(req.params.deptId) as any[];
  if (members.length === 0) return res.status(404).json({ code: 404, message: '部门无成员' });

  const grantedSet = new Set(grantedKeys);
  const deleteStmt = db.prepare('DELETE FROM user_perm_overrides WHERE user_id = ?');
  const insertStmt = db.prepare('INSERT INTO user_perm_overrides (user_id, perm_key, allowed, scope_config) VALUES (?, ?, ?, ?)');

  const tx = db.transaction(() => {
    for (const member of members) {
      const roleDefaults = new Set(
        ALL_PERMISSIONS.filter(p => p.defaultRoles.includes(member.role)).map(p => p.key)
      );
      deleteStmt.run(member.id);
      for (const perm of ALL_PERMISSIONS) {
        const inGranted = grantedSet.has(perm.key);
        const inDefault = roleDefaults.has(perm.key);
        if (inGranted !== inDefault) {
          insertStmt.run(member.id, perm.key, inGranted ? 1 : 0, null);
        }
      }
    }
  });
  tx();

  return res.json({ code: 0, message: `已更新 ${members.length} 名成员的权限` });
});

// ── GET /api/permissions/check/:key ──────────────────────────────────
// 检查当前登录用户是否拥有某权限（前端运行时校验用）
router.get('/check/:key', authMiddleware, (req: AuthRequest, res) => {
  const effective = getUserEffectivePerms(req.userId!);
  return res.json({ code: 0, data: { allowed: effective.includes(req.params.key) } });
});

export default router;
