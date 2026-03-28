import { getDb } from '../config/database';
import { notifyPerfStatusChange } from './message';

// 有效的状态转换
const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['pending_review'],
  pending_review: ['approved', 'rejected'],
  rejected: ['draft'],
  approved: ['in_progress'],
  in_progress: ['pending_assessment', 'returned'],
  pending_assessment: ['assessed'],
  assessed: ['pending_reward'],
  pending_reward: ['completed'],
};

export function canTransition(currentStatus: string, targetStatus: string): boolean {
  return VALID_TRANSITIONS[currentStatus]?.includes(targetStatus) ?? false;
}

export async function transitionPlan(
  planId: number,
  targetStatus: string,
  operatorId: string,
  extra?: { comment?: string; score?: number; bonus?: number }
): Promise<{ success: boolean; message: string }> {
  const db = getDb();
  const plan = db.prepare('SELECT * FROM perf_plans WHERE id = ?').get(planId) as any;

  if (!plan) return { success: false, message: '绩效计划不存在' };
  if (!canTransition(plan.status, targetStatus)) {
    return { success: false, message: `无法从 ${plan.status} 变更到 ${targetStatus}` };
  }

  const now = new Date().toISOString();
  const updates: string[] = [`status = '${targetStatus}'`, `updated_at = '${now}'`];
  const notifyUsers: string[] = [];
  let notifyAction = '';

  switch (targetStatus) {
    case 'pending_review':
      notifyAction = 'submitted';
      if (plan.approver_id) notifyUsers.push(plan.approver_id);
      break;
    case 'approved':
      notifyAction = 'approved';
      notifyUsers.push(plan.creator_id);
      if (plan.assignee_id) notifyUsers.push(plan.assignee_id);
      // 审批通过后自动流转到 in_progress，覆盖初始 status
      updates[0] = `status = 'in_progress'`;
      break;
    case 'rejected':
      if (extra?.comment) updates.push(`reject_reason = '${extra.comment}'`);
      notifyAction = 'rejected';
      notifyUsers.push(plan.creator_id);
      break;
    case 'returned':
      if (extra?.comment) updates.push(`reject_reason = '${extra.comment.replace(/'/g, "''")}'`);
      notifyAction = 'returned';
      notifyUsers.push(plan.creator_id);
      break;
    case 'assessed':
      if (extra?.score != null) updates.push(`score = ${extra.score}`);
      updates.push(`assessed_at = '${now}'`);
      notifyAction = 'assessed';
      if (plan.assignee_id) notifyUsers.push(plan.assignee_id);
      break;
    case 'pending_reward':
      if (extra?.bonus != null) updates.push(`bonus = ${extra.bonus}`);
      break;
    case 'completed':
      updates.push(`rewarded_at = '${now}'`);
      notifyAction = 'rewarded';
      if (plan.assignee_id) notifyUsers.push(plan.assignee_id);
      break;
  }

  db.prepare(`UPDATE perf_plans SET ${updates.join(', ')} WHERE id = ?`).run(planId);

  // 记录状态变更日志
  db.prepare(
    `INSERT INTO perf_logs (plan_id, user_id, action, old_value, new_value, comment) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(planId, operatorId, 'status_change', plan.status, targetStatus, extra?.comment || null);

  // 企微消息推送
  if (notifyAction && notifyUsers.length > 0) {
    try {
      await notifyPerfStatusChange(planId, notifyAction, notifyUsers, plan.title, extra?.comment);
    } catch (e) {
      console.error('消息推送失败:', e);
    }
  }

  return { success: true, message: `状态已变更为 ${targetStatus}` };
}
