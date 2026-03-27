import { Router } from 'express';
import { getDb } from '../config/database';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth';
import { calculateSocialInsurance, calculateHousingFund, calculateNetPay } from '../services/payroll';
import { notifyPayslip } from '../services/message';
import { wecomConfig } from '../config/wecom';
import * as SmartSheet from '../services/smartsheet';

const router = Router();

// 薪资模板列表
router.get('/templates', authMiddleware, requireRole('admin', 'hr'), (_req, res) => {
  const db = getDb();
  const templates = db.prepare('SELECT * FROM salary_templates WHERE is_active = 1 ORDER BY sort_order').all();
  return res.json({ code: 0, data: templates });
});

// 创建/编辑薪资模板
router.post('/templates', authMiddleware, requireRole('admin', 'hr'), (req, res) => {
  const { id, name, type, default_amount, calc_formula, sort_order } = req.body;
  const db = getDb();

  if (id) {
    db.prepare('UPDATE salary_templates SET name=?, type=?, default_amount=?, calc_formula=?, sort_order=? WHERE id=?').run(name, type, default_amount, calc_formula, sort_order, id);
  } else {
    db.prepare('INSERT INTO salary_templates (name, type, default_amount, calc_formula, sort_order) VALUES (?, ?, ?, ?, ?)').run(name, type, default_amount, calc_formula, sort_order);
  }
  return res.json({ code: 0, message: '保存成功' });
});

