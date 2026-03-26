import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import SmartFormInputs, { SmartData, encodeSmartDescription, decodeSmartDescription } from '../components/SmartFormInputs';
import { SmartGoalDisplayFromPlan } from '../components/SmartGoalDisplay';

interface PerfPlan {
  id: number;
  title: string;
  description: string;
  category: string;
  status: string;
  progress: number;
  target_value: string;
  deadline: string;
  quarter: string;
  collaborators?: string;
}

const statusMap: Record<string, { label: string, color: string, bg: string }> = {
  draft: { label: '草稿', color: 'text-slate-500', bg: 'bg-slate-100' },
  pending_review: { label: '待审批', color: 'text-amber-600', bg: 'bg-amber-100' },
  in_progress: { label: '进行中', color: 'text-primary', bg: 'bg-blue-100' },
  completed: { label: '待考核', color: 'text-purple-600', bg: 'bg-purple-100' },
  approved: { label: '已归档', color: 'text-emerald-600', bg: 'bg-emerald-100' },
  rejected: { label: '被驳回', color: 'text-error', bg: 'bg-red-100' },
};


export default function PersonalGoals({ navigate }: { navigate: (view: string) => void }) {

  const { currentUser } = useAuth();
  const [plans, setPlans] = useState<PerfPlan[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newPlan, setNewPlan] = useState<SmartData & { quarter: string }>({
    title: '完成人事管理系统（HRM）性能优化与看板重构',
    target_value: '核心页面加载速度提升 50%（<1.5s），重构看板组件且达到 0 P0 Bug',
    resource: '需要前端团队提供 2 周专项开发工时，UI 设计配合打磨看板交互细节',
    relevance: '直接关联公司年度数字化转型战略，极大提升内网工具的操作效率',
    deadline: '2024-09-30',
    category: '技术',
    collaborators: '',
    quarter: '2024 Q3'
  });
  const [submitting, setSubmitting] = useState(false);
  // 二次编辑被驳回的目标
  const [editingPlan, setEditingPlan] = useState<PerfPlan | null>(null);
  const [editForm, setEditForm] = useState<SmartData>({ title: '', target_value: '', resource: '', relevance: '', deadline: '', category: '业务', collaborators: '' });
  const [resubmitting, setResubmitting] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PerfPlan | null>(null);


  useEffect(() => {
    if (currentUser?.id) {
      fetchPlans();
    }
  }, [currentUser]);

  const fetchPlans = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/perf/plans?userId=${currentUser?.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.code === 0) setPlans(data.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      // 1. 创建草稿
      const approverId = currentUser?.role === 'employee' ? 'zhangwei' : 'lifang';
      const createRes = await fetch('/api/perf/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          ...newPlan,
          description: encodeSmartDescription(newPlan.resource, newPlan.relevance),
          // 向上申请
          assignee_id: currentUser?.id,
          approver_id: approverId
        })
      });
      const createData = await createRes.json();

      // 2. 立即送审
      if (createData.code === 0 && createData.data?.id) {
        await fetch(`/api/perf/plans/${createData.data.id}/submit`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setIsModalOpen(false);
        setNewPlan({ title: '', target_value: '', resource: '', relevance: '', deadline: '', category: '业务', collaborators: '', quarter: '2024 Q2' });
        fetchPlans();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const submitProgress = async (id: number, progress: number) => {
    try {
      // Optimistic update to keep views perfectly in sync without deep re-fetching
      setPlans(prev => prev.map(p => p.id === id ? { ...p, progress } : p));
      setSelectedPlan(prev => prev && prev.id === id ? { ...prev, progress } : prev);

      const token = localStorage.getItem('token');
      await fetch(`/api/perf/plans/${id}/progress`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ progress, comment: '员工自主更新进度' })
      });
    } catch (err) {
      console.error(err);
      fetchPlans(); // revert on fail
    }
  };

  // 打开驳回任务的编辑弹窗
  const handleOpenEdit = (plan: PerfPlan) => {
    setEditingPlan(plan);
    const decoded = decodeSmartDescription(plan.description || '');
    setEditForm({
      title: plan.title,
      resource: decoded.resource,
      relevance: decoded.relevance,
      category: plan.category,
      target_value: plan.target_value || '',
      deadline: plan.deadline || '',
      collaborators: plan.collaborators || '',
    });
  };

  // 重新提交被驳回的任务
  const handleResubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;
    setResubmitting(true);
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/perf/plans/${editingPlan.id}/resubmit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          ...editForm,
          description: encodeSmartDescription(editForm.resource, editForm.relevance)
        }),
      });
      setEditingPlan(null);
      fetchPlans();
    } catch (err) {
      console.error(err);
    } finally {
      setResubmitting(false);
    }
  };

  const overallProgress = plans.length > 0 ? (plans.reduce((acc, p) => acc + (p.progress || 0), 0) / plans.length).toFixed(1) : 0;

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-on-surface antialiased">
      <Sidebar currentView="personal" navigate={navigate} />

      {/* Main Content Area */}
      <main className="flex-1 h-[calc(100vh-4rem)] mt-16 overflow-y-auto">
        <div className="p-8">
          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
            <div>
              <nav className="flex text-xs font-label text-outline mb-2 space-x-2">
                <span>主页</span>
                <span>/</span>
                <span className="text-primary font-medium">目标管理</span>
              </nav>
              <h1 className="text-4xl font-extrabold tracking-tight text-on-surface">个人目标管理 ({currentUser?.name})</h1>
              <p className="text-on-surface-variant mt-2 max-w-2xl">追踪您的关键结果，向上级发起绩效申请。本季度您已达标 {overallProgress}%。</p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setIsModalOpen(true)} className="primary-gradient text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-primary/30 active:scale-95 transition-all">
                <span className="material-symbols-outlined">add</span>
                <span>申请新目标</span>
              </button>
            </div>
          </div>

          {/* Three Category Progress Bars */}
          {(() => {
            // 分类：季度 / 月度 / 专项
            const quarterly = plans.filter(p => p.quarter && !p.category?.includes('专项') && !p.category?.includes('公坚'));
            const monthly = plans.filter(p => !p.quarter && !p.category?.includes('专项') && !p.category?.includes('公坚'));
            const special = plans.filter(p => p.category?.includes('专项') || p.category?.includes('公坚'));
            const calcPct = (arr: typeof plans) => arr.length > 0 ? Math.round(arr.reduce((a, p) => a + (p.progress || 0), 0) / arr.length) : 0;
            const bars = [
              { label: '季度任务', pct: calcPct(quarterly), count: quarterly.length, icon: 'calendar_month', gradient: 'from-[#0060a9] to-[#409eff]' },
              { label: '月度任务', pct: calcPct(monthly), count: monthly.length, icon: 'event_note', gradient: 'from-[#7c3aed] to-[#a78bfa]' },
              { label: '专项任务', pct: calcPct(special), count: special.length, icon: 'star', gradient: 'from-[#d97706] to-[#fbbf24]' },
            ];
            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
                {bars.map(b => (
                  <div key={b.label} className={`bg-gradient-to-br ${b.gradient} p-5 rounded-xl text-white relative overflow-hidden shadow-lg`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-white/60 text-[18px]">{b.icon}</span>
                      <span className="text-white/80 text-xs font-bold">{b.label}</span>
                      <span className="text-white/50 text-[10px]">{b.count} 项</span>
                    </div>
                    <h3 className="text-3xl font-black tracking-tighter mb-2">{b.pct}%</h3>
                    <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                      <div className="h-full bg-white/80 rounded-full transition-all duration-500" style={{ width: `${b.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* ── Kanban Board ─────────────────────────────────────────── */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-primary text-[18px]">view_kanban</span>
              <h3 className="font-bold text-base text-on-surface">我参与的绩效目标</h3>
              <span className="text-[11px] px-2 py-0.5 bg-primary-container text-on-primary-container rounded-full font-bold">{plans.length}</span>
            </div>
            <button onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1.5 text-xs font-bold text-primary hover:bg-primary-container/20 px-3 py-1.5 rounded-xl transition-colors border border-primary/20">
              <span className="material-symbols-outlined text-[14px]">add</span>申请新目标
            </button>
          </div>

          {/* Horizontal scroll kanban */}
          <div className="flex gap-4 overflow-x-auto pb-4">
            {([
              { keys: ['draft', 'pending_review', 'rejected'], label: '筹备中', color: '#94a3b8', bg: '#f1f5f9', wide: false },
              { keys: ['in_progress'],                          label: '进行中', color: '#3b82f6', bg: '#eff6ff', wide: true  },
              { keys: ['completed'],                            label: '待考核', color: '#8b5cf6', bg: '#f5f3ff', wide: false },
              { keys: ['approved'],                             label: '已归档', color: '#10b981', bg: '#ecfdf5', wide: false },
            ] as const).map(col => {
              const colPlans = plans.filter(p => (col.keys as readonly string[]).includes(p.status));
              const colKey = col.keys[0]; // for UI keying
              return (
                <div key={colKey}
                  className={`flex-none flex flex-col rounded-2xl overflow-hidden shadow-sm bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 ${col.wide ? 'w-[560px]' : 'w-72'}`}>
                  {/* Column header */}
                  <div className="px-4 pt-3 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="h-0.5 rounded-full mb-3" style={{ backgroundColor: col.color }} />
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-700 dark:text-slate-200">{col.label}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: col.bg, color: col.color }}>
                        {colPlans.length}
                      </span>
                    </div>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-3 max-h-[600px]">
                    {colPlans.length === 0 && (
                      <div className="py-8 text-center text-slate-300 dark:text-slate-600 text-xs">暂无</div>
                    )}

                    {colPlans.map((plan) => {
                      const pct = plan.progress || 0;
                      const today = new Date();
                      const dl = plan.deadline ? new Date(plan.deadline) : null;
                      const daysLeft = dl ? Math.ceil((dl.getTime() - today.getTime()) / 86400000) : null;
                      const dlColor = daysLeft === null ? 'text-slate-400'
                        : daysLeft < 0 ? 'text-red-500'
                        : daysLeft <= 7 ? 'text-amber-500'
                        : 'text-slate-400';
                      const dlText = daysLeft === null ? '' : daysLeft < 0 ? `逾期${Math.abs(daysLeft)}天` : daysLeft === 0 ? '今天截止' : `${daysLeft}天后`;

                      const barColor = plan.status === 'in_progress' ? '#3b82f6'
                        : plan.status === 'approved' ? '#10b981'
                        : plan.status === 'rejected' ? '#ef4444'
                        : '#cbd5e1';

                      return (
                        <div key={plan.id}
                          onClick={() => setSelectedPlan(plan)}
                          className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3.5 border border-slate-200/50 dark:border-slate-700/50 hover:shadow-md hover:border-slate-300/80 dark:hover:border-slate-600 transition-all group cursor-pointer">

                          {/* Card top: category + title */}
                          <div className="flex items-start gap-2 mb-2.5">
                            <span className="flex-none mt-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                              style={{ background: col.bg, color: col.color }}>
                              {plan.category}
                            </span>
                            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-snug line-clamp-2 flex-1">
                              {plan.title}
                            </h4>
                          </div>

                          {/* Description */}
                          {plan.description && (
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 mb-2.5 leading-relaxed">
                              {plan.description}
                            </p>
                          )}

                          {/* Meta row */}
                          <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3">
                            {plan.deadline && (
                              <span className={`flex items-center gap-0.5 text-[10px] font-medium ${dlColor}`}>
                                <span className="material-symbols-outlined text-[11px]">{daysLeft !== null && daysLeft < 0 ? 'alarm_off' : 'schedule'}</span>
                                {dlText || plan.deadline}
                              </span>
                            )}
                            {plan.target_value && (
                              <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
                                <span className="material-symbols-outlined text-[10px]">flag</span>
                                {plan.target_value}
                              </span>
                            )}
                            {plan.quarter && (
                              <span className="text-[10px] text-slate-400">{plan.quarter}</span>
                            )}
                          </div>

                          {/* Progress — draggable range slider, saves on release */}
                          <div className="w-full"
                            onClick={e => e.stopPropagation()}
                            onPointerDown={e => e.stopPropagation()}
                            onMouseDown={e => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[9px] text-slate-400">当前进度</span>
                              <span className="text-[10px] font-black" style={{ color: barColor }}>
                                <span data-pct-label={plan.id}>{pct}</span>%
                              </span>
                            </div>
                            <div className="relative">
                              <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div data-pct-bar={plan.id} className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                              </div>
                              {plan.status === 'in_progress' && (
                                <input type="range" min="0" max="100" defaultValue={pct}
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                  onInput={e => {
                                    const v = parseInt((e.target as HTMLInputElement).value);
                                    const bar = document.querySelector(`[data-pct-bar="${plan.id}"]`) as HTMLElement;
                                    const label = document.querySelector(`[data-pct-label="${plan.id}"]`) as HTMLElement;
                                    if (bar) bar.style.width = `${v}%`;
                                    if (label) label.textContent = String(v);
                                  }}
                                  onChange={e => {
                                    const v = parseInt((e.target as HTMLInputElement).value);
                                    submitProgress(plan.id, v);
                                  }}
                                />
                              )}
                            </div>
                          </div>

                          {/* Rejected CTA */}
                          {plan.status === 'rejected' && (
                            <button onClick={() => handleOpenEdit(plan)}
                              className="mt-2.5 w-full flex items-center justify-center gap-1 py-1.5 text-[10px] font-bold bg-amber-50 dark:bg-amber-900/20 text-amber-600 rounded-lg border border-amber-200/60 hover:bg-amber-100 transition-colors">
                              <span className="material-symbols-outlined text-[12px]">edit_note</span>
                              修改重新提交
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                </div>
              );
            })}
          </div>
        </div>
      </main>


      {/* Slide-in Modal for Application */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          {/* Modal */}
          <div className="relative bg-surface-container-lowest w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300">
            <div className="px-6 py-5 border-b border-outline-variant/20 flex justify-between items-center bg-surface-container-low/50">
              <h3 className="text-lg font-black text-on-surface">向上申请目标</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-outline hover:bg-surface-container-highest p-1 rounded-full transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleCreatePlan} className="p-6 space-y-4">
              <SmartFormInputs
                data={newPlan}
                onChange={(data) => setNewPlan({ ...newPlan, ...data })}
              />
              <div className="pt-4 flex justify-end gap-3 border-t border-outline-variant/20">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl font-bold text-on-surface-variant hover:bg-surface-container-highest transition-colors">取消</button>
                <button type="submit" disabled={submitting} className="primary-gradient text-white px-6 py-2.5 rounded-xl font-bold hover:shadow-lg disabled:opacity-70 transition-all flex items-center gap-2">
                  {submitting ? <span className="material-symbols-outlined animate-spin" style={{ fontVariationSettings: "'wght' 300" }}>progress_activity</span> : null}
                  确认发起申请
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 驳回后二次编辑弹窗 */}
      {editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setEditingPlan(null)}></div>
          <div className="relative bg-surface-container-lowest w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300">
            <div className="px-6 py-5 border-b border-outline-variant/20 flex justify-between items-center bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20">
              <div>
                <h3 className="text-lg font-black text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-500">replay</span>
                  修改并重新提交
                </h3>
                <p className="text-[11px] text-on-surface-variant mt-0.5">该目标已被主管驳回，请修改后重新提交审批</p>
              </div>
              <button onClick={() => setEditingPlan(null)} className="text-outline hover:bg-surface-container-highest p-1 rounded-full transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleResubmit} className="p-6 space-y-4">
              <SmartFormInputs
                data={editForm}
                onChange={(data) => setEditForm({ ...editForm, ...data })}
              />
              <div className="pt-4 flex justify-end gap-3 border-t border-outline-variant/20">
                <button type="button" onClick={() => setEditingPlan(null)} className="px-5 py-2.5 rounded-xl font-bold text-on-surface-variant hover:bg-surface-container-highest transition-colors">取消</button>
                <button type="submit" disabled={resubmitting} className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-2.5 rounded-xl font-bold hover:shadow-lg disabled:opacity-70 transition-all flex items-center gap-2">
                  {resubmitting ? <span className="material-symbols-outlined animate-spin" style={{ fontVariationSettings: "'wght' 300" }}>progress_activity</span> : <span className="material-symbols-outlined text-[18px]">send</span>}
                  修改并重新提交
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Plan Detail Modal ─────────────────────────────────────── */}
      {selectedPlan && (() => {
        const sp = selectedPlan;
        const st = statusMap[sp.status] || { label: sp.status, color: 'text-slate-500', bg: 'bg-slate-100' };
        const today = new Date();
        const dl = sp.deadline ? new Date(sp.deadline) : null;
        const daysLeft = dl ? Math.ceil((dl.getTime() - today.getTime()) / 86400000) : null;
        const accentColor = {
          in_progress: '#3b82f6', pending_review: '#f59e0b', completed: '#8b5cf6',
          approved: '#10b981', rejected: '#ef4444', draft: '#94a3b8',
        }[sp.status] || '#94a3b8';
        const pct = sp.progress || 0;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setSelectedPlan(null)} />
            <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 fade-in duration-200">
              {/* Color accent header bar */}
              <div className="h-2" style={{ backgroundColor: accentColor }} />
              <div className="px-8 py-6">
                {/* Top row: badges + close */}
                <div className="flex items-start justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500">{sp.category}</span>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${st.bg} ${st.color}`}>{st.label}</span>
                    {sp.quarter && <span className="text-[10px] text-slate-400 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-lg">{sp.quarter}</span>}
                  </div>
                  <button onClick={() => setSelectedPlan(null)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                </div>

                <div className="mb-6">
                  <SmartGoalDisplayFromPlan
                    title={sp.title}
                    target_value={sp.target_value}
                    description={sp.description}
                    deadline={sp.deadline}
                    category={sp.category}
                    collaborators={sp.collaborators}
                  />
                </div>

                {/* Progress — draggable range slider in modal */}
                <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl px-5 py-4 mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px]">trending_up</span>当前进度
                    </span>
                    <span className="text-xl font-black" style={{ color: accentColor }}>
                      <span data-pct-label={`modal-${sp.id}`}>{pct}</span>%
                    </span>
                  </div>
                  <div className="relative">
                    <div className="w-full h-4 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div data-pct-bar={`modal-${sp.id}`} className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: accentColor }} />
                    </div>
                    {sp.status === 'in_progress' && (
                      <input type="range" min="0" max="100" defaultValue={pct}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onInput={e => {
                          const v = parseInt((e.target as HTMLInputElement).value);
                          const bar = document.querySelector(`[data-pct-bar="modal-${sp.id}"]`) as HTMLElement;
                          const label = document.querySelector(`[data-pct-label="modal-${sp.id}"]`) as HTMLElement;
                          if (bar) bar.style.width = `${v}%`;
                          if (label) label.textContent = String(v);
                        }}
                        onChange={e => {
                          const v = parseInt((e.target as HTMLInputElement).value);
                          submitProgress(sp.id, v);
                        }}
                      />
                    )}
                  </div>
                  {sp.status === 'in_progress' && (
                    <p className="text-[10px] text-blue-400 mt-2 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">swipe</span>
                      拖动进度条或点击任意位置调整，松手后自动保存
                    </p>
                  )}
                </div>


                {/* Actions */}
                <div className="flex gap-3">
                  {sp.status === 'rejected' && (
                    <button onClick={() => { setSelectedPlan(null); handleOpenEdit(sp); }}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 text-sm font-bold rounded-xl border border-amber-200/60 hover:bg-amber-100 transition-colors">
                      <span className="material-symbols-outlined text-[16px]">edit_note</span>
                      修改后重新提交
                    </button>
                  )}
                  <button onClick={() => setSelectedPlan(null)}
                    className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-medium rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                    关闭
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
