import { Router } from 'express';
import { getDb } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// 兼容旧表
function ensureColumns(db: any) {
  try { db.exec("ALTER TABLE approval_templates ADD COLUMN business_types TEXT DEFAULT '[]'"); } catch(e) {}
  try { db.exec("ALTER TABLE approval_templates ADD COLUMN permissions TEXT DEFAULT '{}'"); } catch(e) {}
}

// ─── 获取所有审批流模板（含节点） ──────────────────────────────
router.get('/', authMiddleware, (_req: AuthRequest, res) => {
  const db = getDb();
  ensureColumns(db);
  const templates = db.prepare('SELECT * FROM approval_templates ORDER BY sort_order, id').all() as any[];
  const nodes = db.prepare('SELECT * FROM approval_nodes ORDER BY template_id, node_index').all() as any[];

  const result = templates.map(t => ({
    ...t,
    business_types: (() => { try { return JSON.parse(t.business_types || '[]'); } catch { return []; } })(),
    permissions: (() => { try { return JSON.parse(t.permissions || '{}'); } catch { return {}; } })(),
    nodes: nodes.filter((n: any) => n.template_id === t.id).map((n: any) => ({
      ...n,
      config: (() => { try { return JSON.parse(n.config_json || '{}'); } catch { return {}; } })(),
    })),
  }));
  return res.json({ code: 0, data: result });
});

// ─── 新建模板 ─────────────────────────────────────────────────
router.post('/', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  ensureColumns(db);
  const { name, icon, description, category, business_types, permissions } = req.body;
  if (!name) return res.json({ code: 1, message: '模板名称不能为空' });

  const maxSort = (db.prepare('SELECT MAX(sort_order) as ms FROM approval_templates').get() as any)?.ms || 0;
  const result = db.prepare(
    'INSERT INTO approval_templates (name, icon, description, category, business_types, permissions, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(name, icon || 'approval', description || '', category || 'general', JSON.stringify(business_types || []), JSON.stringify(permissions || {}), maxSort + 1);

  const template = db.prepare('SELECT * FROM approval_templates WHERE id = ?').get(result.lastInsertRowid) as Record<string, any>;
  return res.json({ code: 0, data: { ...template, business_types: business_types || [], permissions: permissions || {}, nodes: [] } });
});

// ─── 更新模板信息 ─────────────────────────────────────────────
router.put('/:id', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  ensureColumns(db);
  const { name, icon, description, category, enabled, business_types, permissions } = req.body;
  const fields: string[] = [];
  const values: any[] = [];

  if (name !== undefined) { fields.push('name = ?'); values.push(name); }
  if (icon !== undefined) { fields.push('icon = ?'); values.push(icon); }
  if (description !== undefined) { fields.push('description = ?'); values.push(description); }
  if (category !== undefined) { fields.push('category = ?'); values.push(category); }
  if (enabled !== undefined) { fields.push('enabled = ?'); values.push(enabled ? 1 : 0); }
  if (business_types !== undefined) { fields.push('business_types = ?'); values.push(JSON.stringify(business_types)); }
  if (permissions !== undefined) { fields.push('permissions = ?'); values.push(JSON.stringify(permissions)); }
  fields.push("updated_at = datetime('now')");

  if (fields.length <= 1) return res.json({ code: 1, message: '没有要更新的字段' });

  values.push(req.params.id);
  db.prepare(`UPDATE approval_templates SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return res.json({ code: 0, message: '已更新' });
});

// ─── 删除模板 ─────────────────────────────────────────────────
router.delete('/:id', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  db.prepare('DELETE FROM approval_nodes WHERE template_id = ?').run(req.params.id);
  db.prepare('DELETE FROM approval_templates WHERE id = ?').run(req.params.id);
  return res.json({ code: 0, message: '已删除' });
});

// ─── 保存节点列表（全量覆盖） ─────────────────────────────────
router.put('/:id/nodes', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const templateId = req.params.id;
  const { nodes } = req.body;

  if (!Array.isArray(nodes)) return res.json({ code: 1, message: 'nodes 必须是数组' });

  // 检查模板是否存在
  const template = db.prepare('SELECT id FROM approval_templates WHERE id = ?').get(templateId);
  if (!template) return res.json({ code: 1, message: '模板不存在' });

  // 事务：先删再批量插入
  const insertNode = db.prepare(
    'INSERT INTO approval_nodes (template_id, node_type, node_index, label, approve_type, config_json) VALUES (?, ?, ?, ?, ?, ?)'
  );

  db.transaction(() => {
    db.prepare('DELETE FROM approval_nodes WHERE template_id = ?').run(templateId);
    nodes.forEach((node: any, idx: number) => {
      insertNode.run(
        templateId,
        node.node_type || 'approver',
        idx,
        node.label || '',
        node.approve_type || 'serial',
        JSON.stringify(node.config || {}),
      );
    });
  })();

  // 返回最新节点
  const updatedNodes = db.prepare(
    'SELECT * FROM approval_nodes WHERE template_id = ? ORDER BY node_index'
  ).all(templateId);

  return res.json({
    code: 0,
    data: (updatedNodes as any[]).map((n: any) => ({
      ...n,
      config: (() => { try { return JSON.parse(n.config_json || '{}'); } catch { return {}; } })(),
    })),
  });
});

export default router;
