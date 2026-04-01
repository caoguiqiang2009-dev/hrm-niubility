import { Router } from 'express';
import { getDb } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
const db = getDb();

// 0. Competency Library (Dictionary)
router.get('/library', authMiddleware, (req: any, res) => {
  try {
    const library = db.prepare('SELECT * FROM competency_library ORDER BY category, name').all();
    res.json({ code: 0, data: library });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

router.post('/library', authMiddleware, (req: any, res) => {
  const { id, category, name, description, default_max_score } = req.body;
  if (!name) return res.status(400).json({ code: 400, message: 'Name is required' });
  
  try {
    if (id) {
      db.prepare('UPDATE competency_library SET category = ?, name = ?, description = ?, default_max_score = ? WHERE id = ?')
        .run(category || '通用', name, description || '', default_max_score || 5, id);
    } else {
      db.prepare('INSERT INTO competency_library (category, name, description, default_max_score) VALUES (?, ?, ?, ?)')
        .run(category || '通用', name, description || '', default_max_score || 5);
    }
    res.json({ code: 0, message: 'Saved successfully' });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

router.delete('/library/:id', authMiddleware, (req: any, res) => {
  try {
    db.prepare('DELETE FROM competency_library WHERE id = ?').run(req.params.id);
    // Note: We don't cascade delete dimensions, they just lose their library link or keep it (it won't break joins if we use LEFT JOIN or simply ignore missing library references)
    res.json({ code: 0, message: 'Deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 1. Get Models
router.get('/models', authMiddleware, (req: any, res) => {
  try {
    const models = db.prepare('SELECT * FROM competency_models ORDER BY created_at DESC').all();
    const dimensions = db.prepare('SELECT * FROM competency_dimensions').all();
    
    // Attach dimensions
    const enhanced = models.map((m: any) => ({
      ...m,
      dimensions: dimensions.filter((d: any) => d.model_id === m.id)
    }));
    
    res.json({ code: 0, data: enhanced });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 2. Create/Update Model
router.post('/models', authMiddleware, (req: any, res) => {
  const { id, name, department_id, description, dimensions } = req.body;
  if (!name || !dimensions || !Array.isArray(dimensions) || dimensions.length === 0) {
    return res.status(400).json({ code: 400, message: '模型名称和能力维度(至少一项)必填，不允许建立空壳模型。' });
  }
  
  try {
    const insertModel = db.prepare(`
      INSERT INTO competency_models (name, department_id, description)
      VALUES (?, ?, ?)
    `);
    
    const updateModel = db.prepare(`
      UPDATE competency_models SET name = ?, department_id = ?, description = ? WHERE id = ?
    `);
    
    const insertDim = db.prepare(`
      INSERT INTO competency_dimensions (model_id, library_id, category, name, max_score, weight, target_score, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    db.transaction(() => {
      let modelId = id;
      if (id) {
        updateModel.run(name, department_id, description, id);
        db.prepare('DELETE FROM competency_dimensions WHERE model_id = ?').run(id);
      } else {
        const result = insertModel.run(name, department_id, description);
        modelId = result.lastInsertRowid;
      }
      
      for (const d of dimensions) {
        insertDim.run(
          modelId, 
          d.library_id ? Number(d.library_id) : null,
          d.category || '通用', 
          d.name, 
          d.max_score || 5, 
          d.weight || 1, 
          d.target_score || 3,
          d.description || ''
        );
      }
    })();
    
    res.json({ code: 0, message: 'Saved successfully' });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 3. Delete Model
router.delete('/models/:id', authMiddleware, (req: any, res) => {
  try {
    const id = req.params.id;
    // Check if it's used
    const inUse = db.prepare('SELECT COUNT(*) as count FROM competency_evaluations WHERE model_id = ?').get(id) as any;
    if (inUse.count > 0) {
      return res.status(400).json({ code: 400, message: '该模型已被应用于评估中，无法删除' });
    }
    
    db.transaction(() => {
      db.prepare('DELETE FROM competency_dimensions WHERE model_id = ?').run(id);
      db.prepare('DELETE FROM competency_models WHERE id = ?').run(id);
    })();
    res.json({ code: 0, message: 'Deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 4. Get Evaluations
router.get('/evaluations', authMiddleware, (req: any, res) => {
  try {
    const userId = req.userId;
    // user = user being evaluated OR user = manager evaluating
    const userRole = req.userRole;
    
    let query = `
      SELECT e.*, m.name as model_name 
      FROM competency_evaluations e
      JOIN competency_models m ON e.model_id = m.id
    `;
    
    let evals: any[];
    if (userRole === 'admin' || userRole === 'hr') {
      evals = db.prepare(query + ' ORDER BY e.created_at DESC').all();
    } else {
      evals = db.prepare(query + ' WHERE e.user_id = ? OR e.evaluator_id = ? ORDER BY e.created_at DESC').all(userId, userId);
    }
    
    // Attach user_names easily by fetching mapping
    const users = db.prepare('SELECT u.id, u.name, u.department_id, d.name as department FROM users u LEFT JOIN departments d ON u.department_id = d.id').all();
    const userMap = new Map(users.map((u: any) => [u.id.toString(), u]));
    
    const enriched = evals.map(e => ({
      ...e,
      user_name: userMap.get(e.user_id?.toString())?.name || e.user_id,
      department: userMap.get(e.user_id?.toString())?.department || '',
      evaluator_name: userMap.get(e.evaluator_id?.toString())?.name || e.evaluator_id,
    }));
    
    res.json({ code: 0, data: enriched });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 5. Create Evaluation
router.post('/evaluations', authMiddleware, (req: any, res) => {
  const { user_userIds, model_id } = req.body;
  const evaluator_id = req.userId;
  
  if (!user_userIds || !Array.isArray(user_userIds) || !model_id) {
    return res.status(400).json({ code: 400, message: 'Missing parameters' });
  }
  
  try {
    const dimensions = db.prepare('SELECT id FROM competency_dimensions WHERE model_id = ?').all(model_id);
    if (dimensions.length === 0) {
      return res.status(400).json({ code: 400, message: '您选择的「考核标准(模型)」是一个没有考核指标的残缺模型，无法生成有效问卷。' });
    }
    
    const insertEval = db.prepare(`
      INSERT INTO competency_evaluations (user_id, evaluator_id, model_id)
      VALUES (?, ?, ?)
    `);
    const insertScore = db.prepare(`
      INSERT INTO competency_scores (evaluation_id, dimension_id)
      VALUES (?, ?)
    `);
    
    db.transaction(() => {
      for (const uid of user_userIds) {
        // Prevent duplicate open evaluation for same user/model pair
        const active = db.prepare('SELECT id FROM competency_evaluations WHERE user_id = ? AND model_id = ? AND status != ?').get(uid, model_id, 'completed');
        if (active) continue; // Skip if already being evaluated
        
        const result = insertEval.run(uid, evaluator_id, model_id);
        const evId = result.lastInsertRowid;
        for (const dim of dimensions as any[]) {
          insertScore.run(evId, dim.id);
        }
      }
    })();
    
    res.json({ code: 0, message: 'Initiated successfully' });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 6. Get Evaluation Details
router.get('/evaluations/:id', authMiddleware, (req: any, res) => {
  try {
    const eId = req.params.id;
    const evaluation = db.prepare(`
      SELECT e.*, m.name as model_name 
      FROM competency_evaluations e
      JOIN competency_models m ON e.model_id = m.id
      WHERE e.id = ?
    `).get(eId) as any;
    
    if (!evaluation) return res.status(404).json({ code: 404, message: 'Not found' });
    
    const scores = db.prepare(`
      SELECT s.*, d.name, d.category, d.max_score, d.weight, d.description
      FROM competency_scores s
      JOIN competency_dimensions d ON s.dimension_id = d.id
      WHERE s.evaluation_id = ?
    `).all(eId);
    
    res.json({ code: 0, data: { ...evaluation, scores } });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 7. Submit Scores
router.post('/evaluations/:id/score', authMiddleware, (req: any, res) => {
  const eId = req.params.id;
  const { scores } = req.body; // array of { dimension_id, score, comment }
  const userId = req.userId;
  const userRole = req.userRole;
  
  if (!scores || !Array.isArray(scores)) {
    return res.status(400).json({ code: 400, message: 'Invalid payload' });
  }

  try {
    const evaluation = db.prepare('SELECT * FROM competency_evaluations WHERE id = ?').get(eId) as any;
    if (!evaluation) return res.status(404).json({ code: 404, message: 'Not found' });
    
    const isSelf = evaluation.user_id.toString() === userId?.toString();
    const isManager = evaluation.evaluator_id.toString() === userId?.toString() || userRole === 'admin' || userRole === 'hr';
    
    if (!isSelf && !isManager) {
      return res.status(403).json({ code: 403, message: 'Unauthorized' });
    }
    
    db.transaction(() => {
      const updateSelf = db.prepare('UPDATE competency_scores SET self_score = ?, comment = ? WHERE evaluation_id = ? AND dimension_id = ?');
      const updateManager = db.prepare('UPDATE competency_scores SET manager_score = ?, comment = ? WHERE evaluation_id = ? AND dimension_id = ?');
      
      for (const s of scores) {
        if (evaluation.status === 'pending_self' && isSelf) {
          updateSelf.run(s.score, s.comment || '', eId, s.dimension_id);
        } else if (evaluation.status === 'pending_manager' && isManager) {
          updateManager.run(s.score, s.comment || '', eId, s.dimension_id);
        }
      }
      
      // Update status
      if (evaluation.status === 'pending_self' && isSelf) {
        db.prepare('UPDATE competency_evaluations SET status = "pending_manager" WHERE id = ?').run(eId);
      } else if (evaluation.status === 'pending_manager' && isManager) {
        db.prepare('UPDATE competency_evaluations SET status = "completed", finished_at = CURRENT_TIMESTAMP WHERE id = ?').run(eId);
      }
    })();
    
    res.json({ code: 0, message: 'Submitted successfully' });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});
// 8. Gap Analysis (团队能力盘点预警)
router.get('/gap-analysis', authMiddleware, (req: any, res) => {
  try {
    // Only HR and Admin or Managers should see this. Since it's a team feature, we will just return it. 
    // In a real app, you'd filter by department if user is manager.
    const query = `
      SELECT 
        cl.id as library_id,
        cl.name as skill_name,
        cl.category as category,
        AVG(d.target_score) as target_score,
        AVG(COALESCE(s.manager_score, s.self_score, 0)) as avg_score,
        MAX(COALESCE(s.manager_score, s.self_score, 0)) as top_score,
        COUNT(s.id) as assessment_count
      FROM competency_evaluations e
      JOIN competency_scores s ON e.id = s.evaluation_id
      JOIN competency_dimensions d ON s.dimension_id = d.id
      JOIN competency_library cl ON d.library_id = cl.id
      WHERE e.status = 'completed'
      GROUP BY cl.id, cl.name, cl.category
    `;
    const analysis = db.prepare(query).all();
    
    // Add logic to determine deficiency (B or C type logic)
    const enriched = analysis.map((item: any) => {
      const is_deficient = item.avg_score < item.target_score;
      return {
        ...item,
        is_deficient,
        target_score: Number(item.target_score.toFixed(2)),
        avg_score: Number(item.avg_score.toFixed(2)),
        top_score: Number(item.top_score.toFixed(2)),
      };
    });
    
    res.json({ code: 0, data: enriched });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

export default router;
