import { getDb } from '../server/config/database';

function seedTests() {
  const db = getDb();
  console.log('🌱 开始填充题库与测评模拟数据...');

  try {
    // 1. 获取一些基础能力库ID (competency_library)
    const libs = db.prepare('SELECT id, name FROM competency_library LIMIT 3').all() as any[];
    if (!libs || libs.length === 0) {
      console.log('未找到能力库预设，请先初始化能力库数据');
      return;
    }

    const lib1 = libs[0];
    const lib2 = libs[1];

    // 2. 插入题库
    const insertBank = db.prepare('INSERT INTO test_banks (title, description, mapped_library_id, created_by) VALUES (?, ?, ?, ?) RETURNING id');
    
    const bank1 = insertBank.get(`【${lib1.name}】专项测试`, `考察员工在“${lib1.name}”方面的理论基础与实际应用能力。`, lib1.id, 'admin') as {id: number};
    const bank2 = insertBank.get(`【${lib2.name}】进阶评测`, `针对高阶人员的“${lib2.name}”深度评测，含场景分析题。`, lib2.id, 'admin') as {id: number};

    // 3. 插入题目
    const insertQuestion = db.prepare('INSERT INTO test_questions (bank_id, type, question, options_json, correct_answer, score, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)');
    
    // 给第一个题库加题目 (总分30分)
    insertQuestion.run(bank1.id, 'single', '在与跨部门同事沟通项目需求时，以下哪种做法最合适？', JSON.stringify(['A. 直接发一封长邮件，不确认对方是否理解', 'B. 组织一个简短的同步会，当面/视频对齐目标和分工，并保留会议纪要', 'C. 用聊天工具零散发送需求，对方不回复就算了', 'D. 只和领导沟通，让领导去传达']), 'B', 10, 1);
    
    insertQuestion.run(bank1.id, 'single', '当项目发生严重延期风险时，你应该首先做什么？', JSON.stringify(['A. 独自加班尝试补救，不告诉任何人', 'B. 把责任推给其他延期的团队', 'C. 立即评估影响范围，梳理出可行的补救方案/Plan B，并及时向项目干系人预警', 'D. 假装没发现，等到了deadline再说']), 'C', 10, 2);

    insertQuestion.run(bank1.id, 'multiple', '以下哪些属于高效倾听的表现？（多选）', JSON.stringify(['A. 眼神交流，适时点头回应', 'B. 对方说话时，心里在想晚上吃什么', 'C. 提问确认自己的理解是否准确', 'D. 随意打断对方的发言']), 'A,C', 10, 3);

    // 给第二个题库加题目 (总分25分)
    insertQuestion.run(bank2.id, 'single', '面临巨大的业绩压力，正确的应对策略是？', JSON.stringify(['A. 每天抱怨大环境不好', 'B. 将大目标拆解为每日/每周的可执行小目标，聚焦于自己能改变的行动上', 'C. 放弃努力，顺其自然', 'D. 随便做做表面工作']), 'B', 15, 1);
    
    insertQuestion.run(bank2.id, 'multiple', '以下哪些方法有助于缓解工作中的急性焦虑情绪？（多选）', JSON.stringify(['A. 深呼吸放松法', 'B. 短暂离开工位散步', 'C. 暴饮暴食', 'D. 将注意力转移至当前立刻能做的具体小事上']), 'A,B,D', 10, 2);


    // 4. 插入测试派发 (给当前测试账号派发任务)
    const insertAssignment = db.prepare('INSERT INTO test_assignments (bank_id, user_id, assigned_by, status) VALUES (?, ?, ?, ?)');
    
    // 派发给 张伟 (zhangwei) 和 李芳 (lifang) 和 当前登录可能用的测试号 (通常前端显示的是 zhangwei / lifang 等)
    // 假设系统测试账号主要是 zhangwei 和 lifang
    insertAssignment.run(bank1.id, 'zhangwei', 'admin', 'pending');
    insertAssignment.run(bank2.id, 'zhangwei', 'admin', 'pending');
    insertAssignment.run(bank1.id, 'lifang', 'admin', 'pending');

    console.log('✅ 测试题库与测评任务模拟数据填充成功！');
    console.log(`创建了 2 个题库，5 道题目，并向 zhangwei, lifang 派发了评测任务。`);

  } catch (error) {
    console.error('❌ 填充数据失败:', error);
  }
}

seedTests();
