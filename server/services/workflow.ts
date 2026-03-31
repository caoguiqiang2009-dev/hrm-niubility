import { getDb } from '../config/database';
import { notifyPerfStatusChange } from './message';
import { logAudit } from './audit-logger';

// 有效的状态转换
const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['pending_review', 'pending_receipt'],
  pending_receipt: ['in_progress', 'draft'],       // 流程1: 全员签收后 A 发车
  pending_review: ['pending_dept_review', 'approved', 'rejected'],
  pending_dept_review: ['approved', 'rejected'],
  rejected: ['draft'],
  approved: ['in_progress'],
  in_progress: ['pending_assessment', 'returned'],
  pending_assessment: ['assessed'],
  assessed: ['completed'],                          // 流程5: 评级后直接结案，不走发钱
};

/**
 * 流程5核心防腐：评级官避嫌溯源
 * 绕开负责人A本人，强制定位到A的上级来打分
 * - 如果A是基层员工 → 直属部门主管
 * - 如果A已经是部门主管 → 更高上一级的部门总监
 */
export function getAssessmentJudge(approverIdA: string): { judgeId: string | null; reason: string } {
  const db = getDb();
  const user = db.prepare('SELECT department_id FROM users WHERE id = ?').get(approverIdA) as any;
  if (!user?.department_id) return { judgeId: null, reason: '负责人A无所属部门，无法溯源评级官' };

  const dept = db.prepare('SELECT id, p_manager_id, leader_user_id, parent_id FROM departments WHERE id = ?').get(user.department_id) as any;
  if (!dept) return { judgeId: null, reason: '部门不存在' };

  // 判断A是否就是部门负责人
  const isDeptHead = dept.p_manager_id === approverIdA || dept.leader_user_id === approverIdA;

  if (!isDeptHead) {
    // A是基层 → 直属部门负责人来打分
    const headId = dept.p_manager_id || dept.leader_user_id;
    if (headId && headId !== approverIdA) {
      return { judgeId: headId, reason: '评级官: A的直属部门主管' };
    }
  }

  // A已经是部门主管，或者直属主管就是A自己 → 跨级找上级部门负责人
  if (dept.parent_id && dept.parent_id !== 0) {
    const parentDept = db.prepare('SELECT p_manager_id, leader_user_id FROM departments WHERE id = ?').get(dept.parent_id) as any;
    const parentHeadId = parentDept?.p_manager_id || parentDept?.leader_user_id;
    if (parentHeadId && parentHeadId !== approverIdA) {
      return { judgeId: parentHeadId, reason: '评级官: A已是部门主管，跨级由上级部门总监评级' };
    }
  }

  // 兜底: 总经理
  const { WorkflowEngine } = require('./workflow-engine');
  const gms = WorkflowEngine.getUsersByRoleTag('gm');
  const fallback = gms.find((id: string) => id !== approverIdA);
  if (fallback) return { judgeId: fallback, reason: '评级官: 无可用上级，兜底由总经理评级' };

  return { judgeId: null, reason: '无法定位评级官：组织架构中无合适人选' };
}

export function canTransition(currentStatus: string, targetStatus: string): boolean {
  return VALID_TRANSITIONS[currentStatus]?.includes(targetStatus) ?? false;
}

export async function transitionPlan(
  planId: number,
  targetStatus: string,
  operatorId: string,
  extra?: { comment?: string; score?: number; bonus?: number; attachments?: any }
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

  if (extra?.attachments !== undefined) {
    const attStr = typeof extra.attachments === 'string' ? extra.attachments : JSON.stringify(extra.attachments);
    updates.push(`attachments = '${attStr.replace(/'/g, "''")}'`);
  }

  db.prepare(`UPDATE perf_plans SET ${updates.join(', ')} WHERE id = ?`).run(planId);

  // 记录状态变更日志
  db.prepare(
    `INSERT INTO perf_logs (plan_id, user_id, action, old_value, new_value, comment) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(planId, operatorId, 'status_change', plan.status, targetStatus, extra?.comment || null);

  // 双写统一审计日志
  logAudit({
    businessType: 'perf_plan',
    businessId: planId,
    actorId: operatorId,
    action: 'status_change',
    fromStatus: plan.status,
    toStatus: targetStatus,
    comment: extra?.comment || null,
    extra: extra?.score != null ? { score: extra.score } : undefined
  });

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
      const { WorkflowEngine } = await import('./workflow-engine');
      const hrbpIds = WorkflowEngine.getUsersByRoleTag('hrbp');
      const gmIds = WorkflowEngine.getUsersByRoleTag('gm');
      // If no HRBP/GM tags, fallback to super admin specifically handled in notify
      const adminIds = Array.from(new Set([...hrbpIds, ...gmIds]));
      
      const creatorName = (db.prepare('SELECT name FROM users WHERE id = ?').get(updatedPlan.creator_id) as any)?.name || updatedPlan.creator_id;
      if (adminIds.length > 0) {
        createNotification(
          adminIds,
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
