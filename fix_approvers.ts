import { getDb } from './server/config/database';
import { WorkflowEngine, WORKFLOWS } from './server/services/workflow-engine';

const db = getDb();
const plans = db.prepare("SELECT * FROM perf_plans WHERE status = 'pending_review' OR status = 'pending_dept_review'").all() as any[];

let count = 0;
for (const plan of plans) {
  const nodes = WorkflowEngine.resolveAssignees(WORKFLOWS.PERF_PLAN, { initiatorId: plan.creator_id, deptId: plan.department_id });
  
  if (plan.status === 'pending_review') {
    const node2 = nodes.find((n: any) => n.seq === 2);
    const firstApproverId = node2?.assignees?.[0] || 'admin';
    if (firstApproverId !== plan.approver_id) {
        db.prepare("UPDATE perf_plans SET approver_id = ? WHERE id = ?").run(firstApproverId, plan.id);
        console.log(`Updated plan ${plan.id} approver ${plan.approver_id} -> ${firstApproverId}`);
        count++;
    }
  } else if (plan.status === 'pending_dept_review') {
    const node3 = nodes.find((n: any) => n.seq === 3);
    const secondApproverId = node3?.assignees?.[0] || 'admin';
    if (secondApproverId !== plan.dept_head_id) {
        db.prepare("UPDATE perf_plans SET dept_head_id = ? WHERE id = ?").run(secondApproverId, plan.id);
        console.log(`Updated plan ${plan.id} dept head ${plan.dept_head_id} -> ${secondApproverId}`);
        count++;
    }
  }
}
console.log(`Fixed ${count} pending plans`);
