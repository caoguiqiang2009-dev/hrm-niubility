import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import SmartGoalDisplay from '../components/SmartGoalDisplay';

interface PoolTask {
  id: number;
  status: 'open' | 'in_progress' | 'closed';
  title: string;
  department: string;
  difficulty: string;
  bonus: number;
  max_participants: number;
  current_participants: number;
  description?: string;
  deadline?: string;
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
  const [applying, setApplying] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [bonusFilter, setBonusFilter] = useState<BonusFilter>('all');
  const [deptFilter, setDeptFilter] = useState('全部部门');
  const [sortByBonus, setSortByBonus] = useState(false);

  const { hasPermission, currentUser } = useAuth();
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

  useEffect(() => { fetchTasks(); }, []);

  // ── Filtering ──────────────────────────────────────────────────────────────
  let displayed = tasks.filter(t => {
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

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = (task: PoolTask) => {
    openDialog({
      title: '移入回收站',
      description: `确认将「${task.title}」移入回收站？管理员可随时恢复。`,
      confirmLabel: '移入回收站',
      confirmClass: 'bg-red-500 hover:bg-red-600 text-white',
      onConfirm: () => {
        closeDialog();
        setTasks(prev => prev.filter(t => t.id !== task.id));
        setDeletedTasks(prev => [task, ...prev]);
      },
    });
  };

  const handleRestore = (id: number) => {
    const task = deletedTasks.find(t => t.id === id)!;
    setDeletedTasks(prev => prev.filter(t => t.id !== id));
    setTasks(prev => [...prev, task]);
  };

  const handlePermanentDelete = (task: PoolTask) => {
    openDialog({
      title: '永久删除',
      description: `「${task.title}」将被永久删除，无法恢复。`,
      confirmLabel: '永久删除',
      confirmClass: 'bg-red-600 hover:bg-red-700 text-white',
      onConfirm: () => { closeDialog(); setDeletedTasks(prev => prev.filter(t => t.id !== task.id)); },
    });
  };

  const handleClearTrash = () => {
    openDialog({
      title: '清空回收站',
      description: `共 ${deletedTasks.length} 个任务将被永久删除，操作不可撤销。`,
      confirmLabel: '确认清空',
      confirmClass: 'bg-red-600 hover:bg-red-700 text-white',
      onConfirm: () => { closeDialog(); setDeletedTasks([]); },
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
        body: JSON.stringify({ reason: applyReason }),
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

      <main className="flex-1 mt-16 min-h-[calc(100vh-4rem)] overflow-y-auto">
        <div className="px-8 pt-6 pb-10 max-w-screen-2xl mx-auto">

          {/* Title Row */}
          <div className="flex items-end justify-between mb-5">
            <div>
              <h1 className="text-3xl font-black text-on-background tracking-tight">公司绩效池</h1>
              <p className="text-on-surface-variant text-sm mt-1">发现新机遇，挑战高难度任务，赢取丰厚奖金。</p>
            </div>
            <div className="flex items-center gap-3">
              {canDeleteTask && (
                <button onClick={() => setShowTrash(true)}
                  className="relative flex items-center gap-2 px-4 py-2.5 bg-surface-container-low rounded-xl text-sm font-medium text-on-surface-variant hover:bg-surface-container-high transition-all border border-outline-variant/10">
                  <span className="material-symbols-outlined text-lg">delete_sweep</span>
                  回收站
                  {deletedTasks.length > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{deletedTasks.length}</span>
                  )}
                </button>
              )}
              {canManagePool && (
                <button onClick={() => alert('发布任务功能开发中')}
                  className="flex items-center gap-2 px-5 py-2.5 primary-gradient rounded-xl text-sm font-bold text-white shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all">
                  <span className="material-symbols-outlined text-lg">add</span>发布任务
                </button>
              )}
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-3 mb-6 p-4 bg-surface-container-low rounded-2xl border border-outline-variant/10">
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
          </div>

          {/* Card Grid */}
          {loading ? (
            <div className="flex items-center justify-center h-64 text-on-surface-variant">
              <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>加载中…
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
              {displayed.map(task => {
                const badge = getBadge(task);
                const full = isFull(task);
                const pct = Math.round((task.current_participants / task.max_participants) * 100);
                return (
                  <div key={task.id}
                    className="group bg-surface-container-low rounded-2xl p-5 border border-outline-variant/10 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-300 flex flex-col cursor-pointer"
                    onClick={() => !full && openTaskDetail(task)}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <span className={`${badge.cls} text-[10px] font-bold px-2.5 py-1 rounded-full uppercase label-font`}>{badge.label}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-primary font-black text-lg tracking-tight">¥{task.bonus.toLocaleString()}</span>
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

              {/* Propose new task */}
              <div className="group border-2 border-dashed border-outline-variant/40 rounded-2xl p-5 flex flex-col items-center justify-center text-center hover:border-primary/40 transition-all cursor-pointer">
                <div className="w-10 h-10 bg-surface-container rounded-full flex items-center justify-center mb-3 group-hover:bg-primary-container/20 transition-all">
                  <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary">add_task</span>
                </div>
                <h4 className="font-bold text-sm text-on-surface">提议新任务</h4>
                <p className="text-[11px] text-on-surface-variant mt-1.5 leading-relaxed">发现公司改进点？<br/>提交申请并获取奖励。</p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── Task Detail / Apply Modal ─────────────────────────────────────────── */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setSelectedTask(null)} />
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 fade-in duration-200">

            {/* Step: detail */}
            {modalStep === 'detail' && (
              <>
                {/* Header — compact */}
                <div className="relative bg-gradient-to-br from-[#0060a9] to-[#409eff] px-5 py-3 text-white">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold px-2 py-0.5 bg-white/20 rounded-full uppercase tracking-wider">
                        {getBadge(selectedTask).label}
                      </span>
                      <span className="inline-flex items-center gap-1 bg-white/20 rounded-lg px-2.5 py-0.5 text-xs">
                        <span className="material-symbols-outlined text-[13px]">payments</span>
                        <span className="font-black text-sm">¥{selectedTask.bonus.toLocaleString()}</span>
                      </span>
                    </div>
                    <button onClick={() => setSelectedTask(null)} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  </div>
                  <h2 className="text-lg font-black leading-snug">{selectedTask.title}</h2>
                  <div className="flex items-center gap-3 text-white/80 text-[10px] mt-0.5">
                    {selectedTask.department && <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[11px]">business</span>{selectedTask.department}</span>}
                    <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[11px]">signal_cellular_alt</span>难度: {DIFFICULTY_MAP[selectedTask.difficulty] || selectedTask.difficulty}</span>
                  </div>
                </div>

                {/* Body */}
                <div className="px-5 py-4 space-y-4 max-h-[50vh] overflow-y-auto">
                  <SmartGoalDisplay
                    data={{
                      title: selectedTask.title,
                      target_value: `【交付成果】\n${detail.deliverables}\n\n【参与要求】\n名额上限: ${selectedTask.max_participants} 人 (当前: ${selectedTask.current_participants} 人)`,
                      resource: `【任务说明】\n${selectedTask.description || detail.description}\n\n【能力要求】\n${detail.skills.join('、')}`,
                      relevance: `【归属部门】\n${selectedTask.department || '全公司可见'}\n\n【挑战等级】\n难度系数 ${DIFFICULTY_MAP[selectedTask.difficulty] || selectedTask.difficulty}`,
                      deadline: selectedTask.deadline || '长期有效（随时报名）',
                      category: '公司公坚',
                    }}
                  />
                </div>

                {/* Footer */}
                <div className="flex gap-3 px-6 pb-6">
                  <button onClick={() => setSelectedTask(null)}
                    className="flex-1 py-3 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                    暂不参与
                  </button>
                  <button onClick={() => setModalStep('apply')}
                    className="flex-1 py-3 rounded-xl text-sm font-bold text-white primary-gradient shadow-md hover:opacity-90 transition-opacity">
                    发起加入申请
                  </button>
                </div>
              </>
            )}

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

                  {/* Reason */}
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                      申请理由 <span className="text-slate-300 font-normal">(选填)</span>
                    </label>
                    <textarea
                      value={applyReason}
                      onChange={e => setApplyReason(e.target.value)}
                      placeholder="描述你的优势、经验或参与动机，帮助主管快速评估…"
                      rows={4}
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
                <div className="w-16 h-16 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-5">
                  <span className="material-symbols-outlined text-green-500 text-3xl">check_circle</span>
                </div>
                <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-2">申请已提交！</h3>
                <p className="text-sm text-slate-500 leading-relaxed mb-8">
                  你已成功加入「{selectedTask.title}」，<br/>绩效进度将实时同步到你的个人仪表盘。
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
              ) : deletedTasks.map(task => (
                <div key={task.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700/60 overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <span className={`${getBadge(task).cls} text-[10px] font-bold px-2 py-0.5 rounded-full uppercase`}>{getBadge(task).label}</span>
                      <span className="text-primary font-black text-sm">¥{task.bonus.toLocaleString()}</span>
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
