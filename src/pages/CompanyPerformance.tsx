import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';

interface PoolTask {
  id: number;
  status: 'open' | 'in_progress';
  badge: string;
  badgeClass: string;
  amount: string;
  title: string;
  dept: string;
  difficulty: string;
  participants: string;
  progress: number;
  full?: boolean;
}

const INITIAL_TASKS: PoolTask[] = [
  { id: 1, status: 'open', badge: '开放中', badgeClass: 'bg-secondary-container text-on-secondary-container', amount: '¥12,500', title: 'Q4 智能客服系统架构升级与优化', dept: '研发部', difficulty: '高', participants: '2/5', progress: 40 },
  { id: 2, status: 'in_progress', badge: '进行中', badgeClass: 'bg-primary-container text-on-primary-container', amount: '¥8,000', title: '双十一全球市场营销创意策划案', dept: '市场部', difficulty: '中', participants: '4/4', progress: 85, full: true },
  { id: 3, status: 'open', badge: '开放中', badgeClass: 'bg-secondary-container text-on-secondary-container', amount: '¥25,000', title: '企业级安全攻防演练与漏洞修复', dept: '研发部', difficulty: '专家', participants: '0/3', progress: 0 },
  { id: 4, status: 'open', badge: '开放中', badgeClass: 'bg-secondary-container text-on-secondary-container', amount: '¥5,500', title: '新员工入职数字化体验流程再造', dept: '人事部', difficulty: '低', participants: '1/2', progress: 15 },
  { id: 5, status: 'open', badge: '开放中', badgeClass: 'bg-secondary-container text-on-secondary-container', amount: '¥18,000', title: 'AI 模型在用户行为预测中的应用', dept: '产品部', difficulty: '高', participants: '1/4', progress: 5 },
];

type StatusFilter = 'all' | 'open' | 'in_progress';
type BonusFilter = 'all' | 'low' | 'mid' | 'high';
type DeadlineFilter = 'all' | 'week' | 'month' | 'quarter';

const DEPTS = ['全部部门', '研发部', '市场部', '产品部', '人事部'];

