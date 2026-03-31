import { Router } from 'express';
import { getDb } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { WorkflowEngine, WORKFLOWS } from '../services/workflow-engine';
import { getAuditLogs } from '../services/audit-logger';

const router = Router();

function getUsersMap(ids: string[]) {
  if (!ids.length) return {};
  const db = getDb();
  const placeholders = ids.map(() => '?').join(',');
  const users = db.prepare(`SELECT id, name FROM users WHERE id IN (${placeholders})`).all(...ids) as any[];
  const map: Record<string, string> = {};
  users.forEach(u => map[u.id] = u.name);
  return map;
}

router.get('/:type/:id', authMiddleware, (req: AuthRequest, res) => {
  const { type, id } = req.params;
  const db = getDb();

  try {
    let trajectory: any[] = [];

    // ==========================================
    // 1. 提案流 (PROPOSAL_CREATE)
    // ==========================================
    if (type === 'proposal') {
      const task = db.prepare(`
        SELECT t.*, u.name as initiator_name 
        FROM pool_tasks t 
        JOIN users u ON t.created_by = u.id 
        WHERE t.id = ?
      `).get(id) as any;
      
      if (!task) return res.status(404).json({ code: 404, message: '提案不存在' });

      const nodes = WorkflowEngine.resolveAssignees(WORKFLOWS.PROPOSAL_CREATE, { initiatorId: task.created_by });
      const currentStatus = task.proposal_status || 'draft'; // draft, proposing, pending_hr, pending_admin, approved, rejected
      
      // Node 1: 发起提案
      trajectory.push({
        seq: 1,
        name: '发起提案',
        status: ['draft', 'proposing'].includes(currentStatus) ? 'current' : 'past',
        assignees: [{ id: task.created_by, name: task.initiator_name }],
        is_auto_skipped: false
      });

      // Node 2: HRBP审核
      const node2 = nodes.find(n => n.seq === 2);
      const isReject = currentStatus === 'rejected';
      
      let hrStatus = 'future';
      if (node2?.isSkipped) hrStatus = 'skipped';
      else if (currentStatus === 'pending_hr') hrStatus = 'current';
      else if (['pending_admin', 'approved', 'published'].includes(currentStatus) || task.hr_reviewer_id) hrStatus = 'past';
      else if (isReject && task.hr_reviewer_id) hrStatus = 'rejected';

      const hrMap = getUsersMap(node2?.assignees || []);
      const hrAssignees = (node2?.assignees || []).map((uid: string) => ({ id: uid, name: hrMap[uid] || uid }));

      trajectory.push({
        seq: 2,
        name: '人事风控核查',
        status: hrStatus,
        assignees: hrAssignees,
        is_auto_skipped: node2?.isSkipped || false,
        is_escalated: node2?.isEscalated || false,
        actual_reviewer_id: task.hr_reviewer_id || null,
        comment: isReject && hrStatus === 'rejected' ? task.reject_reason : null,
      });

      // Node 3: 总经理终审
      const node3 = nodes.find(n => n.seq === 3);
      let gmStatus = 'future';
      if (node3?.isSkipped) gmStatus = 'skipped';
      else if (currentStatus === 'pending_admin') gmStatus = 'current';
      else if (['approved', 'published'].includes(currentStatus) || task.admin_reviewer_id) gmStatus = 'past';
      else if (isReject && task.admin_reviewer_id) gmStatus = 'rejected';

      const gmMap = getUsersMap(node3?.assignees || []);
      const gmAssignees = (node3?.assignees || []).map((uid: string) => ({ id: uid, name: gmMap[uid] || uid }));

      trajectory.push({
        seq: 3,
        name: '高管 / 总办审批',
        status: gmStatus,
        assignees: gmAssignees,
        is_auto_skipped: node3?.isSkipped || false,
        is_escalated: node3?.isEscalated || false,
        actual_reviewer_id: task.admin_reviewer_id || null,
        comment: isReject && gmStatus === 'rejected' ? task.reject_reason : null,
      });

      // 结束节点
      trajectory.push({
        seq: 4,
        name: '进入池中 (可认领)',
        status: ['approved', 'published'].includes(currentStatus) ? 'past' : 'future',
        assignees: []
      });
      
      // Inject timestamps from audit logs
      const auditLogs = getAuditLogs('proposal', id) as any[];
      trajectory.forEach((node: any) => {
        if (node.timestamp) return; // already has timestamp from direct log
        const log = auditLogs.find((l: any) => {
          if (node.seq === 1) return l.action === 'create' || l.action === 'submit';
          if (node.seq === 2) return l.from_status === 'pending_hr';
          if (node.seq === 3) return l.from_status === 'pending_admin';
          if (node.seq === 4) return l.action === 'publish' || l.to_status === 'approved';
          return false;
        });
        if (log) node.timestamp = log.created_at;
      });

      return res.json({ code: 0, data: trajectory });
    }

    // ==========================================
    // 2. 奖励分配流 (REWARD_PLAN)
    // ==========================================
    else if (type === 'reward_plan') {
      const plan = db.prepare(`
        SELECT p.*, t.title as task_title, u.name as initiator_name
        FROM pool_reward_plans p
        JOIN pool_tasks t ON p.task_id = t.id
        JOIN users u ON t.created_by = u.id
        WHERE p.id = ?
      `).get(id) as any;

      if (!plan) return res.status(404).json({ code: 404, message: '分配方案不存在' });
      
      const nodes = WorkflowEngine.resolveAssignees(WORKFLOWS.REWARD_PLAN, { initiatorId: plan.task_creator_id });
      const currentStatus = plan.status || 'draft'; // draft, pending_hr, pending_admin, completed, rejected

      // Node 1
      trajectory.push({
        seq: 1,
        name: '制定分配方案',
        status: currentStatus === 'draft' ? 'current' : 'past',
        assignees: [{ id: plan.task_creator_id, name: plan.initiator_name }],
        is_auto_skipped: false
      });

      // Node 2
      const node2 = nodes.find(n => n.seq === 2);
      let hrStatus = 'future';
      if (node2?.isSkipped) hrStatus = 'skipped';
      else if (currentStatus === 'pending_hr') hrStatus = 'current';
      else if (['pending_admin', 'completed'].includes(currentStatus) || plan.hr_reviewer_id) hrStatus = 'past';
      else if (currentStatus === 'rejected' && plan.hr_reviewer_id) hrStatus = 'rejected';

      const hrMap = getUsersMap(node2?.assignees || []);
      trajectory.push({
        seq: 2,
        name: '人事风控审计',
        status: hrStatus,
        assignees: (node2?.assignees || []).map((uid: string) => ({ id: uid, name: hrMap[uid] || uid })),
        is_auto_skipped: node2?.isSkipped || false,
        is_escalated: node2?.isEscalated || false,
        actual_reviewer_id: plan.hr_reviewer_id || null,
        comment: currentStatus === 'rejected' && hrStatus === 'rejected' ? plan.reject_reason : null,
      });

      // Node 3
      const node3 = nodes.find(n => n.seq === 3);
      let gmStatus = 'future';
      if (node3?.isSkipped) gmStatus = 'skipped';
      else if (currentStatus === 'pending_admin') gmStatus = 'current';
      else if (currentStatus === 'completed' || plan.admin_reviewer_id) gmStatus = 'past';
      else if (currentStatus === 'rejected' && plan.admin_reviewer_id) gmStatus = 'rejected';

      const gmMap = getUsersMap(node3?.assignees || []);
      trajectory.push({
        seq: 3,
        name: '总办提现复核',
        status: gmStatus,
        assignees: (node3?.assignees || []).map((uid: string) => ({ id: uid, name: gmMap[uid] || uid })),
        is_auto_skipped: node3?.isSkipped || false,
        is_escalated: node3?.isEscalated || false,
        actual_reviewer_id: plan.admin_reviewer_id || null,
        comment: currentStatus === 'rejected' && gmStatus === 'rejected' ? plan.reject_reason : null,
      });

      trajectory.push({
        seq: 4,
        name: '资金下发并结案',
        status: currentStatus === 'completed' ? 'past' : 'future',
        assignees: []
      });

      // Inject timestamps from audit logs
      const rewardAuditLogs = getAuditLogs('reward_plan', id) as any[];
      trajectory.forEach((node: any) => {
        if (node.timestamp) return;
        const log = rewardAuditLogs.find((l: any) => {
          if (node.seq === 1) return l.action === 'create' || l.action === 'submit';
          if (node.seq === 2) return l.from_status === 'pending_hr';
          if (node.seq === 3) return l.from_status === 'pending_admin';
          if (node.seq === 4) return l.action === 'mark_paid' || l.to_status === 'completed';
          return false;
        });
        if (log) node.timestamp = log.created_at;
      });

      return res.json({ code: 0, data: trajectory });
    }

    // ==========================================
    // 3. 个人计划流 (PERF_PLAN) - 拼装引擎节点与真实日志
    // ==========================================
    else if (type === 'perf_plan') {
      const plan = db.prepare(`SELECT p.*, u.name as initiator_name FROM perf_plans p JOIN users u ON p.creator_id = u.id WHERE p.id = ?`).get(id) as any;
      if (!plan) return res.status(404).json({ code: 404, message: '单据不存在' });

      const nodes = WorkflowEngine.resolveAssignees(WORKFLOWS.PERF_PLAN, { initiatorId: plan.creator_id });
      const logs = db.prepare('SELECT * FROM perf_logs WHERE plan_id = ? ORDER BY created_at ASC').all(id) as any[];
      const currentStatus = plan.status;

      // Node 1: 发起人拟定计划
      const submitLog = logs.find(l => l.action === 'submit' || l.action === 'resubmit');
      trajectory.push({
        seq: 1,
        name: '发起申请',
        status: submitLog ? 'past' : (currentStatus === 'draft' ? 'current' : 'past'),
        assignees: [{ id: plan.creator_id, name: plan.initiator_name }],
        comment: submitLog?.comment,
        timestamp: submitLog?.created_at
      });

      // Node 2: 直属主管审核
      const node2 = nodes.find(n => n.seq === 2);
      const isReject = currentStatus === 'rejected';
      const n2Log = logs.find(l => l.role === 'dept_head' && ['approve', 'reject'].includes(l.action));
      let n2Status = 'future';
      
      if (node2?.isSkipped) n2Status = 'skipped';
      else if (n2Log) n2Status = n2Log.action === 'reject' ? 'rejected' : 'past';
      else if (currentStatus === 'pending_review' && plan.approver_id && node2?.assignees?.includes(plan.approver_id)) n2Status = 'current';
      else if (currentStatus === 'pending_review' && node2?.assignees?.length > 0) n2Status = 'current';

      const n2Map = getUsersMap(node2?.assignees || []);
      trajectory.push({
        seq: 2,
        name: '部门一级审核',
        status: n2Status,
        assignees: (node2?.assignees || []).map((uid: string) => ({ id: uid, name: n2Map[uid] || uid })),
        is_auto_skipped: node2?.isSkipped || false,
        is_escalated: node2?.isEscalated || false,
        actual_reviewer_id: n2Log ? n2Log.user_id : null,
        comment: n2Log?.comment,
        timestamp: n2Log?.created_at
      });

      // Node 3: 跨级主管审核
      const node3 = nodes.find(n => n.seq === 3);
      const n3Log = logs.find(l => l.role === 'parent_dept_head' && ['approve', 'reject'].includes(l.action));
      let n3Status = 'future';

      if (node3?.isSkipped) n3Status = 'skipped';
      else if (n3Log) n3Status = n3Log.action === 'reject' ? 'rejected' : 'past';
      else if (currentStatus === 'pending_review' && plan.approver_id && node3?.assignees?.includes(plan.approver_id)) n3Status = 'current';

      const n3Map = getUsersMap(node3?.assignees || []);
      trajectory.push({
        seq: 3,
        name: '上溯跨级审核',
        status: n3Status,
        assignees: (node3?.assignees || []).map((uid: string) => ({ id: uid, name: n3Map[uid] || uid })),
        is_auto_skipped: node3?.isSkipped || false,
        is_escalated: node3?.isEscalated || false,
        actual_reviewer_id: n3Log ? n3Log.user_id : null,
        comment: n3Log?.comment,
        timestamp: n3Log?.created_at
      });

      // Node 4: HRBP备案
      const node4 = nodes.find(n => n.seq === 4);
      const n4Log = logs.find(l => l.role === 'hrbp');
      let n4Status = 'future';
      if (node4?.isSkipped) n4Status = 'skipped';
      else if (n4Log) n4Status = 'past';
      else if (['in_progress', 'completed', 'assessed'].includes(currentStatus)) n4Status = 'past'; // 已经过关

      const n4Map = getUsersMap(node4?.assignees || []);
      trajectory.push({
        seq: 4,
        name: 'HRBP 备案通知',
        status: n4Status,
        assignees: (node4?.assignees || []).map((uid: string) => ({ id: uid, name: n4Map[uid] || uid })),
        is_auto_skipped: node4?.isSkipped || false,
        is_escalated: node4?.isEscalated || false
      });

      return res.json({ code: 0, data: trajectory });
    }

    return res.status(400).json({ code: 400, message: '不支持的业务类型' });

  } catch (error: any) {
    console.error('[Trajectory Error]', error);
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// ── 完整审计日志 API ──
router.get('/audit-log/:type/:id', authMiddleware, (req: AuthRequest, res) => {
  const { type, id } = req.params;
  try {
    const logs = getAuditLogs(type, id);
    return res.json({ code: 0, data: logs });
  } catch (error: any) {
    console.error('[AuditLog Error]', error);
    return res.status(500).json({ code: 500, message: error.message });
  }
});

export default router;
