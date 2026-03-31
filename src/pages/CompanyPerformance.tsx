import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import SmartGoalDisplay from '../components/SmartGoalDisplay';
import SmartTaskModal, { SmartTaskData } from '../components/SmartTaskModal';
import { decodeSmartDescription } from '../components/SmartFormInputs';
import { useIsMobile } from '../hooks/useIsMobile';
import STARReportModal from '../components/STARReportModal';
import RewardDistributionModal from '../components/RewardDistributionModal';

interface PoolTask {
  id: number;
  status: 'proposing' | 'published' | 'claiming' | 'in_progress' | 'rewarded';
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
  proposal_status?: string;
  roles_config?: { name: string; reward: number; required: number }[];
  role_claims?: { id: number; role_name: string; user_id: string; user_name: string; status: string; reward: number }[];
}

type StatusFilter = 'all' | 'published' | 'claiming' | 'in_progress' | 'rewarded';
type BonusFilter = 'all' | 'low' | 'mid' | 'high';
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
  const [applyRole, setApplyRole] = useState<'R' | 'A' | 'C' | 'I'>('R');
  const [applying, setApplying] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [bonusFilter, setBonusFilter] = useState<BonusFilter>('all');
  const [deptFilter, setDeptFilter] = useState('全部部门');
  const [topDepts, setTopDepts] = useState<string[]>(['全部部门']);
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

  // My Claims state
  const [myClaims, setMyClaims] = useState<any[]>([]);
  const [showMyClaims, setShowMyClaims] = useState(false);

  // New features state
  const [activeTab, setActiveTab] = useState<'task' | 'personnel'>('task');
  const [searchKey, setSearchKey] = useState('');
  const [personnelSearchKey, setPersonnelSearchKey] = useState('');
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);

  // Publish Task state
  const [showPublish, setShowPublish] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // 奖励分配平台 state
  const [showStarModal, setShowStarModal] = useState<PoolTask | null>(null);
  const [showExtendModal, setShowExtendModal] = useState<PoolTask | null>(null);
  const [showTerminateModal, setShowTerminateModal] = useState<PoolTask | null>(null);
  const [showRewardModal, setShowRewardModal] = useState<PoolTask | null>(null);
  const [extendForm, setExtendForm] = useState({ new_deadline: '', reason: '', impact_analysis: '' });
  const [terminateForm, setTerminateForm] = useState({ reason: '', actual_completion: '80', delivered_content: '' });
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);


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

  const fetchMyClaims = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/pool/my-claims', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.code === 0) setMyClaims(json.data);
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

  const fetchTopDepts = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/org/departments', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.code === 0 && Array.isArray(json.data)) {
        // Collect A-level departments (usually parent_id 0 or 1)
        const aLevel = json.data.filter((d: any) => d.parent_id === 1 || d.parent_id === 0);
        // We only map name, ensure uniqueness
        const names = Array.from(new Set(aLevel.map((d: any) => d.name))) as string[];
        setTopDepts(['全部部门', ...names]);
      }
    } catch {}
  };

  useEffect(() => { fetchTasks(); fetchTopDepts(); fetchMyProposals(); fetchMyClaims(); fetchLeaderboard(); fetchUsers(); fetchTrash(); }, []);

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
          max_participants: Number(data.maxParticipants) || 5,
          attachments: data.attachments || []
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
          max_participants: Number(data.maxParticipants) || 5,
          attachments: data.attachments || []
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
    // 提案中的任务不在赏金榜展示
    if (t.status === 'proposing') return false;
    if (searchKey) {
      const kw = searchKey.toLowerCase();
      if (!t.title.toLowerCase().includes(kw) && !(t.description && t.description.toLowerCase().includes(kw))) return false;
    }
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (deptFilter !== '全部部门' && t.department !== deptFilter) return false;
    if (bonusFilter === 'low' && t.bonus > 5000) return false;
    if (bonusFilter === 'mid' && (t.bonus <= 5000 || t.bonus > 20000)) return false;
    if (bonusFilter === 'high' && t.bonus <= 20000) return false;
    return true;
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
      const res = await fetch(`/api/pool/tasks/${selectedTask.id}/claim-role`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_name: applyRole, reason: applyReason }),
      });
      const json = await res.json();
      if (json.code === 0) {
        setModalStep('success');
        fetchTasks(); // Refresh participant count
        fetchMyClaims(); // Refresh my claims list
      } else {
        alert(json.message || '申请失败，请稍后重试');
      }
    } catch {
      alert('网络异常，请稍后重试');
    }
    setApplying(false);
  };

  const statusBtns: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: '全部' },
    ...(canManagePool ? [{ key: 'published' as StatusFilter, label: '发布' }] : []),
    { key: 'claiming', label: '认领中' },
    { key: 'in_progress', label: '进行中' },
    { key: 'rewarded', label: '已发赏' },
  ];
  const bonusBtns: { key: BonusFilter; label: string }[] = [
    { key: 'all', label: '全部奖金' }, { key: 'low', label: '¥0–5k' }, { key: 'mid', label: '¥5k–20k' }, { key: 'high', label: '¥20k+' },
  ];

  const isFull = (t: PoolTask) => t.current_participants >= t.max_participants;
  const isJoined = false; // TODO: track per user

  const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
    published: { label: '发布', cls: 'bg-sky-100 text-sky-700' },
    claiming: { label: '认领中', cls: 'bg-blue-100 text-blue-700' },
    in_progress: { label: '进行中', cls: 'bg-emerald-100 text-emerald-700' },
    rewarded: { label: '已发赏', cls: 'bg-purple-100 text-purple-700' },
  };
  const getBadge = (t: PoolTask) => STATUS_BADGE[t.status] || { label: t.status, cls: 'bg-slate-100 text-slate-500' };

  const detail = selectedTask ? (MOCK_DETAILS[selectedTask.id] || MOCK_DETAILS.default) : MOCK_DETAILS.default;

  return (
    <div className="bg-background text-on-background min-h-screen">
      <Sidebar currentView="company" navigate={navigate} />

      <main className={`flex-1 mt-16 min-h-[calc(100vh-4rem)] overflow-y-auto ${isMobile ? 'pb-20' : ''}`}>
        <div className={`max-w-screen-2xl mx-auto ${isMobile ? 'px-4 pt-4 pb-6' : 'px-8 pt-6 pb-10'}`}>

          {/* ── 顶部统计概览卡 ── */}
          {!isMobile && !loading && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              {(() => {
                const activeTasks = tasks.filter(t => t.status === 'in_progress' || t.status === 'claiming');
                const totalBonus = tasks.filter(t => t.reward_type !== 'score').reduce((sum, t) => sum + (t.bonus || 0), 0);
                const totalParticipants = leaderboard.length;
                const completedTasks = tasks.filter(t => t.status === 'rewarded').length;
                const stats = [
                  { label: '任务总数', value: tasks.filter(t=>t.status!=='proposing').length, sub: `${completedTasks} 已发赏`, icon: 'task_alt', gradient: 'from-blue-500 to-indigo-600' },
                  { label: '进行中', value: activeTasks.length, sub: `${tasks.filter(t=>t.status==='claiming').length} 认领中`, icon: 'directions_run', gradient: 'from-emerald-500 to-teal-600' },
                  { label: '奖金池总额', value: `¥${totalBonus.toLocaleString()}`, sub: '现金奖励合计', icon: 'paid', gradient: 'from-amber-500 to-orange-600' },
                  { label: '参与员工', value: totalParticipants, sub: '上榜人数', icon: 'people', gradient: 'from-purple-500 to-violet-600' },
                ];
                return stats.map(s => (
                  <div key={s.label} className={`bg-gradient-to-br ${s.gradient} rounded-xl px-4 py-2.5 text-white shadow-md flex items-center gap-3`}>
                    <span className="material-symbols-outlined text-white/60 text-[20px] flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>{s.icon}</span>
                    <div className="min-w-0">
                      <p className="text-xl font-black tracking-tight leading-tight">{s.value}</p>
                      <p className="text-[11px] text-white/80 font-bold leading-tight">{s.label} <span className="text-white/50 font-normal">· {s.sub}</span></p>
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}

          {/* Title Row (Action Buttons) */}
          <div className={`flex justify-end mb-3 ${isMobile ? '' : ''}`}>
            <div className={`flex items-center ${isMobile ? 'gap-1.5 w-full' : 'gap-2'}`}>
              {canManagePool && (
                <button onClick={() => navigate('workflows?tab=pending')}
                  className={`flex items-center gap-1 bg-white dark:bg-slate-800 rounded-lg text-primary hover:bg-primary/5 shadow-sm transition-all border border-primary/20 ${isMobile ? 'p-2' : 'px-4 py-2 text-xs font-bold'}`}>
                  <span className={`material-symbols-outlined ${isMobile ? 'text-[18px]' : 'text-[16px]'}`}>rule</span>
                  {!isMobile && '审批'}
                </button>
              )}
              {canDeleteTask && (
                <button onClick={() => { setShowTrash(true); fetchTrash(); }}
                  className={`relative flex items-center gap-1 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-all border border-outline-variant/10 bg-surface-container-low ${isMobile ? 'p-2' : 'px-3 py-2 text-xs font-medium'}`}>
                  <span className={`material-symbols-outlined ${isMobile ? 'text-[18px]' : 'text-[16px]'}`}>delete_sweep</span>
                  {!isMobile && '回收站'}
                  {deletedTasks.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{deletedTasks.length}</span>
                  )}
                </button>
              )}
              {canManagePool && (
                <button onClick={() => setShowPublish(true)}
                  className={`flex items-center gap-1 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-all border border-outline-variant/10 bg-surface-container-low ${isMobile ? 'p-2' : 'px-3 py-2 text-xs font-medium'}`}>
                  <span className={`material-symbols-outlined ${isMobile ? 'text-[18px]' : 'text-[16px]'}`}>publish</span>
                  {!isMobile && '发布任务'}
                </button>
              )}
              <button onClick={() => setShowPropose(true)} title="发现公司改进点，有机会获得奖励"
                className={`relative flex items-center gap-1 bg-amber-50 rounded-lg font-bold text-amber-700 hover:bg-amber-100 transition-all border border-amber-200/60 shadow-sm shadow-amber-100/50 ${isMobile ? 'p-2 ml-auto' : 'px-3 py-2 text-xs'}`}>
                <span className={`material-symbols-outlined ${isMobile ? 'text-[18px]' : 'text-[16px]'}`}>add_task</span>
                {isMobile ? '提案' : '申请提案'}
                <span className={`absolute -top-1.5 -right-1.5 px-1 py-0.5 bg-gradient-to-r from-amber-400 to-orange-400 text-white font-black rounded-full shadow-sm ${isMobile ? 'text-[8px]' : 'text-[9px]'}`}>奖</span>
              </button>
              <button onClick={() => setShowMyProposals(!showMyProposals)}
                className={`relative flex items-center gap-1 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-all border border-outline-variant/10 bg-surface-container-low ${isMobile ? 'p-2' : 'px-3 py-2 text-xs font-medium'}`}>
                <span className={`material-symbols-outlined ${isMobile ? 'text-[18px]' : 'text-[16px]'}`}>pending_actions</span>
                {!isMobile && '我的提案'}
                {myProposals.length > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 bg-violet-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 pointer-events-none">{myProposals.length}</span>
                )}
              </button>
              <button onClick={() => setShowMyClaims(!showMyClaims)}
                className={`relative flex items-center gap-1 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-all border border-outline-variant/10 bg-surface-container-low ${isMobile ? 'p-2' : 'px-3 py-2 text-xs font-medium'}`}>
                <span className={`material-symbols-outlined ${isMobile ? 'text-[18px]' : 'text-[16px]'}`}>assignment_ind</span>
                {!isMobile && '我的认领'}
                {myClaims.length > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 bg-blue-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 pointer-events-none">{myClaims.length}</span>
                )}
              </button>
            </div>
          </div>

          {/* Filter / Search Bar with View Toggles */}
          <div className={`flex items-center bg-surface-container-low rounded-2xl border border-outline-variant/10 mb-4 ${isMobile ? 'flex-col p-2.5 gap-2' : 'flex-wrap p-4 gap-4 mb-6'}`}>
            {/* View toggle - hide personnel on mobile */}
            {!isMobile && (
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
            )}

            {(isMobile || activeTab === 'task') ? (
              <>
                {/* Search bar */}
                <div className={`relative ${isMobile ? 'w-full' : 'flex-1 min-w-[200px] max-w-sm'}`}>
                  <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[16px]">search</span>
                  <input type="text" placeholder="搜索任务..." value={searchKey} onChange={e => setSearchKey(e.target.value)}
                    className={`w-full pl-8 pr-3 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all ${isMobile ? 'py-1.5 text-[13px]' : 'py-2 text-xs'}`} />
                </div>
                {/* Status + Bonus filters: horizontal scroll on mobile */}
                <div className={`flex items-center gap-1.5 ${isMobile ? 'w-full overflow-x-auto scrollbar-hide' : ''}`}>
                  <div className={`flex items-center gap-0.5 bg-surface-container rounded-lg p-0.5 shrink-0`}>
                    {statusBtns.map(b => (
                      <button key={b.key} onClick={() => setStatusFilter(b.key)}
                        className={`shrink-0 px-2 py-1 text-[11px] font-medium rounded-md transition-all ${statusFilter === b.key ? 'bg-primary text-white shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-highest'}`}>
                        {b.label}
                      </button>
                    ))}
                  </div>
                  <div className={`flex items-center gap-0.5 bg-surface-container rounded-lg p-0.5 shrink-0`}>
                    {bonusBtns.map(b => (
                      <button key={b.key} onClick={() => setBonusFilter(b.key)}
                        className={`shrink-0 px-2 py-1 text-[11px] font-medium rounded-md transition-all ${bonusFilter === b.key ? 'bg-primary text-white shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-highest'}`}>
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Dept + sort row */}
                <div className={`flex items-center ${isMobile ? 'w-full justify-between' : 'gap-2'}`}>
                  <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
                    className={`bg-surface-container border-none ring-1 ring-outline-variant/30 rounded-lg focus:ring-2 focus:ring-primary outline-none text-on-surface font-medium ${isMobile ? 'text-[11px] px-2 py-1' : 'text-xs px-3 py-2 rounded-xl'}`}>
                    {topDepts.map(d => <option key={d}>{d}</option>)}
                  </select>
                  <div className="flex items-center gap-1.5">
                    {!isMobile && <span className="text-xs text-on-surface-variant">奖金排序</span>}
                    <button onClick={() => setSortByBonus(p => !p)}
                      className={`relative w-8 h-4 rounded-full transition-colors ${sortByBonus ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'}`}>
                      <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${sortByBonus ? 'translate-x-4' : 'translate-x-0.5'}`}/>
                    </button>
                    <span className={`text-on-surface-variant font-bold ${isMobile ? 'text-[11px]' : 'text-xs'}`}>{displayed.length} 个任务</span>
                  </div>
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
            <div className={`grid ${isMobile ? 'grid-cols-1 gap-2.5' : 'grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5'}`}>
              {displayed.map(task => {
                const badge = getBadge(task);
                const full = isFull(task);
                const pct = task.max_participants > 0 ? Math.round((task.current_participants / task.max_participants) * 100) : 0;
                const isScore = task.reward_type === 'score';
                return isMobile ? (
                  /* ── 移动端紧凑卡片 ── */
                  <div key={task.id}
                    className="group bg-surface-container-low rounded-xl border border-outline-variant/10 active:scale-[0.98] transition-transform cursor-pointer overflow-hidden"
                    onClick={() => !full && openTaskDetail(task)}
                  >
                    <div className="flex items-stretch">
                      {/* 左侧：奖金色带 */}
                      <div className={`w-1 shrink-0 ${isScore ? 'bg-gradient-to-b from-amber-400 to-orange-500' : 'bg-gradient-to-b from-blue-400 to-blue-600'}`} />
                      {/* 右侧：内容 */}
                      <div className="flex-1 px-3 py-2.5">
                        {/* 第一行：标题 + 奖金 */}
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <h3 className="text-[13px] font-bold text-on-surface leading-tight line-clamp-1 flex-1">{task.title}</h3>
                          {isScore ? (
                            <span className="text-orange-500 font-black text-sm tracking-tight whitespace-nowrap">{task.bonus.toLocaleString()}分</span>
                          ) : (
                            <span className="text-primary font-black text-sm tracking-tight whitespace-nowrap">¥{task.bonus.toLocaleString()}</span>
                          )}
                        </div>
                        {/* 第二行：标签 + 进度 + 按钮 */}
                        <div className="flex items-center gap-1.5">
                          <span className={`${badge.cls} text-[9px] font-bold px-1.5 py-px rounded-full shrink-0`}>{badge.label}</span>
                          {task.department && <span className="text-[10px] text-on-surface-variant">{task.department}</span>}
                          <span className={`text-[10px] px-1 rounded ${DIFFICULTY_COLOR[task.difficulty] || 'bg-slate-100 text-slate-600'}`}>
                            {DIFFICULTY_MAP[task.difficulty] || task.difficulty}
                          </span>
                          {/* 进度条 (内联迷你) */}
                          <div className="flex-1 flex items-center gap-1 ml-auto">
                            <div className="flex-1 max-w-[60px] bg-surface-container-highest h-1 rounded-full overflow-hidden">
                              <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${pct}%` }}></div>
                            </div>
                            <span className="text-[10px] text-on-surface-variant whitespace-nowrap">{task.current_participants}/{task.max_participants}</span>
                          </div>
                          {/* 操作按钮 */}
                          {full ? (
                            <span className="text-[10px] text-on-surface-variant bg-surface-container-lowest px-2 py-0.5 rounded font-medium shrink-0">已满</span>
                          ) : (
                            <button onClick={(e) => { e.stopPropagation(); openTaskDetail(task); }}
                              className="text-[10px] text-primary bg-primary/5 border border-primary/20 px-2.5 py-0.5 rounded-md font-bold shrink-0 hover:bg-primary hover:text-white transition-colors">
                              加入
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* ── 桌面端原始卡片 ── */
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
                        <button disabled className={`w-full text-xs bg-surface-container-lowest text-on-surface-variant font-bold rounded-lg border border-outline-variant/20 cursor-not-allowed ${isMobile ? 'py-1.5' : 'py-2.5 rounded-xl'}`}>已满</button>
                      ) : (
                        <button onClick={(e) => { e.stopPropagation(); openTaskDetail(task); }}
                          className={`w-full text-xs bg-surface-container-lowest text-primary font-bold rounded-lg border border-primary/20 hover:bg-primary hover:text-white transition-all ${isMobile ? 'py-1.5' : 'py-2.5 rounded-xl'}`}>
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
                     const closedCount = userTasks.filter(t => t.status === 'rewarded').length;
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
                    
                    const openT = userTasks.filter(t => t.status === 'claiming');
                    const inProgressT = userTasks.filter(t => t.status === 'in_progress');
                    const closedT = userTasks.filter(t => t.status === 'rewarded');
                    
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
                            {renderGroup('认领中', 'person_add', 'text-blue-600', openT)}
                            {renderGroup('进行中', 'directions_run', 'text-amber-600', inProgressT)}
                            {renderGroup('已发赏', 'task_alt', 'text-emerald-600', closedT)}
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
            rewardType: selectedTask.reward_type,
            maxParticipants: String(selectedTask.max_participants),
            attachments: (selectedTask as any).attachments ? JSON.parse((selectedTask as any).attachments) : []
          };
        })()}
        customFooter={
          <div className="w-full">
            {/* ── 已认领成员展示 ── */}
            {(() => {
              const approvedClaims = (selectedTask?.role_claims || []).filter((c: any) => c.status === 'approved');
              if (approvedClaims.length === 0 || !['claiming', 'in_progress', 'rewarded'].includes(selectedTask?.status || '')) return null;
              
              const ROLE_LABELS: Record<string, string> = { R: '执行者', A: '责任验收者', C: '被咨询者', I: '被告知者' };
              const ROLE_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
                A: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-400' },
                R: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-400' },
                C: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-400' },
                I: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', dot: 'bg-slate-400' },
              };
              // Group by role
              const grouped: Record<string, typeof approvedClaims> = {};
              approvedClaims.forEach((c: any) => {
                if (!grouped[c.role_name]) grouped[c.role_name] = [];
                grouped[c.role_name].push(c);
              });
              const roleOrder = ['A', 'R', 'C', 'I'];

              return (
                <div className="mb-3 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="material-symbols-outlined text-[16px] text-emerald-500">group</span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">项目成员</span>
                    <span className="text-[10px] text-slate-400 ml-auto">{approvedClaims.length}人已加入</span>
                  </div>
                  <div className="space-y-1.5">
                    {roleOrder.filter(r => grouped[r]).map(role => {
                      const colors = ROLE_COLORS[role] || ROLE_COLORS.I;
                      return (
                        <div key={role} className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${colors.bg} ${colors.text} border ${colors.border}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`}></span>
                            {role} {ROLE_LABELS[role]}
                          </span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {grouped[role].map((c: any) => (
                              <span key={c.id} className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
                                <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white text-[9px] font-bold flex items-center justify-center shadow-sm">
                                  {(c.user_name || '?')[0]}
                                </span>
                                {c.user_name}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* ── 我的认领审批状态 ── */}
            {(() => {
              const myClaimsList = (selectedTask?.role_claims || []).filter((c: any) => c.user_id === currentUser?.id);
              if (myClaimsList.length === 0) return null;
              return (
                <div className="w-full mb-3 space-y-2">
                  {myClaimsList.map((myClaim: any) => {
                    const isPending = myClaim.status === 'pending';
                    const isApproved = myClaim.status === 'approved';
                    const isRejected = myClaim.status === 'rejected';
                    
                    return (
                      <div key={myClaim.id} className={`w-full p-3 rounded-xl border ${isPending ? 'bg-amber-50 border-amber-200' : isApproved ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`material-symbols-outlined text-[16px] ${isPending ? 'text-amber-600' : isApproved ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {isPending ? 'pending_actions' : isApproved ? 'check_circle' : 'cancel'}
                          </span>
                          <span className="text-xs font-bold text-slate-700">我申请的 [{myClaim.role_name}] 角色审批进度</span>
                          <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${isPending ? 'bg-amber-100 text-amber-700' : isApproved ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                            {isPending ? 'HR / 管理员审核中' : isApproved ? '已批准' : '已驳回'}
                          </span>
                        </div>
                        {isPending && (
                           <div className="text-[11px] text-amber-700 ml-6 flex items-center gap-1">
                             <span className="material-symbols-outlined text-[12px] animate-pulse">schedule</span>
                             该认领申请已提交，等待人事(HR)或总经办审批。
                           </div>
                        )}
                        {myClaim.review_comment && (
                          <div className={`text-[11px] ml-6 mt-1.5 p-1.5 rounded-md ${isApproved ? 'bg-emerald-100/50 text-emerald-700' : 'bg-rose-100/50 text-rose-700'}`}>
                            <span className="font-bold">审批人批注：</span>{myClaim.review_comment}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* ── 操作按钮 ── */}
            <div className="flex gap-3 w-full flex-wrap">
            {selectedTask?.status === 'claiming' ? (
              <>
                <button onClick={() => setSelectedTask(null)}
                  className="flex-1 py-3 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                  暂不参与
                </button>
                <button onClick={() => setModalStep('apply')}
                  className="flex-1 py-3 rounded-xl text-sm font-bold text-white primary-gradient shadow-md hover:opacity-90 transition-opacity">
                  认领角色
                </button>
              </>
            ) : selectedTask?.status === 'published' && canManagePool ? (
              <button onClick={async () => {
                if (!confirm('确认发布认领？发布后所有员工可认领角色')) return;
                const token = localStorage.getItem('token');
                const res = await fetch(`/api/pool/tasks/${selectedTask.id}/start-claiming`, {
                  method: 'POST', headers: { Authorization: `Bearer ${token}` }
                });
                const json = await res.json();
                if (json.code === 0) {
                  fetchTasks();
                  setSelectedTask(null);
                } else {
                  alert(json.message);
                }
              }}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-sky-600 shadow-md hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-[18px]">rocket_launch</span>
                发布认领
              </button>
            ) : selectedTask?.status === 'proposing' && canManagePool ? (
              <button onClick={() => { setSelectedTask(null); navigate('workflows'); }}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-amber-500 shadow-md hover:opacity-90 transition-opacity">
                前往审核
              </button>
            ) : (
              <button onClick={() => setSelectedTask(null)}
                className="flex-1 py-3 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                关闭
              </button>
            )}
            </div>

            {/* ── 赏金榜专用操作（in_progress / completed / terminated）── */}
            {['in_progress', 'completed', 'terminated'].includes(selectedTask?.status || '') && (() => {
              const myClaim = (selectedTask?.role_claims || []).find((c: any) => c.user_id === currentUser?.id && c.status === 'approved');
              const myRole = myClaim?.role_name;
              const isA = myRole === 'A';
              const isRA = myRole === 'R' || myRole === 'A';
              if (!myClaim) return null;
              return (
                <div className="w-full border-t border-slate-100 dark:border-slate-800 pt-3 space-y-2">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    我的操作（{myRole}·{myRole === 'A' ? '负责人' : '执行人'}）
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {/* STAR 填写 — R/A 均可 */}
                    {isRA && (
                      <button
                        onClick={() => setShowStarModal(selectedTask!)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-violet-50 border border-violet-200 text-violet-700 rounded-xl text-xs font-bold hover:bg-violet-100 transition-colors">
                        <span className="material-symbols-outlined text-[14px]">star</span>
                        填写我的 STAR
                      </button>
                    )}
                    {/* 延期 — 仅 A 角色，任务进行中 */}
                    {isA && selectedTask?.status === 'in_progress' && (
                      <button
                        onClick={() => setShowExtendModal(selectedTask!)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl text-xs font-bold hover:bg-blue-100 transition-colors">
                        <span className="material-symbols-outlined text-[14px]">schedule</span>
                        申请延期
                      </button>
                    )}
                    {/* 提前完结 — 仅 A 角色，任务进行中 */}
                    {isA && selectedTask?.status === 'in_progress' && (
                      <button
                        onClick={() => setShowTerminateModal(selectedTask!)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-xs font-bold hover:bg-amber-100 transition-colors">
                        <span className="material-symbols-outlined text-[14px]">stop_circle</span>
                        提前完结
                      </button>
                    )}
                    {/* 发起奖励分配 — 仅 A 角色，100% 或已终止 */}
                    {isA && ['completed', 'terminated'].includes(selectedTask?.status || '') && (
                      <button
                        onClick={() => setShowRewardModal(selectedTask!)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-orange-400 to-amber-500 text-white rounded-xl text-xs font-bold hover:opacity-90 transition-opacity shadow-sm">
                        <span className="material-symbols-outlined text-[14px]">workspace_premium</span>
                        发起奖励分配
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
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
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: 'R' as const, icon: 'engineering', label: '执行者', desc: '实际执行任务，参与具体工作（可多人）', color: 'blue' },
                        { key: 'A' as const, icon: 'verified', label: '责任验收者', desc: '对结果负最终责任，验收交付物（仅一人）', color: 'emerald' },
                        { key: 'C' as const, icon: 'forum', label: '被咨询者', desc: '提供专业意见和建议支持（顾问角色）', color: 'amber' },
                        { key: 'I' as const, icon: 'notifications', label: '被告知者', desc: '接收进度通知，不参与具体工作', color: 'slate' },
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

                  {/* RACI 原则说明 */}
                  <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-slate-700">
                    <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-2 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">info</span>RACI 责任矩阵原则
                    </p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-slate-500 dark:text-slate-400">
                      <div><strong className="text-blue-600">R</strong> Responsible — 执行者，负责完成具体工作</div>
                      <div><strong className="text-emerald-600">A</strong> Accountable — 责任人，对结果负最终责任</div>
                      <div><strong className="text-amber-600">C</strong> Consulted — 咨询者，提供专业意见</div>
                      <div><strong className="text-slate-600">I</strong> Informed — 知情者，接收进展通知</div>
                    </div>
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
                max_participants: Number(data.maxParticipants) || 5,
                attachments: data.attachments || [],
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
          summary: '',
          s: '',
          m: '',
          a_smart: '',
          r_smart: '',
          t: '',
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
          summary: '',
          s: '',
          m: '',
          a_smart: '',
          r_smart: '',
          t: '',
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
                  <div key={p.id} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
                    <div onClick={() => { setShowMyProposals(false); setViewingProposal(p); }} className="cursor-pointer hover:opacity-80 transition-opacity">
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
                    {p.proposal_status === 'rejected' && (
                      <div className="flex gap-2 mt-3 w-full">
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!window.confirm('确认永久删除该被驳回的提案？操作将不可撤销。')) return;
                            try {
                              const token = localStorage.getItem('token');
                              const res = await fetch(`/api/pool/tasks/${p.id}`, {
                                method: 'DELETE',
                                headers: { Authorization: `Bearer ${token}` }
                              });
                              const data = await res.json();
                              if (data.code === 0 || data.success) {
                                fetchMyProposals();
                              } else { alert(data.message || '删除失败'); }
                            } catch { alert('删除失败'); }
                          }}
                          className="px-3 py-2 bg-rose-50 text-rose-500 rounded-xl text-[12px] font-bold border border-rose-200 hover:bg-rose-100 transition-colors shrink-0 flex items-center justify-center group"
                          title="删除被驳回提案"
                        >
                          <span className="material-symbols-outlined text-[16px] group-active:scale-95 transition-transform">delete</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowMyProposals(false);
                            setProposeForm({
                              title: p.title || '',
                              description: p.description || '',
                              department: p.department || '',
                              difficulty: p.difficulty || '中',
                              bonus: String(p.bonus || ''),
                              max_participants: String(p.max_participants || '5'),
                            });
                            setShowPropose(true);
                          }}
                          className="flex-1 py-2 bg-violet-500 text-white rounded-xl text-xs font-bold hover:bg-violet-600 transition-colors flex justify-center items-center"
                        >
                          ✏️ 修改后重新提案
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

            </div>
          </div>
        </div>
      )}

      {/* ── My Claims Panel ── */}
      {showMyClaims && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowMyClaims(false)} />
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-gradient-to-br from-[#0060a9] to-[#4da3e8] px-6 py-4 text-white flex items-center justify-between">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]">assignment_ind</span>
                我的认领
              </h3>
              <button onClick={() => setShowMyClaims(false)} className="text-white/60 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto space-y-3">
              {myClaims.length === 0 ? (
                <div className="text-center py-8">
                  <span className="material-symbols-outlined text-[40px] text-slate-300 mb-2 block">assignment</span>
                  <p className="text-slate-400 text-sm">暂未认领任何任务</p>
                  <p className="text-slate-300 text-xs mt-1">可在赏金榜中选择感兴趣的任务认领角色</p>
                </div>
              ) : myClaims.map((c: any) => {
                const ROLE_LABELS: Record<string, string> = { R: '执行者', A: '责任验收者', C: '被咨询者', I: '被告知者' };
                const ROLE_COLORS: Record<string, string> = {
                  A: 'bg-amber-100 text-amber-700 border-amber-200',
                  R: 'bg-blue-100 text-blue-700 border-blue-200',
                  C: 'bg-purple-100 text-purple-700 border-purple-200',
                  I: 'bg-slate-100 text-slate-600 border-slate-200',
                };
                const CLAIM_STATUS: Record<string, [string, string]> = {
                  pending: ['审核中', 'bg-yellow-100 text-yellow-700'],
                  approved: ['已通过', 'bg-emerald-100 text-emerald-700'],
                  rejected: ['已拒绝', 'bg-red-100 text-red-700'],
                };
                const TASK_STATUS: Record<string, [string, string]> = {
                  claiming: ['认领中', 'bg-blue-100 text-blue-700'],
                  in_progress: ['进行中', 'bg-emerald-100 text-emerald-700'],
                  rewarded: ['已发赏', 'bg-amber-100 text-amber-700'],
                  published: ['已发布', 'bg-indigo-100 text-indigo-700'],
                };
                const [claimLabel, claimCls] = CLAIM_STATUS[c.status] || [c.status, 'bg-slate-100 text-slate-500'];
                const [taskLabel, taskCls] = TASK_STATUS[c.task_status] || [c.task_status || '', 'bg-slate-100 text-slate-500'];
                const isScore = c.task_reward_type === 'score';

                return (
                  <div key={c.id} 
                    onClick={() => {
                      const t = tasks.find((t: any) => t.id === c.pool_task_id);
                      if (t) { setShowMyClaims(false); openTaskDetail(t); }
                    }}
                    className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border border-slate-100 dark:border-slate-700">
                    {/* Header: task title + claim status */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate flex-1">{c.task_title}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${claimCls}`}>{claimLabel}</span>
                    </div>
                    {/* Role badge + task status */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${ROLE_COLORS[c.role_name] || ROLE_COLORS.I}`}>
                        {c.role_name} {ROLE_LABELS[c.role_name] || c.role_name}
                      </span>
                      {taskLabel && (
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${taskCls}`}>{taskLabel}</span>
                      )}
                    </div>
                    {/* Meta info */}
                    <div className="flex items-center gap-3 text-[10px] text-slate-400">
                      {c.task_bonus > 0 && (
                        <span className="font-medium">{isScore ? `${c.task_bonus}分` : `¥${c.task_bonus.toLocaleString()}`}</span>
                      )}
                      {c.reward > 0 && (
                        <span className="text-emerald-500 font-bold">个人奖: {isScore ? `${c.reward}分` : `¥${c.reward}`}</span>
                      )}
                      {c.task_department && <span>{c.task_department}</span>}
                      <span>{new Date(c.created_at).toLocaleDateString()}</span>
                    </div>
                    {/* Reason if exists */}
                    {c.reason && (
                      <div className="mt-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-1.5 text-xs text-blue-600 dark:text-blue-400">
                        <span className="font-bold">认领理由：</span>{c.reason}
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
                  max_participants: Number(data.maxParticipants) || viewingProposal.max_participants || 5,
                  proposal_status: 'pending_hr',
                  attachments: data.attachments || viewingProposal.attachments || []
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
            // Safely parse attachments: handle string, array, null
            let parsedAttachments: any[] = [];
            try {
              if (Array.isArray(p.attachments)) {
                parsedAttachments = p.attachments;
              } else if (typeof p.attachments === 'string' && p.attachments) {
                parsedAttachments = JSON.parse(p.attachments);
              }
            } catch { parsedAttachments = []; }
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
              maxParticipants: p.max_participants || 5,
              hr_reviewer_name: p.hr_reviewer_name,
              hr_reviewer_id: p.hr_reviewer_id,
              admin_reviewer_name: p.admin_reviewer_name,
              admin_reviewer_id: p.admin_reviewer_id,
              creator_name: p.creator_name || currentUser?.name,
              attachments: parsedAttachments
            };
          })()}
          onDraft={async (data) => {
            try {
              const token = localStorage.getItem('token');
              const smartDescription = `【目标 S】${data.s}\n【指标 M】${data.m}\n【方案 A】${data.a_smart}\n【相关 R】${data.r_smart}\n【时限 T】${data.t}`;
              const res = await fetch(`/api/pool/tasks/${viewingProposal.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                  title: data.summary || viewingProposal.title,
                  description: smartDescription,
                  department: data.taskType || viewingProposal.department,
                  difficulty: viewingProposal.difficulty || '中',
                  reward_type: data.rewardType || viewingProposal.reward_type,
                  bonus: Number(data.bonus) || viewingProposal.bonus || 0,
                  max_participants: Number(data.maxParticipants) || viewingProposal.max_participants || 5,
                  attachments: data.attachments || [],
                }),
              });
              const json = await res.json();
              if (json.code === 0) {
                alert('草稿已保存');
                setViewingProposal(null);
                fetchMyProposals();
              } else { alert(json.message || '保存失败'); }
            } catch { alert('保存失败'); }
          }}
          onDelete={async () => {
            if (viewingProposal.proposal_status !== 'draft') return;
            try {
              const token = localStorage.getItem('token');
              const res = await fetch(`/api/pool/tasks/${viewingProposal.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
              });
              const data = await res.json();
              if (data.code === 0 || data.success) {
                setViewingProposal(null);
                fetchMyProposals();
              } else {
                alert(data.message || '删除失败');
              }
            } catch {
              alert('网络错误');
            }
          }}
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

      {/* ── STAR 报告弹窗 ─────────────────────────────────────────────── */}
      {showStarModal && (
        <STARReportModal
          taskId={showStarModal.id}
          taskTitle={showStarModal.title}
          roleName={(showStarModal.role_claims || []).find((c: any) => c.user_id === currentUser?.id)?.role_name || 'R'}
          onClose={() => setShowStarModal(null)}
          onSubmitted={() => { setShowStarModal(null); fetchTasks(); }}
        />
      )}

      {/* ── 延期申请弹窗 ─────────────────────────────────────────────── */}
      {showExtendModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowExtendModal(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 p-5 border-b border-slate-200/60">
              <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-blue-500 text-[20px]">schedule</span>
              </div>
              <div>
                <h2 className="font-black text-slate-800 dark:text-white">PDCA 延期申请</h2>
                <p className="text-[11px] text-slate-400 truncate max-w-xs">{showExtendModal.title}</p>
              </div>
              <button onClick={() => setShowExtendModal(null)} className="ml-auto w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <div className="p-5 space-y-4">
              {actionMsg && (
                <div className={`px-4 py-3 rounded-xl text-sm font-bold ${actionMsg.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                  {actionMsg.text}
                </div>
              )}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
                ⚡ 延期申请无需审批，提交后直接生效，并通知 HR 和 C/I 成员
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1.5">新截止日期 <span className="text-red-500">*</span></label>
                <input type="date" value={extendForm.new_deadline}
                  onChange={e => setExtendForm(p => ({ ...p, new_deadline: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1.5">延期原因 <span className="text-red-500">*</span></label>
                <textarea value={extendForm.reason}
                  onChange={e => setExtendForm(p => ({ ...p, reason: e.target.value }))}
                  rows={3} placeholder="说明需要延期的原因及影响..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1.5">影响分析 <span className="text-slate-400 font-normal">选填</span></label>
                <textarea value={extendForm.impact_analysis}
                  onChange={e => setExtendForm(p => ({ ...p, impact_analysis: e.target.value }))}
                  rows={2} placeholder="说明延期对项目目标或依赖方的影响..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-blue-400" />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-slate-200/60">
              <button onClick={() => setShowExtendModal(null)}
                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50">取消</button>
              <button onClick={async () => {
                if (!extendForm.new_deadline || !extendForm.reason) { setActionMsg({ type: 'err', text: '请填写新截止日期和延期原因' }); return; }
                setActionLoading(true);
                const token = localStorage.getItem('token');
                const res = await fetch(`/api/pool/tasks/${showExtendModal.id}/extend`, {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify(extendForm),
                }).then(r => r.json());
                setActionLoading(false);
                if (res.code === 0) {
                  setActionMsg({ type: 'ok', text: res.message });
                  setTimeout(() => { setShowExtendModal(null); setActionMsg(null); setExtendForm({ new_deadline: '', reason: '', impact_analysis: '' }); fetchTasks(); }, 1500);
                } else { setActionMsg({ type: 'err', text: res.message }); }
              }} disabled={actionLoading}
                className="flex-1 py-2.5 bg-blue-500 text-white rounded-xl text-sm font-bold hover:bg-blue-600 disabled:opacity-50">
                {actionLoading ? '提交中...' : '✅ 确认延期'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 提前完结弹窗 ─────────────────────────────────────────────── */}
      {showTerminateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowTerminateModal(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 p-5 border-b border-slate-200/60">
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-amber-500 text-[20px]">stop_circle</span>
              </div>
              <div>
                <h2 className="font-black text-slate-800 dark:text-white">提前完结任务</h2>
                <p className="text-[11px] text-slate-400 truncate max-w-xs">{showTerminateModal.title}</p>
              </div>
              <button onClick={() => setShowTerminateModal(null)} className="ml-auto w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <div className="p-5 space-y-4">
              {actionMsg && (
                <div className={`px-4 py-3 rounded-xl text-sm font-bold ${actionMsg.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                  {actionMsg.text}
                </div>
              )}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                ⚡ 提前完结无需审批，直接进入 STAR 汇报阶段，系统会通知所有 R/A 成员填写 STAR 报告
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1.5">实际完成度 <span className="text-red-500">*</span></label>
                <div className="flex items-center gap-3">
                  <input type="range" min="0" max="99" value={terminateForm.actual_completion}
                    onChange={e => setTerminateForm(p => ({ ...p, actual_completion: e.target.value }))}
                    className="flex-1" />
                  <span className="font-black text-amber-600 text-lg w-12 text-right">{terminateForm.actual_completion}%</span>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1.5">完结原因 <span className="text-red-500">*</span></label>
                <textarea value={terminateForm.reason}
                  onChange={e => setTerminateForm(p => ({ ...p, reason: e.target.value }))}
                  rows={3} placeholder="说明为何提前完结（外部环境变化、资源限制、战略调整等）..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-amber-400" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1.5">已交付成果 <span className="text-red-500">*</span></label>
                <textarea value={terminateForm.delivered_content}
                  onChange={e => setTerminateForm(p => ({ ...p, delivered_content: e.target.value }))}
                  rows={3} placeholder="列出已完成的交付物、文档、数据或其他成果..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-amber-400" />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-slate-200/60">
              <button onClick={() => setShowTerminateModal(null)}
                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50">取消</button>
              <button onClick={async () => {
                if (!terminateForm.reason || !terminateForm.delivered_content) { setActionMsg({ type: 'err', text: '请填写完结原因和已交付成果' }); return; }
                setActionLoading(true);
                const token = localStorage.getItem('token');
                const res = await fetch(`/api/pool/tasks/${showTerminateModal.id}/terminate`, {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify(terminateForm),
                }).then(r => r.json());
                setActionLoading(false);
                if (res.code === 0) {
                  setActionMsg({ type: 'ok', text: res.message });
                  setTimeout(() => { setShowTerminateModal(null); setActionMsg(null); setTerminateForm({ reason: '', actual_completion: '80', delivered_content: '' }); fetchTasks(); }, 1500);
                } else { setActionMsg({ type: 'err', text: res.message }); }
              }} disabled={actionLoading}
                className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-bold hover:bg-amber-600 disabled:opacity-50">
                {actionLoading ? '提交中...' : '⚠️ 确认提前完结'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 奖励分配弹窗 ─────────────────────────────────────────────── */}
      {showRewardModal && (
        <RewardDistributionModal
          taskId={showRewardModal.id}
          taskTitle={showRewardModal.title}
          totalBonus={showRewardModal.bonus}
          rewardType={showRewardModal.reward_type || 'money'}
          onClose={() => setShowRewardModal(null)}
          onSubmitted={() => { setShowRewardModal(null); fetchTasks(); }}
        />
      )}
    </div>
  );
}

