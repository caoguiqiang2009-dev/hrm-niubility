import express from 'express';
import { getDb } from '../config/database';

const router = express.Router();

// 1. 获取所有可选系统字段
router.get('/fields', (req, res) => {
  const fields = [
    { key: 'user_id', label: '工号/账号', category: '基础信息', checked: true },
    { key: 'user_name', label: '员工姓名', category: '基础信息', checked: true },
    { key: 'department_name', label: '所属部门', category: '基础信息', checked: true },
    
    { key: 'perf_total_score', label: '绩效总台账分', category: '绩效与奖金', checked: true },
    { key: 'perf_total_bonus', label: '核定应发奖金(元)', category: '绩效与奖金', checked: true },
    { key: 'perf_source_tasks', label: '当月奖金任务溯源表', category: '绩效与奖金', checked: false },

    { key: 'eval_self_score', label: '当月环评-自评分(20%)', category: '月度四大维度考评', checked: false },
    { key: 'eval_manager_score', label: '当月环评-主管分(30%)', category: '月度四大维度考评', checked: true },
    { key: 'eval_prof_score', label: '当月环评-发版专业分(40%)', category: '月度四大维度考评', checked: false },
    { key: 'eval_peer_score', label: '当月环评-关联互评分(10%)', category: '月度四大维度考评', checked: false },
    { key: 'eval_final_score', label: '当月系统定岗评价总分', category: '月度四大维度考评', checked: true },
  ];
  res.json({ code: 0, data: fields });
});

// 2. 预览/合并提取发薪台账数据
router.post('/preview', (req, res) => {
  const { month, fields } = req.body;
  if (!month || !fields || !Array.isArray(fields)) return res.status(400).json({ code: 1, message: '参数错误' });

  const db = getDb();

  try {
    // a. 获取基础员工列表
    const users = db.prepare(`
      SELECT u.id as user_id, u.name as user_name, d.name as department_name
      FROM users u LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.status = 'active'
    `).all() as any[];

    // b. 获取各表辅助数据
    const wantsPerf = fields.some(f => f.startsWith('perf_'));
    const wantsEval = fields.some(f => f.startsWith('eval_'));

    let perfData: any[] = [];
    if (wantsPerf) {
      perfData = db.prepare(`
        SELECT assignee_id, SUM(score) as total_score, SUM(bonus) as total_bonus,
        group_concat(id || '(' || title || ')', ', ') as source_tasks
        FROM perf_plans 
        WHERE status IN ('approved', 'completed') AND (rewarded_at LIKE ? OR updated_at LIKE ?)
        GROUP BY assignee_id
      `).all(`%${month}%`, `%${month}%`) as any[];
    }

    let evalData: any[] = [];
    if (wantsEval) {
      evalData = db.prepare(`
        SELECT user_id, self_score, manager_score, prof_score, peer_score, final_score
        FROM monthly_evaluations
        WHERE month = ?
      `).all(month) as any[];
    }

    // c. 数据映射合并
    const result = users.map(user => {
      const pData = perfData.find(p => p.assignee_id === user.user_id) || { total_score: 0, total_bonus: 0, source_tasks: '-' };
      const eData = evalData.find(e => e.user_id === user.user_id) || { self_score: 0, manager_score: 0, prof_score: 0, peer_score: 0, final_score: 0 };

      // 组装返回对象
      const row: any = {};
      
      if (fields.includes('user_id')) row.user_id = user.user_id;
      if (fields.includes('user_name')) row.user_name = user.user_name;
      if (fields.includes('department_name')) row.department_name = user.department_name;

      if (fields.includes('perf_total_score')) row.perf_total_score = pData.total_score || 0;
      if (fields.includes('perf_total_bonus')) row.perf_total_bonus = pData.total_bonus || 0;
      if (fields.includes('perf_source_tasks')) row.perf_source_tasks = pData.source_tasks || '-';

      if (fields.includes('eval_self_score')) row.eval_self_score = eData.self_score || 0;
      if (fields.includes('eval_manager_score')) row.eval_manager_score = eData.manager_score || 0;
      if (fields.includes('eval_prof_score')) row.eval_prof_score = eData.prof_score || 0;
      if (fields.includes('eval_peer_score')) row.eval_peer_score = eData.peer_score || 0;
      if (fields.includes('eval_final_score')) row.eval_final_score = eData.final_score || 0;

      return row;
    });

    res.json({ code: 0, data: result });
  } catch (err: any) {
    res.status(500).json({ code: 1, message: '数据提取失败: ' + err.message });
  }
});

// 3. 模板管理
router.get('/templates', (req, res) => {
  const db = getDb();
  const templates = db.prepare('SELECT * FROM payroll_export_templates ORDER BY id DESC').all();
  res.json({ code: 0, data: templates });
});

router.post('/templates', (req, res) => {
  const { name, fields_json } = req.body;
  if (!name || !fields_json) return res.status(400).json({ code: 1, message: '参数错误' });
  const db = getDb();
  const insert = db.prepare('INSERT INTO payroll_export_templates (name, fields_json) VALUES (?, ?)');
  insert.run(name, fields_json);
  res.json({ code: 0, message: '模板保存成功' });
});

export default router;
