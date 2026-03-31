import { getDb } from '../config/database';

export const WORKFLOWS = {
  PERF_PLAN: 'perf_plan',             // 绩效计划自评与审核
  TASK_MOD: 'task_mod',               // 目标调整与任务延期
  PROPOSAL_CREATE: 'proposal_create', // 奖金提案设立与发布
  REWARD_PLAN: 'reward_plan',         // 奖励分配与审计
  POOL_JOIN: 'pool_join',             // 跨部门参与/评级
};

/**
 * 启动时自动注入默认的流程配置（如果尚未配置）
 */
export function bootstrapWorkflows() {
  const db = getDb();
  const count = db.prepare('SELECT COUNT(*) as c FROM workflow_templates').get() as { c: number };
  
  // 如果数据库中已经存在配置，则跳过注入，保留人工修改的结果
  if (count.c > 0) return;

  const insertTplFunc = db.prepare('INSERT INTO workflow_templates (code, name, description) VALUES (?, ?, ?)');
  const insertNodeFunc = db.prepare('INSERT INTO workflow_nodes (template_id, seq, node_name, node_type, resolver_type, skip_rule) VALUES (?, ?, ?, ?, ?, ?)');

  db.transaction(() => {
    // 1. 绩效计划制定与打分
    const tpl1Id = insertTplFunc.run(WORKFLOWS.PERF_PLAN, '绩效计划审核与评分', '员工发起绩效目标计划，直属/上级跨级审批').lastInsertRowid;
    insertNodeFunc.run(tpl1Id, 1, '发起人拟定计划', 'init', 'self', null);
    insertNodeFunc.run(tpl1Id, 2, '直属部门负责审核', 'approve', 'dept_head', 'auto_skip_if_self');
    insertNodeFunc.run(tpl1Id, 3, '上级部门负责审核', 'approve', 'parent_dept_head', 'auto_skip_if_highest');
    insertNodeFunc.run(tpl1Id, 4, 'HRBP存档备案', 'notify', 'hrbp', null);

    // 2. 悬赏提案设立
    const tpl2Id = insertTplFunc.run(WORKFLOWS.PROPOSAL_CREATE, '奖金提案设立', '员工发起奖池悬赏，HRBP复核加总经审批后发布').lastInsertRowid;
    insertNodeFunc.run(tpl2Id, 1, '发起提案', 'init', 'self', null);
    insertNodeFunc.run(tpl2Id, 2, 'HRBP审核', 'approve', 'hrbp', 'auto_skip_if_self');
    insertNodeFunc.run(tpl2Id, 3, '总经理终审', 'approve', 'gm', 'auto_skip_if_self');

    // 3. 奖励方案分配
    const tpl3Id = insertTplFunc.run(WORKFLOWS.REWARD_PLAN, '奖励分配方案审核', '悬赏发起人分配奖金，须经HRBP合规与GM终审').lastInsertRowid;
    insertNodeFunc.run(tpl3Id, 1, '制定分配方案', 'init', 'task_creator', null);
    insertNodeFunc.run(tpl3Id, 2, '合规审计', 'approve', 'hrbp', 'auto_skip_if_self');
    insertNodeFunc.run(tpl3Id, 3, '总经理确认', 'approve', 'gm', 'auto_skip_if_self');

    // 4. 工作目标调整/延期
    const tpl4Id = insertTplFunc.run(WORKFLOWS.TASK_MOD, '任务调整与延期', '执行过程中修改截止日期或目标要求').lastInsertRowid;
    insertNodeFunc.run(tpl4Id, 1, '发起延期/修改申请', 'init', 'assignee', null);
    insertNodeFunc.run(tpl4Id, 2, '任务发起人确认', 'approve', 'task_creator', 'auto_skip_if_self');

    // 5. 跨部门协作/评级
    const tpl5Id = insertTplFunc.run(WORKFLOWS.POOL_JOIN, '跨部门协作申请', '跨部门参与悬赏或能力评级申请').lastInsertRowid;
    insertNodeFunc.run(tpl5Id, 1, '提交加入申请', 'init', 'self', null);
    insertNodeFunc.run(tpl5Id, 2, '直属负责人知悉', 'approve', 'dept_head', 'auto_skip_if_self');
    insertNodeFunc.run(tpl5Id, 3, '悬赏发起人同意', 'approve', 'task_creator', 'auto_skip_if_self');
  })();
  
  console.log('[Workflow Engine] Bootstrapped default templates.');
}

