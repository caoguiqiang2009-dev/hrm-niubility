import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import SmartGoalDisplay from '../components/SmartGoalDisplay';
import SmartTaskModal, { SmartTaskData } from '../components/SmartTaskModal';
import { decodeSmartDescription } from '../components/SmartFormInputs';
import { useIsMobile } from '../hooks/useIsMobile';

interface PoolTask {
  id: number;
  status: 'open' | 'in_progress' | 'closed';
  title: string;
  department: string;
  difficulty: string;
  reward_type?: 'money' | 'score';
  bonus: number;
  max_participants: number;
  current_participants: number;
  description?: string;
  deadline?: string;
  created_at?: string;
  creator_name?: string;
  participant_names?: string[];
}

type StatusFilter = 'all' | 'open' | 'in_progress';
type BonusFilter = 'all' | 'low' | 'mid' | 'high';
const DEPTS = ['全部部门', '研发部', '市场部', '产品部', '人事部'];

const DIFFICULTY_MAP: Record<string, string> = { low: '低', normal: '中', high: '高', expert: '专家' };
const DIFFICULTY_COLOR: Record<string, string> = {
  low: 'bg-green-100 text-green-700',
  normal: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  expert: 'bg-red-100 text-red-700',
};

// Fallback mock enrichment for demo tasks that lack descriptions
const MOCK_DETAILS: Record<string, { description: string; skills: string[]; deliverables: string }> = {
  default: {
    description: '该任务面向全员开放，需要跨团队协作完成指定目标。完成后按实际贡献分配奖金，请在截止日期前提交成果。',
    skills: ['沟通协作', '项目管理', '结果导向'],
    deliverables: '完整方案文档及落地成果报告，由评审委员会验收后结算奖金。',
  },
};

interface ConfirmDialog {
  title: string;
  description: string;
  confirmLabel: string;
  confirmClass: string;
  onConfirm: () => void;
}

type ModalStep = 'detail' | 'apply' | 'success';

