import axios from 'axios';
import { wecomConfig } from '../config/wecom';
import { getAccessToken } from './wecom';
import { getDb } from '../config/database';
import { createNotification } from '../routes/notifications';

// ─── 发送文字消息 ───────────────────────────────────────────
export async function sendTextMessage(userIds: string[], content: string): Promise<void> {
  const db = getDb();
  const stmt = db.prepare(`INSERT INTO message_logs (user_id, msg_type, title, content) VALUES (?, ?, ?, ?)`);
  for (const uid of userIds) {
    stmt.run(uid, 'text', '', content);
  }

  try {
    const token = await getAccessToken();
    const url = `${wecomConfig.apiBase}/message/send?access_token=${token}`;
    await axios.post(url, {
      touser: userIds.join('|'),
      msgtype: 'text',
      agentid: wecomConfig.agentId,
      text: { content },
    });
  } catch (err) {
    console.error('[WeCom] 发送文字消息失败:', err);
  }
}

// ─── 发送卡片消息 (TextCard) ────────────────────────────────
export async function sendCardMessage(
  userIds: string[],
  title: string,
  description: string,
  url: string,
  btnTxt: string = '详情'
): Promise<void> {
  const db = getDb();
  const stmt = db.prepare(`INSERT INTO message_logs (user_id, msg_type, title, content) VALUES (?, ?, ?, ?)`);
  for (const uid of userIds) {
    stmt.run(uid, 'card', title, description);
  }

  try {
    const token = await getAccessToken();
    const apiUrl = `${wecomConfig.apiBase}/message/send?access_token=${token}`;

    await axios.post(apiUrl, {
      touser: userIds.join('|'),
      msgtype: 'textcard',
      agentid: wecomConfig.agentId,
      textcard: { title, description, url, btntxt: btnTxt },
    });
  } catch (err) {
    console.error('[WeCom] 发送卡片消息失败:', err);
  }
}

// ─── 发送 Markdown 消息（更丰富的排版） ─────────────────────
export async function sendMarkdownMessage(
  userIds: string[],
  content: string
): Promise<void> {
  const db = getDb();
  const stmt = db.prepare(`INSERT INTO message_logs (user_id, msg_type, title, content) VALUES (?, ?, ?, ?)`);
  for (const uid of userIds) {
    stmt.run(uid, 'markdown', '', content);
  }

  try {
    const token = await getAccessToken();
    const url = `${wecomConfig.apiBase}/message/send?access_token=${token}`;
    await axios.post(url, {
      touser: userIds.join('|'),
      msgtype: 'markdown',
      agentid: wecomConfig.agentId,
      markdown: { content },
    });
  } catch (err) {
    console.error('[WeCom] 发送Markdown消息失败:', err);
  }
}

// ─── 工具：获取用户名 ──────────────────────────────────────
function getUserName(userId: string): string {
  try {
    const db = getDb();
    const user = db.prepare('SELECT name FROM users WHERE id = ?').get(userId) as any;
    return user?.name || userId;
  } catch { return userId; }
}

// ─── 工具：获取部门名 ──────────────────────────────────────
function getDeptName(userId: string): string {
  try {
    const db = getDb();
    const row = db.prepare(`
      SELECT d.name FROM users u 
      LEFT JOIN departments d ON u.department_id = d.id 
      WHERE u.id = ?
    `).get(userId) as any;
    return row?.name || '未分配部门';
  } catch { return '未知部门'; }
}

// ─── 工具：格式化日期 ──────────────────────────────────────
function formatDate(dateStr?: string): string {
  if (!dateStr) return '未设置';
  try {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  } catch { return dateStr; }
}

