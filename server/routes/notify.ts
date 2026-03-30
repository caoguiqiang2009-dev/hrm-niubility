import { Router } from 'express';
import { getDb } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { sendTextMessage, sendCardMessage, sendMarkdownMessage, sendInteractiveCard, updateInteractiveCard } from '../services/message';
import { transitionPlan } from '../services/workflow';

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

// ─── ⭐ 企微模板卡片按钮回调 ────────────────────────────────
// 当用户在企微中点击交互卡片按钮时，企微会回调此接口
// 文档: https://developer.work.weixin.qq.com/document/path/90240
router.post('/card/callback', async (req, res) => {
  console.log('[WeCom Callback] 收到回调:', JSON.stringify(req.body));

  // 企微回调的数据可能是 XML 或 JSON 格式
  // 解析 EventKey 和 FromUserName
  const eventKey = req.body?.EventKey || req.body?.event_key || '';
  const userId = req.body?.FromUserName || req.body?.userid || '';
  const responseCode = req.body?.response_code || '';

  if (!eventKey) {
    console.log('[WeCom Callback] 无 EventKey，忽略');
    return res.json({ code: 0 });
  }

  // EventKey 格式: action:planId (如 approve:123, reject:123, view:123)
  const [actionType, planIdStr] = eventKey.split(':');
  const planId = parseInt(planIdStr);

  if (!planId) {
    return res.json({ code: 0 });
  }

  // ── 查看详情：跳转不需要操作 ──
  if (actionType === 'view') {
    return res.json({ code: 0 });
  }

  // ── 审批/驳回 ──
  if (['approve', 'reject'].includes(actionType)) {
    const db = getDb();
    const plan = db.prepare('SELECT * FROM perf_plans WHERE id = ?').get(planId) as any;

    if (!plan) {
      console.error('[WeCom Callback] 计划不存在:', planId);
      await sendTextMessage([userId], `❌ 操作失败：绩效计划 #${planId} 不存在`);
      return res.json({ code: 0 });
    }

    // 权限校验: 只有审批人或 admin 可以操作
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId) as any;
    if (plan.approver_id !== userId && user?.role !== 'admin' && user?.role !== 'hr') {
      await sendTextMessage([userId], `❌ 操作失败：您不是该计划的审批人，无权操作`);
      return res.json({ code: 0 });
    }

    // 禁止自审
    if (plan.creator_id === userId && user?.role !== 'admin') {
      await sendTextMessage([userId], `❌ 操作失败：发起人不能审批自己的计划`);
      return res.json({ code: 0 });
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
      await sendMarkdownMessage([userId], [
        `**${emoji} 操作成功**`,
        ``,
        `>**计划名称：**${plan.title}`,
        `>**发起人：**${creatorName}`,
        `>**操作：**<font color="${actionType === 'approve' ? 'info' : 'warning'}">${actionText}</font>`,
        `>**操作人：**${operatorName}`,
      ].join('\n'));

      // 更新原始卡片（移除按钮，显示结果）
      if (responseCode) {
        await updateInteractiveCard(
          responseCode,
          `${emoji} 已${actionText}`,
          `${operatorName} 已${actionText}「${plan.title}」`
        );
      }
    } else {
      await sendTextMessage([userId], `❌ 操作失败：${result.message}`);
    }

    return res.json({ code: 0 });
  }

  // ── 绩效池：加入/认领 ──
  if (actionType === 'claim') {
    // 未来扩展：绩效池认领
    return res.json({ code: 0 });
  }

  return res.json({ code: 0 });
});

// ─── 企微验证回调（GET 请求，配置回调地址时企微会验证） ─────
router.get('/card/callback', (req, res) => {
  // 企微配置回调地址时会发 GET 请求验证
  // 需要返回 echostr 参数
  const echostr = req.query.echostr;
  if (echostr) {
    return res.send(echostr);
  }
  return res.json({ code: 0, message: 'callback endpoint ready' });
});

// 推送记录查询
router.get('/history', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const logs = db.prepare('SELECT * FROM message_logs ORDER BY created_at DESC LIMIT 100').all();
  return res.json({ code: 0, data: logs });
});

export default router;
