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
  const { currentUser, hasPermission } = useAuth();
  const [subordinates, setSubordinates] = useState<Subordinate[]>([]);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [newPlan, setNewPlan] = useState<SmartData & { assignee_id: string }>({ title: '', target_value: '', resource: '', relevance: '', deadline: '', category: '业务', collaborators: '', assignee_id: '' });
  const [submitting, setSubmitting] = useState(false);

  const [viewMode, setViewMode] = useState<'personnel' | 'kanban' | 'list'>('personnel');
  const [searchKey, setSearchKey] = useState('');
  const [sortKey, setSortKey] = useState<'status' | 'deadline' | 'progress' | 'assignee_name'>('deadline');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isScopeModalOpen, setIsScopeModalOpen] = useState(false);

  
  const flatTasks = React.useMemo(() => {
    let tasks: any[] = [];
    subordinates.forEach(sub => sub.tasks?.forEach(t => tasks.push({ ...t, assignee_id: sub.id, assignee_name: sub.name, assignee_avatar: sub.avatar_url, assignee_role: sub.role, assignee_score: sub.score })));
    if (searchKey.trim()) {
      const lower = searchKey.toLowerCase();
      tasks = tasks.filter(t => t.title.toLowerCase().includes(lower) || t.assignee_name.toLowerCase().includes(lower));
    }
    tasks.sort((a, b) => {
      let valA, valB;
      if (sortKey === 'progress') { valA = a.progress || 0; valB = b.progress || 0; }
      else if (sortKey === 'deadline') { valA = new Date(a.deadline || '2099-01-01').getTime(); valB = new Date(b.deadline || '2099-01-01').getTime(); }
      else if (sortKey === 'status') {
        const w = (s: string) => s === 'in_progress' ? 1 : s === 'pending_review' ? 2 : s === 'completed' ? 3 : 0;
        valA = w(a.status); valB = w(b.status);
      } else { valA = a.assignee_name; valB = b.assignee_name; }
      if (typeof valA === 'string') return sortOrder === 'asc' ? valA.localeCompare(valB as string) : (valB as string).localeCompare(valA);
      return sortOrder === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    });
    return tasks;
  }, [subordinates, searchKey, sortKey, sortOrder]);

  // AI Drawer State
  const [isDiagDrawerOpen, setIsDiagDrawerOpen] = useState(false);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagResult, setDiagResult] = useState('');

  const handleDiagnoseTeam = async () => {
    setIsDiagDrawerOpen(true);
    setDiagLoading(true);
    setDiagResult('');
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('未发现权鉴');
      
      // Generate analytics JSON payload
      const analyticsData = flatTasks.map(t => ({
        人名: t.assignee_name,
        任务: t.title,
        状态: t.status === 'completed' || t.status === 'assessed' ? '已完成' : t.status === 'in_progress' ? '进行中' : t.status === 'pending_review' ? '待审批' : '其他',
        进度: t.progress + '%',
        截止: t.deadline || '无'
      }));

      const prompt = `请作为资深HRBP，根据以下团队近期任务调度数据，分析：\n1. 是谁存在超期风险或是零进度问题？\n2. 团队中有没有出现工作量严重失衡的情况？\n3. 给出3点严厉且一针见血的管理建议。\n\n数据: ${JSON.stringify(analyticsData, null, 2)}`;

      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ prompt })
      });

      if (!res.ok) throw new Error('API Error');
      const json = await res.json();
      if (json.code === 0 && json.data?.analysis) {
        setDiagResult(json.data.analysis);
      } else {
        setDiagResult('诊断未生成，请检查数据。');
      }
    } catch (err: any) {
      console.error(err);
      setDiagResult(`诊断服务暂时不可用：${err.message}`);
    } finally {
      setDiagLoading(false);
    }
  };

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
          collaborators: [data.c, data.i].filter(Boolean).join(','),
          assignee_id: data.r || subordinates[0]?.id || '',
          quarter: data.quarter || undefined, 
          creator_id: currentUser?.id,
          approver_id: data.a || currentUser?.id
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
        // 下发任务不自动 approve，保持 pending_review 状态，员工需确认接收，主管再审批
        await fetch(`/api/perf/plans/${planId}/submit`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
        
        setIsAssignModalOpen(false);
        fetchTeamStatus();
        alert('任务已下发，等待员工确认接收后，请在「待我审批」中审批通过。');
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

  const handleApplyTask = async (data: SmartTaskData) => {
    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('登录已过期，请重新登录');
        window.location.reload();
        return;
      }

      // 动态查询直属上级作为审批人（替代硬编码）
      let approverId: string | undefined = data.approver_id;
      if (!approverId) {
        try {
          const superiorRes = await fetch('/api/org/my-superior', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const superiorJson = await superiorRes.json();
          approverId = superiorJson.data?.id;
        } catch { /* 查询失败则继续，让后端校验 */ }
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
          category: data.taskType || '常规任务',
          target_value: targetValue,
          deadline: data.t,
          collaborators: [data.c, data.i].filter(Boolean).join(','),
          assignee_id: data.r || currentUser?.id,
          quarter: data.quarter || undefined, 
          creator_id: currentUser?.id,
          approver_id: data.a || approverId
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
        
        setIsApplyModalOpen(false);
        fetchTeamStatus();
      } else {
        alert(createData.message || '申请失败，请重试');
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

        {/* Unified Top Section: Quick Actions + Team Overview */}
        <section className="mb-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {currentUser?.role !== 'employee' && (
            <>
              {/* Card 1: Assign Task */}
              <div onClick={() => { setIsAssignModalOpen(true); setNewPlan(p => ({ ...p, assignee_id: subordinates[0]?.id || '' })); }} className="bg-white border border-surface-container rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between">
                <div className="flex items-start space-x-4 mb-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary transition-colors shrink-0">
                    <span className="material-symbols-outlined text-primary group-hover:text-white">add_task</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-on-surface tracking-tight">团队内发起任务</h4>
                    <p className="text-[11px] text-on-surface-variant mt-1 leading-relaxed">为团队成员分配关键的绩效目标与执行任务</p>
                  </div>
                </div>
              </div>
              
              {/* Card 2: Apply Task */}
              <div onClick={() => setIsApplyModalOpen(true)} className="bg-white border border-surface-container rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between">
                <div className="flex items-start space-x-4 mb-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-colors shrink-0">
                    <span className="material-symbols-outlined group-hover:text-white">post_add</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-on-surface tracking-tight text-slate-800">申请新任务</h4>
                    <p className="text-[11px] text-on-surface-variant mt-1 leading-relaxed">使用严谨完整的 SMART 原则向直属上级提报计划</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Card 3: Team Overview Section */}
          <div className={`bg-white border border-surface-container rounded-2xl p-5 shadow-sm flex flex-col justify-between ${currentUser?.role === 'employee' ? 'lg:col-span-3' : 'lg:col-span-1'}`}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-sm font-black font-headline text-on-surface">团队整体进度</h3>
                <p className="text-[11px] text-on-surface-variant font-label mt-1">当前周期执行概况</p>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-2xl font-black text-primary font-headline leading-none">72%</span>
                <span className="inline-flex items-center text-[9px] font-bold text-secondary mt-1">
                  <span className="w-1 h-1 rounded-full bg-secondary mr-1"></span>On Track
                </span>
              </div>
            </div>
            <div className="w-full bg-surface-container rounded-full h-2 overflow-hidden mt-auto">
              <div className="bg-gradient-to-r from-primary to-primary-container h-full rounded-full transition-all duration-1000" style={{ width: '72%' }}></div>
            </div>
          </div>
        </section>

        {/* ── View Toggle & Toolbar ── */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex bg-surface-container rounded-xl p-1 w-full md:w-auto overflow-x-auto">
            <button onClick={() => setViewMode('personnel')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${viewMode === 'personnel' ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface hover:bg-black/5'}`}>
              <span className="material-symbols-outlined text-[18px]">groups</span>
              按人员列阵
            </button>
            <button onClick={() => setViewMode('kanban')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${viewMode === 'kanban' ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface hover:bg-black/5'}`}>
              <span className="material-symbols-outlined text-[18px]">view_kanban</span>
              任务看板
            </button>
            <button onClick={() => setViewMode('list')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${viewMode === 'list' ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface hover:bg-black/5'}`}>
              <span className="material-symbols-outlined text-[18px]">table_rows</span>
              数据列表
            </button>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative w-full md:w-64">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
              <input 
                type="text" 
                placeholder="搜索任务或人员..."
                value={searchKey}
                onChange={e => setSearchKey(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-surface-container rounded-xl text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>
            {/* 团队可视范围配置入口 — 仅 HR / 管理员可见 */}
            {(hasPermission('module_task_mgmt') || hasPermission('edit_org_info') || currentUser?.is_super_admin) && (
              <button
                onClick={() => setIsScopeModalOpen(true)}
                title="配置团队可视范围"
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-surface-container text-slate-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-all flex-shrink-0"
              >
                <span className="material-symbols-outlined text-[18px]">manage_accounts</span>
              </button>
            )}
          </div>

        </div>

        {/* ── View: Personnel (Original Card Layout) ── */}
        {viewMode === 'personnel' && (
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
            subordinates.filter(s => !searchKey.trim() || s.name.toLowerCase().includes(searchKey.toLowerCase())).map((sub, idx) => {
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
                              {task.status === 'completed' || task.status === 'assessed' ? '已结案' :
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
        )}

        {/* ── View: Kanban (Task Board Layout) ── */}
        {viewMode === 'kanban' && (
          <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-320px)] min-h-[400px]">
            {[
              { id: 'pending', title: '待处理 / 挂起', statuses: ['pending', 'suspended', 'claiming'] },
              { id: 'in_progress', title: '进行中', statuses: ['in_progress'] },
              { id: 'review', title: '待验收', statuses: ['pending_review'] },
              { id: 'done', title: '已结案', statuses: ['completed', 'assessed', 'rewarded'] }
            ].map(col => (
              <div key={col.id} className="flex-none w-80 flex flex-col bg-surface-container-lowest border border-surface-container rounded-2xl overflow-hidden shadow-sm">
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-surface-container font-bold text-sm text-slate-700 dark:text-slate-300 flex justify-between items-center">
                  <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600"></span>{col.title}</span>
                  <span className="text-xs bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded-full">{flatTasks.filter(t => col.statuses.includes(t.status)).length}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                  {flatTasks.filter(t => col.statuses.includes(t.status)).map(task => (
                    <div key={task.id} onClick={() => setSelectedTask(task)} className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md cursor-pointer transition-all hover:border-primary/30 active:scale-[0.98]">
                      <div className="flex justify-between items-start mb-2.5 gap-2">
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-100 line-clamp-2 leading-snug flex-1">{task.title}</span>
                        {task.category && <span className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-slate-500 shrink-0 uppercase tracking-widest">{task.category}</span>}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-4">
                        <span className="material-symbols-outlined text-[12px]">calendar_clock</span>
                        <span className={task.deadline && new Date(task.deadline).getTime() < Date.now() && !['completed', 'assessed'].includes(task.status) ? 'text-red-500 font-bold' : ''}>截止: {task.deadline || '无'}</span>
                      </div>
                      <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-700/50 pt-3">
                        <div className="flex items-center gap-2">
                          {task.assignee_avatar ? (
                            <img src={task.assignee_avatar} className="w-6 h-6 rounded-full object-cover shadow-sm ring-1 ring-slate-200 dark:ring-slate-700" alt={task.assignee_name} />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#0060a9] to-[#4da3e8] text-white flex items-center justify-center text-[10px] font-bold shadow-sm">{task.assignee_name.charAt(0)}</div>
                          )}
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{task.assignee_name}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-primary">{task.progress || 0}%</span>
                          <div className="w-10 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className="bg-primary h-full rounded-full" style={{ width: `${task.progress || 0}%` }}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {flatTasks.filter(t => col.statuses.includes(t.status)).length === 0 && (
                    <div className="flex flex-col items-center justify-center h-32 opacity-50">
                      <span className="material-symbols-outlined text-3xl mb-2 text-slate-300">inbox</span>
                      <span className="text-xs font-medium text-slate-400">暂无任务</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── View: List (Data Table Layout) ── */}
        {viewMode === 'list' && (
          <div className="bg-white dark:bg-slate-900 border border-surface-container rounded-2xl overflow-hidden shadow-sm flex flex-col h-[calc(100vh-320px)] min-h-[400px]">
            <div className="overflow-y-auto flex-1 custom-scrollbar">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 text-xs uppercase sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="px-6 py-4 font-bold tracking-wider rounded-tl-xl w-1/3">
                      任务目标
                    </th>
                    <th className="px-6 py-4 font-bold tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none" onClick={() => { setSortKey('assignee_name'); setSortOrder(o => o === 'asc' ? 'desc' : 'asc'); }}>
                      <div className="flex items-center gap-1">负责人 {sortKey === 'assignee_name' && <span className="material-symbols-outlined text-[14px]">{sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>}</div>
                    </th>
                    <th className="px-6 py-4 font-bold tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none" onClick={() => { setSortKey('status'); setSortOrder(o => o === 'asc' ? 'desc' : 'asc'); }}>
                      <div className="flex items-center gap-1">当前状态 {sortKey === 'status' && <span className="material-symbols-outlined text-[14px]">{sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>}</div>
                    </th>
                    <th className="px-6 py-4 font-bold tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none" onClick={() => { setSortKey('progress'); setSortOrder(o => o === 'asc' ? 'desc' : 'asc'); }}>
                      <div className="flex items-center gap-1">执行进度 {sortKey === 'progress' && <span className="material-symbols-outlined text-[14px]">{sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>}</div>
                    </th>
                    <th className="px-6 py-4 font-bold tracking-wider cursor-pointer rounded-tr-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none" onClick={() => { setSortKey('deadline'); setSortOrder(o => o === 'asc' ? 'desc' : 'asc'); }}>
                      <div className="flex items-center gap-1">截止日期 {sortKey === 'deadline' && <span className="material-symbols-outlined text-[14px]">{sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>}</div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container text-slate-700 dark:text-slate-300">
                  {flatTasks.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-16 text-center text-slate-400"><span className="material-symbols-outlined text-4xl mb-2 block">search_off</span>暂无符合条件的数据</td></tr>
                  ) : flatTasks.map(task => (
                    <tr key={task.id} onClick={() => setSelectedTask(task)} className="hover:bg-[#0060a9]/5 dark:hover:bg-[rgb(0,96,169)]/20 cursor-pointer transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800 dark:text-slate-100 group-hover:text-[#0060a9] transition-colors whitespace-normal line-clamp-2 leading-relaxed">{task.title}</span>
                          {task.category && <span className="text-[10px] font-bold mt-1 text-slate-400 uppercase tracking-widest">{task.category}</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#0060a9] to-[#4da3e8] text-white flex items-center justify-center text-[10px] font-bold shrink-0 shadow-sm">{task.assignee_name.charAt(0)}</div>
                          <span className="text-sm font-bold">{task.assignee_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] px-2.5 py-1 rounded font-bold uppercase tracking-wide border ${
                          task.status === 'completed' || task.status === 'assessed' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                          task.status === 'in_progress' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                          task.status === 'pending_review' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                          task.status === 'rejected' ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {task.status === 'completed' || task.status === 'assessed' ? '已结案' :
                           task.status === 'in_progress' ? '进行中' :
                           task.status === 'pending_review' ? '待审批' :
                           task.status === 'rejected' ? '被驳回' : '挂起'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 max-w-[140px]">
                          <div className="flex-1 bg-surface-container-highest h-1.5 rounded-full overflow-hidden">
                            <div className="bg-gradient-to-r from-primary to-secondary h-full rounded-full" style={{ width: `${task.progress || 0}%` }}></div>
                          </div>
                          <span className="text-xs font-black text-slate-700 dark:text-slate-300 w-8 text-right">{task.progress || 0}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-500 text-xs flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[14px]">event</span>
                        {task.deadline ? (
                          <span className={new Date(task.deadline).getTime() < Date.now() && !['completed', 'assessed'].includes(task.status) ? 'text-red-500 font-bold' : ''}>
                            {task.deadline}
                          </span>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-3 border-t border-surface-container bg-slate-50 dark:bg-slate-800/50 text-xs font-bold text-slate-400 flex justify-between items-center">
              <span>共计检索 {flatTasks.length} 条数据结果</span>
            </div>
          </div>
        )}
        </div>

        {/* ── AI Diagnosis Floating Button ── */}
        <button
          onClick={handleDiagnoseTeam}
          className="fixed top-1/2 -translate-y-1/2 right-0 z-[90] flex items-center justify-center w-12 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-l-xl shadow-[-4px_0_15px_rgba(99,102,241,0.3)] hover:shadow-[-8px_0_25px_rgba(99,102,241,0.4)] hover:w-14 transition-all text-white group"
          title="AI 团队洞察诊断"
        >
          <div className="absolute inset-0 rounded-l-xl animate-ping bg-purple-400 opacity-20 delay-100"></div>
          <span className="font-black font-headline text-lg tracking-tighter relative z-10">AI</span>
        </button>

        {/* ── AI Diagnosis Drawer ── */}
        {isDiagDrawerOpen && (
          <div className="fixed inset-0 z-[100] flex justify-end">
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm cursor-pointer transition-opacity" onClick={() => setIsDiagDrawerOpen(false)}></div>
            <div className="relative w-full md:w-[480px] h-full bg-white dark:bg-slate-900 shadow-[-10px_0_30px_rgba(0,0,0,0.1)] flex flex-col transform transition-transform duration-300 animate-in slide-in-from-right overflow-hidden">
              {/* Header */}
              <div className="px-6 py-5 border-b border-surface-container bg-surface-container-low flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <span className="material-symbols-outlined">psychiatry</span>
                  </div>
                  <div>
                    <h2 className="text-lg font-black font-headline text-slate-800 dark:text-slate-100">AI 团队诊断报告</h2>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">DeepSeek HRM Analyzer</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsDiagDrawerOpen(false)}
                  className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
              
              {/* Content Body */}
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-900/50 custom-scrollbar relative">
                {diagLoading ? (
                  <div className="flex flex-col gap-4 animate-pulse pt-2">
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3 mb-4"></div>
                    <div className="space-y-3">
                      <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-full"></div>
                      <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-11/12"></div>
                      <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-4/5"></div>
                    </div>
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/4 mt-6 mb-4"></div>
                    <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded-xl w-full border border-slate-100 dark:border-slate-700/50"></div>
                    <div className="flex items-center justify-center gap-2 mt-12 text-slate-400">
                      <span className="material-symbols-outlined animate-spin text-[16px]">sync</span>
                      <span className="text-xs font-bold font-label">AI 正在深度分析中...</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-[15px] text-slate-700 dark:text-slate-300 leading-loose font-body">
                    {diagResult.split('\n').map((line, idx) => {
                      if (line.startsWith('### ')) return <h4 key={idx} className="text-[16px] font-black font-headline text-slate-800 dark:text-slate-100 mt-6 mb-2">{line.replace('### ', '').replace(/\*\*/g, '')}</h4>;
                      if (line.startsWith('## ')) return <h3 key={idx} className="text-[18px] font-black font-headline text-indigo-700 dark:text-indigo-400 mt-8 mb-3 pb-2 border-b border-indigo-100 dark:border-indigo-900/50">{line.replace('## ', '').replace(/\*\*/g, '')}</h3>;
                      if (line.startsWith('# ')) return <h2 key={idx} className="text-[20px] font-black font-headline text-slate-900 dark:text-white mt-4 mb-4">{line.replace('# ', '').replace(/\*\*/g, '')}</h2>;
                      if (line.trim().startsWith('- ')) return <div key={idx} className="flex items-start gap-2 ml-2 mb-2"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 mt-2"></span><span dangerouslySetInnerHTML={{ __html: line.replace('- ', '').replace(/\*\*(.*?)\*\*/g, '<b class="text-indigo-700 dark:text-indigo-400 font-black">$1</b>') }} className="font-medium"></span></div>;
                      if (!line.trim()) return <div key={idx} className="h-3"></div>;
                      
                      const formattedLine = line.replace(/\*\*(.*?)\*\*/g, '<b class="text-slate-900 dark:text-slate-100 font-black">$1</b>');
                      return <p key={idx} dangerouslySetInnerHTML={{ __html: formattedLine }} className="mb-3"></p>;
                    })}
                  </div>
                )}
              </div>
              
              {/* Footer Action */}
              <div className="p-4 border-t border-surface-container bg-white dark:bg-slate-900 shrink-0 flex gap-3">
                <button 
                  onClick={handleDiagnoseTeam}
                  disabled={diagLoading}
                  className="flex-1 py-3 px-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex justify-center items-center gap-2 disabled:opacity-50 active:scale-95"
                >
                  <span className="material-symbols-outlined text-[18px]">refresh</span>重新诊断
                </button>
                <button 
                  onClick={() => {
                    alert('已获取建议核心卡点，即将向相关责任人推送企微提醒...');
                    setIsDiagDrawerOpen(false);
                  }}
                  disabled={diagLoading || !diagResult}
                  className="flex-[2] py-3 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white shadow-md shadow-primary/20 font-bold transition-all flex justify-center items-center gap-2 disabled:opacity-50 active:scale-95"
                >
                  <span className="material-symbols-outlined text-[18px]">send</span>一键应用建议
                </button>
              </div>
            </div>
          </div>
        )}
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
                collaborators: [data.c, data.i].filter(Boolean).join(','),
                assignee_id: data.r || subordinates[0]?.id || '',
                quarter: data.quarter || undefined,
                creator_id: currentUser?.id,
                approver_id: data.a || currentUser?.id,
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
          summary: '',
          s: '',
          m: '',
          a_smart: '',
          r_smart: '',
          t: '',
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
            s: selectedTask.target_value ? String(selectedTask.target_value).split('\n')[0]?.replace('S: ', '') : '',
            m: selectedTask.target_value ? String(selectedTask.target_value).split('\n')[1]?.replace('M: ', '') : '',
            t: selectedTask.deadline || (selectedTask.target_value ? String(selectedTask.target_value).split('\n')[2]?.replace('T: ', '') : '') || '',
            a_smart: decoded.resource,
            r_smart: decoded.relevance,
            taskType: selectedTask.category,
            c: selectedTask.collaborators || '',
            a: selectedTask.approver_id || currentUser?.id,
            r: selectedTask.assignee_id || selectedTask.creator_id,
            i: '',
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

      {/* Apply for New Task Modal (Same as Personal Goals) */}
      <SmartTaskModal
        isOpen={isApplyModalOpen}
        onClose={() => setIsApplyModalOpen(false)}
        onSubmit={handleApplyTask}
        submitting={submitting}
        title="申请新任务"
        type="personal"
        users={subordinates.map(s => ({ id: s.id, name: s.name }))}
        onDraft={async (data) => {
          setSubmitting(true);
          try {
            const token = localStorage.getItem('token');
            const targetValue = `S: ${data.s}\nM: ${data.m}\nT: ${data.t}`;
            const approverId = currentUser?.role === 'employee' ? 'zhangwei' : 'lifang';
            const res = await fetch('/api/perf/plans', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({
                title: data.summary || '草稿目标',
                description: encodeSmartDescription(data.a_smart, data.r_smart, {
                  plan: data.planTime, do: data.doTime, check: data.checkTime, act: data.actTime
                }),
                category: data.taskType || '常规任务',
                target_value: targetValue,
                deadline: data.t,
                collaborators: [data.c, data.i].filter(Boolean).join(','),
                assignee_id: data.r || currentUser?.id,
                quarter: data.quarter || undefined,
                creator_id: currentUser?.id,
                approver_id: data.a || approverId
              })
            });
            if (res.status === 401) { alert('登录已过期'); window.location.reload(); return; }
            const json = await res.json();
            if (json.code === 0) {
              alert('草稿已保存');
              setIsApplyModalOpen(false);
              fetchTeamStatus();
            } else { alert(json.message || '保存失败'); }
          } catch { alert('网络异常'); } finally { setSubmitting(false); }
        }}
        initialData={{
          summary: '',
          s: '',
          m: '',
          a_smart: '',
          r_smart: '',
          t: '',
          taskType: '重点项目',
          r: currentUser?.id
        }}
      />

      {/* ── TeamScope Modal ── */}
      {isScopeModalOpen && (
        <TeamScopeModal onClose={() => setIsScopeModalOpen(false)} />
      )}
    </div>
  );
}

// ── 内嵌团队可视范围配置浮层 ─────────────────────────────────────────────
function TeamScopeModal({ onClose }: { onClose: () => void }) {
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [allConfigs, setAllConfigs] = useState<any[]>([]);
  const [selectedMgr, setSelectedMgr] = useState<any | null>(null);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [hasOverride, setHasOverride] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [searchMgr, setSearchMgr] = useState('');
  const [searchMember, setSearchMember] = useState('');

  const fetchAllUsers = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/org/users', { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    if (json.code === 0) setAllUsers(json.data || []);
  };

  const fetchAllConfigs = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/team-scope', { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    if (json.code === 0) setAllConfigs(json.data || []);
  };

  useEffect(() => { fetchAllUsers(); fetchAllConfigs(); }, []);

  const selectManager = async (user: any) => {
    setSelectedMgr(user);
    setMsg('');
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/team-scope/${user.id}`, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    if (json.code === 0) {
      setSelectedMemberIds(json.data.member_ids || []);
      setHasOverride(json.data.has_override);
    }
  };

  const toggleMember = (id: string) =>
    setSelectedMemberIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggleAll = () => {
    const filtered = allUsers.filter(u => u.name.includes(searchMember));
    const allSel = filtered.every(u => selectedMemberIds.includes(u.id));
    if (allSel) setSelectedMemberIds(prev => prev.filter(id => !filtered.some(u => u.id === id)));
    else setSelectedMemberIds(prev => [...prev, ...filtered.map(u => u.id).filter(id => !prev.includes(id))]);
  };

  const handleSave = async () => {
    if (!selectedMgr) return;
    setSaving(true); setMsg('');
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/team-scope/${selectedMgr.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ member_ids: selectedMemberIds }),
    });
    const json = await res.json();
    setMsg(json.code === 0 ? `✅ ${json.message}` : `❌ ${json.message}`);
    if (json.code === 0) { setHasOverride(selectedMemberIds.length > 0); fetchAllConfigs(); }
    setSaving(false);
    setTimeout(() => setMsg(''), 4000);
  };

  const handleClear = async () => {
    if (!selectedMgr || !window.confirm(`确定清除「${selectedMgr.name}」的自定义团队范围？将恢复按部门归属显示。`)) return;
    setSaving(true);
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/team-scope/${selectedMgr.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    setMsg(json.code === 0 ? `✅ ${json.message}` : `❌ ${json.message}`);
    if (json.code === 0) { setSelectedMemberIds([]); setHasOverride(false); fetchAllConfigs(); }
    setSaving(false);
    setTimeout(() => setMsg(''), 4000);
  };

  const filteredMgrs = allUsers.filter(u => u.name.includes(searchMgr));
  const filteredMembers = allUsers.filter(u => u.name.includes(searchMember));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col overflow-hidden animate-[fadeIn_0.2s_ease]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-indigo-600 text-[18px]">manage_accounts</span>
            </span>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">团队可视范围</h3>
              <p className="text-[11px] text-slate-400">为指定人员自定义「团队绩效追踪」页面的可见成员范围，不影响其他任何权限</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col p-5 gap-4 min-h-0">
          {/* 已配置人员快捷标签 */}
          {allConfigs.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {allConfigs.map((cfg: any) => (
                <button
                  key={cfg.manager_id}
                  onClick={() => selectManager({ id: cfg.manager_id, name: cfg.manager_name })}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all ${
                    selectedMgr?.id === cfg.manager_id
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                  }`}
                >
                  {cfg.manager_name} <span className="opacity-60">({cfg.member_count}人)</span>
                </button>
              ))}
            </div>
          )}

          {/* Two-panel */}
          <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
            {/* Left: select configuree */}
            <div className="border border-slate-200 rounded-xl flex flex-col overflow-hidden">
              <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[13px] text-slate-400">person_search</span>
                <span className="text-[11px] font-bold text-slate-600">选择被配置人</span>
              </div>
              <div className="p-2.5 flex flex-col gap-2 flex-1 min-h-0">
                <input type="text" placeholder="搜索姓名..." className="w-full text-[11px] border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200" value={searchMgr} onChange={e => setSearchMgr(e.target.value)} />
                <div className="space-y-0.5 overflow-y-auto flex-1">
                  {filteredMgrs.map(u => (
                    <button key={u.id} onClick={() => selectManager(u)} className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-[11px] transition-all ${selectedMgr?.id === u.id ? 'bg-indigo-600 text-white' : 'hover:bg-slate-50 text-slate-700'}`}>
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[9px] flex-shrink-0 ${selectedMgr?.id === u.id ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-600'}`}>{u.name[0]}</span>
                      <span className="font-medium truncate">{u.name}</span>
                      {allConfigs.some((c: any) => c.manager_id === u.id) && (
                        <span className={`ml-auto text-[9px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0 ${selectedMgr?.id === u.id ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-600'}`}>已配置</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: choose visible members */}
            <div className="border border-slate-200 rounded-xl flex flex-col overflow-hidden">
              <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[13px] text-slate-400">group</span>
                  <span className="text-[11px] font-bold text-slate-600">{selectedMgr ? `${selectedMgr.name} 的可见范围` : '请先选择被配置人'}</span>
                </div>
                {selectedMgr && <button onClick={toggleAll} className="text-[10px] text-indigo-600 font-bold hover:underline">{filteredMembers.every(u => selectedMemberIds.includes(u.id)) ? '取消全选' : '全选'}</button>}
              </div>
              <div className="p-2.5 flex flex-col gap-2 flex-1 min-h-0">
                {selectedMgr ? (
                  <>
                    <input type="text" placeholder="搜索成员..." className="w-full text-[11px] border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200" value={searchMember} onChange={e => setSearchMember(e.target.value)} />
                    <div className="space-y-0.5 overflow-y-auto flex-1">
                      {filteredMembers.map(u => {
                        const checked = selectedMemberIds.includes(u.id);
                        return (
                          <label key={u.id} className={`flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer text-[11px] transition-all ${checked ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-slate-50 border border-transparent'}`}>
                            <input type="checkbox" checked={checked} onChange={() => toggleMember(u.id)} className="accent-indigo-600 w-3.5 h-3.5 flex-shrink-0" />
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[8px] flex-shrink-0 ${checked ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>{u.name[0]}</span>
                            <span className={`font-medium truncate ${checked ? 'text-indigo-700' : 'text-slate-700'}`}>{u.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center flex-1 text-slate-300">
                    <span className="material-symbols-outlined text-4xl mb-2">arrow_back</span>
                    <p className="text-[11px]">请在左侧选择需要配置的人员</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          {selectedMgr && (
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className={`text-[11px] font-medium ${hasOverride ? 'text-amber-600' : 'text-slate-400'}`}>
                {hasOverride ? `⚡ 已有自定义配置 · 已选 ${selectedMemberIds.length} 人` : `已选 ${selectedMemberIds.length} 人 · 未配置时按部门归属显示`}
              </span>
              <div className="flex gap-2">
                {hasOverride && (
                  <button onClick={handleClear} disabled={saving} className="px-3 py-1.5 text-[11px] text-red-500 border border-red-200 rounded-lg hover:bg-red-50 font-bold">清除配置</button>
                )}
                <button onClick={handleSave} disabled={saving || selectedMemberIds.length === 0} className="px-4 py-1.5 text-[11px] bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold disabled:opacity-40">
                  {saving ? '保存中...' : '保存配置'}
                </button>
              </div>
            </div>
          )}

          {msg && (
            <div className={`text-[11px] px-3 py-2 rounded-lg font-medium ${msg.startsWith('✅') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{msg}</div>
          )}
        </div>
      </div>
    </div>
  );
}

