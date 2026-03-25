import jwt from 'jsonwebtoken';

async function test() {
  const token = jwt.sign({ userId: 'zhangwei', role: 'manager' }, 'hrm_niubility_jwt_secret_2024', { expiresIn: '7d' });
  const res = await fetch('http://localhost:3001/api/perf/team-status', { headers: { 'Authorization': `Bearer ${token}` } });
  const json = await res.json();
  console.log('Result for zhangwei:', json.data.map((d: any) => d.id));
}

test();
