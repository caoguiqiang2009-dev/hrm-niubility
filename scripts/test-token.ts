import jwt from 'jsonwebtoken';
const token = jwt.sign({ userId: 'zhangwei', role: 'manager' }, 'hrm_niubility_jwt_secret_2024', { expiresIn: '7d' });
console.log(token);
