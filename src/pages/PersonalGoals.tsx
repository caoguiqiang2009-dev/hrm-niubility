import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';

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
  const [newPlan, setNewPlan] = useState({ title: '', description: '', category: '业务', target_value: '', deadline: '', quarter: '2024 Q2' });
  const [submitting, setSubmitting] = useState(false);
  // 二次编辑被驳回的目标
  const [editingPlan, setEditingPlan] = useState<PerfPlan | null>(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', category: '业务', target_value: '', deadline: '' });
  const [resubmitting, setResubmitting] = useState(false);

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
        setNewPlan({ title: '', description: '', category: '业务', target_value: '', deadline: '', quarter: '2024 Q2' });
        fetchPlans();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateProgress = async (id: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const newProgress = parseInt(e.target.value, 10);
    // Optimistic update
    setPlans(plans.map(p => p.id === id ? { ...p, progress: newProgress } : p));
  };

  const submitProgress = async (id: number, progress: number) => {
    try {
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
    setEditForm({
      title: plan.title,
      description: plan.description || '',
      category: plan.category,
      target_value: plan.target_value || '',
      deadline: plan.deadline || '',
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
        body: JSON.stringify(editForm),
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
                <span>向上申请新目标</span>
              </button>
            </div>
          </div>

          {/* Top Level Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
            <div className="bg-primary p-6 rounded-xl text-white relative overflow-hidden flex items-center shadow-xl lg:col-span-3">
              <div className="z-10">
                <p className="text-primary-fixed-dim font-medium mb-1">总体季度完成度</p>
                <h3 className="text-4xl font-black mb-2 tracking-tighter">{overallProgress}%</h3>
                <p className="text-sm text-primary-fixed-dim/80">包含所有推进中与待审核的目标</p>
              </div>
              <div className="absolute -right-8 -bottom-16 opacity-20">
                <span className="material-symbols-outlined text-[200px]">auto_graph</span>
              </div>
            </div>
          </div>

          {/* Goals List */}
          <div className="bg-surface-container-low rounded-xl overflow-hidden p-1 shadow-sm">
            <div className="bg-surface-container-lowest rounded-lg">
              <div className="p-6 border-b border-surface-container-low">
                <h3 className="text-lg font-bold">我参与的绩效目标 ({plans.length})</h3>
              </div>

              <div className="divide-y divide-surface-container-low">
                {plans.length === 0 ? (
                  <div className="p-12 text-center text-outline">暂无目标数据，赶紧点击上方按钮申请吧！</div>
                ) : plans.map((plan) => (
                  <div key={plan.id} className="p-6 hover:bg-surface-container-low transition-colors group">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="bg-blue-100 text-primary text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">{plan.category}</span>
                          <h4 className="text-lg font-bold text-on-surface">{plan.title}</h4>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusMap[plan.status]?.bg || 'bg-slate-100'} ${statusMap[plan.status]?.color || 'text-slate-500'}`}>
                            {statusMap[plan.status]?.label || plan.status}
                          </span>
                        </div>
                        <p className="text-sm text-on-surface-variant mb-4">{plan.description}</p>
                        <div className="flex items-center gap-4 text-xs font-label">
                          <div className="flex items-center gap-1.5 text-on-surface-variant">
                            <span className="material-symbols-outlined text-sm">flag</span>
                            <span className="font-medium">目标: {plan.target_value}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-on-surface-variant">
                            <span className="material-symbols-outlined text-sm">schedule</span>
                            <span>截止: {plan.deadline}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Interactive Progress Slider */}
                      <div className="lg:w-72">
                        <div className="flex justify-between text-xs mb-2 font-label">
                          <span className="font-bold">当前进度 {plan.progress || 0}%</span>
                          {plan.status === 'in_progress' ? <span className="text-primary cursor-pointer animate-pulse">拖曳更新</span> : null}
                        </div>
                        <div className="relative h-2.5 bg-surface-container-high rounded-full overflow-hidden">
                          <div className={`h-full ${plan.status === 'in_progress' ? 'bg-primary' : 'bg-outline-variant'} rounded-full`} style={{ width: `${plan.progress || 0}%` }}></div>
                          {plan.status === 'in_progress' && (
                            <input 
                              type="range" 
                              min="0" max="100" 
                              value={plan.progress || 0} 
                              onChange={(e) => handleUpdateProgress(plan.id, e)} 
                              onMouseUp={() => submitProgress(plan.id, plan.progress)}
                              onTouchEnd={() => submitProgress(plan.id, plan.progress)}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize"
                            />
                          )}
                        </div>

                        {/* 被驳回的操作按钮 */}
                        {plan.status === 'rejected' && (
                          <button
                            onClick={() => handleOpenEdit(plan)}
                            className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow-md active:scale-95 transition-all"
                          >
                            <span className="material-symbols-outlined text-[16px]">edit_note</span>
                            修改后重新提交审批
                          </button>
                        )}
                      </div>

                    </div>
                  </div>
                ))}
              </div>
            </div>
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
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">目标标题</label>
                <input required value={newPlan.title} onChange={e => setNewPlan({...newPlan, title: e.target.value})} className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary outline-none" placeholder="例如：Q3 营收增长计划" />
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">行动描述</label>
                <textarea required value={newPlan.description} onChange={e => setNewPlan({...newPlan, description: e.target.value})} className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm h-24 resize-none focus:ring-2 focus:ring-primary outline-none" placeholder="描述你的关键步骤..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">分类</label>
                  <select value={newPlan.category} onChange={e => setNewPlan({...newPlan, category: e.target.value})} className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary outline-none">
                    <option>业务</option>
                    <option>技术</option>
                    <option>团队</option>
                    <option>其他</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">截止日期</label>
                  <input required type="date" value={newPlan.deadline} onChange={e => setNewPlan({...newPlan, deadline: e.target.value})} className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">衡量指标 (Target)</label>
                <input required value={newPlan.target_value} onChange={e => setNewPlan({...newPlan, target_value: e.target.value})} className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary outline-none" placeholder="例如：达成 100 万销售额" />
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-outline-variant/20">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl font-bold text-on-surface-variant hover:bg-surface-container-highest transition-colors">取消</button>
                <button type="submit" disabled={submitting} className="primary-gradient text-white px-6 py-2.5 rounded-xl font-bold hover:shadow-lg disabled:opacity-70 transition-all flex items-center gap-2">
                   {submitting ? <span className="material-symbols-outlined animate-spin" style={{fontVariationSettings:"'wght' 300"}}>progress_activity</span> : null}
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
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">目标标题</label>
                <input required value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-amber-400 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">行动描述</label>
                <textarea required value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm h-24 resize-none focus:ring-2 focus:ring-amber-400 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">分类</label>
                  <select value={editForm.category} onChange={e => setEditForm({...editForm, category: e.target.value})} className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-amber-400 outline-none">
                    <option>业务</option>
                    <option>技术</option>
                    <option>团队</option>
                    <option>其他</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">截止日期</label>
                  <input required type="date" value={editForm.deadline} onChange={e => setEditForm({...editForm, deadline: e.target.value})} className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-amber-400 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">衡量指标 (Target)</label>
                <input required value={editForm.target_value} onChange={e => setEditForm({...editForm, target_value: e.target.value})} className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-amber-400 outline-none" />
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-outline-variant/20">
                <button type="button" onClick={() => setEditingPlan(null)} className="px-5 py-2.5 rounded-xl font-bold text-on-surface-variant hover:bg-surface-container-highest transition-colors">取消</button>
                <button type="submit" disabled={resubmitting} className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-2.5 rounded-xl font-bold hover:shadow-lg disabled:opacity-70 transition-all flex items-center gap-2">
                   {resubmitting ? <span className="material-symbols-outlined animate-spin" style={{fontVariationSettings:"'wght' 300"}}>progress_activity</span> : <span className="material-symbols-outlined text-[18px]">send</span>}
                   修改并重新提交
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
