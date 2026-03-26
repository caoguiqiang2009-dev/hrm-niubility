import React, { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import SmartFormInputs, { SmartData, encodeSmartDescription } from '../components/SmartFormInputs';
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
  assignee_id: string;
  creator_id: string;
  collaborators?: string;
}

interface Subordinate {
  id: string;
  name: string;
  title: string;
  avatar_url: string;
  role: string;
  score: number;
  tasks: {
    id: number;
    title: string;
    description: string;
    target_value: string;
    category: string;
    status: string;
    deadline: string;
    progress: number;
  }[];
}

export default function TeamPerformance({ navigate }: { navigate: (view: string) => void }) {
  const { currentUser } = useAuth();
  const [approvals, setApprovals] = useState<PerfPlan[]>([]);
  const [subordinates, setSubordinates] = useState<Subordinate[]>([]);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [newPlan, setNewPlan] = useState<SmartData & { assignee_id: string }>({ title: '', target_value: '', resource: '', relevance: '', deadline: '', category: '业务', collaborators: '', assignee_id: '' });
  const [submitting, setSubmitting] = useState(false);

  // Drag to scroll
  const dragRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const onDragStart = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    startX.current = e.pageX - (dragRef.current?.offsetLeft || 0);
    scrollLeft.current = dragRef.current?.scrollLeft || 0;
  }, []);
  const onDragMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current || !dragRef.current) return;
    e.preventDefault();
    const x = e.pageX - (dragRef.current.offsetLeft || 0);
    dragRef.current.scrollLeft = scrollLeft.current - (x - startX.current);
  }, []);
  const onDragEnd = useCallback(() => { isDragging.current = false; }, []);

  useEffect(() => {
    if (currentUser?.id) {
      fetchApprovals();
      fetchTeamStatus();
    }
  }, [currentUser]);

  const fetchApprovals = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/perf/my-approvals`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.code === 0) setApprovals(data.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTeamStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/perf/team-status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.code === 0) setSubordinates(data.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleApprove = async (id: number) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/perf/plans/${id}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchApprovals();
    } catch (err) {
      console.error(err);
    }
  };

  const handleReject = async (id: number) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/perf/plans/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ reason: '主管审阅驳回' })
      });
      fetchApprovals();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAssignPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      // 1. 创建草稿
      const createRes = await fetch('/api/perf/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ 
          ...newPlan, 
          description: encodeSmartDescription(newPlan.resource, newPlan.relevance),
          quarter: '2024 Q2', 
          creator_id: currentUser?.id,
          approver_id: currentUser?.id // 主管自己做审批人
        })
      });
      const createData = await createRes.json();
      
      // 2. 将草稿提交并立刻审批通过 -> 进入 in_progress 状态
      if (createData.code === 0 && createData.data?.id) {
        const planId = createData.data.id;
        await fetch(`/api/perf/plans/${planId}/submit`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
        await fetch(`/api/perf/plans/${planId}/approve`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
        
        setIsAssignModalOpen(false);
        setNewPlan({ title: '', target_value: '', resource: '', relevance: '', deadline: '', category: '业务', assignee_id: '' });
        fetchTeamStatus(); // Refresh subordinates' tasks after assigning
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background text-on-surface font-body selection:bg-primary-fixed">
      <Sidebar currentView="team" navigate={navigate} />

      <main className="flex-1 h-[calc(100vh-4rem)] mt-16 overflow-y-auto">
        <div className="pt-4 pb-12 px-8">
          <section className="mb-8 flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-black text-on-surface font-headline tracking-tight">团队绩效与任务追踪</h2>
            <p className="text-on-surface-variant font-label mt-1">作为主管 {currentUser?.name}，管理团队目标申请与向下派发</p>
          </div>
          <div className="flex space-x-3">
            <button onClick={() => alert("功能开发中")} className="flex items-center px-4 py-2 bg-surface-container-highest text-on-surface rounded-xl font-bold text-sm hover:bg-surface-variant transition-all">
              <span className="material-symbols-outlined text-sm mr-2">filter_list</span>
              高级筛选
            </button>
          </div>
        </section>

        {/* Quick Action Cards Section */}
        <section className="mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white border border-surface-container rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-default group flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center group-hover:bg-secondary transition-colors">
                <span className="material-symbols-outlined text-secondary group-hover:text-white">assignment_turned_in</span>
              </div>
              <div>
                <h4 className="font-bold text-on-surface">待办审核 ({approvals.length})</h4>
                <p className="text-xs text-on-surface-variant mt-0.5">请重点关注下方的审批看板</p>
              </div>
            </div>
            {approvals.length > 0 && <span className="bg-error text-white text-[10px] font-black px-2 py-0.5 rounded-full min-w-[20px] text-center animate-pulse">{approvals.length}</span>}
          </div>
          
          <div onClick={() => { setIsAssignModalOpen(true); setNewPlan(p => ({ ...p, assignee_id: subordinates[0]?.id || '' })); }} className="bg-white border border-surface-container rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary transition-colors">
              <span className="material-symbols-outlined text-primary group-hover:text-white">add_task</span>
            </div>
            <div>
              <h4 className="font-bold text-on-surface tracking-tight">向下发起任务</h4>
              <p className="text-xs text-on-surface-variant mt-0.5">给团队成员强势派发新指标</p>
            </div>
          </div>
        </section>

        {/* Dynamic Approvals Board */}
        {approvals.length > 0 && (
          <section className="mb-10 animate-in fade-in slide-in-from-bottom-4">
            <h3 className="text-xl font-black font-headline text-on-surface mb-4 flex items-center">
              <span className="material-symbols-outlined text-amber-500 mr-2">pending_actions</span>
              待您审批的绩效申请
            </h3>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {approvals.map(plan => (
                <div key={plan.id} 
                  onClick={() => setSelectedTask(plan)}
                  className="bg-amber-50/50 border border-amber-200 dark:bg-amber-900/10 dark:border-amber-900/30 p-5 rounded-2xl flex flex-col sm:flex-row justify-between gap-4 group hover:shadow-md transition-all relative overflow-hidden cursor-pointer"
                >
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-400"></div>
                  <div className="pl-2">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-200/50 text-amber-700 rounded-lg">来自: {plan.assignee_id}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-200/50 text-slate-700 rounded-lg">{plan.category}</span>
                    </div>
                    <h4 className="text-lg font-bold text-slate-800 dark:text-slate-100">{plan.title}</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">{plan.description}</p>
                    <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                      <span>🎯 目标: {plan.target_value}</span>
                      <span>📅 截止: {plan.deadline}</span>
                    </div>
                  </div>
                  <div className="flex sm:flex-col items-center justify-end gap-2 shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); handleApprove(plan.id); }} className="w-full sm:w-28 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-sm transition-all shadow-sm flex items-center justify-center gap-1 active:scale-95">
                      <span className="material-symbols-outlined text-[16px]">check_circle</span> 通过
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleReject(plan.id); }} className="w-full sm:w-28 px-4 py-2 bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-900/50 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-1 active:scale-95">
                       <span className="material-symbols-outlined text-[16px]">cancel</span> 驳回
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Team Overview Section (Bento Grid) */}
        <section className="mb-10 bg-white border border-surface-container rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center gap-8">
            <div className="flex-grow">
              <div className="flex justify-between items-end mb-4">
                <div>
                  <h3 className="text-lg font-black font-headline text-on-surface">团队整体进度</h3>
                  <p className="text-xs text-on-surface-variant font-label mt-0.5">当前周期任务执行概况</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-secondary/10 text-secondary">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary mr-1.5"></span>
                    按计划进行 (On Track)
                  </span>
                  <span className="text-2xl font-black text-primary font-headline">72%</span>
                </div>
              </div>
              <div className="w-full bg-surface-container rounded-full h-3 overflow-hidden">
                <div className="bg-gradient-to-r from-primary to-primary-container h-full rounded-full transition-all duration-1000" style={{ width: '72%' }}></div>
              </div>
            </div>
          </div>
        </section>

        {/* Dynamic Member Cards — 人员左右滑动 × 任务上下滑动 */}
        <div
          ref={dragRef}
          onMouseDown={onDragStart}
          onMouseMove={onDragMove}
          onMouseUp={onDragEnd}
          onMouseLeave={onDragEnd}
          className="flex gap-5 overflow-x-auto pb-4 -mx-2 px-2 snap-x snap-mandatory scroll-smooth cursor-grab active:cursor-grabbing select-none"
          style={{ scrollbarWidth: 'thin' }}>
          {subordinates.length === 0 ? (
            <div className="flex-none w-full py-16 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
              <span className="material-symbols-outlined text-5xl mb-3 block">group_off</span>
              <p className="text-sm font-bold">暂无下属成员数据</p>
            </div>
          ) : (
            subordinates.map(sub => (
              <div key={sub.id} className="flex-none w-72 snap-center bg-surface-container-low rounded-xl p-6 transition-all hover:shadow-2xl hover:shadow-primary/5 group flex flex-col" style={{ height: 'calc(100vh - 320px)', minHeight: '400px' }}>
                <div className="flex justify-between items-start mb-6 shrink-0">
                  <div className="flex items-center space-x-4">
                    <div className="relative shrink-0">
                      {sub.avatar_url ? (
                        <img alt={sub.name} className="w-16 h-16 rounded-2xl object-cover ring-4 ring-white shadow-sm" src={sub.avatar_url} />
                      ) : (
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center font-black text-xl text-primary ring-4 ring-white shadow-sm">
                          {sub.name[0]}
                        </div>
                      )}
                      <span className={`absolute -bottom-1 -right-1 w-4 h-4 border-2 border-white rounded-full ${sub.role === 'manager' ? 'bg-amber-400' : 'bg-secondary'}`}></span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-lg font-black font-headline truncate">{sub.name} ({sub.id})</h3>
                      <p className="text-xs text-on-surface-variant font-label tracking-wide uppercase truncate">{sub.title || '员工'}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end shrink-0 pl-2">
                    <span className="text-2xl font-black text-primary">{sub.score || 90}</span>
                    <span className="text-[10px] text-on-surface-variant font-label uppercase">绩效预估</span>
                  </div>
                </div>
                
                <div className="space-y-3 flex-1 flex flex-col min-h-0">
                  <h4 className="text-xs font-bold text-on-surface-variant uppercase flex items-center shrink-0">
                    <span className="material-symbols-outlined text-xs mr-1">task_alt</span>
                    当前分配的关键任务 ({sub.tasks?.length || 0})
                  </h4>
                  <div className="space-y-2 flex-1 overflow-y-auto pr-1">
                    {!sub.tasks || sub.tasks.length === 0 ? (
                      <div className="text-xs text-slate-400 py-6 text-center border border-dashed border-slate-200 dark:border-slate-700/50 rounded-lg">该成员暂无可追踪的绩效任务</div>
                    ) : (
                      sub.tasks.map(task => (
                        <div key={task.id} 
                          onClick={() => setSelectedTask(task)}
                          className="p-3 bg-white/80 dark:bg-slate-800/80 rounded-lg flex flex-col gap-1.5 border border-slate-100 dark:border-slate-700/50 hover:border-primary/30 transition-colors cursor-pointer"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-sm font-bold text-slate-800 dark:text-slate-100 line-clamp-2 leading-tight">{task.title}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap shrink-0 ${
                              task.status === 'completed' || task.status === 'assessed' ? 'bg-purple-100 text-purple-700' :
                              task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                              task.status === 'pending_review' ? 'bg-amber-100 text-amber-700' :
                              task.status === 'rejected' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {task.status === 'completed' || task.status === 'assessed' ? '待考核' :
                               task.status === 'in_progress' ? '进行中' :
                               task.status === 'pending_review' ? '待审批' :
                               task.status === 'rejected' ? '被驳回' : '挂起'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-400 mt-0.5">
                            <span className="flex items-center gap-1 font-medium"><span className="material-symbols-outlined text-[10px]">schedule</span> 截止: {task.deadline}</span>
                            <span className="font-bold text-primary">进度: {task.progress || 0}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-1">
                            <div className="h-full bg-gradient-to-r from-primary to-secondary rounded-full" style={{ width: `${task.progress || 0}%` }}></div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        </div>
      </main>

      {/* Top-Down Assignment Modal */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsAssignModalOpen(false)}></div>
          <div className="relative bg-surface-container-lowest w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300">
            <div className="px-6 py-5 border-b border-outline-variant/20 flex justify-between items-center bg-surface-container-low/50">
              <h3 className="text-lg font-black text-on-surface">向下发起绩效目标</h3>
              <button onClick={() => setIsAssignModalOpen(false)} className="text-outline hover:bg-surface-container-highest p-1 rounded-full transition-colors">
                 <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleAssignPlan} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">指派给谁</label>
                <select required value={newPlan.assignee_id} onChange={e => setNewPlan({...newPlan, assignee_id: e.target.value})} className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary outline-none">
                  {subordinates.length === 0 ? (
                  <option disabled value="">（无下属成员）</option>
                ) : (
                  subordinates.map(sub => (
                    <option key={sub.id} value={sub.id}>{sub.name} ({sub.title || sub.role})</option>
                  ))
                )}
                </select>
              </div>
              <SmartFormInputs
                data={newPlan}
                onChange={(data) => setNewPlan({ ...newPlan, ...data })}
                hideCategory={false}
              />
              <div className="pt-4 flex justify-end gap-3 border-t border-outline-variant/20">
                <button type="button" onClick={() => setIsAssignModalOpen(false)} className="px-5 py-2.5 rounded-xl font-bold text-on-surface-variant hover:bg-surface-container-highest transition-colors">取消</button>
                <button type="submit" disabled={submitting} className="bg-secondary text-white px-6 py-2.5 rounded-xl font-bold hover:shadow-lg disabled:opacity-70 transition-all flex items-center gap-2">
                   {submitting ? <span className="material-symbols-outlined animate-spin" style={{fontVariationSettings:"'wght' 300"}}>progress_activity</span> : <span className="material-symbols-outlined text-[18px]">electric_bolt</span>}
                   立即强制派发
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setSelectedTask(null)} />
          <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 fade-in duration-200">
            {/* Header */}
            <div className="shrink-0 px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-container text-on-primary-container flex items-center justify-center shadow-inner">
                  <span className="material-symbols-outlined">description</span>
                </div>
                <div>
                  <h3 className="font-black text-slate-800 dark:text-slate-100 text-lg leading-tight">任务详情</h3>
                  <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">SMART Goal Details</p>
                </div>
              </div>
              <button onClick={() => setSelectedTask(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6">
              <SmartGoalDisplayFromPlan
                title={selectedTask.title}
                target_value={selectedTask.target_value}
                description={selectedTask.description}
                deadline={selectedTask.deadline}
                category={selectedTask.category}
                collaborators={selectedTask.collaborators}
              />
            </div>
            
            {/* Footer Actions (Only for Team Manager to close) */}
            <div className="shrink-0 p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 flex justify-end">
               <button onClick={() => setSelectedTask(null)} className="px-6 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-bold rounded-xl transition-colors min-w-[100px]">关闭</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
