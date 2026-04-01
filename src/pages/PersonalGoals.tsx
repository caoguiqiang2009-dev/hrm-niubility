import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import SmartFormInputs, { SmartData, encodeSmartDescription, decodeSmartDescription } from '../components/SmartFormInputs';
import { SmartGoalDisplayFromPlan } from '../components/SmartGoalDisplay';
import SmartTaskModal, { SmartTaskData } from '../components/SmartTaskModal';
import { useIsMobile } from '../hooks/useIsMobile';

interface PerfPlan {
  id: number | string;
  title: string;
  description: string;
  category: string;
  status: string;
  progress: number;
  target_value: string;
  deadline: string;
  quarter: string;
  collaborators?: string;
  creator_id: string;
  assignee_id: string;
}

const statusMap: Record<string, { label: string, color: string, bg: string }> = {
  draft: { label: '草稿', color: 'text-slate-500', bg: 'bg-slate-100' },
  pending_review: { label: '待审批', color: 'text-amber-600', bg: 'bg-amber-100' },
  in_progress: { label: '进行中', color: 'text-primary', bg: 'bg-blue-100' },
  completed: { label: '待考核', color: 'text-purple-600', bg: 'bg-purple-100' },
  approved: { label: '已归档', color: 'text-emerald-600', bg: 'bg-emerald-100' },
  rejected: { label: '被驳回', color: 'text-error', bg: 'bg-red-100' },
  returned: { label: '已退回', color: 'text-orange-600', bg: 'bg-orange-100' },
};