/**
 * 工作流引擎核心类
 * 负责解析 resolver_type，防范死锁和死循环。
 */
export class WorkflowEngine {
  
  /**
   * 按顺读取模板节点，根据参数上下文（发起人ID等）计算出每一节点的审核人
   */
  static resolveAssignees(templateCode: string, context: { initiatorId: string, deptId?: number, taskCreatorId?: string }) {
    const db = getDb();
    const tpl = db.prepare('SELECT id FROM workflow_templates WHERE code = ? AND is_active = 1').get(templateCode) as any;
    if (!tpl) throw new Error(`Workflow template ${templateCode} not found or inactive`);

    const nodes = db.prepare('SELECT * FROM workflow_nodes WHERE template_id = ? ORDER BY seq ASC').all(tpl.id) as any[];
    
    // 运行时解析每个节点
    const resolvedNodes = nodes.map(node => {
      let assignees: string[] = [];
      const initiatorId = context.initiatorId;

      switch (node.resolver_type) {
        case 'self':
        case 'assignee':
          assignees = [initiatorId];
          break;
        case 'dept_head':
          const dh = WorkflowEngine.getDeptHead(initiatorId);
          if (dh) assignees.push(dh);
          break;
        case 'parent_dept_head':
          const pdh = WorkflowEngine.getParentDeptHead(initiatorId);
          if (pdh) assignees.push(pdh);
          break;
        case 'hrbp':
          assignees = WorkflowEngine.getUsersByRoleTag('hrbp');
          break;
        case 'gm':
          assignees = WorkflowEngine.getUsersByRoleTag('gm');
          break;
        case 'vp':
          assignees = WorkflowEngine.getUsersByRoleTag('vp');
          break;
        case 'task_creator':
          if (context.taskCreatorId) assignees.push(context.taskCreatorId);
          break;
        default:
          break;
      }

      // 规则：auto_skip_if_self -> 如果解决人集合里只有自己，跳过该节点
      let skipReason = null;
      if (node.skip_rule === 'auto_skip_if_self') {
        if (assignees.length === 1 && assignees[0] === initiatorId) {
          skipReason = 'Node skipped: Approver equals Initiator (Self-Approval)';
        }
      }

      const isSkipped = skipReason !== null;

      // 向上攀升机制：如果因为某些原因没找到负责审核的人，自动升级给上一级
      // 这是系统级兜底策略 (Auto-Escalation)
      if (assignees.length === 0 && node.is_required && !isSkipped && node.node_type === 'approve') {
        const gmUsers = WorkflowEngine.getUsersByRoleTag('gm');
        if (gmUsers.length > 0) {
          assignees = gmUsers; // 升级为最高权限审批
        } else {
          assignees = [ 'CaoGuiQiang' ]; // 硬底兜底
        }
      }

      return {
        ...node,
        assignees,
        isSkipped,
        skipReason
      };
    });

    return resolvedNodes;
  }

  static getUsersByRoleTag(tag: string): string[] {
    const db = getDb();
    const rows = db.prepare('SELECT user_id FROM user_role_tags WHERE tag = ?').all(tag) as any[];
    return rows.map(r => r.user_id);
  }

  static getDeptHead(userId: string): string | null {
    const db = getDb();
    const u = db.prepare('SELECT department_id FROM users WHERE id = ?').get(userId) as any;
    if (!u || !u.department_id) return null;
    const d = db.prepare('SELECT p_manager_id FROM departments WHERE id = ?').get(u.department_id) as any;
    return d?.p_manager_id || null;
  }

  static getParentDeptHead(userId: string): string | null {
    const db = getDb();
    const u = db.prepare('SELECT department_id FROM users WHERE id = ?').get(userId) as any;
    if (!u || !u.department_id) return null;

    // 获取上级部门的 ID
    const d = db.prepare('SELECT parent_id FROM departments WHERE id = ?').get(u.department_id) as any;
    if (!d || !d.parent_id || d.parent_id === 0) return null;

    const pd = db.prepare('SELECT p_manager_id FROM departments WHERE id = ?').get(d.parent_id) as any;
    return pd?.p_manager_id || null;
  }
}
