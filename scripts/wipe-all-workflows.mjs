/**
 * 无差别清理所有流程流转数据（任务板、绩效单、能力模型打分、通知等等）
 * 仅保留系统底座、账套人员、审批模型以及字典数据。
 * 在生产环境全量清空的专属脚本。
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

const safeRun = (label, sql) => {
  try {
    const result = db.prepare(sql).run();
    console.log(`   ✅ ${label}: 清理 ${result.changes} 条`);
  } catch (e) {
    if (e.message.includes('no such table')) {
      console.log(`   ⚠️  ${label}: 跳过 (表不存在, ${e.message})`);
    } else {
      console.log(`   ❌  ${label}: 失败 (${e.message})`);
    }
  }
};

console.log('🧹 [警告] 开始做【无差别流程数据清空】...');

const cleanup = db.transaction(() => {
  // 1. 绩效业务
  safeRun('绩效计划 (perf_plans)', 'DELETE FROM perf_plans');
  safeRun('绩效日志 (perf_logs)', 'DELETE FROM perf_logs');
  safeRun('月度考评 (monthly_evaluations)', 'DELETE FROM monthly_evaluations');
  safeRun('月度打分人 (monthly_eval_reviewers)', 'DELETE FROM monthly_eval_reviewers');
  
  // 2. 赏金任务与项目池
  safeRun('绩效池任务 (pool_tasks)', 'DELETE FROM pool_tasks');
  safeRun('绩效池参与者 (pool_participants)', 'DELETE FROM pool_participants');
  safeRun('加入审批 (pool_join_requests)', 'DELETE FROM pool_join_requests');
  safeRun('角色认领 (pool_role_claims)', 'DELETE FROM pool_role_claims');
  safeRun('任务延期 (pool_task_extensions)', 'DELETE FROM pool_task_extensions');
  safeRun('STAR报告 (pool_star_reports)', 'DELETE FROM pool_star_reports');
  safeRun('临时提案池 (pool_proposals)', 'DELETE FROM pool_proposals');

  // 3. 能力与培训测评
  safeRun('测评任务 (test_assignments)', 'DELETE FROM test_assignments');
  safeRun('测评答题 (test_answers)', 'DELETE FROM test_answers');
  safeRun('能力评估 (competency_evaluations)', 'DELETE FROM competency_evaluations');
  safeRun('能力打分 (competency_scores)', 'DELETE FROM competency_scores');

  // 4. 公共协作底层
  safeRun('日常任务 (tasks)', 'DELETE FROM tasks');
  safeRun('团队动态 (team_feeds)', 'DELETE FROM team_feeds');
  safeRun('消息与推送 (message_logs)', 'DELETE FROM message_logs');
  safeRun('企微卡片回调 (card_response_codes)', 'DELETE FROM card_response_codes');
  safeRun('系统红点通知 (notifications)', 'DELETE FROM notifications');

  // 5. 重置核心业务表的自增主键(安全重置 ID 到 0)
  const sequences = [
    'perf_plans', 'perf_logs', 'pool_tasks', 'monthly_evaluations', 'pool_join_requests',
    'pool_role_claims', 'pool_star_reports', 'competency_evaluations', 'team_feeds', 'notifications', 'tasks'
  ];
  try {
    for (const seq of sequences) {
      db.prepare('DELETE FROM sqlite_sequence WHERE name = ?').run(seq);
    }
    console.log('   🔄 SQLite 序列已归零，新数据 ID 将从 1 重新开始');
  } catch(e) { /* sqlite_sequence might be locked or not existing if no autoincrement yet */ }
});

try {
  cleanup();
  console.log('\n🌟 流程测试数据已被全量清空！系统恢复初始出厂状态。');
} catch (err) {
  console.error('\n❌ 清理事务中止:', err);
}

db.close();
