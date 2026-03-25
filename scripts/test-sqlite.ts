import Database from 'better-sqlite3';

const db = new Database('./data/hrm.db');
const userId = 'zhangwei';

const departments = db.prepare('SELECT id, parent_id FROM departments').all() as any[];
const leaderDepts = db.prepare('SELECT id FROM departments WHERE leader_user_id = ?').all(userId) as any[];

let deptIds = leaderDepts.map(d => d.id);

const findChildren = (parentIds: number[]) => {
  const children = departments.filter(d => parentIds.includes(d.parent_id)).map(d => d.id);
  if (children.length > 0) {
    children.forEach(c => {
      if (!deptIds.includes(c)) deptIds.push(c);
    });
    findChildren(children);
  }
};
findChildren([...deptIds]);

if (deptIds.length > 0) {
  const placeholders = deptIds.map(() => '?').join(',');
  const query = `SELECT id, name, title, avatar_url, role FROM users WHERE department_id IN (${placeholders}) AND status = ? AND id != ?`;
  console.log('Query:', query);
  console.log('Params:', ...deptIds, 'active', userId);
  
  const subordinates = db.prepare(query).all(...deptIds, 'active', userId);
  console.log('subordinates:', subordinates);
}
