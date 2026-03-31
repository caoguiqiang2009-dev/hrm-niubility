import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// In dev: server/config/ -> ../../ (root)
// In prod (tsup bundle): server-dist/ -> ../ (root)
const PROJECT_ROOT = __dirname.endsWith('server-dist') ? path.resolve(__dirname, '..') : path.resolve(__dirname, '../..');
const DB_PATH = path.resolve(PROJECT_ROOT, 'data/hrm.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    console.log(`📦 SQLite connected: ${DB_PATH}`);
  }
  return db;
}

export function initDatabase(): void {
  const db = getDb();

  db.exec(`
    -- ============ 组织架构 ============

    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      parent_id INTEGER DEFAULT 0,
      leader_user_id TEXT,
      region TEXT,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      title TEXT,
      department_id INTEGER,
      avatar_url TEXT,
      mobile TEXT,
      email TEXT,
      password_hash TEXT,
      role TEXT DEFAULT 'employee',
      status TEXT DEFAULT 'active',
      synced_at DATETIME
    );

    -- ============ 绩效生命周期 ============

    CREATE TABLE IF NOT EXISTS perf_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT,
      creator_id TEXT NOT NULL,
      assignee_id TEXT,
      approver_id TEXT,
      department_id INTEGER,
      status TEXT DEFAULT 'draft',
      progress INTEGER DEFAULT 0,
      target_value TEXT,
      actual_value TEXT,
      score REAL,
      bonus REAL,
      difficulty TEXT,
      deadline DATE,
      quarter TEXT,
      alignment TEXT,
      reject_reason TEXT,
      collaborators TEXT,
      assessed_at DATETIME,
      rewarded_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS perf_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      action TEXT,
      old_value TEXT,
      new_value TEXT,
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ============ 统一审计日志 ============
    CREATE TABLE IF NOT EXISTS workflow_audit_logs (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      business_type TEXT NOT NULL,
      business_id   INTEGER NOT NULL,
      actor_id      TEXT NOT NULL,
      action        TEXT NOT NULL,
      from_status   TEXT,
      to_status     TEXT,
      comment       TEXT,
      extra_json    TEXT,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_wal_biz ON workflow_audit_logs(business_type, business_id);

    -- ============ 绩效池 ============

    CREATE TABLE IF NOT EXISTS pool_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      department TEXT,
      difficulty TEXT DEFAULT 'normal',
      reward_type TEXT DEFAULT 'money',
      bonus REAL,
      max_participants INTEGER DEFAULT 5,
      created_by TEXT,
      hr_reviewer_id TEXT,
      admin_reviewer_id TEXT,
      reject_reason TEXT,
      status TEXT DEFAULT 'open',
      proposal_status TEXT DEFAULT 'approved',
      deadline DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS pool_participants (
      pool_task_id INTEGER,
      user_id TEXT,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (pool_task_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS pool_join_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pool_task_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      reason TEXT,
      role TEXT,
      status TEXT DEFAULT 'pending',
      reviewer_id TEXT,
      review_comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      reviewed_at DATETIME
    );

    -- ============ 通知 ============

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      type TEXT,
      title TEXT,
      content TEXT,
      related_plan_id INTEGER,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ============ 团队动态 ============

    CREATE TABLE IF NOT EXISTS team_feeds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT,
      title TEXT,
      content TEXT,
      user_id TEXT,
      department_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );


    -- ============ 消息推送记录 ============

    CREATE TABLE IF NOT EXISTS message_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      msg_type TEXT,
      title TEXT,
      content TEXT,
      status TEXT DEFAULT 'sent',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ============ 企微交互卡片 response_code ============
    CREATE TABLE IF NOT EXISTS card_response_codes (
      plan_id INTEGER PRIMARY KEY,
      response_code TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ============ 能力维度与模型 ============
    CREATE TABLE IF NOT EXISTS competency_models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      department_id TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS competency_library (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT,
      name TEXT NOT NULL,
      description TEXT,
      default_max_score REAL DEFAULT 5.0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS competency_dimensions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      model_id INTEGER NOT NULL,
      library_id INTEGER,
      category TEXT,
      name TEXT NOT NULL,
      max_score REAL DEFAULT 5.0,
      weight REAL DEFAULT 1.0,
      target_score REAL DEFAULT 3.0,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS competency_evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      evaluator_id TEXT,
      model_id INTEGER NOT NULL,
      status TEXT DEFAULT 'pending_self', -- pending_self, pending_manager, completed
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      finished_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS competency_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      evaluation_id INTEGER NOT NULL,
      dimension_id INTEGER NOT NULL,
      self_score REAL,
      manager_score REAL,
      comment TEXT
    );

    -- ============ 日常待办任务 ============
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      due_date DATE,
      priority TEXT DEFAULT 'normal',
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ============ 权限覆盖配置 ============
    CREATE TABLE IF NOT EXISTS permission_overrides (
      key TEXT PRIMARY KEY,
      admin_val INTEGER,
      hr_val INTEGER,
      manager_val INTEGER,
      employee_val INTEGER,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ============ 用户级权限覆盖 (ACL) ============
    CREATE TABLE IF NOT EXISTS user_perm_overrides (
      user_id TEXT NOT NULL,
      perm_key TEXT NOT NULL,
      allowed INTEGER NOT NULL DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, perm_key)
    );

    -- ============ 团队数据可视范围自定义 ============
    -- 仅影响"团队绩效与任务追踪"页面的成员可见范围，不影响其他权限
    CREATE TABLE IF NOT EXISTS team_view_scopes (
      manager_id TEXT NOT NULL,
      member_id  TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (manager_id, member_id)
    );

    -- ============ 可配置高层角色与工作流引擎 ============
    CREATE TABLE IF NOT EXISTS user_role_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      tag TEXT NOT NULL,        -- 'vp' / 'gm' / 'hrbp'
      label TEXT,               -- 显示名
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, tag)
    );

    CREATE TABLE IF NOT EXISTS workflow_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      version INTEGER DEFAULT 1,
      updated_by TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS workflow_nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL REFERENCES workflow_templates(id),
      seq INTEGER NOT NULL,
      node_name TEXT NOT NULL,
      node_type TEXT NOT NULL,
      resolver_type TEXT NOT NULL,
      resolver_config TEXT DEFAULT '{}',
      skip_rule TEXT,
      is_required INTEGER DEFAULT 1
    );

    -- ============ 审批流模板 ============
    CREATE TABLE IF NOT EXISTS approval_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon TEXT DEFAULT 'approval',
      description TEXT DEFAULT '',
      category TEXT DEFAULT 'general',
      business_types TEXT DEFAULT '[]',
      permissions TEXT DEFAULT '{}',
      enabled INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ============ 审批流节点 ============
    CREATE TABLE IF NOT EXISTS approval_nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL REFERENCES approval_templates(id) ON DELETE CASCADE,
      node_type TEXT NOT NULL DEFAULT 'approver',
      node_index INTEGER NOT NULL DEFAULT 0,
      label TEXT DEFAULT '',
      approve_type TEXT DEFAULT 'serial',
      config_json TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    -- ============ 绩效预算 ============
    CREATE TABLE IF NOT EXISTS perf_budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quarter TEXT NOT NULL,
      department_id INTEGER,
      budget_amount REAL NOT NULL,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ============ 题库与在线评测 ============
    CREATE TABLE IF NOT EXISTS test_banks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      mapped_library_id INTEGER, -- 关联到 competency_library.id
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS test_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bank_id INTEGER NOT NULL,
      type TEXT DEFAULT 'single', -- single, multiple
      question TEXT NOT NULL,
      options_json TEXT NOT NULL, -- JSON string array
      correct_answer TEXT NOT NULL, -- "A" or "A,B"
      score REAL DEFAULT 10,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS test_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bank_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      assigned_by TEXT,
      status TEXT DEFAULT 'pending', -- pending, completed
      final_score REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS test_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      user_answer TEXT,
      is_correct INTEGER DEFAULT 0,
      earned_score REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ============ 月度绩效考评引擎 ============
    CREATE TABLE IF NOT EXISTS monthly_evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      month TEXT NOT NULL, -- e.g. "2024-06"
      status TEXT DEFAULT 'pending', -- pending, completed
      self_score REAL DEFAULT 0,
      manager_score REAL DEFAULT 0,
      prof_score REAL DEFAULT 0,
      peer_score REAL DEFAULT 0,
      final_score REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS monthly_eval_reviewers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      evaluation_id INTEGER NOT NULL,
      reviewer_id TEXT NOT NULL,
      role TEXT NOT NULL, -- self, manager, prof, peer
      score REAL,
      comment TEXT,
      status TEXT DEFAULT 'pending', -- pending, submitted
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      submitted_at DATETIME
    );

    -- ============ 发薪台账导出模板 ============
    CREATE TABLE IF NOT EXISTS payroll_export_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      fields_json TEXT NOT NULL,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);


  try {
    db.prepare('ALTER TABLE competency_dimensions ADD COLUMN library_id INTEGER').run();
  } catch (e) {}
  try {
    db.prepare('ALTER TABLE competency_dimensions ADD COLUMN target_score REAL DEFAULT 3.0').run();
  } catch (e) {}
  
  try {
    db.prepare('ALTER TABLE test_banks ADD COLUMN is_archived INTEGER DEFAULT 0').run();
  } catch (e) {}

  // ============ 数据库迁移：缺失表和列 ============
  // pool_role_claims 表（RACI 角色认领）
  db.exec(`
    CREATE TABLE IF NOT EXISTS pool_role_claims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pool_task_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      role_name TEXT NOT NULL,
      reward REAL,
      reason TEXT,
      status TEXT DEFAULT 'pending',
      reviewer_id TEXT,
      review_comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      reviewed_at DATETIME
    );
  `);

  // pool_tasks 缺失列迁移
  const poolMigrations = [
    'ALTER TABLE pool_tasks ADD COLUMN deleted_at DATETIME',
    'ALTER TABLE pool_tasks ADD COLUMN progress INTEGER DEFAULT 0',
    'ALTER TABLE pool_tasks ADD COLUMN roles_config TEXT',
    'ALTER TABLE pool_tasks ADD COLUMN dept_head_id TEXT',
    // 奖励分配平台新增字段
    'ALTER TABLE pool_tasks ADD COLUMN actual_end_reason TEXT',
    'ALTER TABLE pool_tasks ADD COLUMN actual_completion REAL',
    'ALTER TABLE pool_tasks ADD COLUMN terminated_by TEXT',
    'ALTER TABLE pool_tasks ADD COLUMN terminated_at DATETIME',
    'ALTER TABLE pool_tasks ADD COLUMN star_phase_started_at DATETIME',
    // 流程3&6: 交付对象金主物理字段
    'ALTER TABLE pool_tasks ADD COLUMN delivery_target_id TEXT',
  ];
  for (const sql of poolMigrations) {
    try { db.prepare(sql).run(); } catch (e) {}
  }

  // ── 延期记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS pool_task_extensions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pool_task_id INTEGER NOT NULL,
      initiator_id TEXT NOT NULL,
      original_deadline TEXT NOT NULL,
      new_deadline TEXT NOT NULL,
      reason TEXT NOT NULL,
      impact_analysis TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ── STAR 绩效报告表
  db.exec(`
    CREATE TABLE IF NOT EXISTS pool_star_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pool_task_id INTEGER NOT NULL,
      reward_plan_id INTEGER,
      user_id TEXT NOT NULL,
      role_name TEXT NOT NULL,
      situation TEXT,
      task_desc TEXT,
      action TEXT,
      result TEXT,
      is_submitted INTEGER DEFAULT 0,
      submitted_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_star_task_user
      ON pool_star_reports(pool_task_id, user_id);
  `);

  // ── 奖励分配主表
  db.exec(`
    CREATE TABLE IF NOT EXISTS pool_reward_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pool_task_id INTEGER NOT NULL,
      initiator_id TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      total_bonus REAL NOT NULL DEFAULT 0,
      reward_type TEXT DEFAULT 'money',
      attachments TEXT DEFAULT '[]',
      hr_reviewer_id TEXT,
      hr_comment TEXT,
      hr_reviewed_at DATETIME,
      admin_reviewer_id TEXT,
      admin_comment TEXT,
      admin_reviewed_at DATETIME,
      pay_period TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ── 每人奖励分配明细表
  db.exec(`
    CREATE TABLE IF NOT EXISTS pool_reward_distributions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reward_plan_id INTEGER NOT NULL,
      pool_task_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      role_name TEXT NOT NULL,
      bonus_amount REAL DEFAULT 0,
      perf_score REAL DEFAULT 0,
      paid_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);


  // perf_plans 缺失列迁移
  const perfMigrations = [
    'ALTER TABLE perf_plans ADD COLUMN dept_head_id TEXT',
    'ALTER TABLE perf_plans ADD COLUMN resource TEXT',
    'ALTER TABLE perf_plans ADD COLUMN relevance TEXT',
    // 流程1: 团队签收状态JSON
    'ALTER TABLE perf_plans ADD COLUMN receipt_status TEXT',
  ];
  for (const sql of perfMigrations) {
    try { db.prepare(sql).run(); } catch (e) {}
  }

  // 【风险5】monthly_evaluations 增加 deadline 字段（HR 设置考评截止时间）
  // 【风险6】pool_reward_plans 增加 paid_at 字段（实际发放时间）
  const v211Migrations = [
    'ALTER TABLE monthly_evaluations ADD COLUMN deadline DATE',
    'ALTER TABLE monthly_eval_reviewers ADD COLUMN reminded_at DATETIME',
    'ALTER TABLE pool_reward_plans ADD COLUMN paid_at DATETIME',
  ];
  for (const sql of v211Migrations) {
    try { db.prepare(sql).run(); } catch (e) {}
  }

  // ============ 初始化能力库预设数据 ============
  const libCount = db.prepare('SELECT COUNT(*) as count FROM competency_library').get() as {count: number};
  if (libCount && libCount.count === 0) {
    const insertLib = db.prepare('INSERT INTO competency_library (category, name, description, default_max_score) VALUES (?, ?, ?, ?)');
    const presets = [
      ['通用基石', '沟通表达与协作', '能清晰、准确地表达观点，倾听他人意见，在跨部门或团队内顺畅协作，共同推进目标达成。', 5.0],
      ['通用基石', '抗压与情绪管理', '面对高压、挫折或突发事件时，能够保持情绪稳定，快速恢复状态并积极面对挑战。', 5.0],
      ['核心基础', '问题分析与解决', '面对复杂问题时，能抓住事物本质，运用结构化思维拆解问题，提供切实可行的解决方案。', 5.0],
      ['核心基础', '结果导向与执行', '具有极强的目标感，在遇到困难时不找借口，主动寻求资源确保工作成果按时、保质交付。', 5.0],
      ['专业技能', '专业技能与技术深度', '在岗位所属专业领域具备扎实的理论基础和实践经验，能够解决该领域的棘手技术/业务难题。', 5.0],
      ['专业技能', '业务理解与创新力', '深入理解公司业务战略或产品逻辑，不设边界，经常提出有建设性的突破性、创新性方案。', 5.0],
      ['管理领导', '团队管理与赋能', '有效选拔、培养和激励下属，合理分配任务，持续辅导团队成员提升能力并取得成功。', 5.0],
      ['管理领导', '战略执行与辅导', '能够将公司战略分解为团队目标，并在执行过程中给予团队方向把控与资源支持。', 5.0],
    ];
    db.transaction(() => {
      for (const p of presets) {
        insertLib.run(p[0], p[1], p[2], p[3]);
      }
    })();
    console.log('✅ Competency library seeded with default presets');
  }

  console.log('✅ Database tables initialized');
}