// ─── 绩效状态变更推送（丰富版） ────────────────────────────
export async function notifyPerfStatusChange(
  planId: number,
  action: string,
  targetUserIds: string[],
  planTitle: string,
  extra?: string
): Promise<void> {
  const db = getDb();
  const plan = db.prepare('SELECT * FROM perf_plans WHERE id = ?').get(planId) as any;
  const appUrl = process.env.APP_URL || 'https://talk.szyixikeji.com';

  const creatorName = getUserName(plan?.creator_id || '');
  const assigneeName = getUserName(plan?.assignee_id || '');
  const deptName = getDeptName(plan?.creator_id || plan?.assignee_id || '');
  const deadline = formatDate(plan?.deadline);
  const quarter = plan?.quarter || '';
  const progress = plan?.progress ?? 0;
  const category = plan?.category || '常规任务';
  const now = new Date();
  const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  let mdContent = '';
  let cardTitle = '';
  let cardDesc = '';
  let cardBtn = '查看详情';
  let cardUrl = `${appUrl}/workflows`;
  let systemLink = '/personal';

  switch (action) {
    case 'submitted': {
      cardTitle = '📋 新的绩效审批请求';
      systemLink = '/workflows';
      cardUrl = `${appUrl}/workflows`;
      mdContent = [
        `**📋 新的绩效审批请求**`,
        `> 请尽快处理以下审批`,
        ``,
        `**任务名称：**${planTitle}`,
        `**发起人：**${creatorName}`,
        `**所属部门：**${deptName}`,
        `**任务类型：**${category}`,
        quarter ? `**考核周期：**${quarter}` : '',
        `**截止日期：**<font color="warning">${deadline}</font>`,
        ``,
        `> 请点击下方链接前往审批`,
        `> [👉 前往审批](${cardUrl})`,
      ].filter(Boolean).join('\n');
      cardDesc = `<div class="gray">${timeStr}</div><div class="normal">发起人：${creatorName}（${deptName}）</div><div class="normal">任务：${planTitle}</div><div class="normal">类型：${category}${quarter ? ` | 周期：${quarter}` : ''}</div><div class="highlight">截止：${deadline}</div>`;
      cardBtn = '前往审批';
      break;
    }
    case 'approved': {
      cardTitle = '✅ 绩效计划已通过审批';
      systemLink = '/personal';
      cardUrl = `${appUrl}/goals`;
      mdContent = [
        `**✅ 绩效计划审批通过**`,
        ``,
        `**任务名称：**${planTitle}`,
        `**执行人：**${assigneeName}`,
        `**所属部门：**${deptName}`,
        quarter ? `**考核周期：**${quarter}` : '',
        `**截止日期：**${deadline}`,
        `**当前状态：**<font color="info">进行中</font>`,
        ``,
        `> 审批已通过，请按时完成目标 💪`,
        `> [👉 查看我的目标](${cardUrl})`,
      ].filter(Boolean).join('\n');
      cardDesc = `<div class="gray">${timeStr}</div><div class="normal">任务：${planTitle}</div><div class="normal">执行人：${assigneeName}（${deptName}）</div><div class="highlight">✅ 审批已通过，开始执行</div>`;
      cardBtn = '查看目标';
      break;
    }
    case 'rejected': {
      cardTitle = '❌ 绩效计划被驳回';
      systemLink = '/personal';
      cardUrl = `${appUrl}/goals`;
      const reason = extra || '未说明原因';
      mdContent = [
        `**❌ 绩效计划被驳回**`,
        ``,
        `**任务名称：**${planTitle}`,
        `**发起人：**${creatorName}`,
        `**驳回原因：**<font color="warning">${reason}</font>`,
        ``,
        `> 请修改后重新提交`,
        `> [👉 前往修改](${cardUrl})`,
      ].filter(Boolean).join('\n');
      cardDesc = `<div class="gray">${timeStr}</div><div class="normal">任务：${planTitle}</div><div class="highlight">❌ 驳回原因：${reason}</div><div class="normal">请修改后重新提交</div>`;
      cardBtn = '前往修改';
      break;
    }
    case 'returned': {
      cardTitle = '🔙 绩效计划已退回';
      systemLink = '/personal';
      cardUrl = `${appUrl}/goals`;
      const returnReason = extra || '未说明原因';
      mdContent = [
        `**🔙 绩效计划已退回**`,
        ``,
        `**任务名称：**${planTitle}`,
        `**退回原因：**<font color="warning">${returnReason}</font>`,
        ``,
        `> 请根据反馈修改后重新提交`,
        `> [👉 前往修改](${cardUrl})`,
      ].filter(Boolean).join('\n');
      cardDesc = `<div class="gray">${timeStr}</div><div class="normal">任务：${planTitle}</div><div class="highlight">🔙 退回原因：${returnReason}</div>`;
      cardBtn = '前往修改';
      break;
    }
    case 'progress_update': {
      cardTitle = '📊 绩效进度已更新';
      systemLink = '/team';
      cardUrl = `${appUrl}/team`;
      const progressBar = progress >= 80 ? '🟢' : progress >= 50 ? '🟡' : '🔴';
      mdContent = [
        `**📊 绩效进度更新**`,
        ``,
        `**任务名称：**${planTitle}`,
        `**执行人：**${assigneeName}`,
        `**当前进度：**${progressBar} <font color="${progress >= 80 ? 'info' : 'warning'}">${progress}%</font>`,
        `**截止日期：**${deadline}`,
        ``,
        `> [👉 查看详情](${cardUrl})`,
      ].filter(Boolean).join('\n');
      cardDesc = `<div class="gray">${timeStr}</div><div class="normal">执行人：${assigneeName}</div><div class="normal">任务：${planTitle}</div><div class="highlight">进度：${progress}%</div>`;
      break;
    }
    case 'assessed': {
      cardTitle = '🏆 绩效考核评分完成';
      systemLink = '/personal';
      cardUrl = `${appUrl}/goals`;
      const score = plan?.score ?? '待定';
      mdContent = [
        `**🏆 绩效考核评分完成**`,
        ``,
        `**任务名称：**${planTitle}`,
        `**被考核人：**${assigneeName}`,
        `**考核得分：**<font color="info">${score} 分</font>`,
        quarter ? `**考核周期：**${quarter}` : '',
        ``,
        `> [👉 查看评分详情](${cardUrl})`,
      ].filter(Boolean).join('\n');
      cardDesc = `<div class="gray">${timeStr}</div><div class="normal">任务：${planTitle}</div><div class="highlight">🏆 考核得分：${score} 分</div>`;
      cardBtn = '查看评分';
      break;
    }
    case 'rewarded': {
      cardTitle = '💰 绩效奖金已发放';
      systemLink = '/personal';
      cardUrl = `${appUrl}/goals`;
      const bonus = plan?.bonus ? `¥${plan.bonus}` : '待定';
      mdContent = [
        `**💰 绩效奖金已发放**`,
        ``,
        `**任务名称：**${planTitle}`,
        `**获奖人：**${assigneeName}`,
        `**奖金金额：**<font color="info">${bonus}</font>`,
        ``,
        `> 恭喜！继续加油 🎉`,
        `> [👉 查看详情](${cardUrl})`,
      ].filter(Boolean).join('\n');
      cardDesc = `<div class="gray">${timeStr}</div><div class="normal">任务：${planTitle}</div><div class="highlight">💰 奖金：${bonus}</div>`;
      cardBtn = '查看详情';
      break;
    }
    case 'overdue': {
      cardTitle = '⚠️ 绩效任务逾期预警';
      systemLink = '/personal';
      cardUrl = `${appUrl}/goals`;
      const daysOverdue = plan?.deadline ? Math.ceil((Date.now() - new Date(plan.deadline).getTime()) / (1000 * 60 * 60 * 24)) : 0;
      mdContent = [
        `**⚠️ 绩效任务逾期预警**`,
        ``,
        `**任务名称：**${planTitle}`,
        `**执行人：**${assigneeName}`,
        `**截止日期：**<font color="warning">${deadline}</font>`,
        `**已逾期：**<font color="warning">${daysOverdue} 天</font>`,
        `**当前进度：**${progress}%`,
        ``,
        `> ⏰ 请尽快完成或联系上级调整截止日期`,
        `> [👉 前往处理](${cardUrl})`,
      ].filter(Boolean).join('\n');
      cardDesc = `<div class="gray">${timeStr}</div><div class="normal">任务：${planTitle}</div><div class="normal">执行人：${assigneeName}</div><div class="highlight">⚠️ 已逾期 ${daysOverdue} 天 | 进度：${progress}%</div>`;
      cardBtn = '前往处理';
      break;
    }
    default: {
      cardTitle = '📢 绩效通知';
      mdContent = [
        `**📢 绩效通知**`,
        ``,
        `**任务：**${planTitle}`,
        extra ? `**备注：**${extra}` : '',
        ``,
        `> [👉 查看详情](${cardUrl})`,
      ].filter(Boolean).join('\n');
      cardDesc = `<div class="gray">${timeStr}</div><div class="normal">${planTitle}</div>${extra ? `<div class="highlight">${extra}</div>` : ''}`;
    }
  }

  // 1. 优先发送 Markdown（排版更好看）
  await sendMarkdownMessage(targetUserIds, mdContent);

  // 2. 站内消息通知中心
  createNotification(
    targetUserIds,
    'perf',
    cardTitle,
    `${planTitle}${extra ? `：${extra}` : ''}`,
    systemLink,
    planId
  );
}

// ─── 工资条发放推送（丰富版） ───────────────────────────────
export async function notifyPayslip(userId: string, month: string, netPay: number): Promise<void> {
  const appUrl = process.env.APP_URL || 'https://talk.szyixikeji.com';
  const userName = getUserName(userId);

  const mdContent = [
    `**💰 工资条已发放**`,
    ``,
    `**员工：**${userName}`,
    `**发薪月份：**${month}`,
    `**实发工资：**<font color="info">¥${netPay.toFixed(2)}</font>`,
    ``,
    `> 点击查看完整明细`,
    `> [👉 查看工资条](${appUrl}/salary/payslip)`,
  ].join('\n');

  await sendMarkdownMessage([userId], mdContent);
  createNotification([userId], 'salary', '💰 工资条已发放', `${month} 工资已出账：¥${netPay.toFixed(2)}`, '/salary');
}
