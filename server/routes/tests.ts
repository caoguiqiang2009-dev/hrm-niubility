import { Router } from 'express';
import { getDb } from '../config/database';
import { authMiddleware } from '../middleware/auth';

const router = Router();
const db = getDb();

// ======================== 管理端 (Admin) ========================

// 1. 获取所有题库 (包含题目数量)
router.get('/bank', authMiddleware, (req: any, res) => {
  try {
    const banks = db.prepare(`
      SELECT b.*, l.name as competency_name,
        (SELECT COUNT(*) FROM test_questions q WHERE q.bank_id = b.id) as question_count
      FROM test_banks b
      LEFT JOIN competency_library l ON b.mapped_library_id = l.id
      WHERE ifnull(b.is_archived, 0) = 0
      ORDER BY b.created_at DESC
    `).all() as any[];
    res.json({ code: 0, data: banks });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 1.5 获取题库详情及考题内容
router.get('/bank/:id', authMiddleware, (req: any, res) => {
  try {
    const bankId = req.params.id;
    const bank = db.prepare('SELECT * FROM test_banks WHERE id = ?').get(bankId) as any;
    if (!bank) return res.status(404).json({ code: 404, message: 'Bank not found' });
    
    let questions = db.prepare('SELECT * FROM test_questions WHERE bank_id = ? ORDER BY sort_order ASC').all(bankId) as any[];
    questions = questions.map(q => ({
      ...q,
      options: JSON.parse(q.options_json)
    }));
    
    res.json({ code: 0, data: { ...bank, questions } });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 2. 创建或更新题库 (及考题)
router.post('/bank', authMiddleware, (req: any, res) => {
  const { id, title, description, mapped_library_id, questions } = req.body;
  if (!title || !questions || !Array.isArray(questions)) {
    return res.status(400).json({ code: 400, message: 'Missing required fields' });
  }

  try {
    const userId = req.userId || 'system';

    db.transaction(() => {
      // Versioning Logic: If editing an existing bank, archive the old one and create a new one
      if (id) {
        db.prepare(`UPDATE test_banks SET is_archived = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(id);
      }
      
      const result = db.prepare(`INSERT INTO test_banks (title, description, mapped_library_id, created_by) VALUES (?, ?, ?, ?)`).run(title, description || '', mapped_library_id || null, userId);
      const bankId = result.lastInsertRowid;

      const insertQ = db.prepare(`
        INSERT INTO test_questions (bank_id, type, question, options_json, correct_answer, score, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      questions.forEach((q: any, i: number) => {
        insertQ.run(
          bankId, 
          q.type || 'single', 
          q.question, 
          JSON.stringify(q.options || []), 
          q.correct_answer, 
          q.score || 10, 
          i
        );
      });
    })();

    res.json({ code: 0, message: 'Saved successfully' });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 新增：获取某个试卷的答题结果统计
router.get('/bank/:id/results', authMiddleware, (req: any, res) => {
  try {
    const bankId = req.params.id;
    
    // 基础试卷信息
    const bank = db.prepare('SELECT title, description FROM test_banks WHERE id = ?').get(bankId) as any;
    if (!bank) return res.status(404).json({ code: 404, message: 'Bank not found' });
    
    // 查询被派发人及其成绩和状态
    const results = db.prepare(`
      SELECT 
        a.id as assignment_id, a.user_id, a.status, a.final_score, a.assigned_by, a.created_at, a.completed_at,
        u.name as user_name, u.avatar_url, d.name as department_name
      FROM test_assignments a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE a.bank_id = ?
      ORDER BY a.status DESC, a.final_score DESC, a.completed_at DESC
    `).all(bankId) as any[];
    
    // 统计数据
    const totalAssigned = results.length;
    const completed = results.filter(r => r.status === 'completed');
    const totalCompleted = completed.length;
    const averageScore = totalCompleted > 0 
      ? Math.round(completed.reduce((sum, r) => sum + (r.final_score || 0), 0) / totalCompleted) 
      : 0;
      
    res.json({
      code: 0,
      data: {
        bank,
        stats: { totalAssigned, totalCompleted, averageScore },
        results
      }
    });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 3. 派发测试给指定员工
router.post('/bank/:id/assign', authMiddleware, (req: any, res) => {
  const bankId = req.params.id;
  const { user_ids } = req.body; // Array of user IDs
  if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
    return res.status(400).json({ code: 400, message: 'Missing user_ids' });
  }

  try {
    const assignerId = req.userId || 'system';
    const bank = db.prepare('SELECT title FROM test_banks WHERE id = ?').get(bankId) as {title: string};
    if (!bank) return res.status(404).json({ code: 404, message: 'Bank not found' });

    db.transaction(() => {
      const insertAssign = db.prepare(`INSERT INTO test_assignments (bank_id, user_id, assigned_by) VALUES (?, ?, ?)`);
      const insertNotif = db.prepare(`INSERT INTO notifications (user_id, type, title, content) VALUES (?, 'system', '新测评任务', ?)`);
      
      for (const uid of user_ids) {
        // 防止重复派发待完成的同一份试卷
        const existing = db.prepare(`SELECT id FROM test_assignments WHERE bank_id = ? AND user_id = ? AND status = 'pending'`).get(bankId, uid);
        if (existing) continue;

        insertAssign.run(bankId, uid, assignerId);
        insertNotif.run(uid, `您收到一份新的能力测试卷：【${bank.title}】，请及时前往在“待办事项”中完成答题。`);
      }
    })();

    res.json({ code: 0, message: 'Assigned successfully' });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ======================== 员工端 (Employee) ========================

// 4. 读取我的所有测试任务
router.get('/my', authMiddleware, (req: any, res) => {
  try {
    const userId = req.userId;
    const assignments = db.prepare(`
      SELECT a.*, b.title, b.description, b.mapped_library_id,
             (SELECT COUNT(*) FROM test_questions q WHERE q.bank_id = b.id) as question_count
      FROM test_assignments a
      JOIN test_banks b ON a.bank_id = b.id
      WHERE a.user_id = ?
      ORDER BY a.status DESC, a.created_at DESC
    `).all(userId);
    
    res.json({ code: 0, data: assignments });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 5. 获取某张卷子的题目用于考试
router.get('/assignment/:id', authMiddleware, (req: any, res) => {
  try {
    const assignId = req.params.id;
    const userId = req.userId;
    
    const assignment = db.prepare(`
      SELECT a.*, b.title, b.description 
      FROM test_assignments a
      JOIN test_banks b ON a.bank_id = b.id
      WHERE a.id = ? AND a.user_id = ?
    `).get(assignId, userId) as any;
    
    if (!assignment) return res.status(404).json({ code: 404, message: 'Assignment not found' });
    
    // 如果已完成，还可以把答案带回去
    let questions = db.prepare(`SELECT * FROM test_questions WHERE bank_id = ? ORDER BY sort_order ASC`).all(assignment.bank_id) as any[];
    questions = questions.map(q => {
      // 客户端答题不需要答案，如果是 pending 状态屏蔽正确答案
      let correct = q.correct_answer;
      if (assignment.status === 'pending') correct = '';
      return {
        ...q,
        options: JSON.parse(q.options_json),
        correct_answer: correct
      };
    });

    res.json({ code: 0, data: { assignment, questions } });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 6. 交卷、自动阅卷、能力折算
router.post('/assignment/:id/submit', authMiddleware, (req: any, res) => {
  const assignId = req.params.id;
  const userId = req.userId;
  const { answers } = req.body; // { [question_id]: "A,B" }
  
  if (!answers) return res.status(400).json({ code: 400, message: 'Missing answers' });

  try {
    const assignment = db.prepare(`SELECT a.*, b.mapped_library_id FROM test_assignments a JOIN test_banks b ON a.bank_id = b.id WHERE a.id = ? AND a.user_id = ?`).get(assignId, userId) as any;
    if (!assignment || assignment.status === 'completed') {
      return res.status(400).json({ code: 400, message: 'Invalid assignment or already submitted' });
    }

    const questions = db.prepare(`SELECT * FROM test_questions WHERE bank_id = ?`).all(assignment.bank_id) as any[];
    
    let totalScore = 0;
    let maxTotalScore = 0;
    const answerRecords: any[] = [];

    for (const q of questions) {
      maxTotalScore += q.score;
      const userAns = answers[q.id] || '';
      
      const normalize = (str: string) => str.split(',').map((s: string) => s.trim()).filter(Boolean).sort().join(',');
      const isCorrect = normalize(userAns) === normalize(q.correct_answer);
      const earned = isCorrect ? q.score : 0;
      totalScore += earned;

      answerRecords.push({
        question_id: q.id,
        user_answer: userAns,
        is_correct: isCorrect ? 1 : 0,
        earned_score: earned
      });
    }

    db.transaction(() => {
      // 1. 保存答案日志
      const insertAns = db.prepare(`INSERT INTO test_answers (assignment_id, question_id, user_answer, is_correct, earned_score) VALUES (?, ?, ?, ?, ?)`);
      for (const rec of answerRecords) {
        insertAns.run(assignId, rec.question_id, rec.user_answer, rec.is_correct, rec.earned_score);
      }
      
      // 2. 更新状态
      db.prepare(`UPDATE test_assignments SET status = 'completed', final_score = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?`).run(totalScore, assignId);

      // 3. 自动同步能力库 (百分制折算)
      if (assignment.mapped_library_id) {
         const competencyId = assignment.mapped_library_id;
         
         const libraryDef = db.prepare('SELECT default_max_score FROM competency_library WHERE id = ?').get(competencyId) as any;
         if (libraryDef) {
            const maxScorePoints = libraryDef.default_max_score || 5.0;
            const percent = maxTotalScore > 0 ? (totalScore / maxTotalScore) : 0;
            const capabilityScore = Number((percent * maxScorePoints).toFixed(1));

            const evalInsert = db.prepare(`INSERT INTO competency_evaluations (user_id, evaluator_id, model_id, status, finished_at) VALUES (?, 'system', 0, 'completed', CURRENT_TIMESTAMP)`).run(userId);
            const evalId = evalInsert.lastInsertRowid;
            
            let dimRecord = db.prepare(`SELECT id FROM competency_dimensions WHERE library_id = ? LIMIT 1`).get(competencyId) as any;
            if(!dimRecord) {
                const createDim = db.prepare(`INSERT INTO competency_dimensions (model_id, library_id, category, name, max_score, weight, target_score) VALUES (0, ?, '测评直通', '考核系统自动导入', 5, 1, 3)`).run(competencyId);
                dimRecord = { id: createDim.lastInsertRowid };
            }
            
            db.prepare(`INSERT INTO competency_scores (evaluation_id, dimension_id, self_score, manager_score, comment) VALUES (?, ?, ?, ?, ?)`).run(evalId, dimRecord.id, capabilityScore, capabilityScore, `系统测评自动结算 (${totalScore}/${maxTotalScore}分)`);
         }
      }
    })();

    res.json({ code: 0, message: 'Submitted', data: { final_score: totalScore } });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 7. AI 一键出题
router.post('/bank/generate-ai', authMiddleware, async (req: any, res) => {
  const { purpose, materials, position, requirements, count = 5 } = req.body;
  if (!purpose && !position) {
    return res.status(400).json({ code: 400, message: '请提供测试目的或岗位信息' });
  }

  const prompt = `你是一个资深的HR和业务专家，负责人才测评。请根据以下信息生成一份能力测评试卷的题目。
测试目的：${purpose || '无'}
关联岗位：${position || '无'}
岗位职能要求：${requirements || '无'}
参考材料：${materials || '无'}

请生成大约 ${count} 道题目（可包含单选题和多选题）。
必须且只能输出严格格式的 JSON 数组，不要带任何 Markdown 代码块包裹，也不要任何额外解释。
每个对象的格式如下：
{
  "type": "single", // 或 "multiple"
  "question": "题干内容",
  "options": ["选项A内容", "选项B内容", "选项C内容", "选项D内容"], // 必须且恰好是4个选项的数组
  "correct_answer": "A", // 单选题为单一字母如 "A"，多选题为逗号分隔字母如 "A,C"
  "score": 10 // 强烈建议此题多少分(默认10分)
}
`;

  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'sk-592b0ba541a94bc39f4f77480b3fe4f1';
  try {
    const apiRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      }),
    });

    if (!apiRes.ok) {
      throw new Error(`AI 服务异常: ${apiRes.statusText}`);
    }

    const result = await apiRes.json();
    let content = result.choices?.[0]?.message?.content || '[]';
    
    // 清理可能的 markdown 代码块标记
    content = content.replace(/```json/g, '').replace(/```/g, '').trim();
    
    let generatedQuestions;
    try {
      generatedQuestions = JSON.parse(content);
      if (!Array.isArray(generatedQuestions)) {
        generatedQuestions = [generatedQuestions];
      }
    } catch (e) {
      console.error('Failed to parse AI response:', content);
      throw new Error('AI 返回的数据格式无法解析，请重试');
    }

    return res.json({ code: 0, data: generatedQuestions });
  } catch (error: any) {
    console.error('AI generate test error:', error.message);
    return res.status(500).json({ code: 500, message: `AI 暂时不可用: ${error.message}` });
  }
});

export default router;
