import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { analyzePerformance, diagnosePerformance } from '../services/ai';

const router = Router();

// AI 绩效分析
router.post('/analyze', authMiddleware, async (req, res) => {
  const { data, prompt } = req.body;
  try {
    const result = await analyzePerformance({ ...data, prompt });
    return res.json({ code: 0, data: { analysis: result } });
  } catch (error: any) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// AI 提报质量深度诊断
router.post('/diagnose-perf', authMiddleware, async (req, res) => {
  try {
    const { plans } = req.body;
    if (!plans || !Array.isArray(plans)) return res.status(400).json({ code: 400, message: '无效的提报数据记录' });
    
    // 取前 50 条避免请求过载
    const report = await diagnosePerformance(plans.slice(0, 50));
    return res.json({ code: 0, data: { diagnosticReport: report } });
  } catch (error: any) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// AI 通用聊天 (浮窗助手)
router.post('/chat', authMiddleware, async (req, res) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ code: 400, message: '缺少 messages 参数' });
  }

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
        messages: messages.slice(-20), // 只取最近20条避免超限
        temperature: 0.5,
        max_tokens: 1024,
      }),
    });

    if (!apiRes.ok) {
      throw new Error(`DeepSeek API: ${apiRes.statusText}`);
    }

    const result = await apiRes.json();
    const content = result.choices?.[0]?.message?.content || '抱歉，暂时无法生成回答。';
    return res.json({ code: 0, data: { content } });
  } catch (error: any) {
    console.error('AI Chat error:', error.message);
    return res.status(500).json({ code: 500, message: `AI 暂时不可用: ${error.message}` });
  }
});

export default router;
