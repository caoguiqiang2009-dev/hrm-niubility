import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import PersonalGoalsPanel from '../components/PersonalGoalsPanel';
import { useIsMobile } from '../hooks/useIsMobile';

/* ─── Types ─────────────────────────────────────────────────── */
interface Task { id: number; title: string; description: string; due_date: string; priority: string; status: string; type?: string; }
interface ModuleProps { navigate: (v: string) => void; data: DashData; actions: DashActions; }

interface DashData {
  pendingWorkflows: number; unreadCount: number; myPlans: any[]; recentNotifs: any[];
  myProposals: any[]; tasks: Task[]; pendingTasks: Task[]; completedTasks: Task[];
  totalPlansCount: number;
}
interface DashActions {
  toggleTask: (t: Task) => void;
  openTaskModal: () => void;
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: '草稿', color: 'text-slate-500', bg: 'bg-slate-100' },
  submitted: { label: '审批中', color: 'text-blue-600', bg: 'bg-blue-50' },
  approved: { label: '已通过', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  rejected: { label: '已驳回', color: 'text-red-500', bg: 'bg-red-50' },
  assessed: { label: '已评分', color: 'text-purple-600', bg: 'bg-purple-50' },
  pending_hr: { label: '待人事审核', color: 'text-amber-600', bg: 'bg-amber-50' },
  pending_admin: { label: '待总经理复核', color: 'text-orange-600', bg: 'bg-orange-50' },
};

function fmtDate(d: string) {
  if (!d) return '';
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '刚刚'; if (m < 60) return `${m}分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}小时前`;
  return `${Math.floor(h / 24)}天前`;
}

