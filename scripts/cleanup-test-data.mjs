/**
 * 清理测试账号及其产生的所有数据
 * 在生产环境部署后运行: node scripts/cleanup-test-data.mjs
 */
import Database from 'better-sqlite3';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '..', 'data', 'hrm.db');

if (!existsSync(dbPath)) {
  console.log('⚠️  数据库文件不存在:', dbPath);
  process.exit(0);
}

const db = new Database(dbPath);

// 种子数据中的测试用户 ID
const TEST_USERS = ['admin', 'zhangwei', 'lifang', 'wangming', 'zhaoming', 'liuqiang', 'chenxia', 'huangli'];
const placeholders = TEST_USERS.map(() => '?').join(',');

console.log('🧹 开始清理测试数据...');
console.log(`   目标账号: ${TEST_USERS.join(', ')}`);

const cleanup = db.transaction(() => {
  // 1. 删除测试用户的通知
  const r1 = db.prepare(`DELETE FROM notifications WHERE user_id IN (${placeholders})`).run(...TEST_USERS);
  console.log(`   ✅ 通知: 删除 ${r1.changes} 条`);

  // 2. 删除测试用户的待办任务
  const r2 = db.prepare(`DELETE FROM tasks WHERE user_id IN (${placeholders})`).run(...TEST_USERS);
  console.log(`   ✅ 待办任务: 删除 ${r2.changes} 条`);

  // 3. 删除测试用户创建/参与的绩效日志
  const r3a = db.prepare(`DELETE FROM perf_logs WHERE user_id IN (${placeholders})`).run(...TEST_USERS);
  console.log(`   ✅ 绩效日志: 删除 ${r3a.changes} 条`);

  // 4. 删除测试用户关联的绩效计划
  const r4 = db.prepare(`DELETE FROM perf_plans WHERE creator_id IN (${placeholders}) OR assignee_id IN (${placeholders}) OR approver_id IN (${placeholders})`).run(...TEST_USERS, ...TEST_USERS, ...TEST_USERS);
  console.log(`   ✅ 绩效计划: 删除 ${r4.changes} 条`);

  // 5. 删除测试用户创建的绩效池任务
  const r5 = db.prepare(`DELETE FROM pool_tasks WHERE created_by IN (${placeholders})`).run(...TEST_USERS);
  console.log(`   ✅ 绩效池任务: 删除 ${r5.changes} 条`);

  // 6. 删除团队动态 (seed模拟数据)
  const r6 = db.prepare(`DELETE FROM team_feeds`).run();
  console.log(`   ✅ 团队动态: 删除 ${r6.changes} 条`);

  // 7. 删除薪资模板 (seed模拟数据) — 保留，因为生产也需要
  // const r7 = db.prepare(`DELETE FROM salary_templates`).run();

  // 8. 删除测试用户关联的薪资记录
  const r8 = db.prepare(`DELETE FROM salary_records WHERE user_id IN (${placeholders})`).run(...TEST_USERS);
  console.log(`   ✅ 薪资记录: 删除 ${r8.changes} 条`);

  // 9. 删除测试用户权限
  const r9 = db.prepare(`DELETE FROM permissions WHERE user_id IN (${placeholders})`).run(...TEST_USERS);
  console.log(`   ✅ 权限记录: 删除 ${r9.changes} 条`);

  // 10. 删除测试用户本身
  const r10 = db.prepare(`DELETE FROM users WHERE id IN (${placeholders}) AND wecom_userid IS NULL`).run(...TEST_USERS);
  console.log(`   ✅ 测试用户: 删除 ${r10.changes} 个`);
  console.log(`   ⚠️  已通过企微同步的用户不会被删除`);

  // 11. 删除种子部门 (仅删除没有真实用户的部门)
  // 不自动删除部门，因为企微同步的部门可能和种子部门重叠
});

try {
  cleanup();
  console.log('\n✅ 测试数据清理完成！');
} catch (err) {
  console.error('❌ 清理失败:', err);
}

db.close();
