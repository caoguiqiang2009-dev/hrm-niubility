import { getDb } from '../config/database';

export interface AuditLogParams {
  businessType: 'perf_plan' | 'proposal' | 'reward_plan' | 'pool_join';
  businessId: number | string;
  actorId: string;
  action: string;
  fromStatus?: string;
  toStatus?: string;
  comment?: string;
  extra?: Record<string, any>;
}

/**
 * 统一审计日志写入 — 所有流程状态变更一律通过此函数记录
 */
export function logAudit(params: AuditLogParams): void {
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO workflow_audit_logs 
        (business_type, business_id, actor_id, action, from_status, to_status, comment, extra_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      params.businessType,
      params.businessId,
      params.actorId,
      params.action,
      params.fromStatus || null,
      params.toStatus || null,
      params.comment || null,
      params.extra ? JSON.stringify(params.extra) : null
    );
  } catch (err) {
    console.error('[AuditLogger] Failed to write audit log:', err);
    // Silent fail — audit logging should never block business logic
  }
}

/**
 * 查询某个业务单据的完整审计日志
 */
export function getAuditLogs(businessType: string, businessId: number | string) {
  const db = getDb();
  return db.prepare(`
    SELECT w.*, u.name AS actor_name
    FROM workflow_audit_logs w
    LEFT JOIN users u ON w.actor_id = u.id
    WHERE w.business_type = ? AND w.business_id = ?
    ORDER BY w.created_at ASC
  `).all(businessType, businessId);
}
