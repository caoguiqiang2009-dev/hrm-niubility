import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initDatabase } from './config/database';
import { seedData } from './seed';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// 项目根目录: 开发模式在 server/ 的上级，生产模式在 server-dist/ 的上级
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Routes
import authRoutes from './routes/auth';
import orgRoutes from './routes/org';
import perfRoutes from './routes/perf';
import teamRoutes from './routes/team';
import salaryRoutes from './routes/salary';
import notifyRoutes from './routes/notify';
import dashboardRoutes from './routes/dashboard';
import poolRoutes from './routes/pool';
import aiRoutes from './routes/ai';
import taskRoutes from './routes/tasks';
import permissionsRoutes from './routes/permissions';

const app = express();
const PORT = process.env.SERVER_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/org', orgRoutes);
app.use('/api/perf', perfRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/salary', salaryRoutes);
app.use('/api/notify', notifyRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/pool', poolRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/permissions', permissionsRoutes);

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 企微域名归属自动验证 (免手动传文件验证)
// 企微验证文件的内容永远和它文件名里的随机串一致
app.get('/WW_verify_*.txt', (req, res) => {
  // 提取如 WW_verify_12345.txt 中的 12345
  const verifyCode = req.path.replace('/WW_verify_', '').replace('.txt', '');
  res.type('text/plain');
  res.send(verifyCode);
});

// 生产模式: serve 前端静态文件
if (process.env.NODE_ENV === 'production') {
  const distPath = path.resolve(PROJECT_ROOT, 'dist');
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// 确保数据目录存在
const dataDir = path.resolve(PROJECT_ROOT, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 初始化数据库 & 种子数据
initDatabase();
seedData();

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 HRM Backend Server running on http://localhost:${PORT}`);
  console.log(`📡 API endpoints available at http://localhost:${PORT}/api`);
});

export default app;