export default function CompanyPerformance({ navigate }: { navigate: (view: string) => void }) {
  const [tasks, setTasks] = useState<PoolTask[]>(INITIAL_TASKS);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [bonusFilter, setBonusFilter] = useState<BonusFilter>('all');
  const [deptFilter, setDeptFilter] = useState('全部部门');
  const [deadlineFilter, setDeadlineFilter] = useState<DeadlineFilter>('all');
  const [sortByBonus, setSortByBonus] = useState(false);

  const handleDelete = (id: number) => {
    if (!window.confirm('确认删除该绩效池任务？此操作不可撤销。')) return;
    setDeletingId(id);
    setTimeout(() => {
      setTasks(prev => prev.filter(t => t.id !== id));
      setDeletingId(null);
    }, 300);
  };

  const amountToNum = (a: string) => parseInt(a.replace(/[¥,]/g, ''));

  let displayed = tasks.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (deptFilter !== '全部部门' && t.dept !== deptFilter) return false;
    const v = amountToNum(t.amount);
    if (bonusFilter === 'low' && v > 5000) return false;
    if (bonusFilter === 'mid' && (v <= 5000 || v > 20000)) return false;
    if (bonusFilter === 'high' && v <= 20000) return false;
    return true;
  });
  if (sortByBonus) displayed = [...displayed].sort((a, b) => amountToNum(b.amount) - amountToNum(a.amount));

  const statusBtns: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'open', label: '开放中' },
    { key: 'in_progress', label: '进行中' },
  ];
  const bonusBtns: { key: BonusFilter; label: string }[] = [
    { key: 'all', label: '全部奖金' },
    { key: 'low', label: '¥0–5k' },
    { key: 'mid', label: '¥5k–20k' },
    { key: 'high', label: '¥20k+' },
  ];
  const deadlineBtns: { key: DeadlineFilter; label: string }[] = [
    { key: 'all', label: '不限截止' },
    { key: 'week', label: '本周' },
    { key: 'month', label: '本月' },
    { key: 'quarter', label: '本季' },
  ];

  return (
    <div className="bg-background text-on-background min-h-screen">
      <Sidebar currentView="company" navigate={navigate} />

      <main className="flex-1 mt-16 min-h-[calc(100vh-4rem)] overflow-y-auto">
        <div className="px-8 pt-6 pb-10 max-w-screen-2xl mx-auto">

          {/* ── Page Title Row ── */}
          <div className="flex items-end justify-between mb-5">
            <div>
              <h1 className="text-3xl font-black text-on-background tracking-tight">公司绩效池</h1>
              <p className="text-on-surface-variant text-sm mt-1">发现新机遇，挑战高难度任务，赢取丰厚奖金。</p>
            </div>
            <button
              onClick={() => alert('发布任务功能开发中')}
              className="flex items-center gap-2 px-5 py-2.5 primary-gradient rounded-xl text-sm font-bold text-white shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              发布任务
            </button>
          </div>

          {/* ── Horizontal Filter Bar ── */}
          <div className="flex flex-wrap items-center gap-3 mb-6 p-4 bg-surface-container-low rounded-2xl border border-outline-variant/10">
            {/* Status */}
            <div className="flex items-center gap-1 bg-surface-container rounded-xl p-1">
              {statusBtns.map(b => (
                <button key={b.key} onClick={() => setStatusFilter(b.key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${statusFilter === b.key ? 'bg-primary text-white shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-highest'}`}>
                  {b.label}
                </button>
              ))}
            </div>

            {/* Bonus */}
            <div className="flex items-center gap-1 bg-surface-container rounded-xl p-1">
              {bonusBtns.map(b => (
                <button key={b.key} onClick={() => setBonusFilter(b.key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${bonusFilter === b.key ? 'bg-primary text-white shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-highest'}`}>
                  {b.label}
                </button>
              ))}
            </div>

            {/* Department */}
            <select
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
              className="bg-surface-container border-none ring-1 ring-outline-variant/30 rounded-xl text-xs px-3 py-2 focus:ring-2 focus:ring-primary outline-none text-on-surface font-medium"
            >
              {DEPTS.map(d => <option key={d}>{d}</option>)}
            </select>

            {/* Deadline */}
            <div className="flex items-center gap-1 bg-surface-container rounded-xl p-1">
              {deadlineBtns.map(b => (
                <button key={b.key} onClick={() => setDeadlineFilter(b.key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${deadlineFilter === b.key ? 'bg-primary text-white shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-highest'}`}>
                  {b.label}
                </button>
              ))}
            </div>

            {/* Sort toggle */}
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-on-surface-variant">奖金排序</span>
              <button
                onClick={() => setSortByBonus(p => !p)}
                className={`relative w-9 h-5 rounded-full transition-colors ${sortByBonus ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${sortByBonus ? 'translate-x-4' : 'translate-x-0.5'}`}/>
              </button>
              <span className="text-xs text-on-surface-variant font-bold">{displayed.length} 个任务</span>
            </div>
          </div>

          {/* ── Full-Width Task Card Grid ── */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
            {displayed.map(task => (
              <div
                key={task.id}
                className={`group bg-surface-container-low rounded-2xl p-5 border border-outline-variant/10 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-300 flex flex-col ${deletingId === task.id ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'}`}
              >
                <div className="flex justify-between items-start mb-3">
                  <span className={`${task.badgeClass} text-[10px] font-bold px-2.5 py-1 rounded-full uppercase label-font`}>{task.badge}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-primary font-black text-lg tracking-tight">{task.amount}</span>
                    <button
                      onClick={() => handleDelete(task.id)}
                      title="删除任务"
                      className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-6 h-6 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                    >
                      <span className="material-symbols-outlined text-[13px]">delete</span>
                    </button>
                  </div>
                </div>
                <h3 className="text-sm font-bold text-on-surface mb-3 line-clamp-2 leading-snug">{task.title}</h3>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  <span className="px-2 py-0.5 bg-surface-container-lowest text-on-surface-variant text-[10px] rounded border border-outline-variant/20">{task.dept}</span>
                  <span className="px-2 py-0.5 bg-surface-container-lowest text-on-surface-variant text-[10px] rounded border border-outline-variant/20">难度: {task.difficulty}</span>
                </div>
                <div className="mt-auto">
                  <div className="flex justify-between items-center text-[10px] text-on-surface-variant mb-1.5">
                    <span>{task.participants} 人参与</span>
                    <span className="font-bold text-primary">{task.progress}%</span>
                  </div>
                  <div className="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden mb-4">
                    <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${task.progress}%` }}></div>
                  </div>
                  {task.full ? (
                    <button disabled className="w-full py-2.5 text-xs bg-surface-container-lowest text-on-surface-variant font-bold rounded-xl border border-outline-variant/20 cursor-not-allowed">
                      人数已满
                    </button>
                  ) : (
                    <button className="w-full py-2.5 text-xs bg-surface-container-lowest text-primary font-bold rounded-xl border border-primary/20 hover:bg-primary hover:text-white transition-all">
                      立即加入
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* New task proposal card */}
            <div className="group border-2 border-dashed border-outline-variant/40 rounded-2xl p-5 flex flex-col items-center justify-center text-center hover:border-primary/40 transition-all cursor-pointer">
              <div className="w-10 h-10 bg-surface-container rounded-full flex items-center justify-center mb-3 group-hover:bg-primary-container/20 transition-all">
                <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary">add_task</span>
              </div>
              <h4 className="font-bold text-sm text-on-surface">提议新任务</h4>
              <p className="text-[11px] text-on-surface-variant mt-1.5 leading-relaxed">发现公司改进点？<br/>提交申请并获取奖励。</p>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
