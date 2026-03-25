import { getDb } from './config/database';
import bcrypt from 'bcryptjs';

export function seedData(): void {
  const db = getDb();

  // 检查是否已有数据
  const userCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as any)?.c || 0;
  if (userCount > 0) {
    console.log('📋 数据库已有数据，跳过seed');
    return;
  }

  console.log('🌱 开始填充种子数据...');

  const passwordHash = bcrypt.hashSync('123456', 10);

  // 部门
  db.prepare(`INSERT INTO departments (id, name, parent_id, leader_user_id, region) VALUES (?, ?, ?, ?, ?)`).run(1, '总裁办', 0, 'admin', '总部');
  db.prepare(`INSERT INTO departments (id, name, parent_id, leader_user_id, region) VALUES (?, ?, ?, ?, ?)`).run(2, '产品部', 1, 'zhangwei', '华东');
  db.prepare(`INSERT INTO departments (id, name, parent_id, leader_user_id, region) VALUES (?, ?, ?, ?, ?)`).run(3, '技术部', 1, 'wangming', '华东');
  db.prepare(`INSERT INTO departments (id, name, parent_id, leader_user_id, region) VALUES (?, ?, ?, ?, ?)`).run(4, 'UX设计组', 2, 'zhangwei', '华东');
  db.prepare(`INSERT INTO departments (id, name, parent_id, leader_user_id, region) VALUES (?, ?, ?, ?, ?)`).run(5, '人力资源部', 1, 'lifang', '总部');
  db.prepare(`INSERT INTO departments (id, name, parent_id, leader_user_id, region) VALUES (?, ?, ?, ?, ?)`).run(6, '市场部', 1, null, '华南');

  // 用户
  const users = [
    ['admin', '管理员', '系统管理员', 1, 'admin', passwordHash],
    ['zhangwei', '张伟', '高级产品经理', 2, 'manager', passwordHash],
    ['lifang', '李芳', '人力资源总监', 5, 'hr', passwordHash],
    ['wangming', '王明', '技术总监', 3, 'manager', passwordHash],
    ['zhaoming', '赵敏', '交互设计师', 4, 'employee', passwordHash],
    ['liuqiang', '刘强', '前端工程师', 3, 'employee', passwordHash],
    ['chenxia', '陈夏', '后端工程师', 3, 'employee', passwordHash],
    ['huangli', '黄丽', '市场经理', 6, 'manager', passwordHash],
  ];
  for (const u of users) {
    db.prepare('INSERT INTO users (id, name, title, department_id, role, password_hash, status) VALUES (?, ?, ?, ?, ?, ?, ?)').run(u[0], u[1], u[2], u[3], u[4], u[5], 'active');
  }

  // 绩效计划
  const plans = [
    ['Q2 项目上线率提升', '技术', 'zhangwei', 'zhangwei', 'wangming', 2, 'in_progress', 92, '高', '2024-06-30', '2024Q2', '公司年度OKR'],
    ['团队技能内训计划', '团队', 'zhangwei', 'zhangwei', 'lifang', 2, 'in_progress', 60, '中', '2024-06-30', '2024Q2', null],
    ['客户满意度提升', '业务', 'zhangwei', 'zhangwei', 'wangming', 2, 'approved', 45, '高', '2024-07-31', '2024Q2', '公司年度OKR'],
    ['微服务架构重构', '技术', 'wangming', 'liuqiang', 'wangming', 3, 'in_progress', 70, '专家', '2024-06-30', '2024Q2', null],
    ['设计系统规范化', '业务', 'zhaoming', 'zhaoming', 'zhangwei', 4, 'pending_review', 30, '中', '2024-07-15', '2024Q2', null],
  ];
  for (const p of plans) {
    db.prepare(
      `INSERT INTO perf_plans (title, category, creator_id, assignee_id, approver_id, department_id, status, progress, difficulty, deadline, quarter, alignment) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(...p);
  }

  // 绩效池任务
  db.prepare(`INSERT INTO pool_tasks (title, department, difficulty, bonus, status, max_participants, progress, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run('Azure Horizon 3.0 性能优化', '技术部', '专家', 15000, 'open', 3, 0, 'wangming');
  db.prepare(`INSERT INTO pool_tasks (title, department, difficulty, bonus, status, max_participants, progress, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run('Q3 市场推广方案', '市场部', '高', 8000, 'open', 5, 0, 'huangli');
  db.prepare(`INSERT INTO pool_tasks (title, department, difficulty, bonus, status, max_participants, progress, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run('新员工入职培训体系', '人力资源部', '中', 5000, 'in_progress', 2, 40, 'lifang');

  // 团队动态
  db.prepare(`INSERT INTO team_feeds (type, title, content, user_id) VALUES (?, ?, ?, ?)`).run('announcement', '公司年会活动报名已开始', '各位同事，本年度公司年会将于下月15日举行，请在周五前提交报名...', null);
  db.prepare(`INSERT INTO team_feeds (type, title, content, user_id) VALUES (?, ?, ?, ?)`).run('onboarding', '欢迎新成员：赵敏 (交互设计师)', '敏敏加入到了 UX 设计组', 'zhaoming');
  db.prepare(`INSERT INTO team_feeds (type, title, content, user_id) VALUES (?, ?, ?, ?)`).run('update', 'Azure Horizon 3.0 开发里程碑已达成', '项目核心功能开发完成，进入测试阶段', 'wangming');

  // 薪资模板
  db.prepare(`INSERT INTO salary_templates (name, type, default_amount, sort_order) VALUES (?, ?, ?, ?)`).run('基本工资', 'income', 15000, 1);
  db.prepare(`INSERT INTO salary_templates (name, type, default_amount, sort_order) VALUES (?, ?, ?, ?)`).run('绩效奖金', 'income', 0, 2);
  db.prepare(`INSERT INTO salary_templates (name, type, default_amount, sort_order) VALUES (?, ?, ?, ?)`).run('全勤奖', 'income', 500, 3);
  db.prepare(`INSERT INTO salary_templates (name, type, default_amount, calc_formula, sort_order) VALUES (?, ?, ?, ?, ?)`).run('社保代扣', 'deduction', 0, 'base * 0.105', 4);
  db.prepare(`INSERT INTO salary_templates (name, type, default_amount, calc_formula, sort_order) VALUES (?, ?, ?, ?, ?)`).run('公积金代扣', 'deduction', 0, 'base * 0.12', 5);
  db.prepare(`INSERT INTO salary_templates (name, type, default_amount, calc_formula, sort_order) VALUES (?, ?, ?, ?, ?)`).run('个人所得税', 'deduction', 0, 'auto_tax', 6);

  // 日常待办任务
  const dailyTasks = [
    ['zhangwei', '审核 UX 设计规范初稿', '查看交互设计师赵敏提交的新版全景图规范文档', '2026-03-30', 'high', 'pending'],
    ['zhangwei', '更新下季度招聘需求', '随着企微集成完成，需要补充两名全栈工程师', '2026-04-05', 'normal', 'pending'],
    ['zhangwei', '确认前端性能优化方案', '审核加载白屏和 SSR 在国内服务器的访问瓶颈', '2026-03-27', 'high', 'pending'],
    ['zhangwei', '参加数据平台组联调会', '', '2026-03-28', 'normal', 'completed'],
  ];
  const insertTask = db.prepare('INSERT INTO tasks (user_id, title, description, due_date, priority, status) VALUES (?, ?, ?, ?, ?, ?)');
  for (const t of dailyTasks) {
    insertTask.run(...t);
  }

  console.log('✅ 种子数据填充完成');
}
