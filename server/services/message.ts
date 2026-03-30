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

// ─── 发送 Markdown 消息 ─────────────────────────────────────
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

// ─── ⭐ 发送按钮交互卡片（可直接审批/驳回/认领等） ──────────
export async function sendInteractiveCard(
  userIds: string[],
  options: {
    title: string;
    desc?: string;
    details: { key: string; value: string }[];
    buttons: { text: string; key: string; style?: 1 | 2 | 3 | 4 }[];
    taskId: string;
    quoteTitle?: string;
    quoteText?: string;
    cardUrl?: string;
  }
): Promise<string | null> {
  const db = getDb();
  const stmt = db.prepare(`INSERT INTO message_logs (user_id, msg_type, title, content) VALUES (?, ?, ?, ?)`);
  for (const uid of userIds) {
    stmt.run(uid, 'interactive', options.title, JSON.stringify(options.details));
  }

  try {
    const token = await getAccessToken();
    const url = `${wecomConfig.apiBase}/message/send?access_token=${token}`;

    const templateCard: any = {
      card_type: 'button_interaction',
      source: {
        desc: 'AI赋能HRM',
        desc_color: 1, // 蓝色
      },
      main_title: {
        title: options.title,
        desc: options.desc || '',
      },
      horizontal_content_list: options.details.map((d) => ({
        keyname: d.key,
        value: d.value,
      })),
      task_id: options.taskId,
      button_list: options.buttons.map((b) => ({
        text: b.text,
        style: b.style || 1,
        key: b.key,
      })),
      card_action: {
        type: 1,
        url: options.cardUrl || `${process.env.APP_URL || 'https://talk.szyixikeji.com'}/workflows`,
      },
    };

    // 引用区域（显示任务内容摘要）
    if (options.quoteTitle || options.quoteText) {
      templateCard.quote_area = {
        type: 0,
        title: options.quoteTitle || '',
        quote_text: options.quoteText || '',
      };
    }

    const resp = await axios.post(url, {
      touser: userIds.join('|'),
      msgtype: 'template_card',
      agentid: wecomConfig.agentId,
      template_card: templateCard,
    });

    // 返回 response_code，可用于后续更新卡片
    return resp.data?.response_code || null;
  } catch (err) {
    console.error('[WeCom] 发送交互卡片失败:', err);
    return null;
  }
}

// ─── ⭐ 更新已发送的交互卡片（移除按钮，显示操作结果） ─────
export async function updateInteractiveCard(
  responseCode: string,
  resultTitle: string,
  resultDesc: string
): Promise<void> {
  try {
    const token = await getAccessToken();
    const url = `${wecomConfig.apiBase}/message/update_template_card?access_token=${token}`;

    await axios.post(url, {
      userids: [],  // 空数组表示更新所有接收者
      agentid: wecomConfig.agentId,
      response_code: responseCode,
      template_card: {
        card_type: 'text_notice',
        source: {
          desc: 'AI赋能HRM',
          desc_color: 1,
        },
        main_title: {
          title: resultTitle,
          desc: resultDesc,
        },
      },
    });
  } catch (err) {
    console.error('[WeCom] 更新交互卡片失败:', err);
  }
}

// ─── 工具函数 ───────────────────────────────────────────────
function getUserName(userId: string): string {
  try {
    const db = getDb();
    const user = db.prepare('SELECT name FROM users WHERE id = ?').get(userId) as any;
    return user?.name || userId;
  } catch { return userId; }
}

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

function formatDate(dateStr?: string): string {
  if (!dateStr) return '未设置';
  try {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  } catch { return dateStr; }
}

