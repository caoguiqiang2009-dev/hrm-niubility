import { WorkflowEngine } from './server/services/workflow-engine';
const nodes = WorkflowEngine.resolveAssignees('pf_plan', { initiatorId: 'wangming' });
console.log(JSON.stringify(nodes, null, 2));