/* ─── Module Card Wrapper (with drag handle) ─────────────── */
function ModCard({ children, className = '', dragHandleProps, isEditing, onRemove }: {
  children: React.ReactNode; className?: string;
  dragHandleProps?: any; isEditing?: boolean; onRemove?: () => void;
}) {
  return (
    <div className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 p-5 relative group/card ${className}`}>
      {isEditing && (
        <>
          <div {...dragHandleProps}
            className="absolute -top-1 left-1/2 -translate-x-1/2 w-12 h-5 flex items-center justify-center cursor-grab active:cursor-grabbing z-10 rounded-b-lg bg-blue-50 dark:bg-blue-900/30 opacity-0 group-hover/card:opacity-100 transition-opacity">
            <span className="material-symbols-outlined text-blue-400 text-[14px]">drag_indicator</span>
          </div>
          <button onClick={onRemove}
            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-[12px] hover:bg-red-600 shadow-md z-10 opacity-0 group-hover/card:opacity-100 transition-opacity">
            <span className="material-symbols-outlined text-[14px]">close</span>
          </button>
        </>
      )}
      {children}
    </div>
  );
}

function ModHeader({ icon, color, title, badge, action }: {
  icon: string; color: string; title: string; badge?: number; action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
        <span className={`material-symbols-outlined text-[16px] ${color}`} style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
        {title}
        {badge != null && badge > 0 && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold">{badge}</span>}
      </h3>
      {action}
    </div>
  );
}

/* ================================================================
   模块组件
   ================================================================ */

/* ─── 模块: 我的流程 ──────────────────────────────────────── */
function WorkflowsModule({ navigate }: ModuleProps) {
  const { currentUser } = useAuth();
  const [tab, setTab] = useState<'initiated' | 'pending' | 'reviewed' | 'cc'>(currentUser?.role === 'employee' ? 'initiated' : 'pending');
  const [items, setItems] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const token = localStorage.getItem('token');
  const hdr = { Authorization: `Bearer ${token}` };

  useEffect(() => { fetchAll(); }, []);
  useEffect(() => { fetchTab(); }, [tab]);

  const fetchAll = async () => {
    try {
      const tabs = ['initiated', 'pending', 'reviewed', 'cc'] as const;
      const results = await Promise.all(
        tabs.map(t => fetch(`/api/workflows/${t}`, { headers: hdr }).then(r => r.json()).catch(() => ({ data: [] })))
      );
      const c: Record<string, number> = {};
      tabs.forEach((t, i) => { c[t] = results[i]?.data?.length || 0; });
      setCounts(c);
      const defaultTabIdx = currentUser?.role === 'employee' ? 0 : 1;
      setItems(results[defaultTabIdx]?.data?.slice(0, 5) || []);
    } catch {}
  };

  const fetchTab = async () => {
    try {
      const r = await fetch(`/api/workflows/${tab}`, { headers: hdr });
      const j = await r.json();
      setItems((j?.data || []).slice(0, 5));
    } catch {}
  };

  const TABS = [
    { key: 'initiated' as const, label: '我发起的', icon: 'send' },
    { key: 'pending' as const, label: '待我审核', icon: 'pending_actions' },
    { key: 'reviewed' as const, label: '我已审核', icon: 'task_alt' },
    { key: 'cc' as const, label: '抄送我的', icon: 'forward_to_inbox' },
  ];

  return (
    <>
      <ModHeader icon="assignment" color="text-blue-500" title="我的流程" badge={counts.pending || 0}
        action={<button onClick={() => navigate(`workflows?tab=${tab}`)} className="text-[10px] font-bold text-blue-500 hover:text-blue-700">查看全部 →</button>} />
      <div className="flex gap-1 mb-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-1">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
              tab === t.key ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
            }`}>
            <span className="material-symbols-outlined text-[12px]">{t.icon}</span>
            {t.label}
            {(counts[t.key] || 0) > 0 && <span className={`text-[8px] px-1 py-px rounded-full font-black ${
              tab === t.key ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500'
            }`}>{counts[t.key]}</span>}
          </button>
        ))}
      </div>
      <div className="space-y-2 max-h-[240px] overflow-y-auto">
        {items.length === 0 ? <div className="text-center py-6 text-slate-400 text-xs">暂无流程</div> :
          items.map((w: any) => {
            const s = STATUS_MAP[w.status] || STATUS_MAP[w.proposal_status] || { label: w.status, color: 'text-slate-500', bg: 'bg-slate-100' };
            return (
              <div key={`${w.type}-${w.id}`} onClick={() => navigate(`workflows?tab=${tab}`)}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-all">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${w.type === 'proposal' ? 'bg-purple-50' : 'bg-blue-50'}`}>
                  <span className={`material-symbols-outlined text-[14px] ${w.type === 'proposal' ? 'text-purple-500' : 'text-blue-500'}`}>
                    {w.type === 'proposal' ? 'lightbulb' : 'trending_up'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{w.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${s.color} ${s.bg}`}>{s.label}</span>
                    {w.created_at && <span className="text-[9px] text-slate-400">{fmtDate(w.created_at)}</span>}
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </>
  );
}

/* ─── 模块: 待办事项 ──────────────────────────────────────── */
function TodoModule({ navigate, data, actions }: ModuleProps) {
  const { tasks, pendingTasks } = data;
  return (
    <>
      <ModHeader icon="checklist" color="text-amber-500" title="待办事项" badge={pendingTasks.length}
        action={<button onClick={actions.openTaskModal} className="text-[10px] font-bold text-blue-500 hover:text-blue-700 flex items-center gap-0.5">
          <span className="material-symbols-outlined text-[14px]">add</span>新建</button>} />
      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
        {tasks.length === 0 ? <div className="text-center py-6 text-slate-400 text-xs">暂无待办事项 🎉</div> :
          tasks.map(t => {
            const done = t.status === 'completed';
            const isTest = t.type === 'test_assignment';
            const isEval = t.type === 'monthly_eval';
            const isSystemTask = isTest || isEval;
            return (
              <div key={t.id} onClick={() => { 
                if (isTest) navigate(`competency?testId=${t.id}`); 
                else if (isEval) navigate('monthly-eval');
              }} className={`flex items-start gap-3 p-3 rounded-xl transition-all ${done ? 'opacity-50' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'} ${isSystemTask ? 'cursor-pointer' : ''}`}>
                {isSystemTask ? (
                  <div className={`mt-0.5 w-4 h-4 flex items-center justify-center ${isEval ? 'text-rose-500' : 'text-indigo-500'}`}>
                    <span className="material-symbols-outlined text-[16px]">{isEval ? 'rate_review' : 'assignment'}</span>
                  </div>
                ) : (
                  <input type="checkbox" checked={done} onChange={() => actions.toggleTask(t)} className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-500 cursor-pointer" />
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold ${done ? 'line-through text-slate-400' : isEval ? 'text-rose-600 dark:text-rose-400' : isTest ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-800 dark:text-white'}`}>{t.title}</p>
                  {t.due_date && <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1"><span className="material-symbols-outlined text-[11px]">schedule</span>{new Date(t.due_date).toLocaleDateString()}</p>}
                </div>
                {!done && t.priority === 'high' && <span className="text-[9px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full font-bold">紧急</span>}
              </div>
            );
          })}
      </div>
    </>
  );
}

/* ─── 模块: 我的绩效计划 ──────────────────────────────────── */
function PerfPlanModule({ navigate, data }: ModuleProps) {
  const { myPlans } = data;
  return (
    <>
      <ModHeader icon="trending_up" color="text-emerald-500" title="我的绩效计划"
        action={<button onClick={() => { document.getElementById('personal-goals-section')?.scrollIntoView({ behavior: 'smooth' }); }} className="text-[10px] font-bold text-blue-500 hover:text-blue-700">查看全部 →</button>} />
      {myPlans.length === 0 ? <div className="text-center py-6 text-slate-400 text-xs">暂无进行中的绩效计划</div> :
        <div className="space-y-3">
          {myPlans.map((plan: any) => {
            const s = STATUS_MAP[plan.status] || { label: plan.status, color: 'text-slate-500', bg: 'bg-slate-100' };
            return (
              <div key={plan.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all cursor-pointer" onClick={() => { document.getElementById('personal-goals-section')?.scrollIntoView({ behavior: 'smooth' }); }}>
                <div className="relative w-10 h-10 flex-shrink-0">
                  <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="14" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                    <circle cx="18" cy="18" r="14" fill="none" stroke={plan.progress >= 80 ? '#22c55e' : plan.progress >= 40 ? '#3b82f6' : '#f59e0b'}
                      strokeWidth="3" strokeDasharray={`${(plan.progress / 100) * 88} 88`} strokeLinecap="round" />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-slate-600">{plan.progress}%</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{plan.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${s.color} ${s.bg}`}>{s.label}</span>
                    {plan.deadline && <span className="text-[9px] text-slate-400">截止 {plan.deadline}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>}
    </>
  );
}

/* ─── 模块: 最新消息 ──────────────────────────────────────── */
function NotificationsModule({ navigate, data }: ModuleProps) {
  const { recentNotifs, unreadCount } = data;
  return (
    <>
      <ModHeader icon="inbox" color="text-blue-500" title="最新消息" badge={unreadCount} />
      {recentNotifs.length === 0 ? <div className="text-center py-6 text-slate-400 text-xs">暂无消息</div> :
        <div className="space-y-2">
          {recentNotifs.map((n: any) => (
            <div key={n.id} className={`p-3 rounded-xl transition-all cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 ${!n.is_read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
              onClick={() => {
                if (n.title.includes('评测')) navigate('competency');
                else navigate('dashboard');
              }}>
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${!n.is_read ? 'bg-blue-100' : 'bg-slate-100'}`}>
                  <span className={`material-symbols-outlined text-[14px] ${!n.is_read ? 'text-blue-600' : 'text-slate-400'}`}>
                    {n.type === 'proposal' ? 'description' : n.type === 'perf' ? 'trending_up' : n.title.includes('评测') ? 'assignment' : 'notifications'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className={`text-xs font-bold truncate ${!n.is_read ? 'text-slate-800' : 'text-slate-500'}`}>{n.title}</p>
                    <span className="text-[9px] text-slate-400 flex-shrink-0 ml-2">{fmtDate(n.created_at)}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 line-clamp-2 mt-0.5">{n.content}</p>
                </div>
                {!n.is_read && <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1" />}
              </div>
            </div>
          ))}
        </div>}
    </>
  );
}

/* ─── 模块: 我的提案 ──────────────────────────────────────── */
function ProposalsModule({ navigate, data }: ModuleProps) {
  const { myProposals } = data;
  if (myProposals.length === 0) return null;
  return (
    <>
      <ModHeader icon="lightbulb" color="text-purple-500" title="我的提案"
        action={<button onClick={() => navigate('company')} className="text-[10px] font-bold text-blue-500 hover:text-blue-700">查看全部 →</button>} />
      <div className="space-y-2">
        {myProposals.map((p: any) => {
          const s = STATUS_MAP[p.proposal_status] || { label: p.proposal_status, color: 'text-slate-500', bg: 'bg-slate-100' };
          return (
            <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all">
              <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-purple-500 text-[14px]">lightbulb</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{p.title}</p>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${s.color} ${s.bg}`}>{s.label}</span>
              </div>
              {p.bonus > 0 && <span className="text-[10px] text-rose-500 font-bold">¥{p.bonus}</span>}
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ─── 模块: 快速入口 ──────────────────────────────────────── */
function QuickLinksModule({ navigate }: ModuleProps) {
  const links = [
    { icon: 'person', label: '个人管理', view: 'personal', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { icon: 'groups', label: '团队管理', view: 'team', color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { icon: 'analytics', label: '公司绩效池', view: 'company', color: 'text-orange-600', bg: 'bg-orange-50' },
    { icon: 'view_quilt', label: '全景仪表盘', view: 'panorama', color: 'text-purple-600', bg: 'bg-purple-50' },
  ];
  return (
    <>
      <ModHeader icon="bolt" color="text-slate-500" title="快速入口" />
      <div className="space-y-2">
        {links.map(l => (
          <button key={l.view} onClick={() => navigate(l.view)}
            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all text-left group">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${l.bg}`}>
              <span className={`material-symbols-outlined text-[18px] ${l.color}`}>{l.icon}</span>
            </div>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex-1">{l.label}</span>
            <span className="material-symbols-outlined text-[14px] text-slate-300 group-hover:text-slate-500 transition-colors">chevron_right</span>
          </button>
        ))}
      </div>
    </>
  );
}

/* ─── 模块: 今日概览 ──────────────────────────────────────── */
function SummaryModule({ data }: ModuleProps) {
  return (
    <div className="-m-5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-5 text-white">
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>summarize</span>
        <h3 className="font-bold text-sm">今日概览</h3>
      </div>
      <div className="space-y-2 text-xs opacity-90">
        <p>📋 {data.pendingTasks.length} 项待办事项</p>
        <p>✅ {data.completedTasks.length} 项已完成</p>
        <p>📊 {data.myPlans.length} 个绩效计划进行中</p>
        <p>⏳ {data.pendingWorkflows} 个流程待审核</p>
        <p>✉️ {data.unreadCount} 条未读消息</p>
      </div>
    </div>
  );
}

/* ================================================================
   统一弹窗组件 — 点击顶部卡片打开详情
   ================================================================ */
type DetailModalType = 'workflows' | 'perf' | 'tasks' | 'notifications' | null;

const MODAL_CONFIG: Record<string, { title: string; icon: string; color: string }> = {
  perf: { title: '进行中绩效计划', icon: 'trending_up', color: 'text-emerald-500' },
  tasks: { title: '待办事项', icon: 'checklist', color: 'text-amber-500' },
  notifications: { title: '消息中心', icon: 'inbox', color: 'text-purple-500' },
};

function DetailModal({ type, onClose, data, actions, navigate }: {
  type: DetailModalType; onClose: () => void;
  data: DashData; actions: DashActions; navigate: (v: string) => void;
}) {
  if (!type) return null;
  const cfg = MODAL_CONFIG[type];
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl max-h-[80vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center flex-shrink-0">
          <h3 className="text-base font-bold flex items-center gap-2">
            <span className={`material-symbols-outlined ${cfg.color}`} style={{ fontVariationSettings: "'FILL' 1" }}>{cfg.icon}</span>
            {cfg.title}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {type === 'perf' && <PerfDetail data={data} navigate={navigate} />}
          {type === 'tasks' && <TasksDetail data={data} actions={actions} navigate={navigate} onClose={onClose} />}
          {type === 'notifications' && <NotificationsDetail data={data} navigate={navigate} onClose={onClose} />}
        </div>
      </div>
    </div>
  );
}
/* ─── 弹窗内容: 绩效计划 ─── */
function PerfDetail({ data, navigate }: { data: DashData; navigate: (v: string) => void }) {
  return (
    <div className="space-y-3">
      {data.myPlans.length === 0 ? <div className="text-center py-10 text-slate-400 text-sm">暂无进行中的绩效计划</div> :
        data.myPlans.map((plan: any) => {
          const s = STATUS_MAP[plan.status] || { label: plan.status, color: 'text-slate-500', bg: 'bg-slate-100' };
          return (
            <div key={plan.id} className="flex items-center gap-4 p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all cursor-pointer border border-slate-100 dark:border-slate-800" onClick={() => navigate('personal')}>
              <div className="relative w-12 h-12 flex-shrink-0">
                <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="14" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                  <circle cx="18" cy="18" r="14" fill="none" stroke={plan.progress >= 80 ? '#22c55e' : plan.progress >= 40 ? '#3b82f6' : '#f59e0b'}
                    strokeWidth="3" strokeDasharray={`${(plan.progress / 100) * 88} 88`} strokeLinecap="round" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-slate-600">{plan.progress}%</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 dark:text-white">{plan.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.color} ${s.bg}`}>{s.label}</span>
                  {plan.deadline && <span className="text-[10px] text-slate-400">截止 {plan.deadline}</span>}
                </div>
              </div>
              <span className="material-symbols-outlined text-slate-300 text-[18px]">chevron_right</span>
            </div>
          );
        })}
    </div>
  );
}

/* ─── 弹窗内容: 待办事项 ─── */
function TasksDetail({ data, actions, navigate, onClose }: { data: DashData; actions: DashActions; navigate: (v: string) => void; onClose: () => void; }) {
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">{data.pendingTasks.length} 项待办 · {data.completedTasks.length} 项已完成</p>
        <button onClick={() => { onClose(); actions.openTaskModal(); }} className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-bold hover:bg-blue-600 transition-all">
          <span className="material-symbols-outlined text-[14px]">add</span>新建待办
        </button>
      </div>
      <div className="space-y-2">
        {data.tasks.length === 0 ? <div className="text-center py-10 text-slate-400 text-sm">暂无待办事项 🎉</div> :
          data.tasks.map(t => {
            const done = t.status === 'completed';
            const isTest = t.type === 'test_assignment';
            const isEval = t.type === 'monthly_eval';
            const isSystemTask = isTest || isEval;
            return (
              <div key={t.id} onClick={() => { 
                if (isTest) { onClose(); navigate(`competency?testId=${t.id}`); } 
                else if (isEval) { onClose(); navigate('monthly-eval'); }
              }} className={`flex items-start gap-3 p-3 rounded-xl transition-all border border-slate-100 dark:border-slate-800 ${done ? 'opacity-50 bg-slate-50/50' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'} ${isSystemTask ? 'cursor-pointer' : ''}`}>
                {isSystemTask ? (
                  <div className={`mt-0.5 w-4 h-4 flex items-center justify-center ${isEval ? 'text-rose-500' : 'text-indigo-500'}`}>
                    <span className="material-symbols-outlined text-[16px]">{isEval ? 'rate_review' : 'assignment'}</span>
                  </div>
                ) : (
                  <input type="checkbox" checked={done} onChange={() => actions.toggleTask(t)} className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-500 cursor-pointer" />
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold ${done ? 'line-through text-slate-400' : isEval ? 'text-rose-600 dark:text-rose-400' : isTest ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-800 dark:text-white'}`}>{t.title}</p>
                  {t.description && <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{t.description}</p>}
                  {t.due_date && <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1"><span className="material-symbols-outlined text-[11px]">schedule</span>{new Date(t.due_date).toLocaleDateString()}</p>}
                </div>
                {!done && t.priority === 'high' && <span className="text-[9px] px-2 py-0.5 bg-red-100 text-red-600 rounded-full font-bold">紧急</span>}
              </div>
            );
          })}
      </div>
    </>
  );
}

/* ─── 弹窗内容: 消息中心 ─── */
function NotificationsDetail({ data, navigate, onClose }: { data: DashData; navigate: (v: string) => void; onClose: () => void; }) {
  const [allNotifs, setAllNotifs] = useState<any[]>([]);
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetch('/api/notifications?limit=50', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(j => setAllNotifs(j?.data || [])).catch(() => {});
  }, []);

  const markRead = async (id: number) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      setAllNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch {}
  };

  return (
    <div className="space-y-2">
      {allNotifs.length === 0 ? <div className="text-center py-10 text-slate-400 text-sm">暂无消息</div> :
        allNotifs.map((n: any) => (
          <div key={n.id} onClick={() => {
              if (!n.is_read) markRead(n.id);
              if (n.title.includes('评测')) { onClose(); navigate('competency?tab=my_tests'); }
            }}
            className={`p-4 rounded-xl transition-all border border-slate-100 dark:border-slate-800 ${!n.is_read ? 'bg-blue-50/50 dark:bg-blue-900/10 cursor-pointer hover:bg-blue-50' : 'cursor-pointer hover:bg-slate-50'}`}>
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${!n.is_read ? 'bg-blue-100' : 'bg-slate-100'}`}>
                <span className={`material-symbols-outlined text-[18px] ${!n.is_read ? 'text-blue-600' : 'text-slate-400'}`}>
                  {n.type === 'proposal' ? 'description' : n.type === 'perf' ? 'trending_up' : n.title.includes('评测') ? 'assignment' : 'notifications'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className={`text-sm font-bold ${!n.is_read ? 'text-slate-800' : 'text-slate-500'}`}>{n.title}</p>
                  <span className="text-[10px] text-slate-400 flex-shrink-0 ml-2">{fmtDate(n.created_at)}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{n.content}</p>
              </div>
              {!n.is_read && <div className="w-2.5 h-2.5 bg-blue-500 rounded-full flex-shrink-0 mt-1.5" />}
            </div>
          </div>
        ))}
    </div>
  );
}



/* ================================================================
   主页组件
   ================================================================ */
export default function EmployeeDashboard({ navigate }: { navigate: (view: string) => void }) {
  const { currentUser } = useAuth();
  const isMobile = useIsMobile();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', due_date: '', priority: 'normal' });
  const [pendingWorkflows, setPendingWorkflows] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [myPlans, setMyPlans] = useState<any[]>([]);
  const [recentNotifs, setRecentNotifs] = useState<any[]>([]);
  const [myProposals, setMyProposals] = useState<any[]>([]);
  const [totalPlansCount, setTotalPlansCount] = useState(0);
  const [dashLoading, setDashLoading] = useState(true);

  // Detail modal state
  const [detailModal, setDetailModal] = useState<DetailModalType>(null);

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => { fetchTasks(); fetchDashboardData(); }, []);

  const fetchTasks = async () => {
    try { const r = await fetch('/api/tasks', { headers }); if (r.ok) setTasks(await r.json()); } catch {}
  };

  const fetchDashboardData = async () => {
    setDashLoading(true);
    try {
      const [pendingRes, notifRes, plansRes, proposalsRes, ucRes] = await Promise.all([
        fetch('/api/workflows/pending', { headers }).then(r => r.json()).catch(() => ({ data: [] })),
        fetch('/api/notifications?limit=5', { headers }).then(r => r.json()).catch(() => ({ data: [] })),
        fetch(`/api/perf/plans${currentUser?.id ? `?userId=${currentUser.id}` : ''}`, { headers }).then(r => r.json()).catch(() => ({ data: [] })),
        fetch('/api/pool/my-proposals', { headers }).then(r => r.json()).catch(() => ({ data: [] })),
        fetch('/api/notifications/unread-count', { headers }).then(r => r.json()).catch(() => ({ data: { count: 0 } })),
      ]);
      setPendingWorkflows(pendingRes?.data?.length || 0);
      setRecentNotifs(notifRes?.data || []);
      setUnreadCount(ucRes?.data?.count || 0);

      const ongoingPlans = (plansRes?.data || []).filter((p: any) => !['completed', 'cancelled'].includes(p.status));
      setTotalPlansCount(ongoingPlans.filter((p: any) => p.status === 'in_progress').length);
      setMyPlans(ongoingPlans.slice(0, 4));

      setMyProposals((proposalsRes?.data || []).slice(0, 3));
    } catch {}
    setDashLoading(false);
  };

  const handleToggleTaskStatus = async (task: Task) => {
    const ns = task.status === 'completed' ? 'pending' : 'completed';
    setTasks(tasks.map(t => t.id === task.id ? { ...t, status: ns } : t));
    try { await fetch(`/api/tasks/${task.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ status: ns }) }); fetchTasks(); } catch { fetchTasks(); }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const r = await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(newTask) });
      if (r.ok) { fetchTasks(); setIsTaskModalOpen(false); setNewTask({ title: '', description: '', due_date: '', priority: 'normal' }); }
    } catch {}
  };

  // Date
  const now = new Date();
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 星期${weekDays[now.getDay()]}`;
  const hr = now.getHours();
  const greeting = hr < 6 ? '夜深了' : hr < 12 ? '早上好' : hr < 14 ? '中午好' : hr < 18 ? '下午好' : '晚上好';

  const pendingTasks = tasks.filter(t => t.status !== 'completed');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  const dashData: DashData = { pendingWorkflows, unreadCount, myPlans, recentNotifs, myProposals, tasks, pendingTasks, completedTasks, totalPlansCount };
  const dashActions: DashActions = { toggleTask: handleToggleTaskStatus, openTaskModal: () => setIsTaskModalOpen(true) };

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-on-surface antialiased">
      <Sidebar currentView="dashboard" navigate={navigate} />

      <main className={`flex-1 h-[calc(100vh-4rem)] mt-16 overflow-y-auto relative ${isMobile ? 'pb-20' : ''}`}>
        <div className={`max-w-6xl mx-auto space-y-6 ${isMobile ? 'p-4' : 'p-6'}`}>
          {/* Welcome section */}
          <div className={`flex items-end justify-between ${isMobile ? 'flex-col items-start gap-2' : ''}`}>
            <div>
              <h2 className={`font-black text-on-surface tracking-tight mb-1 ${isMobile ? 'text-xl' : 'text-3xl'}`}>{greeting}, {currentUser?.name || '同事'} 👋</h2>
              <p className={`text-on-surface-variant ${isMobile ? 'text-xs' : 'text-sm'}`}>{dateStr}</p>
            </div>
            

          </div>

          {/* Stat Cards */}
          <div className={`grid gap-3 ${isMobile ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4'}`}>
            {dashLoading ? (
              // Skeleton loading state
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-slate-100 dark:bg-slate-800/60 rounded-2xl p-4 animate-pulse">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-9 h-9 bg-slate-200 dark:bg-slate-700 rounded-xl" />
                  </div>
                  <div className="h-7 w-12 bg-slate-200 dark:bg-slate-700 rounded-lg mb-1.5" />
                  <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
                </div>
              ))
            ) : (
              [
                { label: '待我审批', value: pendingWorkflows, icon: 'pending_actions', from: 'from-blue-50', to: 'to-indigo-50', text: 'text-blue-700', sub: 'text-blue-600/70', border: 'border-blue-100/60', iconBg: 'bg-blue-100', iconColor: 'text-blue-600', modal: 'workflows' as DetailModalType, badge: pendingWorkflows },
                { label: '进行中绩效', value: totalPlansCount, icon: 'trending_up', from: 'from-emerald-50', to: 'to-teal-50', text: 'text-emerald-700', sub: 'text-emerald-600/70', border: 'border-emerald-100/60', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', modal: 'perf' as DetailModalType },
                { label: '待办事项', value: pendingTasks.length, icon: 'checklist', from: 'from-amber-50', to: 'to-orange-50', text: 'text-amber-700', sub: 'text-amber-600/70', border: 'border-amber-100/60', iconBg: 'bg-amber-100', iconColor: 'text-amber-600', modal: 'tasks' as DetailModalType, badge: pendingTasks.length },
                { label: '未读消息', value: unreadCount, icon: 'mail', from: 'from-purple-50', to: 'to-violet-50', text: 'text-purple-700', sub: 'text-purple-600/70', border: 'border-purple-100/60', iconBg: 'bg-purple-100', iconColor: 'text-purple-600', modal: 'notifications' as DetailModalType, badge: unreadCount },
              ].map(c => (
                <button key={c.label}
                  onClick={() => {
                    if (c.modal === 'workflows') navigate('workflows?tab=pending');
                    else if (c.modal === 'perf') {
                      document.getElementById('personal-goals-section')?.scrollIntoView({ behavior: 'smooth' });
                    }
                    else if (c.modal) setDetailModal(c.modal);
                  }}
                  className={`bg-gradient-to-br ${c.from} ${c.to} rounded-2xl p-4 text-left hover:shadow-md active:scale-95 transition-all border ${c.border}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className={`w-9 h-9 ${c.iconBg} rounded-xl flex items-center justify-center`}>
                      <span className={`material-symbols-outlined ${c.iconColor} text-[18px]`}>{c.icon}</span>
                    </div>
                    {c.badge != null && c.badge > 0 && <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-black">{c.badge}</span>}
                  </div>
                  <p className={`text-2xl font-black ${c.text}`}>{c.value}</p>
                  <p className={`text-[11px] ${c.sub} font-bold`}>{c.label}</p>
                </button>
              ))
            )}
          </div>




          {/* ── 嵌入: 个人目标管理 ── */}
          <div id="personal-goals-section" className={`border-t border-slate-200/60 dark:border-slate-800 scroll-mt-20 ${isMobile ? 'mt-6 pt-5' : 'mt-10 pt-8'}`}>
            <h3 className={`font-bold text-slate-800 dark:text-slate-100 mb-5 flex items-center gap-2 ${isMobile ? 'text-base' : 'text-lg'}`}>
              <span className="material-symbols-outlined text-blue-500">person</span>
              个人目标与追踪
            </h3>
            <PersonalGoalsPanel />
          </div>

          {/* 管理专属入口 (绩效管理 & 工资表管理) */}
          {(currentUser?.role === 'admin' || currentUser?.role === 'hr' || currentUser?.role === 'supervisor' || currentUser?.role === 'manager') && (
            <div className="mt-10 border-t border-slate-200/60 dark:border-slate-800 pt-8">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-5 flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-500">category</span>
                管理专属
              </h3>
              <div className={`grid gap-3 ${isMobile ? 'grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5'}`}>
              {/* 绩效核算 (原月度考评) 放在第一位以保持一致性 - 全角色可见 */}
              <div onClick={() => navigate('monthly-eval')} className={`bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all cursor-pointer group flex flex-col hover:-translate-y-1 hover:border-blue-200 dark:hover:border-blue-800/50 ${isMobile ? 'rounded-2xl p-4' : 'rounded-3xl p-6'}`}>
                <div className={`rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center group-hover:bg-blue-100 transition-colors ${isMobile ? 'w-10 h-10 mb-2' : 'w-12 h-12 mb-5'}`}>
                  <span className="material-symbols-outlined text-[24px] text-blue-600 font-bold" style={{ fontVariationSettings: "'wght' 600" }}>rule</span>
                </div>
                <h4 className={`font-black text-slate-800 dark:text-slate-100 tracking-tight ${isMobile ? 'text-sm mb-0' : 'text-xl mb-3'}`}>月度考评系统</h4>
                {!isMobile && (
                  <>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 font-medium">
                      {currentUser?.role === 'supervisor' || currentUser?.role === 'manager'
                        ? '查看与管理本部门员工的月度绩效考评'
                        : '所有员工必须参与的月底绩效四大维度打分'}
                    </p>
                    <div className="flex gap-3 text-[12px] font-bold text-slate-400 mt-auto">
                      <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 group-hover:bg-blue-300"></div>待审阅打分</span>
                      <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 group-hover:bg-blue-300"></div>百分制测评</span>
                    </div>
                  </>
                )}
              </div>

              {(currentUser?.role === 'admin' || currentUser?.role === 'hr') && (<>
              {/* 绩效管理 */}
              <div onClick={() => navigate('perf-analytics')} className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all cursor-pointer group flex flex-col h-full hover:-translate-y-1 hover:border-emerald-200 dark:hover:border-emerald-800/50">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center mb-5 group-hover:bg-emerald-100 transition-colors">
                  <span className="material-symbols-outlined text-[24px] text-emerald-600 font-bold" style={{ fontVariationSettings: "'wght' 600" }}>trending_up</span>
                </div>
                <h4 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-3 tracking-tight">任务管理</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 font-medium">绩效计划审批、考核评分与奖金发放</p>
                <div className="flex gap-3 text-[12px] font-bold text-slate-400 mt-auto">
                  <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 group-hover:bg-emerald-300"></div>审批流程</span>
                  <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 group-hover:bg-emerald-300"></div>评分管理</span>
                </div>
              </div>

              {/* 能力管理 */}
              <div onClick={() => navigate('competency')} className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all cursor-pointer group flex flex-col h-full hover:-translate-y-1 hover:border-indigo-200 dark:hover:border-indigo-800/50">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center mb-5 group-hover:bg-indigo-100 transition-colors">
                  <span className="material-symbols-outlined text-[24px] text-indigo-600 font-bold" style={{ fontVariationSettings: "'wght' 600" }}>psychology</span>
                </div>
                <h4 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-3 tracking-tight">能力大盘</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 font-medium">配置模型、进行能力打分与雷达图跟踪</p>
                <div className="flex gap-3 text-[12px] font-bold text-slate-400 mt-auto">
                  <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 group-hover:bg-indigo-300"></div>自定义模型</span>
                  <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 group-hover:bg-indigo-300"></div>综合评估</span>
                </div>
              </div>

              {/* 绩效核算 */}
              <div onClick={() => navigate('perf-accounting')} className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all cursor-pointer group flex flex-col h-full hover:-translate-y-1 hover:border-amber-200 dark:hover:border-amber-800/50 relative overflow-hidden">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center mb-5 group-hover:bg-amber-100 transition-colors relative z-10">
                  <span className="material-symbols-outlined text-[24px] text-amber-600 font-bold" style={{ fontVariationSettings: "'wght' 600" }}>account_balance_wallet</span>
                </div>
                <h4 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-3 tracking-tight relative z-10">绩效核算</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 font-medium relative z-10 leading-relaxed">一览全员累积的绩效考评分与奖金，支持任务溯源提取对账单</p>
                <div className="flex gap-3 text-[12px] font-bold text-slate-400 mt-auto relative z-10">
                  <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 group-hover:bg-amber-300"></div>汇总计算</span>
                  <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 group-hover:bg-amber-300"></div>穿透溯源</span>
                </div>
              </div>

              {/* 提案审议 */}
              <div onClick={() => navigate('admin?module=proposals')} className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all cursor-pointer group flex flex-col h-full hover:-translate-y-1 hover:border-indigo-200 dark:hover:border-indigo-800/50">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center mb-5 group-hover:bg-indigo-100 transition-colors">
                  <span className="material-symbols-outlined text-[24px] text-indigo-600 font-bold" style={{ fontVariationSettings: "'wght' 600" }}>how_to_reg</span>
                </div>
                <h4 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-3 tracking-tight">提案审议</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 font-medium">处理各部门提交的任务发起草案，复核定级发放到任务池</p>
                <div className="flex gap-3 text-[12px] font-bold text-slate-400 mt-auto">
                  <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 group-hover:bg-indigo-300"></div>提案审批</span>
                  <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 group-hover:bg-indigo-300"></div>奖金池</span>
                </div>
              </div>
              </>)}
            </div>
          </div>
          )}


        </div>
      </main>

      {/* Task Modal */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-center justify-center">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="text-base font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-500">add_task</span>新建待办事项
              </h3>
              <button onClick={() => setIsTaskModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <form onSubmit={handleCreateTask} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">任务标题 *</label>
                <input required autoFocus type="text" value={newTask.title}
                  onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="例如：准备项目季度汇报PPT" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">截止日期</label>
                <input type="date" value={newTask.due_date}
                  onChange={e => setNewTask({ ...newTask, due_date: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">描述</label>
                <textarea rows={3} value={newTask.description}
                  onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                  placeholder="补充任务细节..." />
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <input type="radio" name="priority" value="normal" checked={newTask.priority === 'normal'}
                    onChange={() => setNewTask({ ...newTask, priority: 'normal' })} className="accent-blue-500 w-4 h-4" />普通
                </label>
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <input type="radio" name="priority" value="high" checked={newTask.priority === 'high'}
                    onChange={() => setNewTask({ ...newTask, priority: 'high' })} className="accent-red-500 w-4 h-4" />
                  <span className="text-red-500 font-bold">紧急</span>
                </label>
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800 mt-4">
                <button type="button" onClick={() => setIsTaskModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl">取消</button>
                <button type="submit" className="px-6 py-2.5 text-sm font-bold text-white bg-blue-500 hover:bg-blue-600 active:scale-95 shadow-md rounded-xl">创建</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <DetailModal type={detailModal} onClose={() => setDetailModal(null)} data={dashData} actions={dashActions} navigate={navigate} />
    </div>
  );
}
