import React, { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import SmartFormInputs, { SmartData, encodeSmartDescription, decodeSmartDescription } from '../components/SmartFormInputs';
import { SmartGoalDisplayFromPlan } from '../components/SmartGoalDisplay';
import SmartTaskModal, { SmartTaskData } from '../components/SmartTaskModal';

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
      fetchTeamStatus();
    }
  }, [currentUser]);

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

  const handleAssignPlanSmart = async (data: SmartTaskData) => {
    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('登录已过期，请重新登录');
        window.location.reload();
        return;
      }
      const targetValue = `S: ${data.s}\nM: ${data.m}\nT: ${data.t}`;
      
      const createRes = await fetch('/api/perf/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ 
          title: data.summary || '新任务',
          description: encodeSmartDescription(data.a_smart, data.r_smart, {
            plan: data.planTime, do: data.doTime, check: data.checkTime, act: data.actTime
          }),
          category: data.taskType || '临时指派',
          target_value: targetValue,
          deadline: data.t,
          collaborators: data.c,
          assignee_id: data.a || subordinates[0]?.id || '',
          quarter: '2024 Q2', 
          creator_id: currentUser?.id,
          approver_id: currentUser?.id
        })
      });

      if (createRes.status === 401) {
        alert('登录已过期，请重新登录后再试');
        localStorage.removeItem('token');
        window.location.reload();
        return;
      }

      const createData = await createRes.json();
      
      if (createData.code === 0 && createData.data?.id) {
        const planId = createData.data.id;
        await fetch(`/api/perf/plans/${planId}/submit`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
        await fetch(`/api/perf/plans/${planId}/approve`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
        
        setIsAssignModalOpen(false);
        fetchTeamStatus();
      } else {
        alert(createData.message || '创建任务失败，请重试');
      }
    } catch (err) {
      console.error(err);
      alert('网络异常，请检查网络连接后重试');
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
            <p className="text-on-surface-variant font-label mt-1">
              {currentUser?.role === 'employee' ? `查看部门整体进度与同事任务执行概况` : `作为主管 ${currentUser?.name}，管理团队目标申请与向下派发`}
            </p>
          </div>
        </section>

        {/* Quick Action Cards Section */}
        <section className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {currentUser?.role !== 'employee' && (
            <div onClick={() => { setIsAssignModalOpen(true); setNewPlan(p => ({ ...p, assignee_id: subordinates[0]?.id || '' })); }} className="bg-white border border-surface-container rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary transition-colors">
                <span className="material-symbols-outlined text-primary group-hover:text-white">add_task</span>
              </div>
              <div>
                <h4 className="font-bold text-on-surface tracking-tight">团队内发起任务</h4>
                <p className="text-xs text-on-surface-variant mt-0.5">为团队成员分配绩效目标与关键任务</p>
              </div>
            </div>
          )}
        </section>

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
              <p className="text-sm font-bold">{currentUser?.role === 'employee' ? '暂无部门同事数据' : '暂无下属成员数据'}</p>
            </div>
          ) : (
            subordinates.map((sub, idx) => {
            const cardColors = [
              { ring: 'ring-rose-300', accent: 'text-rose-500', bg: 'from-rose-400/20 to-pink-400/20', dot: 'bg-rose-400' },
              { ring: 'ring-blue-300', accent: 'text-blue-500', bg: 'from-blue-400/20 to-cyan-400/20', dot: 'bg-blue-400' },
              { ring: 'ring-emerald-300', accent: 'text-emerald-500', bg: 'from-emerald-400/20 to-teal-400/20', dot: 'bg-emerald-400' },
              { ring: 'ring-amber-300', accent: 'text-amber-500', bg: 'from-amber-400/20 to-orange-400/20', dot: 'bg-amber-400' },
              { ring: 'ring-violet-300', accent: 'text-violet-500', bg: 'from-violet-400/20 to-purple-400/20', dot: 'bg-violet-400' },
              { ring: 'ring-cyan-300', accent: 'text-cyan-500', bg: 'from-cyan-400/20 to-sky-400/20', dot: 'bg-cyan-400' },
            ];
            const cc = cardColors[idx % cardColors.length];
            return (
              <div key={sub.id} className="flex-none w-72 snap-center bg-surface-container-low rounded-xl p-6 transition-all hover:shadow-2xl hover:shadow-primary/5 group flex flex-col" style={{ height: 'calc(100vh - 320px)', minHeight: '400px' }}>
                <div className="flex justify-between items-start mb-6 shrink-0">
                  <div className="flex items-center space-x-4">
                    <div className="relative shrink-0">
                      {sub.avatar_url ? (
                        <img alt={sub.name} className={`w-16 h-16 rounded-2xl object-cover ring-4 ${cc.ring} shadow-sm`} src={sub.avatar_url} />
                      ) : (
                        <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${cc.bg} flex items-center justify-center font-black text-xl ${cc.accent} ring-4 ${cc.ring} shadow-sm`}>
                          {sub.name[0]}
                        </div>
                      )}
                      <span className={`absolute -bottom-1 -right-1 w-4 h-4 border-2 border-white rounded-full ${sub.role === 'manager' ? 'bg-amber-400' : cc.dot}`}></span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-lg font-black font-headline truncate">{sub.name}</h3>
                      <p className="text-xs text-on-surface-variant font-label tracking-wide truncate">{sub.title || '员工'}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end shrink-0 pl-2">
                    <span className={`text-2xl font-black ${cc.accent}`}>{sub.score || 90}</span>
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
            )})
          )}
        </div>
        </div>
      </main>

      {/* Top-Down Assignment Modal */}
      <SmartTaskModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        onSubmit={handleAssignPlanSmart}
        title="向下发起绩效目标"
        type="team"
        users={subordinates.map(s => ({ id: s.id, name: s.name }))}
        submitting={submitting}
        onDraft={async (data) => {
          setSubmitting(true);
          try {
            const token = localStorage.getItem('token');
            if (!token) { alert('登录已过期，请重新登录'); window.location.reload(); return; }
            const targetValue = `S: ${data.s}\nM: ${data.m}\nT: ${data.t}`;
            const res = await fetch('/api/perf/plans', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({
                title: data.summary || '草稿任务',
                description: encodeSmartDescription(data.a_smart, data.r_smart, {
                  plan: data.planTime, do: data.doTime, check: data.checkTime, act: data.actTime
                }),
                category: data.taskType || '临时指派',
                target_value: targetValue,
                deadline: data.t,
                collaborators: data.c,
                assignee_id: data.a || subordinates[0]?.id || '',
                quarter: '2024 Q2',
                creator_id: currentUser?.id,
                approver_id: currentUser?.id,
              })
            });
            if (res.status === 401) { alert('登录已过期，请重新登录后再试'); localStorage.removeItem('token'); window.location.reload(); return; }
            const json = await res.json();
            if (json.code === 0) {
              alert('草稿已保存');
              setIsAssignModalOpen(false);
              fetchTeamStatus();
            } else { alert(json.message || '保存失败'); }
          } catch { alert('网络异常，请重试'); } finally { setSubmitting(false); }
        }}
        initialData={{
          a: subordinates[0]?.id || '',
          r: currentUser?.id,
          summary: '团队季度核心目标下达',
          s: '完成分配的核心业务指标或技术重构任务',
          m: '达成率 100%，无重大事故',
          a_smart: '基于团队现有资源及工时排期执行',
          r_smart: '支撑部门季度 OKR',
          t: '2024-06-30',
          taskType: '重点项目'
        }}
      />

      {/* Task Detail Modal (Readonly SmartTaskModal) */}
      <SmartTaskModal
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onSubmit={() => {}}
        title="任务详情"
        type="team"
        users={subordinates.map(s => ({ id: s.id, name: s.name }))}
        readonly={true}
        initialData={(() => {
          if (!selectedTask) return {};
          const decoded = decodeSmartDescription(selectedTask.description || '');
          return {
            id: selectedTask.id,
            status: selectedTask.status,
            flow_type: 'perf_plan',
            summary: selectedTask.title,
            s: selectedTask.target_value ? selectedTask.target_value.split('\n')[0]?.replace('S: ', '') : '',
            m: selectedTask.target_value ? selectedTask.target_value.split('\n')[1]?.replace('M: ', '') : '',
            t: selectedTask.deadline || selectedTask.target_value?.split('\n')[2]?.replace('T: ', '') || '',
            a_smart: decoded.resource,
            r_smart: decoded.relevance,
            taskType: selectedTask.category,
            c: selectedTask.collaborators || '',
            r: currentUser?.id,
            planTime: decoded.planTime,
            doTime: decoded.doTime,
            checkTime: decoded.checkTime,
            actTime: decoded.actTime,
            approver_id: selectedTask.approver_id || currentUser?.id,
            creator_id: selectedTask.creator_id || currentUser?.id,
            assignee_id: selectedTask.assignee_id
          };
        })()}
      />

    </div>
  );
}
