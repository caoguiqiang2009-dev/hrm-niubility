import { Router } from 'express';
import multer from 'multer';
import * as cheerio from 'cheerio';
// pdf-parse is loaded dynamically to avoid Node.js DOMMatrix crash
import { authMiddleware } from '../middleware/auth';
import { analyzePerformance, diagnosePerformance } from '../services/ai';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit


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

// 解析外部链接文本
router.post('/extract-url', authMiddleware, async (req, res) => {
  const { url } = req.body;
  if (!url || !url.startsWith('http')) {
    return res.status(400).json({ code: 400, message: '无效的网址' });
  }
  try {
    const fetchRes = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!fetchRes.ok) throw new Error('无法访问该网页');
    const html = await fetchRes.text();
    const $ = cheerio.load(html);
    // 移除干扰元素
    $('script, style, noscript, nav, footer, header, iframe').remove();
    let text = $('body').text();
    text = text.replace(/\s+/g, ' ').trim(); // 精简空白符
    // 截断太长内容避免超过 Token
    if (text.length > 8000) text = text.substring(0, 8000) + '...';
    return res.json({ code: 0, data: { text } });
  } catch (err: any) {
    return res.status(500).json({ code: 500, message: '抓取失败: ' + err.message });
  }
});

// 解析上传的附件文本
router.post('/extract-file', authMiddleware, upload.single('file'), async (req: any, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ code: 400, message: '未找到文件' });

    const originalName = file.originalname.toLowerCase();
    let text = '';

    if (originalName.endsWith('.pdf')) {
      // Dynamic import to avoid Node.js DOMMatrix crash at startup
      const pdfParseModule = await import('pdf-parse');
      const parsePdf = (pdfParseModule as any).default || pdfParseModule;
      const data = await parsePdf(file.buffer);
      text = data.text;
    } else if (originalName.endsWith('.txt') || originalName.endsWith('.md') || originalName.endsWith('.csv')) {
      text = file.buffer.toString('utf-8');
    } else {
      return res.status(400).json({ code: 400, message: '暂不支持该文件格式，仅支持 PDF、TXT、MD、CSV 等' });
    }

    text = text.replace(/\s+/g, ' ').trim();
    if (text.length > 10000) text = text.substring(0, 10000) + '...';

    return res.json({ code: 0, data: { text } });
  } catch (err: any) {
    return res.status(500).json({ code: 500, message: '文件解析失败: ' + err.message });
  }
});

export default router;