export default function PersonalGoals({ navigate }: { navigate: (view: string) => void }) {

  const { currentUser } = useAuth();
  const isMobile = useIsMobile();
  const [plans, setPlans] = useState<PerfPlan[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [users, setUsers] = useState<{id: string, name: string}[]>([]);
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
  const [myManagerId, setMyManagerId] = useState<string>('');
  // 二次编辑被驳回的目标
  const [editingPlan, setEditingPlan] = useState<PerfPlan | null>(null);
  const [editForm, setEditForm] = useState<SmartData>({ title: '', target_value: '', resource: '', relevance: '', deadline: '', category: '业务', collaborators: '' });
  const [resubmitting, setResubmitting] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PerfPlan | null>(null);


  useEffect(() => {
    if (currentUser?.id) {
      fetchPlans();
      fetchUsers();
      fetchMyManager();
    }
  }, [currentUser]);

  /** 从组织架构获取直属上级（部门负责人），若无则尝试取 HR 兜底 */
  const fetchMyManager = async () => {
    try {
      const token = localStorage.getItem('token');
      // Step 1: 获取当前用户的部门 ID
      const meRes = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
      const meData = await meRes.json();
      const deptId = meData?.data?.department_id;
      if (deptId) {
        // Step 2: 获取部门 leader
        const deptRes = await fetch(`/api/org/departments/${deptId}`, { headers: { Authorization: `Bearer ${token}` } });
        const deptData = await deptRes.json();
        const leaderId = deptData?.data?.leader_user_id;
        if (leaderId && leaderId !== currentUser?.id) {
          setMyManagerId(leaderId);
          return;
        }
      }
      // Step 3: 兜底 — 取任意 HR 或管理员
      const usersRes = await fetch('/api/org/users', { headers: { Authorization: `Bearer ${token}` } });
      const usersData = await usersRes.json();
      const hrUser = (usersData?.data || []).find((u: any) => u.role === 'hr' || u.role === 'admin');
      if (hrUser) setMyManagerId(hrUser.id);
    } catch {}
  };

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/org/users', { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (data.code === 0) {
        setUsers(data.data.map((u: any) => ({ id: u.id, name: u.name })));
      }
    } catch (err) {}
  };

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

  const handleCreatePlanSmart = async (data: SmartTaskData) => {
    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      // 1. 创建草稿
      const approverId = myManagerId || currentUser?.id || '';
      const targetValue = `S: ${data.s}\nM: ${data.m}\nT: ${data.t}`;
      const createRes = await fetch('/api/perf/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          title: data.summary || '新目标',
          description: encodeSmartDescription(data.a_smart, data.r_smart, {
            plan: data.planTime, do: data.doTime, check: data.checkTime, act: data.actTime
          }),
          category: data.taskType || '常规任务',
          target_value: targetValue,
          deadline: data.t,
          collaborators: [data.c, data.i].filter(Boolean).join(','),
          assignee_id: data.r,
          approver_id: data.a,
          creator_id: currentUser?.id
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
        fetchPlans();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const submitProgress = async (id: number | string, progress: number) => {
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

  // 重新提交被驳回/草稿的任务
  const handleResubmitSmart = async (data: SmartTaskData) => {
    if (!editingPlan) return;
    setResubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const targetValue = `S: ${data.s}\nM: ${data.m}\nT: ${data.t}`;
      const body = {
        title: data.summary || editingPlan.title,
        description: encodeSmartDescription(data.a_smart, data.r_smart, {
          plan: data.planTime, do: data.doTime, check: data.checkTime, act: data.actTime
        }),
        category: data.taskType || editingPlan.category,
        target_value: targetValue,
        deadline: data.t,
        collaborators: [data.c, data.i].filter(Boolean).join(','),
        assignee_id: data.r,
        approver_id: data.a,
        creator_id: currentUser?.id,
      };

      if (editingPlan.status === 'draft') {
        // 草稿：先更新内容，再提交审批
        await fetch(`/api/perf/plans/${editingPlan.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        await fetch(`/api/perf/plans/${editingPlan.id}/submit`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } else {
        // 被驳回：走 resubmit 接口
        await fetch(`/api/perf/plans/${editingPlan.id}/resubmit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(body),
        });
      }
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
      <main className={`flex-1 h-[calc(100vh-4rem)] mt-16 overflow-y-auto ${isMobile ? 'pb-20' : ''}`}>
        <div className={isMobile ? 'p-4' : 'p-8'}>
          {/* Header Section */}
          <div className={`flex flex-col justify-between mb-6 gap-4 ${isMobile ? '' : 'md:flex-row md:items-end mb-10 gap-6'}`}>
            <div>
              {!isMobile && (
              <nav className="flex text-xs font-label text-outline mb-2 space-x-2">
                <span>主页</span>
                <span>/</span>
                <span className="text-primary font-medium">目标管理</span>
              </nav>
              )}
              <h1 className={`font-extrabold tracking-tight text-on-surface ${isMobile ? 'text-xl' : 'text-4xl'}`}>个人目标管理</h1>
              <p className={`text-on-surface-variant mt-1 ${isMobile ? 'text-xs' : 'mt-2 max-w-2xl'}`}>
                本季度您已达标 {overallProgress}%
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setIsModalOpen(true)} className={`primary-gradient text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-primary/30 active:scale-95 transition-all ${isMobile ? 'px-4 py-2 text-sm w-full justify-center' : 'px-6 py-2.5'}`}>
                <span className="material-symbols-outlined">add</span>
                <span>申请新目标</span>
              </button>
            </div>
          </div>

          {/* Three Category Progress Bars */}
          {(() => {
            // 分类：季度 / 月度 / 专项
            const quarterly = plans.filter(p => p.quarter?.includes('Q') && !p.category?.includes('专项') && !p.category?.includes('公坚'));
            const monthly = plans.filter(p => (!p.quarter || p.quarter.includes('-')) && !p.category?.includes('专项') && !p.category?.includes('公坚'));
            const special = plans.filter(p => p.category?.includes('专项') || p.category?.includes('公坚'));
            const calcPct = (arr: typeof plans) => arr.length > 0 ? Math.round(arr.reduce((a, p) => a + (p.progress || 0), 0) / arr.length) : 0;
            const bars = [
              { label: '季度任务', pct: calcPct(quarterly), count: quarterly.length, icon: 'calendar_month', gradient: 'from-[#0060a9] to-[#409eff]' },
              { label: '月度任务', pct: calcPct(monthly), count: monthly.length, icon: 'event_note', gradient: 'from-[#7c3aed] to-[#a78bfa]' },
              { label: '专项任务', pct: calcPct(special), count: special.length, icon: 'star', gradient: 'from-[#d97706] to-[#fbbf24]' },
            ];
            return (
              <div className={`grid gap-3 mb-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-3'}`}>
                {bars.map(b => (
                  <div key={b.label} className={`bg-gradient-to-br ${b.gradient} px-4 py-3 rounded-xl text-white relative overflow-hidden shadow-md h-[100px] flex flex-col justify-between`}>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-white/60 text-[16px]">{b.icon}</span>
                      <span className="text-white/90 text-[11px] font-bold">{b.label}</span>
                      <span className="text-white/60 text-[10px] ml-auto">{b.count} 项</span>
                    </div>
                    <div>
                      <div className="flex items-baseline mb-1">
                        <h3 className="text-2xl font-black tracking-tighter leading-none">{b.pct}%</h3>
                      </div>
                      <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden mt-1">
                        <div className="h-full bg-white/90 rounded-full transition-all duration-500" style={{ width: `${b.pct}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* ── Kanban Board ─────────────────────────────────────────── */}
          <div className="mb-3 flex justify-end">
            <button onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1.5 text-xs font-bold text-primary hover:bg-primary-container/20 px-3 py-1.5 rounded-xl transition-colors border border-primary/20">
              <span className="material-symbols-outlined text-[14px]">add</span>申请新任务
            </button>
          </div>

          {/* Horizontal scroll kanban — stacks vertically on mobile */}
          <div className={isMobile ? 'space-y-4' : 'flex gap-4 overflow-x-auto pb-4'}>
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
                  className={`flex flex-col rounded-2xl overflow-hidden shadow-sm bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 ${isMobile ? 'w-full' : col.wide ? 'flex-none w-[560px]' : 'flex-none w-72'}`}>
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
                  <div className={`flex-1 overflow-y-auto p-3 space-y-3 ${isMobile ? 'h-auto' : 'h-[350px]'}`}>
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
                              <div className={`w-full rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 ${isMobile ? 'h-5' : 'h-3'}`}>
                                <div data-pct-bar={plan.id} className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                              </div>
                              {plan.status === 'in_progress' && !(plan as any).is_pool && (
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
      <SmartTaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreatePlanSmart}
        title="申请新任务"
        type="personal"
        users={users}
        submitting={submitting}
        onDraft={async (data) => {
          setSubmitting(true);
          try {
            const token = localStorage.getItem('token');
            const approverId = myManagerId || currentUser?.id || '';
            const targetValue = `S: ${data.s}\nM: ${data.m}\nT: ${data.t}`;
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
                assignee_id: data.r,
                approver_id: data.a,
                creator_id: currentUser?.id,
              })
            });
            const json = await res.json();
            if (json.code === 0) {
              alert('草稿已保存');
              setIsModalOpen(false);
              fetchPlans();
            } else { alert(json.message || '保存失败'); }
          } catch { alert('保存失败'); } finally { setSubmitting(false); }
        }}
        initialData={{
          summary: '',
          s: '',
          m: '',
          a_smart: '',
          r_smart: '',
          t: '',
          r: currentUser?.id || '',
          a: currentUser?.role === 'employee' ? 'zhangwei' : 'lifang',
          c: '',
          i: ''
        }}
      />

      {/* 驳回/草稿 二次编辑弹窗 */}
      <SmartTaskModal
        isOpen={!!editingPlan}
        onClose={() => setEditingPlan(null)}
        onDelete={async () => {
          try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/perf/plans/${editingPlan?.id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` }
            });
            const json = await res.json();
            if (json.success || json.code === 0) {
              setEditingPlan(null);
              fetchPlans();
            } else {
              alert(json.message || '删除失败');
            }
          } catch { alert('网络错误'); }
        }}
        onSubmit={handleResubmitSmart}
        title={editingPlan?.status === 'draft' ? '编辑草稿并提交' : '修改并重新提交'}
        type="personal"
        users={users}
        submitting={resubmitting}
        onDraft={async (data) => {
          try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/perf/plans/${editingPlan?.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({
                title: data.summary || editingPlan?.title,
                description: encodeSmartDescription(data.a_smart, data.r_smart, {
                  plan: data.planTime, do: data.doTime, check: data.checkTime, act: data.actTime
                }),
                category: data.taskType || editingPlan?.category,
                target_value: `S: ${data.s}\nM: ${data.m}\nT: ${data.t}`,
                deadline: data.t,
                collaborators: data.c,
                attachments: data.attachments || [],
              })
            });
            const json = await res.json();
            if (json.code === 0) {
              alert('草稿已保存');
              setEditingPlan(null);
              fetchPlans();
            } else { alert(json.message || '保存失败'); }
          } catch { alert('保存失败'); }
        }}
        initialData={(() => {
          if (!editingPlan) return {};
          const decoded = decodeSmartDescription(editingPlan.description || '');
          // Safely parse attachments
          let parsedAttachments: any[] = [];
          try {
            if (Array.isArray((editingPlan as any).attachments)) {
              parsedAttachments = (editingPlan as any).attachments;
            } else if (typeof (editingPlan as any).attachments === 'string' && (editingPlan as any).attachments) {
              parsedAttachments = JSON.parse((editingPlan as any).attachments);
            }
          } catch { parsedAttachments = []; }
          return {
            summary: editingPlan.title,
            s: editingPlan.target_value ? String(editingPlan.target_value).split('\n')[0]?.replace('S: ', '') : '',
            m: editingPlan.target_value ? String(editingPlan.target_value).split('\n')[1]?.replace('M: ', '') : '',
            t: editingPlan.deadline || (editingPlan.target_value ? String(editingPlan.target_value).split('\n')[2]?.replace('T: ', '') : '') || '',
            a_smart: decoded.resource,
            r_smart: decoded.relevance,
            taskType: editingPlan.category,
            c: editingPlan.collaborators || '',
            i: '',
            a: (editingPlan as any).approver_id,
            r: editingPlan.assignee_id || editingPlan.creator_id,
            planTime: decoded.planTime,
            doTime: decoded.doTime,
            checkTime: decoded.checkTime,
            actTime: decoded.actTime,
            attachments: parsedAttachments
          };
        })()}
      />

      {/* ── Plan Detail Modal (Readonly SmartTaskModal) ─────────────────────────────────────── */}
      <SmartTaskModal
        isOpen={!!selectedPlan}
        onClose={() => setSelectedPlan(null)}
        onSubmit={() => {}}
        title="目标详情"
        type="personal"
        users={users}
        readonly={true}
        initialData={(() => {
          if (!selectedPlan) return {};
          const decoded = decodeSmartDescription(selectedPlan.description || '');
          // Safely parse attachments
          let parsedAttachments: any[] = [];
          try {
            if (Array.isArray((selectedPlan as any).attachments)) {
              parsedAttachments = (selectedPlan as any).attachments;
            } else if (typeof (selectedPlan as any).attachments === 'string' && (selectedPlan as any).attachments) {
              parsedAttachments = JSON.parse((selectedPlan as any).attachments);
            }
          } catch { parsedAttachments = []; }
          return {
            id: selectedPlan.id,
            status: selectedPlan.status,
            flow_type: 'perf_plan',
            summary: selectedPlan.title,
            s: selectedPlan.target_value ? String(selectedPlan.target_value).split('\n')[0]?.replace('S: ', '') : '',
            m: selectedPlan.target_value ? String(selectedPlan.target_value).split('\n')[1]?.replace('M: ', '') : '',
            t: selectedPlan.deadline || (selectedPlan.target_value ? String(selectedPlan.target_value).split('\n')[2]?.replace('T: ', '') : '') || '',
            a_smart: decoded.resource,
            r_smart: decoded.relevance,
            taskType: selectedPlan.category,
            c: selectedPlan.collaborators || '',
            a: (selectedPlan as any).approver_id,
            r: selectedPlan.assignee_id || selectedPlan.creator_id,
            i: '',
            planTime: decoded.planTime,
            doTime: decoded.doTime,
            checkTime: decoded.checkTime,
            actTime: decoded.actTime,
            approver_id: (selectedPlan as any).approver_id,
            creator_id: selectedPlan.creator_id,
            assignee_id: selectedPlan.assignee_id,
            attachments: parsedAttachments
          };
        })()}
        customFooter={(() => {
          if (!selectedPlan) return null;
          const sp = selectedPlan;
          const pct = sp.progress || 0;
          const isAssigned = sp.creator_id !== sp.assignee_id; // 上级下发的任务
          const accentColor = {
            in_progress: '#3b82f6', pending_review: '#f59e0b', completed: '#8b5cf6',
            approved: '#10b981', rejected: '#ef4444', draft: '#94a3b8', returned: '#f97316',
          }[sp.status] || '#94a3b8';

          // 退回操作
          const handleReturn = async () => {
            const reason = prompt('请输入退回原因（可选）：');
            if (reason === null) return; // 用户取消
            try {
              const token = localStorage.getItem('token');
              const res = await fetch(`/api/perf/plans/${sp.id}/return`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ reason: reason || '经线下沟通，退回调整' })
              });
              const data = await res.json();
              if (data.code === 0) {
                setSelectedPlan(null);
                fetchPlans();
              } else { alert(data.message || '退回失败'); }
            } catch { alert('操作失败'); }
          };

          // 删除草稿
          const handleDeleteDraft = async () => {
            if (!confirm('确定删除这个草稿吗？此操作不可恢复。')) return;
            try {
              const token = localStorage.getItem('token');
              const res = await fetch(`/api/perf/plans/${sp.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
              });
              const data = await res.json();
              if (data.code === 0) {
                setSelectedPlan(null);
                fetchPlans();
              } else { alert(data.message || '删除失败'); }
            } catch { alert('操作失败'); }
          };

          // 提交草稿
          const handleSubmitDraft = async () => {
            try {
              const token = localStorage.getItem('token');
              const res = await fetch(`/api/perf/plans/${sp.id}/submit`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
              });
              const data = await res.json();
              if (data.code === 0) {
                setSelectedPlan(null);
                fetchPlans();
              } else { alert(data.message || '提交失败'); }
            } catch { alert('操作失败'); }
          };
          
          return (
            <div className="w-full flex items-end justify-between gap-4">
              {/* 进度条区域 */}
              <div className="flex-1 max-w-md bg-slate-50 dark:bg-slate-800/40 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">trending_up</span>当前进度
                  </span>
                  <span className="text-lg font-black" style={{ color: accentColor }}>
                    <span data-pct-label={`modal-${sp.id}`}>{pct}</span>%
                  </span>
                </div>
                <div className="relative">
                  <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div data-pct-bar={`modal-${sp.id}`} className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: accentColor }} />
                  </div>
                  {sp.status === 'in_progress' && !(sp as any).is_pool && (
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
              </div>
              {/* 操作按钮区域 */}
              <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                {/* 草稿：编辑 + 提交 + 删除 */}
                {sp.status === 'draft' && (
                  <>
                    <button onClick={handleDeleteDraft}
                      className="flex items-center gap-1.5 px-4 py-2.5 text-red-500 bg-red-50 text-sm font-bold rounded-lg border border-red-200 hover:bg-red-100 transition-colors">
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                      删除
                    </button>
                    <button onClick={() => { setSelectedPlan(null); handleOpenEdit(sp); }}
                      className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-50 text-blue-600 text-sm font-bold rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors">
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                      编辑
                    </button>
                    <button onClick={handleSubmitDraft}
                      className="flex items-center gap-1.5 px-5 py-2.5 bg-[#005ea4] text-white text-sm font-bold rounded-lg hover:bg-[#004d87] transition-colors shadow-sm">
                      <span className="material-symbols-outlined text-[16px]">send</span>
                      提交审批
                    </button>
                  </>
                )}
                {/* 被驳回：修改后重新提交 */}
                {sp.status === 'rejected' && (
                  <button onClick={() => { setSelectedPlan(null); handleOpenEdit(sp); }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-amber-50 text-amber-600 text-sm font-bold rounded-lg border border-amber-200 hover:bg-amber-100 transition-colors">
                    <span className="material-symbols-outlined text-[16px]">edit_note</span>
                    修改后重新提交
                  </button>
                )}
                {/* 进行中 + 上级下发 + 非只读：退回按钮 */}
                {sp.status === 'in_progress' && isAssigned && !(sp as any).is_pool && (
                  <button onClick={handleReturn}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-orange-50 text-orange-600 text-sm font-bold rounded-lg border border-orange-200 hover:bg-orange-100 transition-colors">
                    <span className="material-symbols-outlined text-[16px]">reply</span>
                    退回
                  </button>
                )}
                {/* 发起验收总结 (仅限 A 或 管理员) */}
                {sp.status === 'in_progress' && (currentUser?.id === (sp as any).approver_id || currentUser?.role === 'admin' || currentUser?.role === 'gm') && (
                  <button onClick={async () => {
                    if (!confirm('确定发起验收总结吗？发起后将流转至上级进行最终评级结案。')) return;
                    try {
                      const res = await fetch(`/api/perf/plans/${sp.id}/review`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                        body: JSON.stringify({ action: 'assess' })
                      });
                      const data = await res.json();
                      if (data.code === 0) {
                        alert('已发起验收流程，等待评级考评。');
                        setSelectedPlan(null);
                        fetchPlans();
                      } else { alert(data.message || '操作失败'); }
                    } catch { alert('网络异常'); }
                  }}
                    className="flex items-center gap-1.5 px-5 py-2.5 bg-purple-600 text-white text-sm font-bold rounded-lg hover:bg-purple-700 transition-colors shadow-sm">
                    <span className="material-symbols-outlined text-[16px]">how_to_reg</span>
                    提交验收总结
                  </button>
                )}
                <button onClick={() => setSelectedPlan(null)}
                  className="px-6 py-2.5 bg-slate-100 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-200 transition-colors">
                  关闭
                </button>
              </div>
            </div>
          );
        })()}
      />

    </div>
  );
}
