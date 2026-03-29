import express from 'express';
import { getDb } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// 工具函数：获取智能推荐的打分人
function getSuggestedReviewers(db: any, month: string, userId: string, departmentId: number) {
  // 查当月完结任务
  const currentMonthPlans = db.prepare(`
    SELECT id, assignee_id, creator_id, approver_id, collaborators 
    FROM perf_plans 
    WHERE status IN ('completed', 'approved') 
    AND assignee_id = ?
    AND (rewarded_at LIKE ? OR updated_at LIKE ?)
  `).all(userId, `%${month}%`, `%${month}%`) as any[];

  // 1. 自评
  const selfId = userId;

  // 2. 主管直评
  const dept = db.prepare('SELECT leader_user_id FROM departments WHERE id = ?').get(departmentId) as any;
  let managerId = dept?.leader_user_id;
  if (!managerId || managerId === userId) {
    const parentDept = db.prepare(`
      SELECT d2.leader_user_id 
      FROM departments d1 JOIN departments d2 ON d1.parent_id = d2.id 
      WHERE d1.id = ?
    `).get(departmentId) as any;
    managerId = parentDept?.leader_user_id || 'admin';
  }

  // 3. 专业环评
  const profSet = new Set<string>();
  for (const task of currentMonthPlans) {
    if (task.creator_id && task.creator_id !== userId) profSet.add(task.creator_id);
    if (task.approver_id && task.approver_id !== userId) profSet.add(task.approver_id);
  }
  const profIds = Array.from(profSet).slice(0, 3);

  // 4. 关联人环评
  const peerSet = new Set<string>();
  for (const task of currentMonthPlans) {
    if (task.collaborators) {
      const collabs = task.collaborators.split(',').map((c: string) => c.trim());
      for (const c of collabs) {
        if (c && c !== userId) peerSet.add(c);
      }
    }
  }
  const peerIds = Array.from(peerSet).slice(0, 3);

  return { self: [selfId], manager: [managerId], prof: profIds, peer: peerIds };
}

// 1. HR 获取当月全员大名单及考评状态
router.get('/hr/employees-status', (req, res) => {
  const { month } = req.query;
  if (!month) return res.status(400).json({ code: 1, message: '请提供月份' });
  const db = getDb();
  try {
    const list = db.prepare(`
      SELECT u.id as user_id, u.name as user_name, u.department_id, d.name as department_name, 
             e.status as eval_status, e.final_score
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN monthly_evaluations e ON u.id = e.user_id AND e.month = ?
      WHERE u.status = 'active'
      ORDER BY d.id, u.id
    `).all(month);
    res.json({ code: 0, data: list });
  } catch (err: any) {
    res.status(500).json({ code: 1, message: err.message });
  }
});

// 2. HR 预览智能推荐的评审人 (不落库)
router.get('/hr/preview-reviewers', (req, res) => {
  const { month, userId } = req.query;
  if (!month || !userId) return res.status(400).json({ code: 1, message: '参数缺失' });
  const db = getDb();
  try {
    const user = db.prepare('SELECT department_id FROM users WHERE id = ?').get(userId) as any;
    if (!user) return res.status(404).json({ code: 1, message: '用户不存在' });

    const suggested = getSuggestedReviewers(db, month as string, userId as string, user.department_id);
    
    // 补全人员详细信息返回前端
    const getUserInfo = (id: string) => db.prepare('SELECT id, name FROM users WHERE id = ?').get(id) || { id, name: id === 'admin' ? '系统管理员' : '未知' };
    
    res.json({ code: 0, data: {
      self: suggested.self.map(id => getUserInfo(id)),
      manager: suggested.manager.map(id => getUserInfo(id)),
      prof: suggested.prof.map(id => getUserInfo(id)),
      peer: suggested.peer.map(id => getUserInfo(id))
    }});
  } catch (err: any) {
    res.status(500).json({ code: 1, message: err.message });
  }
});

// 3. 辅助接口：获取用于下拉框选人的简版通讯录
router.get('/hr/all-users', (req, res) => {
  const db = getDb();
  try {
    const users = db.prepare("SELECT id, name FROM users WHERE status = 'active' ORDER BY name").all();
    res.json({ code: 0, data: users });
  } catch (err: any) {
    res.status(500).json({ code: 1, message: err.message });
  }
});

// 4. 下发考核单 (单人精细配置 或 批量自动推车)
router.post('/hr/publish', (req, res) => {
  const { month, userIds, manualReviewers } = req.body;
  if (!month || !userIds || !userIds.length) return res.status(400).json({ code: 1, message: '缺少参数' });

  const db = getDb();
  try {
    const insertEval = db.prepare(`INSERT INTO monthly_evaluations (user_id, month, status) VALUES (?, ?, 'pending')`);
    const insertReviewer = db.prepare(`INSERT INTO monthly_eval_reviewers (evaluation_id, reviewer_id, role) VALUES (?, ?, ?)`);

    let generatedCount = 0;

    db.transaction(() => {
      for (const userId of userIds) {
        // 清理这名员工当月的旧有未完成的考评条目，支持反复重新发起覆盖
        db.prepare('DELETE FROM monthly_eval_reviewers WHERE evaluation_id IN (SELECT id FROM monthly_evaluations WHERE month = ? AND user_id = ?)').run(month, userId);
        db.prepare('DELETE FROM monthly_evaluations WHERE month = ? AND user_id = ?').run(month, userId);

        const resEval = insertEval.run(userId, month);
        const evalId = resEval.lastInsertRowid;
        generatedCount++;

        let reviewersToUse;
        
        // 如果是从面板配置后单发，携带了 manualReviewers 就用手工的
        if (manualReviewers && manualReviewers.targetUserId === userId) {
          reviewersToUse = manualReviewers;
        } else {
          // 否则（比如批量下发）直接系统推演顶上
          const user = db.prepare('SELECT department_id FROM users WHERE id = ?').get(userId) as any;
          reviewersToUse = getSuggestedReviewers(db, month, userId, user.department_id);
        }

        // 插入4个维度的所有打分人
        ['self', 'manager', 'prof', 'peer'].forEach((role) => {
          const ids = reviewersToUse[role] || [];
          for (const revId of ids) {
            if (revId) insertReviewer.run(evalId, revId, role);
          }
        });
      }
    })();

    res.json({ code: 0, message: `成功发出了 ${generatedCount} 位员工的本月绩效考评！` });
  } catch (err: any) {
    res.status(500).json({ code: 1, message: '派发失败: ' + err.message });
  }
});

