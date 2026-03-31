const Database = require('better-sqlite3');
const db = new Database('./data/hrm.db');

function getChain(userId) {
  const user = db.prepare('SELECT id, name, role, department_id FROM users WHERE id = ?').get(userId);
  if (!user) return { user: null, chain: [] };
  const chain = [];
  let deptId = user.department_id;
  const visited = new Set();
  while (deptId && !visited.has(deptId)) {
    visited.add(deptId);
    const dept = db.prepare('SELECT id, name, parent_id, leader_user_id FROM departments WHERE id = ?').get(deptId);
    if (!dept) break;
    const leader = dept.leader_user_id
      ? db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(dept.leader_user_id)
      : null;
    chain.push({
      dept: dept.name,
      deptId: dept.id,
      leader: leader ? leader.name : 'X-none',
      leaderId: leader ? leader.id : null,
      isSelf: leader ? leader.id === userId : false
    });
    deptId = dept.parent_id > 0 ? dept.parent_id : null;
  }
  return { user: { id: user.id, name: user.name, role: user.role }, chain };
}

const allUsers = db.prepare('SELECT id FROM users').all();
allUsers.forEach(u => {
  const r = getChain(u.id);
  if (!r.user) return;
  console.log(r.user.name + '(' + r.user.id + ') [' + r.user.role + ']:');
  r.chain.forEach((c, i) => {
    const prefix = i === 0 ? '  L0: ' : '  L' + i + ': ';
    const selfMark = c.isSelf ? ' <<SELF>>' : '';
    console.log(prefix + c.dept + ' leader=' + c.leader + selfMark);
  });
  console.log('');
});
