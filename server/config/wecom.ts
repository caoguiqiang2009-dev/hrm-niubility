export const wecomConfig = {
  corpId: process.env.WECOM_CORP_ID || '',
  agentId: process.env.WECOM_AGENT_ID || '',
  secret: process.env.WECOM_SECRET || '',
  // 通讯录同步：需要使用「通讯录同步助手」的 Secret，而非自建应用 Secret
  contactSecret: process.env.WECOM_CONTACT_SECRET || '',
  // 企微API基础地址
  apiBase: 'https://qyapi.weixin.qq.com/cgi-bin',
  // 智能表格 — 工资表
  salaryDocId: process.env.WECOM_SALARY_DOC_ID || '',
  salarySheetId: process.env.WECOM_SALARY_SHEET_ID || '',
  // 回调验证（交互式卡片按钮回调）
  callbackToken: process.env.WECOM_CALLBACK_TOKEN || '',
  callbackAesKey: process.env.WECOM_CALLBACK_AES_KEY || '',
};