// 2. 获取当前用户需要执行的所有打分任务 (作为 reviewer)
router.get('/my-tasks', (req, res) => {
  const userId = (req as any).user?.id || 'admin'; // Authorization middleware will set this
  const db = getDb();
  
  try {
    const tasks = db.prepare(`
      SELECT r.id as reviewer_task_id, r.role, r.status, r.score, r.comment,
             e.month, e.user_id as target_user_id,
             u.name as target_user_name, d.name as target_department_name
      FROM monthly_eval_reviewers r
      JOIN monthly_evaluations e ON r.evaluation_id = e.id
      JOIN users u ON e.user_id = u.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE r.reviewer_id = ?
      ORDER BY r.status DESC, e.month DESC
    `).all(userId);

    res.json({ code: 0, data: tasks });
  } catch (err: any) {
    res.status(500).json({ code: 1, message: '获取待办失败: ' + err.message });
  }
});

// 3. 提交打分并重新计算分数
router.post('/submit-score', (req, res) => {
  const { reviewer_task_id, score, comment } = req.body;
  if (!reviewer_task_id || score === undefined) return res.status(400).json({ code: 1, message: '缺少参数' });

  const db = getDb();
  try {
    db.transaction(() => {
      // 更新单条任务分数
      db.prepare(`
        UPDATE monthly_eval_reviewers 
        SET score = ?, comment = ?, status = 'submitted', submitted_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(score, comment, reviewer_task_id);

      // 获取这单属于哪个评估
      const evalRow = db.prepare('SELECT evaluation_id FROM monthly_eval_reviewers WHERE id = ?').get(reviewer_task_id) as any;
      if (!evalRow) return;

      const evalId = evalRow.evaluation_id;

      // 重新计算各大类平均分
      const allReviews = db.prepare('SELECT role, score FROM monthly_eval_reviewers WHERE evaluation_id = ? AND status = ?').all(evalId, 'submitted') as any[];
      
      const getAvg = (role: string) => {
        const matching = allReviews.filter(r => r.role === role);
        if (matching.length === 0) return 0;
        const sum = matching.reduce((acc, curr) => acc + (curr.score || 0), 0);
        return sum / matching.length;
      };

      const selfScore = getAvg('self');
      const managerScore = getAvg('manager');
      const profScore = getAvg('prof');
      const peerScore = getAvg('peer');

      // 最终加权: Self 20%, Manager 30%, Prof 40%, Peer 10%
      const finalScore = (selfScore * 0.2) + (managerScore * 0.3) + (profScore * 0.4) + (peerScore * 0.1);

      // 检查是否所有人都提交了
      const pendingCount = (db.prepare('SELECT COUNT(*) as c FROM monthly_eval_reviewers WHERE evaluation_id = ? AND status = ?').get(evalId, 'pending') as any).c;
      const evalStatus = pendingCount === 0 ? 'completed' : 'pending';

      db.prepare(`
        UPDATE monthly_evaluations
        SET self_score = ?, manager_score = ?, prof_score = ?, peer_score = ?, final_score = ?, status = ?, completed_at = CASE WHEN ? = 'completed' THEN CURRENT_TIMESTAMP ELSE completed_at END
        WHERE id = ?
      `).run(selfScore, managerScore, profScore, peerScore, finalScore, evalStatus, evalStatus, evalId);
    })();

    res.json({ code: 0, message: '提交成功' });
  } catch (err: any) {
    res.status(500).json({ code: 1, message: '提交失败: ' + err.message });
  }
});

// 4. 获取某个员工的考核单摘要列表 (供发薪台账拉取)
router.get('/monthly-summary', (req, res) => {
  const { month } = req.query;
  const db = getDb();
  try {
    const list = db.prepare(`
      SELECT e.*, u.name as user_name, d.name as department_name
      FROM monthly_evaluations e
      JOIN users u ON e.user_id = u.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE e.month = ?
    `).all(month);
    res.json({ code: 0, data: list });
  } catch (err: any) {
    res.status(500).json({ code: 1, message: '请求失败' });
  }
});

// 5. 获取某个员工在指定月份完结的核心任务 (供打分人参考)
router.get('/user-tasks', (req, res) => {
  const { userId, month } = req.query;
  if (!userId || !month) return res.status(400).json({ code: 1, message: '参数缺失' });
  const db = getDb();
  try {
    const tasks = db.prepare(`
      SELECT id, title, description, status, metric, target, score, reward, rewarded_at, updated_at
      FROM perf_plans 
      WHERE assignee_id = ? 
      AND status IN ('completed', 'approved')
      AND (rewarded_at LIKE ? OR updated_at LIKE ?)
      ORDER BY updated_at DESC
    `).all(userId, `%${month}%`, `%${month}%`);
    res.json({ code: 0, data: tasks });
  } catch (err: any) {
    res.status(500).json({ code: 1, message: '获取任务失败: ' + err.message });
  }
});

export default router;

