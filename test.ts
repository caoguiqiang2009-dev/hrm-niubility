import jwt from 'jsonwebtoken';
const token = jwt.sign({ userId: 'zhangwei', role: 'manager' }, 'hrm_niubility_jwt_secret_2024', { expiresIn: '7d' });
fetch('http://localhost:3001/api/perf/team-status', { headers: { 'Authorization': `Bearer ${token}` } })
  .then(res => res.json())
  .then(data => console.log(JSON.stringify(data.data.map(d => d.id))))
  .catch(console.error);
