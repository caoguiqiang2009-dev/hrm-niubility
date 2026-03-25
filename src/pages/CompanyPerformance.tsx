import Sidebar from '../components/Sidebar';

export default function CompanyPerformance({ navigate }: { navigate: (view: string) => void }) {
  return (
    <div className="bg-background text-on-background min-h-screen">
      <Sidebar currentView="company" navigate={navigate} />

      {/* Main Content Area */}
      <main className="flex-1 mt-16 min-h-[calc(100vh-4rem)] overflow-y-auto">

        <div className="p-8">
          <div className="max-w-7xl mx-auto flex gap-8">
          {/* Left Sidebar Filter */}
          <aside className="w-72 flex-shrink-0 flex flex-col gap-6">
            <div className="bg-surface-container-low p-6 rounded-xl shadow-sm border border-outline-variant/10">
              <h3 className="text-sm font-bold text-on-surface mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-lg">filter_list</span>
                任务筛选
              </h3>
              {/* Status Filter */}
              <div className="mb-8">
                <label className="label-font text-[10px] uppercase tracking-widest text-on-surface-variant font-bold block mb-3">状态</label>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input className="rounded text-primary focus:ring-primary-container bg-surface-container-lowest border-outline-variant/30" type="checkbox" />
                    <span className="text-sm text-on-surface group-hover:text-primary transition-colors">开放中</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input defaultChecked className="rounded text-primary focus:ring-primary-container bg-surface-container-lowest border-outline-variant/30" type="checkbox" />
                    <span className="text-sm text-on-surface group-hover:text-primary transition-colors">进行中</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input className="rounded text-primary focus:ring-primary-container bg-surface-container-lowest border-outline-variant/30" type="checkbox" />
                    <span className="text-sm text-on-surface group-hover:text-primary transition-colors">已完成</span>
                  </label>
                </div>
              </div>
              {/* Bonus Range Filter */}
              <div className="mb-8">
                <label className="label-font text-[10px] uppercase tracking-widest text-on-surface-variant font-bold block mb-3">奖金范围</label>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => alert("功能开发中")} className="px-3 py-1.5 text-xs rounded-full bg-surface-container-lowest border border-outline-variant/20 hover:border-primary transition-all">¥0-5k</button>
                  <button onClick={() => alert("功能开发中")} className="px-3 py-1.5 text-xs rounded-full bg-primary text-white font-medium">¥5k-20k</button>
                  <button onClick={() => alert("功能开发中")} className="px-3 py-1.5 text-xs rounded-full bg-surface-container-lowest border border-outline-variant/20 hover:border-primary transition-all">¥20k+</button>
                </div>
              </div>
              {/* Department Filter */}
              <div className="mb-8">
                <label className="label-font text-[10px] uppercase tracking-widest text-on-surface-variant font-bold block mb-3">所属部门</label>
                <select className="w-full bg-surface-container-lowest border-none ring-1 ring-outline-variant/30 rounded-lg text-sm px-3 py-2 focus:ring-2 focus:ring-primary transition-all outline-none">
                  <option>全部分门</option>
                  <option>研发部</option>
                  <option>市场部</option>
                  <option>产品部</option>
                  <option>人事部</option>
                </select>
              </div>
              {/* Deadline Filter */}
              <div className="mb-2">
                <label className="label-font text-[10px] uppercase tracking-widest text-on-surface-variant font-bold block mb-3">截止日期</label>
                <div className="space-y-2">
                  <button onClick={() => alert("功能开发中")} className="w-full text-left px-4 py-2 text-sm rounded-lg hover:bg-surface-container-highest transition-colors flex items-center justify-between group">
                    <span>本周</span>
                    <span className="text-[10px] bg-error-container text-on-error-container px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">紧急</span>
                  </button>
                  <button onClick={() => alert("功能开发中")} className="w-full text-left px-4 py-2 text-sm rounded-lg bg-surface-container-highest font-medium text-primary flex items-center justify-between">
                    <span>本月</span>
                    <span className="material-symbols-outlined text-sm">check</span>
                  </button>
                  <button onClick={() => alert("功能开发中")} className="w-full text-left px-4 py-2 text-sm rounded-lg hover:bg-surface-container-highest transition-colors">本季</button>
                </div>
              </div>
            </div>
            <div className="primary-gradient p-6 rounded-2xl text-white relative overflow-hidden">
              <div className="relative z-10">
                <h4 className="font-bold text-lg mb-2">快速挑战</h4>
                <p className="text-xs text-white/80 mb-4">完成即时任务，获取双倍积分奖励。</p>
                <button onClick={() => alert("功能开发中")} className="bg-white text-primary px-4 py-2 rounded-xl text-xs font-bold hover:bg-opacity-90 transition-all">立即查看</button>
              </div>
              <span className="material-symbols-outlined absolute -right-4 -bottom-4 text-white/10 text-8xl">rocket_launch</span>
            </div>
          </aside>

          {/* Right Content Grid */}
          <section className="flex-1">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-black text-on-background tracking-tight">公司绩效池</h1>
                <p className="text-on-surface-variant text-sm mt-1">发现新机遇，挑战高难度任务，赢取丰厚奖金。</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => alert("功能开发中")} className="flex items-center gap-2 px-4 py-2 bg-surface-container-low rounded-xl text-sm font-medium text-on-surface-variant hover:bg-surface-container-high transition-all">
                  <span className="material-symbols-outlined text-lg">sort</span>
                  按奖励排序
                </button>
                <button onClick={() => alert("功能开发中")} className="flex items-center gap-2 px-4 py-2 primary-gradient rounded-xl text-sm font-bold text-white shadow-lg shadow-primary/20">
                  <span className="material-symbols-outlined text-lg">add</span>
                  发布任务
                </button>
              </div>
            </div>

            {/* Task Card Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Card 1 */}
              <div className="group bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-300 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <span className="bg-secondary-container text-on-secondary-container text-[10px] font-bold px-3 py-1 rounded-full uppercase label-font">开放中</span>
                  <span className="text-primary font-black text-xl tracking-tight">¥12,500</span>
                </div>
                <h3 className="text-lg font-bold text-on-surface mb-3 line-clamp-2">Q4 智能客服系统架构升级与优化</h3>
                <div className="flex flex-wrap gap-2 mb-6">
                  <span className="px-2 py-0.5 bg-surface-container-lowest text-on-surface-variant text-[10px] rounded border border-outline-variant/20">研发部</span>
                  <span className="px-2 py-0.5 bg-surface-container-lowest text-on-surface-variant text-[10px] rounded border border-outline-variant/20">难度: 高</span>
                </div>
                <div className="mt-auto">
                  <div className="flex justify-between items-center text-xs text-on-surface-variant mb-2">
                    <span>参与人数: 2/5</span>
                    <span>进度: 40%</span>
                  </div>
                  <div className="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden mb-6">
                    <div className="bg-primary h-full rounded-full transition-all" style={{ width: '40%' }}></div>
                  </div>
                  <button onClick={() => alert("功能开发中")} className="w-full py-3 bg-surface-container-lowest text-primary font-bold rounded-xl border border-primary/20 hover:bg-primary hover:text-white transition-all">
                    立即加入
                  </button>
                </div>
              </div>

              {/* Card 2 */}
              <div className="group bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-300 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <span className="bg-primary-container text-on-primary-container text-[10px] font-bold px-3 py-1 rounded-full uppercase label-font">进行中</span>
                  <span className="text-primary font-black text-xl tracking-tight">¥8,000</span>
                </div>
                <h3 className="text-lg font-bold text-on-surface mb-3 line-clamp-2">双十一全球市场营销创意策划案</h3>
                <div className="flex flex-wrap gap-2 mb-6">
                  <span className="px-2 py-0.5 bg-surface-container-lowest text-on-surface-variant text-[10px] rounded border border-outline-variant/20">市场部</span>
                  <span className="px-2 py-0.5 bg-surface-container-lowest text-on-surface-variant text-[10px] rounded border border-outline-variant/20">难度: 中</span>
                </div>
                <div className="mt-auto">
                  <div className="flex justify-between items-center text-xs text-on-surface-variant mb-2">
                    <span>参与人数: 4/4</span>
                    <span>进度: 85%</span>
                  </div>
                  <div className="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden mb-6">
                    <div className="bg-primary h-full rounded-full transition-all" style={{ width: '85%' }}></div>
                  </div>
                  <button onClick={() => alert("功能开发中")} className="w-full py-3 bg-surface-container-lowest text-on-surface-variant font-bold rounded-xl border border-outline-variant/20 cursor-not-allowed">
                    人数已满
                  </button>
                </div>
              </div>

              {/* Card 3 */}
              <div className="group bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-300 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <span className="bg-secondary-container text-on-secondary-container text-[10px] font-bold px-3 py-1 rounded-full uppercase label-font">开放中</span>
                  <span className="text-primary font-black text-xl tracking-tight">¥25,000</span>
                </div>
                <h3 className="text-lg font-bold text-on-surface mb-3 line-clamp-2">企业级安全攻防演练与漏洞修复</h3>
                <div className="flex flex-wrap gap-2 mb-6">
                  <span className="px-2 py-0.5 bg-surface-container-lowest text-on-surface-variant text-[10px] rounded border border-outline-variant/20">研发部</span>
                  <span className="px-2 py-0.5 bg-surface-container-lowest text-on-surface-variant text-[10px] rounded border border-outline-variant/20">难度: 专家</span>
                </div>
                <div className="mt-auto">
                  <div className="flex justify-between items-center text-xs text-on-surface-variant mb-2">
                    <span>参与人数: 0/3</span>
                    <span>进度: 0%</span>
                  </div>
                  <div className="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden mb-6">
                    <div className="bg-primary h-full rounded-full transition-all" style={{ width: '0%' }}></div>
                  </div>
                  <button onClick={() => alert("功能开发中")} className="w-full py-3 bg-surface-container-lowest text-primary font-bold rounded-xl border border-primary/20 hover:bg-primary hover:text-white transition-all">
                    立即加入
                  </button>
                </div>
              </div>

              {/* Card 4 */}
              <div className="group bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-300 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <span className="bg-secondary-container text-on-secondary-container text-[10px] font-bold px-3 py-1 rounded-full uppercase label-font">开放中</span>
                  <span className="text-primary font-black text-xl tracking-tight">¥5,500</span>
                </div>
                <h3 className="text-lg font-bold text-on-surface mb-3 line-clamp-2">新员工入职数字化体验流程再造</h3>
                <div className="flex flex-wrap gap-2 mb-6">
                  <span className="px-2 py-0.5 bg-surface-container-lowest text-on-surface-variant text-[10px] rounded border border-outline-variant/20">人事部</span>
                  <span className="px-2 py-0.5 bg-surface-container-lowest text-on-surface-variant text-[10px] rounded border border-outline-variant/20">难度: 低</span>
                </div>
                <div className="mt-auto">
                  <div className="flex justify-between items-center text-xs text-on-surface-variant mb-2">
                    <span>参与人数: 1/2</span>
                    <span>进度: 15%</span>
                  </div>
                  <div className="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden mb-6">
                    <div className="bg-primary h-full rounded-full transition-all" style={{ width: '15%' }}></div>
                  </div>
                  <button onClick={() => alert("功能开发中")} className="w-full py-3 bg-surface-container-lowest text-primary font-bold rounded-xl border border-primary/20 hover:bg-primary hover:text-white transition-all">
                    立即加入
                  </button>
                </div>
              </div>

              {/* Card 5 */}
              <div className="group bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-300 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <span className="bg-secondary-container text-on-secondary-container text-[10px] font-bold px-3 py-1 rounded-full uppercase label-font">开放中</span>
                  <span className="text-primary font-black text-xl tracking-tight">¥18,000</span>
                </div>
                <h3 className="text-lg font-bold text-on-surface mb-3 line-clamp-2">AI 模型在用户行为预测中的应用</h3>
                <div className="flex flex-wrap gap-2 mb-6">
                  <span className="px-2 py-0.5 bg-surface-container-lowest text-on-surface-variant text-[10px] rounded border border-outline-variant/20">产品部</span>
                  <span className="px-2 py-0.5 bg-surface-container-lowest text-on-surface-variant text-[10px] rounded border border-outline-variant/20">难度: 高</span>
                </div>
                <div className="mt-auto">
                  <div className="flex justify-between items-center text-xs text-on-surface-variant mb-2">
                    <span>参与人数: 1/4</span>
                    <span>进度: 5%</span>
                  </div>
                  <div className="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden mb-6">
                    <div className="bg-primary h-full rounded-full transition-all" style={{ width: '5%' }}></div>
                  </div>
                  <button onClick={() => alert("功能开发中")} className="w-full py-3 bg-surface-container-lowest text-primary font-bold rounded-xl border border-primary/20 hover:bg-primary hover:text-white transition-all">
                    立即加入
                  </button>
                </div>
              </div>

              {/* Empty/New Card Slot */}
              <div className="group border-2 border-dashed border-outline-variant/40 rounded-2xl p-6 flex flex-col items-center justify-center text-center hover:border-primary/40 transition-all cursor-pointer">
                <div className="w-12 h-12 bg-surface-container rounded-full flex items-center justify-center mb-4 group-hover:bg-primary-container/20 transition-all">
                  <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary">add_task</span>
                </div>
                <h4 className="font-bold text-on-surface">提议新任务</h4>
                <p className="text-xs text-on-surface-variant mt-2 px-6">发现公司改进点？提交绩效任务申请并获取奖励。</p>
              </div>
            </div>
          </section>
        </div>
        </div>
      </main>
    </div>
  );
}
