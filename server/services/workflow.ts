import { getDb } from '../config/database';
import { notifyPerfStatusChange } from './message';

// 有效的状态转换
const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['pending_review'],
  pending_review: ['pending_dept_review', 'approved', 'rejected'],
  pending_dept_review: ['approved', 'rejected'],
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
    case 'pending_dept_review':
      notifyAction = 'submitted'; // Using submitted for dept head too
      if (plan.dept_head_id) notifyUsers.push(plan.dept_head_id);
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

  // ── 流程异常检测：节点缺失时通知HR ──
  if (['pending_review', 'pending_dept_review', 'in_progress', 'pending_assessment'].includes(targetStatus)) {
    const { createNotification } = await import('../routes/notifications');
    const updatedPlan = db.prepare('SELECT * FROM perf_plans WHERE id = ?').get(planId) as any;
    const issues: string[] = [];
    if (!updatedPlan.approver_id) issues.push('缺少审批人(直属上级)');
    if (targetStatus === 'pending_dept_review' && !updatedPlan.dept_head_id) issues.push('缺少部门负责人(二审)');
    if (!updatedPlan.assignee_id) issues.push('缺少执行人');

    // 检查部门是否有负责人
    if (updatedPlan.department_id || updatedPlan.creator_id) {
      const creatorDeptId = updatedPlan.department_id || (db.prepare('SELECT department_id FROM users WHERE id = ?').get(updatedPlan.creator_id) as any)?.department_id;
      if (creatorDeptId) {
        const dept = db.prepare('SELECT leader_user_id FROM departments WHERE id = ?').get(creatorDeptId) as any;
        if (!dept?.leader_user_id) issues.push('所属部门无负责人');
      }
    }

    if (issues.length > 0) {
      const hrAdmins = db.prepare("SELECT id FROM users WHERE role IN ('hr', 'admin')").all() as any[];
      const hrAdminIds = hrAdmins.map((u: any) => u.id);
      const creatorName = (db.prepare('SELECT name FROM users WHERE id = ?').get(updatedPlan.creator_id) as any)?.name || updatedPlan.creator_id;
      if (hrAdminIds.length > 0) {
        createNotification(
          hrAdminIds,
          'workflow_error',
          '⚠️ 流程节点异常',
          `${creatorName} 的绩效计划「${updatedPlan.title}」存在流程异常：${issues.join('、')}，请前往流程异常管理修复`,
          '/admin'
        );
      }
    }
  }

  return { success: true, message: `状态已变更为 ${targetStatus}` };
}