// 生成月度工资表
router.post('/sheets/generate', authMiddleware, requireRole('admin', 'hr'), (req: AuthRequest, res) => {
  const { month, department_id } = req.body;
  const db = getDb();

  // 查找目标员工
  let sql = 'SELECT id, name, department_id FROM users WHERE status = ?';
  const params: any[] = ['active'];
  if (department_id) { sql += ' AND department_id = ?'; params.push(department_id); }
  const employees = db.prepare(sql).all(...params) as any[];

  if (employees.length === 0) {
    return res.status(400).json({ code: 400, message: '没有符合条件的员工' });
  }

  // 获取薪资模板默认值
  const baseSalaryTemplate = db.prepare("SELECT default_amount FROM salary_templates WHERE name = '基本工资' AND is_active = 1").get() as any;
  const defaultBase = baseSalaryTemplate?.default_amount || 10000;

  // 创建工资表
  const deptName = department_id ? (db.prepare('SELECT name FROM departments WHERE id = ?').get(department_id) as any)?.name : '全员';
  const title = `${month} ${deptName || ''}工资表`;

  const sheet = db.prepare('INSERT INTO salary_sheets (title, month, department_id, creator_id, employee_count) VALUES (?, ?, ?, ?, ?)').run(title, month, department_id || null, req.userId, employees.length);
  const sheetId = sheet.lastInsertRowid;

  // 为每个员工生成工资行
  const insertRow = db.prepare(
    `INSERT INTO salary_rows (sheet_id, user_id, user_name, department_name, base_salary, perf_bonus, social_insurance, housing_fund, gross_pay, tax, net_pay) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  let totalAmount = 0;
  const generateTransaction = db.transaction(() => {
    for (const emp of employees) {
      const deptInfo = db.prepare('SELECT name FROM departments WHERE id = ?').get(emp.department_id) as any;
      // 获取该员工本月已发放的绩效奖金
      const bonus = db.prepare(
        "SELECT COALESCE(SUM(bonus), 0) as total FROM perf_plans WHERE assignee_id = ? AND status = 'completed' AND strftime('%Y-%m', rewarded_at) = ?"
      ).get(emp.id, month) as any;

      const baseSalary = defaultBase;
      const perfBonus = bonus?.total || 0;
      const socialIns = calculateSocialInsurance(baseSalary);
      const housingFund = calculateHousingFund(baseSalary);

      const pay = calculateNetPay({
        base_salary: baseSalary, perf_bonus: perfBonus,
        attendance_bonus: 0, overtime_pay: 0, other_income: 0,
        social_insurance: socialIns, housing_fund: housingFund, other_deduction: 0,
      });

      insertRow.run(sheetId, emp.id, emp.name, deptInfo?.name || '', baseSalary, perfBonus, socialIns, housingFund, pay.gross_pay, pay.tax, pay.net_pay);
      totalAmount += pay.net_pay;
    }
  });
  generateTransaction();

  db.prepare('UPDATE salary_sheets SET total_amount = ? WHERE id = ?').run(totalAmount, sheetId);

  return res.json({ code: 0, data: { id: sheetId, employee_count: employees.length, total_amount: totalAmount } });
});

// 工资表列表
router.get('/sheets', authMiddleware, requireRole('admin', 'hr'), (req, res) => {
  const db = getDb();
  const sheets = db.prepare('SELECT * FROM salary_sheets ORDER BY created_at DESC').all();
  return res.json({ code: 0, data: sheets });
});

// 工资表详情
router.get('/sheets/:id', authMiddleware, requireRole('admin', 'hr'), (req, res) => {
  const db = getDb();
  const sheet = db.prepare('SELECT * FROM salary_sheets WHERE id = ?').get(req.params.id);
  const rows = db.prepare('SELECT * FROM salary_rows WHERE sheet_id = ? ORDER BY user_name').all(req.params.id);
  if (!sheet) return res.status(404).json({ code: 404, message: '工资表不存在' });
  return res.json({ code: 0, data: { ...(sheet as Record<string, any>), rows } });
});

// 修改工资行
router.put('/sheets/:id/rows/:rowId', authMiddleware, requireRole('admin', 'hr'), (req, res) => {
  const { base_salary, perf_bonus, attendance_bonus, overtime_pay, other_income, other_deduction, remark } = req.body;
  const db = getDb();

  const row = db.prepare('SELECT * FROM salary_rows WHERE id = ?').get(req.params.rowId) as any;
  if (!row) return res.status(404).json({ code: 404, message: '工资行不存在' });

  const updated = { ...row, ...req.body };
  const socialIns = calculateSocialInsurance(updated.base_salary);
  const housingFund = calculateHousingFund(updated.base_salary);
  const pay = calculateNetPay({ ...updated, social_insurance: socialIns, housing_fund: housingFund });

  db.prepare(
    `UPDATE salary_rows SET base_salary=?, perf_bonus=?, attendance_bonus=?, overtime_pay=?, other_income=?, social_insurance=?, housing_fund=?, tax=?, other_deduction=?, gross_pay=?, net_pay=?, remark=? WHERE id=?`
  ).run(updated.base_salary, updated.perf_bonus, updated.attendance_bonus, updated.overtime_pay, updated.other_income, socialIns, housingFund, pay.tax, updated.other_deduction, pay.gross_pay, pay.net_pay, remark || '', req.params.rowId);

  return res.json({ code: 0, message: '更新成功' });
});

// 提交审批
router.post('/sheets/:id/submit', authMiddleware, requireRole('admin', 'hr'), (req, res) => {
  const db = getDb();
  db.prepare("UPDATE salary_sheets SET status = 'pending_approval' WHERE id = ? AND status = 'draft'").run(req.params.id);
  return res.json({ code: 0, message: '已提交审批' });
});

// 审批通过
router.post('/sheets/:id/approve', authMiddleware, requireRole('admin'), (req: AuthRequest, res) => {
  const db = getDb();
  db.prepare("UPDATE salary_sheets SET status = 'approved', approver_id = ?, approved_at = ? WHERE id = ? AND status = 'pending_approval'").run(req.userId, new Date().toISOString(), req.params.id);
  return res.json({ code: 0, message: '已审批通过' });
});

// 驳回
router.post('/sheets/:id/reject', authMiddleware, requireRole('admin'), (_req, res) => {
  const db = getDb();
  db.prepare("UPDATE salary_sheets SET status = 'draft' WHERE id = ?").run(_req.params.id);
  return res.json({ code: 0, message: '已驳回' });
});

// 发放 (发企微通知)
router.post('/sheets/:id/publish', authMiddleware, requireRole('admin', 'hr'), async (req, res) => {
  const db = getDb();
  const sheet = db.prepare('SELECT * FROM salary_sheets WHERE id = ?').get(req.params.id) as any;
  if (!sheet || sheet.status !== 'approved') {
    return res.status(400).json({ code: 400, message: '工资表未审批通过' });
  }

  db.prepare("UPDATE salary_sheets SET status = 'published', published_at = ? WHERE id = ?").run(new Date().toISOString(), req.params.id);

  // 通知每个员工
  const rows = db.prepare('SELECT user_id, net_pay FROM salary_rows WHERE sheet_id = ?').all(req.params.id) as any[];
  for (const row of rows) {
    try {
      await notifyPayslip(row.user_id, sheet.month, row.net_pay);
    } catch (e) {
      console.error(`通知员工 ${row.user_id} 失败:`, e);
    }
  }

  return res.json({ code: 0, message: '已发放并通知员工' });
});

// 员工查看自己的工资条
router.get('/my-payslips', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const payslips = db.prepare(
    `SELECT sr.*, ss.month, ss.title as sheet_title FROM salary_rows sr JOIN salary_sheets ss ON sr.sheet_id = ss.id WHERE sr.user_id = ? AND ss.status = 'published' ORDER BY ss.month DESC`
  ).all(req.userId);
  return res.json({ code: 0, data: payslips });
});

// ═══════════════════════════════════════════════════════════════════════
// ─── 企微智能表格 (Cloud Smart Sheet) ──────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════

const getDocConfig = () => ({
  docid: wecomConfig.salaryDocId,
  sheetId: wecomConfig.salarySheetId,
});

// 检查配置状态
router.get('/smartsheet/status', authMiddleware, requireRole('admin', 'hr'), (_req, res) => {
  const { docid, sheetId } = getDocConfig();
  return res.json({
    code: 0,
    data: {
      configured: !!(docid && sheetId),
      docid: docid ? `${docid.slice(0, 12)}...` : '',
      sheetId: sheetId || '',
    },
  });
});

// 获取字段
router.get('/smartsheet/fields', authMiddleware, requireRole('admin', 'hr'), async (_req, res) => {
  const { docid, sheetId } = getDocConfig();
  if (!docid || !sheetId) return res.status(400).json({ code: 400, message: '未配置智能表格 (WECOM_SALARY_DOC_ID / WECOM_SALARY_SHEET_ID)' });
  try {
    const fields = await SmartSheet.getSheetFields(docid, sheetId);
    return res.json({ code: 0, data: fields });
  } catch (err: any) {
    console.error('[Salary SmartSheet] getFields error:', err.message);
    return res.status(500).json({ code: 500, message: err.message });
  }
});

// 查询记录
router.get('/smartsheet/records', authMiddleware, requireRole('admin', 'hr'), async (req, res) => {
  const { docid, sheetId } = getDocConfig();
  if (!docid || !sheetId) return res.status(400).json({ code: 400, message: '未配置智能表格' });
  try {
    const offset = parseInt(req.query.offset as string) || 0;
    const limit = parseInt(req.query.limit as string) || 100;
    const result = await SmartSheet.getRecords(docid, sheetId, { offset, limit });
    return res.json({ code: 0, data: result });
  } catch (err: any) {
    console.error('[Salary SmartSheet] getRecords error:', err.message);
    return res.status(500).json({ code: 500, message: err.message });
  }
});

// 添加记录
router.post('/smartsheet/records', authMiddleware, requireRole('admin', 'hr'), async (req: AuthRequest, res) => {
  const { docid, sheetId } = getDocConfig();
  if (!docid || !sheetId) return res.status(400).json({ code: 400, message: '未配置智能表格' });
  try {
    const { records } = req.body;
    if (!records?.length) return res.status(400).json({ code: 400, message: '无记录数据' });
    const result = await SmartSheet.addRecords(docid, sheetId, records);
    return res.json({ code: 0, data: result });
  } catch (err: any) {
    console.error('[Salary SmartSheet] addRecords error:', err.message);
    return res.status(500).json({ code: 500, message: err.message });
  }
});

// 更新记录
router.put('/smartsheet/records', authMiddleware, requireRole('admin', 'hr'), async (req: AuthRequest, res) => {
  const { docid, sheetId } = getDocConfig();
  if (!docid || !sheetId) return res.status(400).json({ code: 400, message: '未配置智能表格' });
  try {
    const { records } = req.body;
    if (!records?.length) return res.status(400).json({ code: 400, message: '无记录数据' });
    const result = await SmartSheet.updateRecords(docid, sheetId, records);
    return res.json({ code: 0, data: result });
  } catch (err: any) {
    console.error('[Salary SmartSheet] updateRecords error:', err.message);
    return res.status(500).json({ code: 500, message: err.message });
  }
});

// 删除记录
router.delete('/smartsheet/records', authMiddleware, requireRole('admin', 'hr'), async (req: AuthRequest, res) => {
  const { docid, sheetId } = getDocConfig();
  if (!docid || !sheetId) return res.status(400).json({ code: 400, message: '未配置智能表格' });
  try {
    const { record_ids } = req.body;
    if (!record_ids?.length) return res.status(400).json({ code: 400, message: '无记录ID' });
    await SmartSheet.deleteRecords(docid, sheetId, record_ids);
    return res.json({ code: 0, message: '删除成功' });
  } catch (err: any) {
    console.error('[Salary SmartSheet] deleteRecords error:', err.message);
    return res.status(500).json({ code: 500, message: err.message });
  }
});

export default router;
