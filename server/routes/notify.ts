import { Router, Request, Response } from 'express';
import { getDb } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { sendTextMessage, sendCardMessage, sendMarkdownMessage, sendInteractiveCard, updateInteractiveCard } from '../services/message';
import { transitionPlan } from '../services/workflow';
import { verifySignature, decryptMsg, parseXml } from '../utils/wecom-crypto';

const router = Router();

// 发送文字消息
router.post('/send', authMiddleware, async (req, res) => {
  const { userIds, content } = req.body;
  try {
    await sendTextMessage(userIds, content);
    return res.json({ code: 0, message: '发送成功' });
  } catch (error: any) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 发送卡片消息
router.post('/card', authMiddleware, async (req, res) => {
  const { userIds, title, description, url, btnTxt } = req.body;
  try {
    await sendCardMessage(userIds, title, description, url, btnTxt);
    return res.json({ code: 0, message: '发送成功' });
  } catch (error: any) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 发送 Markdown 消息
router.post('/markdown', authMiddleware, async (req, res) => {
  const { userIds, content } = req.body;
  try {
    await sendMarkdownMessage(userIds, content);
    return res.json({ code: 0, message: '发送成功' });
  } catch (error: any) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 发送交互卡片
router.post('/interactive', authMiddleware, async (req, res) => {
  const { userIds, title, desc, details, buttons, taskId, quoteTitle, quoteText, cardUrl } = req.body;
  try {
    const responseCode = await sendInteractiveCard(userIds, {
      title, desc, details, buttons, taskId, quoteTitle, quoteText, cardUrl,
    });
    return res.json({ code: 0, message: '发送成功', data: { responseCode } });
  } catch (error: any) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// ─── 企微回调验证 (GET) ─────────────────────────────────────
// 企微管理后台配置回调 URL 时会发 GET 请求验证
router.get('/card/callback', (req: Request, res: Response) => {
  const { msg_signature, timestamp, nonce, echostr } = req.query;

  console.log('[WeCom Verify] GET 回调验证请求:', { msg_signature, timestamp, nonce, echostr: echostr ? 'present' : 'missing' });

  if (!msg_signature || !timestamp || !nonce || !echostr) {
    console.log('[WeCom Verify] 参数不完整，返回 ready');
    return res.send('callback endpoint ready');
  }

  // 验证签名
  const valid = verifySignature(
    msg_signature as string,
    timestamp as string,
    nonce as string,
    echostr as string
  );

  if (!valid) {
    console.error('[WeCom Verify] 签名验证失败');
    return res.status(403).send('签名验证失败');
  }

  // 解密 echostr 并返回明文
  try {
    const decrypted = decryptMsg(echostr as string);
    console.log('[WeCom Verify] ✅ 验证成功, echostr 解密成功');
    return res.send(decrypted);
  } catch (err) {
    console.error('[WeCom Verify] echostr 解密失败:', err);
    return res.status(500).send('解密失败');
  }
});

// ─── 企微模板卡片按钮回调 (POST) ────────────────────────────
router.post('/card/callback', async (req: Request, res: Response) => {
  console.log('[WeCom Callback] POST 收到回调');

  let eventData: Record<string, string> = {};

  // 方式1: XML 格式（企微标准格式）
  if (typeof req.body === 'string' || req.headers['content-type']?.includes('xml')) {
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const { msg_signature, timestamp, nonce } = req.query;

    try {
      const xmlObj = parseXml(rawBody);
      const encrypted = xmlObj.Encrypt;

      if (encrypted && msg_signature) {
        const valid = verifySignature(
          msg_signature as string,
          timestamp as string,
          nonce as string,
          encrypted
        );

        if (!valid) {
          console.error('[WeCom Callback] 签名验证失败');
          return res.send('success');
        }

        const decrypted = decryptMsg(encrypted);
        eventData = parseXml(decrypted);
      } else {
        eventData = xmlObj;
      }
    } catch (err) {
      console.error('[WeCom Callback] XML 解析失败:', err);
      return res.send('success');
    }
  }
  // 方式2: JSON 格式（简化模式）
  else if (typeof req.body === 'object') {
    eventData = req.body;
  }

  console.log('[WeCom Callback] 解析后的事件数据:', JSON.stringify(eventData));

  // 提取关键字段
  const eventKey = eventData.EventKey || eventData.event_key || eventData.SelectedItems || '';
  const userId = eventData.FromUserName || eventData.userid || '';
  const taskId = eventData.TaskId || eventData.task_id || '';
  const responseCode = eventData.ResponseCode || eventData.response_code || '';

  if (!eventKey) {
    console.log('[WeCom Callback] 无 EventKey，忽略');
    return res.send('success');
  }

  // EventKey 格式: action:planId (如 approve:123, reject:123, view:123)
  const [actionType, planIdStr] = eventKey.split(':');
  const planId = parseInt(planIdStr);

  if (!planId) {
    console.log('[WeCom Callback] 无效的 EventKey:', eventKey);
    return res.send('success');
  }

  // ── 查看详情：不需要操作 ──
  if (actionType === 'view') {
    return res.send('success');
  }

  // ── 审批/驳回 ──
  if (['approve', 'reject'].includes(actionType)) {
    const db = getDb();
    const plan = db.prepare('SELECT * FROM perf_plans WHERE id = ?').get(planId) as any;

    if (!plan) {
      console.error('[WeCom Callback] 计划不存在:', planId);
      try { await sendTextMessage([userId], `❌ 操作失败：绩效计划 #${planId} 不存在`); } catch {}
      return res.send('success');
    }

    // 权限校验
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId) as any;
    if (plan.approver_id !== userId && user?.role !== 'admin' && user?.role !== 'hr') {
      try { await sendTextMessage([userId], `❌ 操作失败：您不是该计划的审批人，无权操作`); } catch {}
      return res.send('success');
    }

    // 禁止自审
    if (plan.creator_id === userId && user?.role !== 'admin') {
      try { await sendTextMessage([userId], `❌ 操作失败：发起人不能审批自己的计划`); } catch {}
      return res.send('success');
    }

    const targetStatus = actionType === 'approve' ? 'approved' : 'rejected';
    const comment = actionType === 'reject' ? '通过企微消息驳回' : undefined;
    const result = await transitionPlan(planId, targetStatus, userId, { comment });

    const creatorName = (db.prepare('SELECT name FROM users WHERE id = ?').get(plan.creator_id) as any)?.name || plan.creator_id;
    const operatorName = (db.prepare('SELECT name FROM users WHERE id = ?').get(userId) as any)?.name || userId;

    if (result.success) {
      const emoji = actionType === 'approve' ? '✅' : '❌';
      const actionText = actionType === 'approve' ? '通过' : '驳回';

      // 回复操作者
      try {
        await sendMarkdownMessage([userId], [
          `**${emoji} 操作成功**`,
          ``,
          `>**计划名称：**${plan.title}`,
          `>**发起人：**${creatorName}`,
          `>**操作：**<font color="${actionType === 'approve' ? 'info' : 'warning'}">${actionText}</font>`,
          `>**操作人：**${operatorName}`,
        ].join('\n'));
      } catch {}

      // 更新原始卡片
      if (responseCode) {
        try {
          await updateInteractiveCard(
            responseCode,
            `${emoji} 已${actionText}`,
            `${operatorName} 已${actionText}「${plan.title}」`
          );
        } catch {}
      }

      console.log(`[WeCom Callback] ✅ ${operatorName} ${actionText}了「${plan.title}」`);
    } else {
      try { await sendTextMessage([userId], `❌ 操作失败：${result.message}`); } catch {}
    }

    return res.send('success');
  }

  return res.send('success');
});

// 推送记录查询
router.get('/history', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const logs = db.prepare('SELECT * FROM message_logs ORDER BY created_at DESC LIMIT 100').all();
  return res.json({ code: 0, data: logs });
});

export default router;
