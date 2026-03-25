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

    -- ============ 绩效池 ============

    CREATE TABLE IF NOT EXISTS pool_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      department TEXT,
      difficulty TEXT,
      bonus REAL,
      status TEXT DEFAULT 'open',
      max_participants INTEGER,
      progress INTEGER DEFAULT 0,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS pool_participants (
      pool_task_id INTEGER,
      user_id TEXT,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (pool_task_id, user_id)
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

    -- ============ 工资表 ============

    CREATE TABLE IF NOT EXISTS salary_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT,
      default_amount REAL DEFAULT 0,
      calc_formula TEXT,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS salary_sheets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      month TEXT NOT NULL,
      department_id INTEGER,
      status TEXT DEFAULT 'draft',
      total_amount REAL DEFAULT 0,
      employee_count INTEGER DEFAULT 0,
      creator_id TEXT,
      approver_id TEXT,
      approved_at DATETIME,
      published_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS salary_rows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sheet_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT,
      department_name TEXT,
      base_salary REAL DEFAULT 0,
      perf_bonus REAL DEFAULT 0,
      attendance_bonus REAL DEFAULT 0,
      overtime_pay REAL DEFAULT 0,
      other_income REAL DEFAULT 0,
      social_insurance REAL DEFAULT 0,
      housing_fund REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      other_deduction REAL DEFAULT 0,
      gross_pay REAL DEFAULT 0,
      net_pay REAL DEFAULT 0,
      remark TEXT
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
  `);

  console.log('✅ Database tables initialized');
}
