// 四大流程浏览器自动化测试
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const http = require('http');

const SCREENSHOTS_DIR = path.join(__dirname, '../test-screenshots');
if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const BASE = 'http://localhost:3000';
const API_HOST = 'localhost';
const API_PORT = 3001;

let step = 0;
async function shot(page, name) {
  step++;
  const file = path.join(SCREENSHOTS_DIR, `${String(step).padStart(2,'0')}_${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  📸 [${step}] ${name}`);
  return file;
}

function apiPost(path, body, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const req = http.request({ hostname: API_HOST, port: API_PORT, path, method: 'POST', headers }, res => {
      let chunks = '';
      res.on('data', c => chunks += c);
      res.on('end', () => { try { resolve(JSON.parse(chunks)); } catch(e) { reject(new Error(chunks)); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function login(page, userId) {
  const json = await apiPost('/api/auth/login', { code: 'mock_code', userId });
  if (json.code !== 0) throw new Error(`登录失败: ${json.message}`);
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  }, { token: json.data.token, user: json.data.user });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  console.log(`  🔐 ${json.data.user.name} (${json.data.user.role})`);
  return json.data.token;
}

async function clickText(page, texts, timeout = 1500) {
  for (const t of texts) {
    try {
      const el = page.locator(`text=${t}`).first();
      if (await el.isVisible({ timeout: 500 })) {
        await el.click();
        await page.waitForTimeout(timeout);
        return true;
      }
    } catch {}
  }
  return false;
}

(async () => {
  console.log('🚀 启动浏览器测试...\n');
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'zh-CN' })).newPage();
  
  try {
    // ═══════════════════════════════════════
    console.log('═══ 流程一：团队内发起任务（主管→员工）═══');
    // ═══════════════════════════════════════
    
    await page.goto(BASE, { waitUntil: 'networkidle' });
    console.log('\n--- 1.1 登录主管(张伟) ---');
    await login(page, 'zhangwei');
    await shot(page, 'dashboard_zhangwei');

    console.log('\n--- 1.2 进入绩效页 ---');
    let found = await clickText(page, ['我的绩效', '绩效目标', '绩效']);
    if (!found) {
      // 尝试sidebar图标
      const links = await page.$$eval('nav a, aside a, [class*="sidebar"] a', els => els.map(e => ({ text: e.textContent?.trim(), href: e.href })));
      console.log('  侧边链接:', links.map(l => l.text).join(' | '));
      found = await clickText(page, ['目标']);
    }
    await shot(page, 'perf_page');

    console.log('\n--- 1.3 点击新建/指派任务 ---');
    found = await clickText(page, ['指派新任务', '新建目标', '新建', '创建', '发起任务', '指派']);
    await shot(page, 'create_modal');

    if (found) {
      console.log('\n--- 1.4 填写表单 ---');
      // 尝试填写标题
      const titleSel = 'input[placeholder*="标题"], input[placeholder*="名称"], textarea[placeholder*="目标"], input[name="title"]';
      const titleEl = await page.$(titleSel);
      if (titleEl) {
        await titleEl.fill('Q2产品优化方案');
        console.log('  ✅ 标题已填');
      }
      
      // S-目标
      const sInput = await page.$('textarea[placeholder*="具体"]') || await page.$('textarea[placeholder*="目标"]');
      if (sInput) {
        await sInput.fill('优化核心产品用户体验');
        console.log('  ✅ S目标已填');
      }
      
      await shot(page, 'form_filled');
      
      // 提交
      console.log('\n--- 1.5 提交 ---');
      found = await clickText(page, ['提交审批', '提交', '确认创建', '确认']);
      await page.waitForTimeout(2000);
      await shot(page, 'submitted');
    }

    // ═══════════════════════════════════════
    console.log('\n\n═══ 流程二：员工申请个人目标 ═══');
    // ═══════════════════════════════════════
    
    console.log('\n--- 2.1 切换赵敏(员工) ---');
    await login(page, 'zhaoming');
    await shot(page, 'dashboard_zhaoming');

    console.log('\n--- 2.2 进入绩效页 ---');
    await clickText(page, ['我的绩效', '绩效目标', '绩效', '目标']);
    await shot(page, 'emp_perf');

    console.log('\n--- 2.3 新建个人目标 ---');
    found = await clickText(page, ['申请新目标', '新建目标', '新建', '创建']);
    await shot(page, 'emp_create_modal');

    if (found) {
      const titleEl2 = await page.$('input[placeholder*="标题"], input[name="title"], textarea[placeholder*="目标"]');
      if (titleEl2) {
        await titleEl2.fill('前端性能优化');
        console.log('  ✅ 标题已填');
      }
      await shot(page, 'emp_form');
    }

    // ═══════════════════════════════════════
    console.log('\n\n═══ 流程三：申请提案 ═══');
    // ═══════════════════════════════════════
    
    console.log('\n--- 3.1 切换刘强(员工) ---');
    await login(page, 'liuqiang');
    
    console.log('\n--- 3.2 进入赏金榜 ---');
    await clickText(page, ['赏金榜', '绩效池', '公司绩效']);
    await shot(page, 'bounty_board');

    console.log('\n--- 3.3 点击发起提案 ---');
    found = await clickText(page, ['发起提案', '新建提案', '提案']);
    await shot(page, 'propose_modal');
    
    if (found) {
      const titleEl3 = await page.$('input[placeholder*="标题"], input[name="title"]');
      if (titleEl3) {
        await titleEl3.fill('智能客服AI助手');
        console.log('  ✅ 标题已填');
      }
      await shot(page, 'propose_form');
    }

    // ═══════════════════════════════════════
    console.log('\n\n═══ 流程四：认领任务 ═══');
    // ═══════════════════════════════════════
    
    // 通过API快速创建一个可认领任务
    console.log('\n--- 4.0 API创建可认领任务 ---');
    const adminToken = (await apiPost('/api/auth/login', { code: 'mock_code', userId: 'admin' })).data.token;
    const empToken = (await apiPost('/api/auth/login', { code: 'mock_code', userId: 'liuqiang' })).data.token;
    
    const propRes = await apiPost('/api/pool/tasks/propose', { title: '智能客服AI助手', description: '搭建AI客服系统', bonus: 5000, max_participants: 4 }, empToken);
    const taskId = propRes.data?.id;
    console.log(`  提案ID: ${taskId}`);
    
    await apiPost(`/api/pool/proposals/${taskId}/review`, { action: 'approve' }, adminToken);
    await apiPost(`/api/pool/proposals/${taskId}/review`, { action: 'approve' }, adminToken);
    await apiPost(`/api/pool/tasks/${taskId}/start-claiming`, {}, adminToken);
    console.log('  ✅ 任务已发布认领(无需RACI预配置)');

    console.log('\n--- 4.1 员工(赵敏)查看赏金榜 ---');
    await login(page, 'zhaoming');
    await clickText(page, ['赏金榜', '公司绩效', '绩效池']);
    await page.waitForTimeout(1500);
    await shot(page, 'bounty_claiming');

    console.log('\n--- 4.2 点击任务卡片 ---');
    found = await clickText(page, ['智能客服AI助手']);
    await page.waitForTimeout(1000);
    await shot(page, 'task_detail');
    
    console.log('\n--- 4.3 点击认领角色 ---');
    found = await clickText(page, ['认领角色', '认领']);
    await page.waitForTimeout(1000);
    await shot(page, 'claim_role_modal');

    if (found) {
      console.log('\n--- 4.4 选择R (执行者) ---');
      found = await clickText(page, ['执行者', 'R 执行者']);
      await shot(page, 'role_R_selected');
      
      console.log('\n--- 4.5 填写理由并提交 ---');
      const reasonEl = await page.$('textarea[placeholder*="理由"], textarea[placeholder*="描述"], textarea[placeholder*="优势"]');
      if (reasonEl) {
        await reasonEl.fill('我有丰富的AI集成开发经验');
        console.log('  ✅ 理由已填');
      }
      
      found = await clickText(page, ['提交申请', '提交', '确认申请']);
      await page.waitForTimeout(2000);
      await shot(page, 'claim_submitted');
    }

    // ═══════════════════════════════════════
    console.log('\n\n═══ HR审批认领 ═══');
    // ═══════════════════════════════════════
    
    console.log('\n--- 5.1 切换HR(admin) ---');
    await login(page, 'admin');
    await shot(page, 'admin_dashboard');

    console.log('\n--- 5.2 进入我的流程 ---');
    await clickText(page, ['我的流程', '流程', '审批']);
    await page.waitForTimeout(1500);
    await shot(page, 'admin_workflows');

    console.log('\n--- 5.3 查看待审核 ---');
    await clickText(page, ['待我审核', '待审核', '待处理']);
    await page.waitForTimeout(1500);
    await shot(page, 'pending_review');

    // 最终状态
    console.log('\n--- 6. 最终仪表板 ---');
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await shot(page, 'final_dashboard');

  } catch (err) {
    console.error('❌ 错误:', err.message);
    try { await shot(page, 'error_state'); } catch {}
  } finally {
    await browser.close();
    console.log(`\n✅ 测试完成！共 ${step} 张截图`);
    console.log(`📁 截图目录: ${SCREENSHOTS_DIR}`);
  }
})();