// ─── 绩效状态变更推送（丰富版 + 交互按钮） ─────────────────
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

  let systemLink = '/personal';

  switch (action) {
    // ── 审批请求：发送交互卡片，可直接同意/驳回 ──
    case 'submitted': {
      systemLink = '/workflows';
      const smartTasks = plan ? db.prepare(
        'SELECT title, s, m FROM smart_tasks WHERE plan_id = ? LIMIT 3'
      ).all(planId) as any[] : [];
      const taskSummary = smartTasks.length > 0
        ? smartTasks.map((t: any) => `• ${t.title}`).join('\n')
        : '（暂无 SMART 目标）';

      const responseCode = await sendInteractiveCard(targetUserIds, {
        title: '📋 绩效审批请求',
        desc: `${creatorName} 提交了新的绩效计划`,
        details: [
          { key: '发起人', value: creatorName },
          { key: '所属部门', value: deptName },
          { key: '计划名称', value: planTitle },
          { key: '任务类型', value: category },
          ...(quarter ? [{ key: '考核周期', value: quarter }] : []),
          { key: '截止日期', value: deadline },
          { key: '提交时间', value: timeStr },
        ],
        quoteTitle: 'SMART 目标摘要',
        quoteText: taskSummary, 
        buttons: [
          { text: '✅ 同意', key: `approve:${planId}`, style: 1 },
          { text: '❌ 驳回', key: `reject:${planId}`, style: 2 },
          { text: '📋 查看详情', key: `view:${planId}`, style: 3 },
        ],
        taskId: `perf_approval_${planId}_${Date.now()}`,
        cardUrl: `${appUrl}/workflows`,
      });

      // 保存 response_code 用于后续更新卡片
      if (responseCode) {
        try {
          db.prepare(
            `INSERT OR REPLACE INTO card_response_codes (plan_id, response_code, created_at) VALUES (?, ?, ?)`
          ).run(planId, responseCode, now.toISOString());
        } catch { /* table may not exist yet */ }
      }
      break;
    }

    // ── 审批通过 ──
    case 'approved': {
      systemLink = '/personal';
      await sendMarkdownMessage(targetUserIds, [
        `**✅ 绩效计划审批通过**`,
        ``,
        `>**任务名称：**${planTitle}`,
        `>**执行人：**${assigneeName}`,
        `>**所属部门：**${deptName}`,
        quarter ? `>**考核周期：**${quarter}` : '',
        `>**截止日期：**${deadline}`,
        `>**当前状态：**<font color="info">进行中</font>`,
        ``,
        `审批已通过，请按时完成目标 💪`,
        `[👉 查看我的目标](${appUrl}/goals)`,
      ].filter(Boolean).join('\n'));
      break;
    }

    // ── 驳回 ──
    case 'rejected': {
      systemLink = '/personal';
      const reason = extra || '未说明原因';
      await sendMarkdownMessage(targetUserIds, [
        `**❌ 绩效计划被驳回**`,
        ``,
        `>**任务名称：**${planTitle}`,
        `>**发起人：**${creatorName}`,
        `>**驳回原因：**<font color="warning">${reason}</font>`,
        ``,
        `请修改后重新提交`,
        `[👉 前往修改](${appUrl}/goals)`,
      ].filter(Boolean).join('\n'));
      break;
    }

    // ── 退回 ──
    case 'returned': {
      systemLink = '/personal';
      const returnReason = extra || '未说明原因';
      await sendMarkdownMessage(targetUserIds, [
        `**🔙 绩效计划已退回**`,
        ``,
        `>**任务名称：**${planTitle}`,
        `>**退回原因：**<font color="warning">${returnReason}</font>`,
        ``,
        `请根据反馈修改后重新提交`,
        `[👉 前往修改](${appUrl}/goals)`,
      ].filter(Boolean).join('\n'));
      break;
    }

    // ── 进度更新 ──
    case 'progress_update': {
      systemLink = '/team';
      const progressColor = progress >= 80 ? 'info' : 'warning';
      await sendMarkdownMessage(targetUserIds, [
        `**📊 绩效进度更新**`,
        ``,
        `>**任务名称：**${planTitle}`,
        `>**执行人：**${assigneeName}`,
        `>**当前进度：**<font color="${progressColor}">${progress}%</font>`,
        `>**截止日期：**${deadline}`,
        ``,
        `[👉 查看详情](${appUrl}/team)`,
      ].filter(Boolean).join('\n'));
      break;
    }

    // ── 评分完成 ──
    case 'assessed': {
      systemLink = '/personal';
      const score = plan?.score ?? '待定';
      await sendMarkdownMessage(targetUserIds, [
        `**🏆 绩效考核评分完成**`,
        ``,
        `>**任务名称：**${planTitle}`,
        `>**被考核人：**${assigneeName}`,
        `>**考核得分：**<font color="info">${score} 分</font>`,
        quarter ? `>**考核周期：**${quarter}` : '',
        ``,
        `[👉 查看评分详情](${appUrl}/goals)`,
      ].filter(Boolean).join('\n'));
      break;
    }

    // ── 奖金发放 ──
    case 'rewarded': {
      systemLink = '/personal';
      const bonus = plan?.bonus ? `¥${plan.bonus}` : '待定';
      await sendMarkdownMessage(targetUserIds, [
        `**💰 绩效奖金已发放**`,
        ``,
        `>**任务名称：**${planTitle}`,
        `>**获奖人：**${assigneeName}`,
        `>**奖金金额：**<font color="info">${bonus}</font>`,
        ``,
        `恭喜！继续加油 🎉`,
        `[👉 查看详情](${appUrl}/goals)`,
      ].filter(Boolean).join('\n'));
      break;
    }

    // ── 逾期预警 ──
    case 'overdue': {
      systemLink = '/personal';
      const daysOverdue = plan?.deadline ? Math.ceil((Date.now() - new Date(plan.deadline).getTime()) / (1000 * 60 * 60 * 24)) : 0;
      await sendMarkdownMessage(targetUserIds, [
        `**⚠️ 绩效任务逾期预警**`,
        ``,
        `>**任务名称：**${planTitle}`,
        `>**执行人：**${assigneeName}`,
        `>**截止日期：**<font color="warning">${deadline}</font>`,
        `>**已逾期：**<font color="warning">${daysOverdue} 天</font>`,
        `>**当前进度：**${progress}%`,
        ``,
        `⏰ 请尽快完成或联系上级调整截止日期`,
        `[👉 前往处理](${appUrl}/goals)`,
      ].filter(Boolean).join('\n'));
      break;
    }

    // ── 默认 ──
    default: {
      await sendMarkdownMessage(targetUserIds, [
        `**📢 绩效通知**`,
        ``,
        `>**任务：**${planTitle}`,
        extra ? `>**备注：**${extra}` : '',
        ``,
        `[👉 查看详情](${appUrl}/workflows)`,
      ].filter(Boolean).join('\n'));
    }
  }

  // 站内消息通知中心
  const actionLabels: Record<string, string> = {
    submitted: '📋 新的绩效审批请求',
    approved: '✅ 绩效计划已通过审批',
    rejected: '❌ 绩效计划被驳回',
    returned: '🔙 绩效计划已退回',
    progress_update: '📊 绩效进度已更新',
    assessed: '🏆 绩效考核评分完成',
    rewarded: '💰 绩效奖金已发放',
    overdue: '⚠️ 绩效任务逾期预警',
  };
  const title = actionLabels[action] || '📢 绩效通知';
  createNotification(
    targetUserIds,
    'perf',
    title,
    `${planTitle}${extra ? `：${extra}` : ''}`,
    systemLink,
    planId
  );
}

// ─── 工资条发放推送 ─────────────────────────────────────────
export async function notifyPayslip(userId: string, month: string, netPay: number): Promise<void> {
  const appUrl = process.env.APP_URL || 'https://talk.szyixikeji.com';
  const userName = getUserName(userId);

  const mdContent = [
    `**💰 工资条已发放**`,
    ``,
    `>**员工：**${userName}`,
    `>**发薪月份：**${month}`,
    `>**实发工资：**<font color="info">¥${netPay.toFixed(2)}</font>`,
    ``,
    `点击查看完整明细`,
    `[👉 查看工资条](${appUrl}/salary/payslip)`,
  ].join('\n');

  await sendMarkdownMessage([userId], mdContent);
  createNotification([userId], 'salary', '💰 工资条已发放', `${month} 工资已出账：¥${netPay.toFixed(2)}`, '/salary');
}