export default function CompanyPerformance({ navigate }: { navigate: (view: string) => void }) {
  const [tasks, setTasks] = useState<PoolTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletedTasks, setDeletedTasks] = useState<PoolTask[]>([]);
  const [showTrash, setShowTrash] = useState(false);
  const [dialog, setDialog] = useState<ConfirmDialog | null>(null);
  const [selectedTask, setSelectedTask] = useState<PoolTask | null>(null);
  const [modalStep, setModalStep] = useState<ModalStep>('detail');
  const [applyReason, setApplyReason] = useState('');
  const [applyRole, setApplyRole] = useState<'R' | 'A'>('A');
  const [applying, setApplying] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [bonusFilter, setBonusFilter] = useState<BonusFilter>('all');
  const [deptFilter, setDeptFilter] = useState('全部部门');
  const [sortByBonus, setSortByBonus] = useState(false);
  const [users, setUsers] = useState<{id: string, name: string}[]>([]);

  // Proposal state
  const [showPropose, setShowPropose] = useState(false);
  const [proposeForm, setProposeForm] = useState({ title: '', description: '', department: '', difficulty: '中', bonus: '', max_participants: '5' });
  const [proposing, setProposing] = useState(false);
  const [proposeMsg, setProposeMsg] = useState('');
  const [myProposals, setMyProposals] = useState<any[]>([]);
  const [showMyProposals, setShowMyProposals] = useState(false);
  const [viewingProposal, setViewingProposal] = useState<any>(null);

  // New features state
  const [activeTab, setActiveTab] = useState<'task' | 'personnel'>('task');
  const [searchKey, setSearchKey] = useState('');
  const [personnelSearchKey, setPersonnelSearchKey] = useState('');
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);

  // Publish Task state
  const [showPublish, setShowPublish] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const { hasPermission, currentUser } = useAuth();
  const isMobile = useIsMobile();
  const canManagePool = hasPermission('manage_perf_pool');
  const canDeleteTask = hasPermission('delete_perf_task');

  const fetchTasks = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/pool/tasks', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.code === 0) setTasks(json.data);
    } catch { /* Use empty state */ }
    setLoading(false);
  };

  const fetchMyProposals = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/pool/my-proposals', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.code === 0) setMyProposals(json.data.filter((p: any) => p.proposal_status !== 'approved'));
    } catch {}
  };

  const fetchLeaderboard = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/pool/leaderboard', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.code === 0) setLeaderboard(json.data);
    } catch {}
  };

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/org/users', { headers: { 'Authorization': `Bearer ${token}` } });
      const json = await res.json();
      if (json.code === 0) setUsers(json.data.map((u: any) => ({ id: u.id, name: u.name })));
    } catch {}
  };

  useEffect(() => { fetchTasks(); fetchMyProposals(); fetchLeaderboard(); fetchUsers(); fetchTrash(); }, []);

  const handleProposeSmart = async (data: SmartTaskData) => {
    if (!data.summary.trim()) return;
    setProposing(true);
    try {
      const token = localStorage.getItem('token');
      const pdcaStr = [
        data.planTime ? `Plan: ${data.planTime}` : '',
        data.doTime ? `Do: ${data.doTime}` : '',
        data.checkTime ? `Check: ${data.checkTime}` : '',
        data.actTime ? `Act: ${data.actTime}` : ''
      ].filter(Boolean).join(' | ');
      
      const smartDescription = `【目标 S】${data.s}\n【指标 M】${data.m}\n【方案 A】${data.a_smart}\n【相关 R】${data.r_smart}\n【时限 T】${data.t}${pdcaStr ? `\n【PDCA】\n${pdcaStr}` : ''}`;
      
      const res = await fetch('/api/pool/tasks/propose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: data.summary || '新提案',
          description: smartDescription,
          department: data.taskType || '全部部门',
          difficulty: '中',
          reward_type: data.rewardType,
          bonus: Number(data.bonus) || 0,
          max_participants: 5
        }),
      });
      const json = await res.json();
      if (json.code === 0) {
        fetchMyProposals();
        setTimeout(() => setShowPropose(false), 1500);
      } else {
        alert(json.message);
      }
    } catch { 
      alert('网络错误');
    }
    setProposing(false);
  };

  const handlePublishTask = async (data: SmartTaskData) => {
    if (!data.summary.trim()) return;
    setPublishing(true);
    try {
      const token = localStorage.getItem('token');
      const pdcaStr = [
        data.planTime ? `Plan: ${data.planTime}` : '',
        data.doTime ? `Do: ${data.doTime}` : '',
        data.checkTime ? `Check: ${data.checkTime}` : '',
        data.actTime ? `Act: ${data.actTime}` : ''
      ].filter(Boolean).join(' | ');
      
      const smartDescription = `【目标 S】${data.s}\n【指标 M】${data.m}\n【方案 A】${data.a_smart}\n【相关 R】${data.r_smart}\n【时限 T】${data.t}${pdcaStr ? `\n【PDCA】\n${pdcaStr}` : ''}`;
      
      const res = await fetch('/api/pool/tasks/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: data.summary || '新任务',
          description: smartDescription,
          department: data.taskType || '全部部门',
          difficulty: '中',
          reward_type: data.rewardType,
          bonus: Number(data.bonus) || 0,
          max_participants: 5
        }),
      });
      const json = await res.json();
      if (json.code === 0) {
        fetchTasks();
        setTimeout(() => setShowPublish(false), 1500);
      } else {
        alert(json.message);
      }
    } catch { 
      alert('网络错误');
    }
    setPublishing(false);
  };

  const PROPOSAL_STATUS: Record<string, [string, string]> = {
    pending_hr: ['⏳ 待人事审核', 'bg-amber-100 text-amber-700'],
    pending_admin: ['🔍 待总经理复核', 'bg-blue-100 text-blue-700'],
    approved: ['✅ 已通过', 'bg-emerald-100 text-emerald-700'],
    rejected: ['❌ 已驳回', 'bg-red-100 text-red-600'],
  };

  // ── Filtering ──────────────────────────────────────────────────────────────
  let displayed = tasks.filter(t => {
    if (searchKey) {
      const kw = searchKey.toLowerCase();
      if (!t.title.toLowerCase().includes(kw) && !(t.description && t.description.toLowerCase().includes(kw))) return false;
    }
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (deptFilter !== '全部部门' && t.department !== deptFilter) return false;
    if (bonusFilter === 'low' && t.bonus > 5000) return false;
    if (bonusFilter === 'mid' && (t.bonus <= 5000 || t.bonus > 20000)) return false;
    if (bonusFilter === 'high' && t.bonus <= 20000) return false;
    return t.status !== 'closed';
  });
  if (sortByBonus) displayed = [...displayed].sort((a, b) => b.bonus - a.bonus);

  // ── Dialog helper ──────────────────────────────────────────────────────────
  const openDialog = (cfg: ConfirmDialog) => setDialog(cfg);
  const closeDialog = () => setDialog(null);

  // ── Delete (soft-delete → 回收站) ───────────────────────────────────────────
  const fetchTrash = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/pool/tasks/trash', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.code === 0) setDeletedTasks(json.data || []);
    } catch {}
  };

  const handleDelete = (task: PoolTask) => {
    openDialog({
      title: '移入回收站',
      description: `确认将「${task.title}」移入回收站？可随时恢复。`,
      confirmLabel: '移入回收站',
      confirmClass: 'bg-red-500 hover:bg-red-600 text-white',
      onConfirm: async () => {
        try {
          const token = localStorage.getItem('token');
          const res = await fetch(`/api/pool/tasks/${task.id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
          const json = await res.json();
          if (json.code === 0) {
            closeDialog();
            setTasks(prev => prev.filter(t => t.id !== task.id));
            fetchTrash();
          } else {
            closeDialog();
            alert(json.message || '操作失败');
          }
        } catch {
          closeDialog();
          alert('网络异常，请重试');
        }
      },
    });
  };

  const handleRestore = async (id: number) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/pool/tasks/${id}/restore`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.code === 0) { fetchTasks(); fetchTrash(); }
      else alert(json.message || '恢复失败');
    } catch { alert('网络异常'); }
  };

  const handlePermanentDelete = (task: PoolTask) => {
    openDialog({
      title: '永久删除',
      description: `「${task.title}」将被永久删除，无法恢复。`,
      confirmLabel: '永久删除',
      confirmClass: 'bg-red-600 hover:bg-red-700 text-white',
      onConfirm: async () => {
        try {
          const token = localStorage.getItem('token');
          const res = await fetch(`/api/pool/tasks/${task.id}/purge`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
          const json = await res.json();
          if (json.code === 0) { closeDialog(); fetchTrash(); }
          else { closeDialog(); alert(json.message || '删除失败'); }
        } catch { closeDialog(); alert('网络异常'); }
      },
    });
  };

  const handleClearTrash = () => {
    openDialog({
      title: '清空回收站',
      description: `共 ${deletedTasks.length} 个任务将被永久删除，操作不可撤销。`,
      confirmLabel: '确认清空',
      confirmClass: 'bg-red-600 hover:bg-red-700 text-white',
      onConfirm: async () => {
        try {
          const token = localStorage.getItem('token');
          for (const t of deletedTasks) {
            await fetch(`/api/pool/tasks/${t.id}/purge`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
          }
          closeDialog();
          fetchTrash();
        } catch { closeDialog(); alert('网络异常'); }
      },
    });
  };

  // ── Task Detail & Apply ────────────────────────────────────────────────────
  const openTaskDetail = (task: PoolTask) => {
    setSelectedTask(task);
    setModalStep('detail');
    setApplyReason('');
  };

  const handleJoinApply = async () => {
    if (!selectedTask) return;
    setApplying(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/pool/tasks/${selectedTask.id}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: applyReason, role: applyRole }),
      });
      const json = await res.json();
      if (json.code === 0) {
        setModalStep('success');
        fetchTasks(); // Refresh participant count
      } else {
        alert(json.message || '申请失败，请稍后重试');
      }
    } catch {
      alert('网络异常，请稍后重试');
    }
    setApplying(false);
  };

  const statusBtns: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: '全部' }, { key: 'open', label: '开放中' }, { key: 'in_progress', label: '进行中' },
  ];
  const bonusBtns: { key: BonusFilter; label: string }[] = [
    { key: 'all', label: '全部奖金' }, { key: 'low', label: '¥0–5k' }, { key: 'mid', label: '¥5k–20k' }, { key: 'high', label: '¥20k+' },
  ];

  const isFull = (t: PoolTask) => t.current_participants >= t.max_participants;
  const isJoined = false; // TODO: track per user

  const getBadge = (t: PoolTask) => t.status === 'in_progress'
    ? { label: '进行中', cls: 'bg-primary-container text-on-primary-container' }
    : { label: '开放中', cls: 'bg-secondary-container text-on-secondary-container' };

  const detail = selectedTask ? (MOCK_DETAILS[selectedTask.id] || MOCK_DETAILS.default) : MOCK_DETAILS.default;

  return (
    <div className="bg-background text-on-background min-h-screen">
      <Sidebar currentView="company" navigate={navigate} />

      <main className={`flex-1 mt-16 min-h-[calc(100vh-4rem)] overflow-y-auto ${isMobile ? 'pb-20' : ''}`}>
        <div className={`max-w-screen-2xl mx-auto ${isMobile ? 'px-4 pt-4 pb-6' : 'px-8 pt-6 pb-10'}`}>

          {/* Title Row (Action Buttons only) */}
          <div className={`flex justify-end mb-4 ${isMobile ? 'flex-wrap gap-2' : ''}`}>
            <div className={`flex items-center gap-2 ${isMobile ? 'flex-wrap w-full' : ''}`}>
              {canDeleteTask && (
                <button onClick={() => setShowTrash(true)}
                  className="relative flex items-center gap-1.5 px-3 py-2 bg-surface-container-low rounded-xl text-xs font-medium text-on-surface-variant hover:bg-surface-container-high transition-all border border-outline-variant/10">
                  <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
                  回收站
                  {deletedTasks.length > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{deletedTasks.length}</span>
                  )}
                </button>
              )}
              {canManagePool && (
                <button onClick={() => setShowPublish(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-surface-container-low rounded-xl text-xs font-medium text-on-surface-variant hover:bg-surface-container-high transition-all border border-outline-variant/10">
                  <span className="material-symbols-outlined text-[16px]">publish</span>
                  发布任务
                </button>
              )}
              <button onClick={() => setShowPropose(true)} title="发现公司改进点，有机会获得奖励"
                className="relative flex items-center gap-1.5 px-3 py-2 bg-amber-50 rounded-xl text-xs font-bold text-amber-700 hover:bg-amber-100 transition-all border border-amber-200/60 shadow-sm shadow-amber-100/50">
                <span className="material-symbols-outlined text-[16px]">add_task</span>
                申请提案
                <span className="absolute -top-2 -right-2 px-1.5 py-0.5 bg-gradient-to-r from-amber-400 to-orange-400 text-white text-[9px] font-black rounded-full shadow-sm">有奖</span>
              </button>
              <button onClick={() => setShowMyProposals(!showMyProposals)}
                className="relative flex items-center gap-1.5 px-3 py-2 bg-surface-container-low rounded-xl text-xs font-medium text-on-surface-variant hover:bg-surface-container-high transition-all border border-outline-variant/10">
                <span className="material-symbols-outlined text-[16px]">pending_actions</span>
                我的提案
                {myProposals.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 bg-violet-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 pointer-events-none">{myProposals.length}</span>
                )}
              </button>
            </div>
          </div>

          {/* Filter / Search Bar with View Toggles */}
          <div className={`flex items-center gap-4 mb-6 bg-surface-container-low rounded-2xl border border-outline-variant/10 ${isMobile ? 'flex-col p-3 gap-3' : 'flex-wrap p-4'}`}>
            <div className="flex bg-surface-container p-1 rounded-xl border border-outline-variant/10 w-fit shrink-0">
              <button onClick={() => setActiveTab('task')}
                className={`px-5 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'task' ? 'bg-primary text-white shadow-md' : 'text-on-surface-variant hover:bg-surface-container-highest'}`}>
                任务视图
              </button>
              <button onClick={() => setActiveTab('personnel')}
                className={`px-5 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'personnel' ? 'bg-primary text-white shadow-md' : 'text-on-surface-variant hover:bg-surface-container-highest'}`}>
                人员视图
              </button>
            </div>

            {activeTab === 'task' ? (
              <>
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                  <input type="text" placeholder="搜索任务标题或描述..." value={searchKey} onChange={e => setSearchKey(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-surface-container border border-outline-variant/30 rounded-xl text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all" />
                </div>
                <div className="flex items-center gap-1 bg-surface-container rounded-xl p-1">
                  {statusBtns.map(b => (
                    <button key={b.key} onClick={() => setStatusFilter(b.key)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${statusFilter === b.key ? 'bg-primary text-white shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-highest'}`}>
                      {b.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1 bg-surface-container rounded-xl p-1">
                  {bonusBtns.map(b => (
                    <button key={b.key} onClick={() => setBonusFilter(b.key)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${bonusFilter === b.key ? 'bg-primary text-white shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-highest'}`}>
                      {b.label}
                    </button>
                  ))}
                </div>
                <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
                  className="bg-surface-container border-none ring-1 ring-outline-variant/30 rounded-xl text-xs px-3 py-2 focus:ring-2 focus:ring-primary outline-none text-on-surface font-medium">
                  {DEPTS.map(d => <option key={d}>{d}</option>)}
                </select>
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-on-surface-variant">奖金排序</span>
                  <button onClick={() => setSortByBonus(p => !p)}
                    className={`relative w-9 h-5 rounded-full transition-colors ${sortByBonus ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'}`}>
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${sortByBonus ? 'translate-x-4' : 'translate-x-0.5'}`}/>
                  </button>
                  <span className="text-xs text-on-surface-variant font-bold">{displayed.length} 个任务</span>
                </div>
              </>
            ) : (
              <div className="relative w-full max-w-md">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                <input type="text" placeholder="搜素人员姓名、部门..." value={personnelSearchKey} onChange={e => setPersonnelSearchKey(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-surface-container border border-outline-variant/30 rounded-xl text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all" />
              </div>
            )}
          </div>

          {/* Card Grid / Leaderboard */}
          {loading ? (
            <div className="flex items-center justify-center h-64 text-on-surface-variant">
              <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>加载中…
            </div>
          ) : activeTab === 'task' ? (
            <div className={`grid gap-5 ${isMobile ? 'grid-cols-1' : 'grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'}`}>
              {displayed.map(task => {
                const badge = getBadge(task);
                const full = isFull(task);
                const pct = task.max_participants > 0 ? Math.round((task.current_participants / task.max_participants) * 100) : 0;
                const isScore = task.reward_type === 'score';
                return (
                  <div key={task.id}
                    className="group bg-surface-container-low rounded-2xl p-5 border border-outline-variant/10 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-300 flex flex-col cursor-pointer"
                    onClick={() => !full && openTaskDetail(task)}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <span className={`${badge.cls} text-[10px] font-bold px-2.5 py-1 rounded-full uppercase label-font`}>{badge.label}</span>
                      <div className="flex items-center gap-1.5">
                        {isScore ? (
                          <span className="text-orange-500 font-black text-lg tracking-tight">{task.bonus.toLocaleString()}分</span>
                        ) : (
                          <span className="text-primary font-black text-lg tracking-tight">¥{task.bonus.toLocaleString()}</span>
                        )}
                        {canDeleteTask && (
                          <button onClick={(e) => { e.stopPropagation(); handleDelete(task); }}
                            title="移入回收站"
                            className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-6 h-6 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">
                            <span className="material-symbols-outlined text-[13px]">delete</span>
                          </button>
                        )}
                      </div>
                    </div>
                    <h3 className="text-sm font-bold text-on-surface mb-3 line-clamp-2 leading-snug">{task.title}</h3>
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {task.department && <span className="px-2 py-0.5 bg-surface-container-lowest text-on-surface-variant text-[10px] rounded border border-outline-variant/20">{task.department}</span>}
                      <span className={`px-2 py-0.5 text-[10px] rounded border border-transparent ${DIFFICULTY_COLOR[task.difficulty] || 'bg-slate-100 text-slate-600'}`}>
                        难度: {DIFFICULTY_MAP[task.difficulty] || task.difficulty}
                      </span>
                    </div>
                    <div className="mt-auto">
                      <div className="flex justify-between items-center text-[10px] text-on-surface-variant mb-1.5">
                        <span>{task.current_participants}/{task.max_participants} 人参与</span>
                        <span className="font-bold text-primary">{pct}%</span>
                      </div>
                      <div className="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden mb-4">
                        <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${pct}%` }}></div>
                      </div>
                      {full ? (
                        <button disabled className="w-full py-2.5 text-xs bg-surface-container-lowest text-on-surface-variant font-bold rounded-xl border border-outline-variant/20 cursor-not-allowed">人数已满</button>
                      ) : (
                        <button onClick={(e) => { e.stopPropagation(); openTaskDetail(task); }}
                          className="w-full py-2.5 text-xs bg-surface-container-lowest text-primary font-bold rounded-xl border border-primary/20 hover:bg-primary hover:text-white transition-all">
                          立即加入
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex h-[calc(100vh-16rem)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              {/* Left Pane: Master List */}
              <div className="w-[35%] flex flex-col border-r-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
                <div className="grid grid-cols-5 gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 text-[11px] font-extrabold text-slate-500 dark:text-slate-400 text-center sticky top-0 z-10">
                  <div className="col-span-1 text-left">名字</div>
                  <div className="col-span-1">进行</div>
                  <div className="col-span-1">完成</div>
                  <div className="col-span-1">累计积分</div>
                  <div className="col-span-1">累计奖金</div>
                </div>
                <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 custom-scrollbar">
                  {leaderboard.filter(u => !personnelSearchKey || u.name.toLowerCase().includes(personnelSearchKey.toLowerCase()) || (u.department_name && u.department_name.toLowerCase().includes(personnelSearchKey.toLowerCase()))).map((user, idx) => {
                     const userTasks = tasks.filter(t => t.participant_names?.includes(user.name));
                     const ongoingCount = userTasks.filter(t => t.status === 'in_progress').length;
                     const closedCount = userTasks.filter(t => t.status === 'closed').length;
                     const isSelected = expandedUserId === user.id;

                     return (
                       <div key={user.id} onClick={() => setExpandedUserId(user.id)} 
                            className={`grid grid-cols-5 gap-2 px-4 py-3 items-center cursor-pointer transition-colors ${isSelected ? 'bg-red-50 dark:bg-red-900/20 shadow-inner' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                         <div className="col-span-1 flex items-center gap-2">
                           <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#0060a9] to-[#409eff] text-white flex items-center justify-center text-[11px] font-bold shrink-0">{user.name.charAt(0)}</div>
                           <span className={`text-xs font-bold truncate ${isSelected ? 'text-red-700 dark:text-red-400' : 'text-slate-800 dark:text-slate-200'}`}>{user.name}</span>
                         </div>
                         <div className="col-span-1 text-center text-xs font-black text-amber-500">{ongoingCount > 0 ? ongoingCount : '-'}</div>
                         <div className="col-span-1 text-center text-xs font-black text-emerald-500">{closedCount > 0 ? closedCount : '-'}</div>
                         <div className="col-span-1 text-center text-xs font-black text-orange-500">{user.total_score > 0 ? user.total_score : '-'}</div>
                         <div className="col-span-1 text-center text-xs font-black text-blue-600 dark:text-blue-400">{(user.total_money && user.total_money > 0) ? `¥${user.total_money.toLocaleString()}` : '-'}</div>
                       </div>
                     );
                  })}
                  {leaderboard.length === 0 && !loading && (
                    <div className="p-6 text-center text-slate-400 text-sm">暂无人员数据</div>
                  )}
                </div>
              </div>

              {/* Right Pane: Tasks Detail */}
              <div className="w-[65%] flex flex-col bg-slate-50/50 dark:bg-slate-950/50 overflow-y-auto custom-scrollbar p-6 relative">
                {!expandedUserId ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 dark:text-slate-600">
                    <span className="material-symbols-outlined text-6xl mb-4 opacity-50">person_search</span>
                    <p className="text-sm font-bold">请在左侧点击员工姓名查看其负责的任务卡</p>
                  </div>
                ) : (
                  (() => {
                    const selectedUser = leaderboard.find(u => u.id === expandedUserId);
                    if (!selectedUser) return null;
                    const userTasks = tasks.filter(t => t.participant_names?.includes(selectedUser.name));
                    
                    const openT = userTasks.filter(t => t.status === 'open');
                    const inProgressT = userTasks.filter(t => t.status === 'in_progress');
                    const closedT = userTasks.filter(t => t.status === 'closed');
                    
                    const renderGroup = (title: string, icon: string, color: string, list: PoolTask[]) => {
                      if (list.length === 0) return null;
                      return (
                        <div className="mb-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                          <h4 className={`text-sm font-black mb-4 flex items-center gap-2 ${color}`}>
                            <span className="material-symbols-outlined text-[18px]">{icon}</span>
                            {title} ({list.length})
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                            {list.map(t => (
                              <div key={t.id} onClick={() => openTaskDetail(t)}
                                className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow cursor-pointer flex flex-col h-full group">
                                <span className="font-bold text-sm text-slate-800 dark:text-slate-100 mb-2 group-hover:text-blue-600 transition-colors line-clamp-2 leading-snug">{t.title}</span>
                                <div className="flex flex-wrap gap-1 mb-3 mt-auto">
                                  {t.department && <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 text-[9px] rounded font-medium">{t.department}</span>}
                                  <span className={`px-1.5 py-0.5 text-[9px] rounded font-medium ${DIFFICULTY_COLOR[t.difficulty] || 'bg-slate-100 text-slate-600'}`}>
                                    {DIFFICULTY_MAP[t.difficulty] || t.difficulty}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-700/60 mt-auto">
                                  <span className="text-[10px] text-slate-400 font-medium">{new Date(t.created_at || '').toLocaleDateString()}</span>
                                  {t.reward_type === 'score' ? (
                                    <span className="text-sm font-black text-orange-500">{t.bonus.toLocaleString()}分</span>
                                  ) : (
                                    <span className="text-sm font-black text-primary">¥{t.bonus.toLocaleString()}</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    };

                    return (
                      <div>
                        <div className="mb-6 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0060a9] to-[#409eff] text-white flex items-center justify-center text-lg font-black shadow-md">{selectedUser.name.charAt(0)}</div>
                          <div>
                            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">{selectedUser.name} <span className="text-xs font-medium text-slate-500 ml-2">{selectedUser.department_name || '未知部门'} · {selectedUser.title || '员工'}</span></h3>
                            <p className="text-xs text-slate-500 mt-0.5">共参与 {userTasks.length} 个任务，累计奖赏: <strong className="text-primary">{selectedUser.total_money ? `¥${selectedUser.total_money.toLocaleString()}` : ''} {selectedUser.total_score ? `${selectedUser.total_score}分` : ''}</strong></p>
                          </div>
                        </div>
                        {userTasks.length === 0 ? (
                          <div className="text-center py-10 bg-white dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-slate-400 text-sm font-medium">
                            该员工暂无参与任何任务
                          </div>
                        ) : (
                          <>
                            {renderGroup('开放中', 'lock_open', 'text-slate-600 dark:text-slate-300', openT)}
                            {renderGroup('进行中', 'directions_run', 'text-amber-600', inProgressT)}
                            {renderGroup('已完结', 'task_alt', 'text-emerald-600', closedT)}
                          </>
                        )}
                      </div>
                    );
                  })()
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── Task Detail Modal (Readonly SmartTaskModal) ───────────────────────── */}
      <SmartTaskModal
        isOpen={!!selectedTask && modalStep === 'detail'}
        onClose={() => setSelectedTask(null)}
        onSubmit={() => {}}
        title="任务详情"
        type="pool_publish"
        users={users}
        readonly={true}
        initialData={(() => {
          if (!selectedTask) return {};
          const decoded = decodeSmartDescription(selectedTask.description || '');
          return {
            id: selectedTask.id,
            status: selectedTask.status || (selectedTask as any).proposal_status,
            flow_type: 'proposal',
            creator_name: selectedTask.creator_name,
            summary: selectedTask.title,
            s: selectedTask.title,
            m: '',
            a_smart: decoded.resource,
            r_smart: decoded.relevance,
            t: selectedTask.deadline || '',
            planTime: decoded.planTime,
            doTime: decoded.doTime,
            checkTime: decoded.checkTime,
            actTime: decoded.actTime,
            taskType: selectedTask.department,
            bonus: String(selectedTask.bonus),
            rewardType: selectedTask.reward_type
          };
        })()}
        customFooter={
          <div className="flex gap-3 w-full">
            <button onClick={() => setSelectedTask(null)}
              className="flex-1 py-3 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              暂不参与
            </button>
            <button onClick={() => setModalStep('apply')}
              className="flex-1 py-3 rounded-xl text-sm font-bold text-white primary-gradient shadow-md hover:opacity-90 transition-opacity">
              发起加入申请
            </button>
          </div>
        }
      />

      {/* ── Task Apply / Success Modal ─────────────────────────────────────────── */}
      {selectedTask && modalStep !== 'detail' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setSelectedTask(null)} />
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200">


            {/* Step: apply form */}
            {modalStep === 'apply' && (
              <>
                <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                  <button onClick={() => setModalStep('detail')} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                  </button>
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">发起加入申请</h3>
                    <p className="text-[10px] text-slate-400">{selectedTask.title}</p>
                  </div>
                  <button onClick={() => setSelectedTask(null)} className="ml-auto p-1 text-slate-400 hover:text-slate-700 transition-colors">
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>

                <div className="px-6 py-5 space-y-5">
                  {/* Applicant info */}
                  <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#0060a9] to-[#409eff] flex items-center justify-center text-white font-bold text-sm">
                      {currentUser?.name?.charAt(0) || '我'}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{currentUser?.name}</p>
                      <p className="text-[10px] text-slate-400">{currentUser?.title || currentUser?.role}</p>
                    </div>
                    <span className="ml-auto text-[10px] px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full font-medium">申请人</span>
                  </div>

                  {/* Role Selection */}
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2.5">
                      选择参与角色
                    </label>
                    <div className="flex gap-3">
                      {[
                        { key: 'R' as const, icon: 'person', label: '负责人', desc: '主导任务交付，对结果负最终责任', color: 'blue' },
                        { key: 'A' as const, icon: 'engineering', label: '执行人', desc: '实际执行任务，参与具体工作', color: 'emerald' },
                      ].map(r => (
                        <button key={r.key} onClick={() => setApplyRole(r.key)}
                          className={`flex-1 p-3.5 rounded-xl border-2 transition-all text-left ${
                            applyRole === r.key
                              ? `border-${r.color}-500 bg-${r.color}-50 dark:bg-${r.color}-900/20 ring-2 ring-${r.color}-500/20`
                              : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                          }`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`material-symbols-outlined text-[18px] ${applyRole === r.key ? `text-${r.color}-500` : 'text-slate-400'}`} style={{ fontVariationSettings: "'FILL' 1" }}>{r.icon}</span>
                            <span className={`text-sm font-bold ${applyRole === r.key ? `text-${r.color}-600 dark:text-${r.color}-400` : 'text-slate-600 dark:text-slate-300'}`}>
                              <span className="text-[10px] font-black mr-1 opacity-60">{r.key}</span>{r.label}
                            </span>
                            {applyRole === r.key && <span className={`ml-auto material-symbols-outlined text-[16px] text-${r.color}-500`}>check_circle</span>}
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed">{r.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Reason */}
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                      申请理由 <span className="text-slate-300 font-normal">(选填)</span>
                    </label>
                    <textarea
                      value={applyReason}
                      onChange={e => setApplyReason(e.target.value)}
                      placeholder="描述你的优势、经验或参与动机，帮助主管快速评估…"
                      rows={3}
                      className="w-full text-sm px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[#0060a9]/30 text-slate-700 dark:text-slate-300 placeholder-slate-400 transition-all"
                    />
                  </div>

                  {/* Flow hint */}
                  <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-200/60 dark:border-amber-800/40">
                    <span className="material-symbols-outlined text-amber-500 text-[16px] mt-0.5">info</span>
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">提交后将发送给直属主管审批，审批通过后正式加入任务并开始计算绩效。</p>
                  </div>
                </div>

                <div className="flex gap-3 px-6 pb-6">
                  <button onClick={() => setModalStep('detail')}
                    className="flex-1 py-3 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                    返回详情
                  </button>
                  <button onClick={handleJoinApply} disabled={applying}
                    className="flex-1 py-3 rounded-xl text-sm font-bold text-white primary-gradient shadow-md hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2">
                    {applying && <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>}
                    {applying ? '提交中…' : '提交申请'}
                  </button>
                </div>
              </>
            )}

            {/* Step: success */}
            {modalStep === 'success' && (
              <div className="px-8 py-10 text-center">
                <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-5">
                  <span className="material-symbols-outlined text-amber-500 text-3xl">schedule</span>
                </div>
                <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-2">申请已提交！</h3>
                <p className="text-sm text-slate-500 leading-relaxed mb-8">
                  你的加入申请已提交到管理员，<br/>审批通过后将正式加入「{selectedTask.title}」。
                </p>
                <button onClick={() => setSelectedTask(null)}
                  className="w-full py-3 rounded-xl text-sm font-bold text-white primary-gradient shadow-md hover:opacity-90 transition-opacity">
                  好的，知道了
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Recycle Bin Drawer ─────────────────────────────────────────────────── */}
      {showTrash && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowTrash(false)} />
          <div className="ml-auto relative w-full max-w-md bg-white dark:bg-slate-900 h-full flex flex-col shadow-2xl animate-in slide-in-from-right-8 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <span className="material-symbols-outlined text-red-500 text-[18px]">delete_sweep</span>
                </div>
                <div>
                  <h2 className="font-bold text-sm text-slate-800 dark:text-slate-100">回收站</h2>
                  <p className="text-[10px] text-slate-400">{deletedTasks.length > 0 ? `${deletedTasks.length} 个已删除任务` : '暂无记录'}</p>
                </div>
              </div>
              <button onClick={() => setShowTrash(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {deletedTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                  <span className="material-symbols-outlined text-7xl mb-3 opacity-30">recycling</span>
                  <p className="text-sm font-medium">回收站为空</p>
                </div>
              ) : deletedTasks.map((task: any) => (
                <div key={task.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700/60 overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <span className={`${getBadge(task).cls} text-[10px] font-bold px-2 py-0.5 rounded-full uppercase`}>{getBadge(task).label}</span>
                      <span className="text-primary font-black text-sm">¥{task.bonus?.toLocaleString()}</span>
                    </div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1 line-clamp-2">{task.title}</p>
                    <p className="text-[10px] text-slate-400">{task.department} · 难度: {DIFFICULTY_MAP[task.difficulty] || task.difficulty}</p>
                  </div>
                  <div className="flex border-t border-slate-100 dark:border-slate-700/60">
                    <button onClick={() => handleRestore(task.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-primary hover:bg-primary/5 transition-colors">
                      <span className="material-symbols-outlined text-[14px]">restore</span>恢复
                    </button>
                    <div className="w-px bg-slate-100 dark:bg-slate-700/60"/>
                    <button onClick={() => handlePermanentDelete(task)}
                      className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                      <span className="material-symbols-outlined text-[14px]">delete_forever</span>彻底删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {deletedTasks.length > 0 && (
              <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                <button onClick={handleClearTrash}
                  className="w-full py-2.5 text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl border border-red-200/60 transition-all flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-[14px]">delete_sweep</span>
                  清空回收站（{deletedTasks.length} 项）
                </button>
              </div>
            )}
          </div>
        </div>
      )}



      {/* ── Propose Task Modal ─────────────────────────────────────────────── */}
      <SmartTaskModal
        isOpen={showPropose}
        onClose={() => setShowPropose(false)}
        onSubmit={handleProposeSmart}
        title="申请绩效池提案"
        type="pool_propose"
        users={users}
        submitting={proposing}
        onDraft={async (data) => {
          try {
            const token = localStorage.getItem('token');
            const smartDescription = `【目标 S】${data.s}\n【指标 M】${data.m}\n【方案 A】${data.a_smart}\n【相关 R】${data.r_smart}\n【时限 T】${data.t}`;
            const res = await fetch('/api/pool/tasks/propose', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                title: data.summary || '草稿提案',
                description: smartDescription,
                department: data.taskType || '',
                difficulty: '中',
                reward_type: data.rewardType,
                bonus: Number(data.bonus) || 0,
                max_participants: 5,
                is_draft: true,
              }),
            });
            const json = await res.json();
            if (json.code === 0) {
              alert('草稿已保存');
              fetchMyProposals();
              setShowPropose(false);
            } else { alert(json.message); }
          } catch { alert('保存失败'); }
        }}
        initialData={{
          summary: '提出公司级或跨部门的新项目提案，经审批后入池',
          s: '预期达成什么样的关键结果？',
          m: '如何衡量成果的好坏（交付标准）？',
          a_smart: '初步的执行思路和需要的资源支持有哪些？',
          r_smart: '该提案能为公司带来什么价值或解决什么痛点？',
          t: '期望完成的合适时间周期是？',
          taskType: '重点项目',
          bonus: '0',
          rewardType: 'money',
          r: currentUser?.id
        }}
      />

      {/* ── Publish Task Modal ─────────────────────────────────────────────── */}
      <SmartTaskModal
        isOpen={showPublish}
        onClose={() => setShowPublish(false)}
        onSubmit={handlePublishTask}
        title="发布公司级任务"
        type="pool_publish"
        users={users}
        submitting={publishing}
        initialData={{
          summary: '发布直接生效的公司级核心任务',
          s: '预期达成什么样的关键结果？',
          m: '如何衡量成果的好坏（交付标准）？',
          a_smart: '初步的执行思路和需要的资源支持有哪些？',
          r_smart: '该任务能为公司带来什么核心价值？',
          t: '期望完成的合适时间周期是？',
          taskType: '重点项目',
          bonus: '0',
          rewardType: 'money',
          r: currentUser?.id
        }}
      />

      {/* ── My Proposals Panel ─────────────────────────────────────────────── */}
      {showMyProposals && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowMyProposals(false)} />
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-gradient-to-br from-[#7c3aed] to-[#a78bfa] px-6 py-4 text-white flex items-center justify-between">
              <h3 className="font-bold text-lg">我的提案</h3>
              <button onClick={() => setShowMyProposals(false)} className="text-white/60 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto space-y-3">
              {myProposals.length === 0 ? (
                <p className="text-center text-slate-400 py-8">暂无提案</p>
              ) : myProposals.map((p: any) => {
                const [statusLabel, statusCls] = PROPOSAL_STATUS[p.proposal_status] || [p.proposal_status, 'bg-slate-100 text-slate-500'];
                return (
                  <div key={p.id} onClick={() => { setShowMyProposals(false); setViewingProposal(p); }} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate">{p.title}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusCls}`}>{statusLabel}</span>
                    </div>
                    {p.description && <p className="text-xs text-slate-500 mb-2 line-clamp-2">{p.description}</p>}
                    <div className="flex items-center gap-3 text-[10px] text-slate-400">
                      <span>奖金: ¥{p.bonus || 0}</span>
                      <span>难度: {p.difficulty || '中'}</span>
                      <span>{new Date(p.created_at).toLocaleDateString()}</span>
                    </div>
                    {p.reject_reason && (
                      <div className="mt-2 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-1.5 text-xs text-red-600">
                        <span className="font-bold">驳回原因：</span>{p.reject_reason}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Viewing/Editing a Proposal ─────────────────────────────── */}
      {viewingProposal && (
        <SmartTaskModal
          isOpen={!!viewingProposal}
          onClose={() => setViewingProposal(null)}
          onSubmit={async (data) => {
            // For drafts: submit as proposal
            try {
              const token = localStorage.getItem('token');
              const smartDescription = `【目标 S】${data.s}\n【指标 M】${data.m}\n【方案 A】${data.a_smart}\n【相关 R】${data.r_smart}\n【时限 T】${data.t}`;
              await fetch(`/api/pool/tasks/${viewingProposal.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                  title: data.summary || viewingProposal.title,
                  description: smartDescription,
                  department: data.taskType || viewingProposal.department,
                  difficulty: viewingProposal.difficulty || '中',
                  reward_type: data.rewardType || viewingProposal.reward_type,
                  bonus: Number(data.bonus) || viewingProposal.bonus || 0,
                  proposal_status: 'pending_hr',
                }),
              });
              setViewingProposal(null);
              fetchMyProposals();
            } catch { alert('提交失败'); }
          }}
          title={viewingProposal.proposal_status === 'draft' ? '编辑草稿提案' : '提案详情'}
          type="pool_propose"
          users={users}
          submitting={false}
          readonly={viewingProposal.proposal_status !== 'draft'}
          initialData={(() => {
            const p = viewingProposal;
            const desc = p.description || '';
            const extract = (label: string) => {
              const m = desc.match(new RegExp(`【${label}】([\\s\\S]*?)(?=【|$)`));
              return m ? m[1].trim() : '';
            };
            return {
              id: p.id,
              status: p.proposal_status,
              flow_type: 'proposal',
              summary: p.title,
              s: extract('目标 S'),
              m: extract('指标 M'),
              a_smart: extract('方案 A'),
              r_smart: extract('相关 R'),
              t: extract('时限 T'),
              taskType: p.department || '',
              bonus: String(p.bonus || 0),
              rewardType: p.reward_type || 'money',
              hr_reviewer_name: p.hr_reviewer_name,
              hr_reviewer_id: p.hr_reviewer_id,
              admin_reviewer_name: p.admin_reviewer_name,
              admin_reviewer_id: p.admin_reviewer_id,
              creator_name: p.creator_name || currentUser?.name,
            };
          })()}
        />
      )}

      {/* ── Custom Confirm Dialog ─────────────────────────────────────────────── */}
      {dialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={closeDialog} />
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 fade-in duration-150">
            <div className="px-6 pt-6 pb-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-red-500 text-2xl">warning</span>
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-2">{dialog.title}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{dialog.description}</p>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={closeDialog}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">取消</button>
              <button onClick={dialog.onConfirm}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${dialog.confirmClass}`}>{dialog.confirmLabel}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
