import React, { useState, useEffect, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';

interface EvalTask {
  reviewer_task_id: number;
  role: string;
  status: string;
  score: number | null;
  comment: string | null;
  month: string;
  target_user_id: string;
  target_user_name: string;
  target_department_name: string;
}


// ── 可搜索用户选择器 ────────────────────────────────────────────────
function SearchableUserSelect({
  value,
  users,
  onChange,
}: {
  value: string;
  users: { id: string; name: string }[];
  onChange: (uid: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = query
    ? users.filter(u => u.name.toLowerCase().includes(query.toLowerCase()))
    : users;

  const selectedUser = users.find(u => u.id === value);

  return (
    <div ref={ref} className="relative flex-1">
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setQuery(''); }}
        className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-bold outline-none focus:border-indigo-400 hover:border-indigo-300 transition-colors text-left"
      >
        <span className={selectedUser ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400'}>
          {selectedUser ? selectedUser.name : '- 删除此名额 -'}
        </span>
        <span className="material-symbols-outlined text-slate-400 text-[16px] shrink-0">
          {open ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {open && (
        <div className="absolute z-[9999] mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl shadow-slate-900/10 overflow-hidden">
          {/* 搜索框 */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-700">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[15px]">search</span>
              <input
                autoFocus
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="搜索姓名..."
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 font-medium"
              />
            </div>
          </div>
          {/* 选项列表 */}
          <div className="max-h-48 overflow-y-auto">
            <div
              onClick={() => { onChange(''); setOpen(false); }}
              className="px-3 py-2 text-sm text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors font-medium"
            >
              - 删除此名额 -
            </div>
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-slate-400">未找到匹配的人员</div>
            ) : (
              filtered.map(u => (
                <div
                  key={u.id}
                  onClick={() => { onChange(u.id); setOpen(false); }}
                  className={`px-3 py-2 text-sm cursor-pointer transition-colors flex items-center gap-2 ${
                    u.id === value
                      ? 'bg-indigo-50 text-indigo-700 font-bold dark:bg-indigo-900/30 dark:text-indigo-300'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 font-medium'
                  }`}
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 text-white text-[10px] font-black flex items-center justify-center shrink-0">
                    {u.name.charAt(0)}
                  </div>
                  {u.name}
                  {u.id === value && (
                    <span className="material-symbols-outlined text-[14px] ml-auto text-indigo-500">check</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MonthlyEvaluationPage({ navigate }: { navigate: (view: string) => void }) {
  const { currentUser, hasPermission } = useAuth();
  const [tasks, setTasks] = useState<EvalTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggerMonth, setTriggerMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // 打分 Modal
  const [scoringTask, setScoringTask] = useState<EvalTask | null>(null);
  const [scoreInput, setScoreInput] = useState<number | ''>('');
  const [commentInput, setCommentInput] = useState('');
  const [targetTasks, setTargetTasks] = useState<any[]>([]);
  const [targetTasksLoading, setTargetTasksLoading] = useState(false);
  const [taskSearchQuery, setTaskSearchQuery] = useState('');

  // HR 管理专用状态
  const [hrEmployees, setHrEmployees] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [previewUser, setPreviewUser] = useState<any>(null);
  const [previewReviewers, setPreviewReviewers] = useState<any>({ self:[], manager:[], prof:[], peer:[] });
  const [previewLoading, setPreviewLoading] = useState(false);
  const [hrLoading, setHrLoading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [deadline, setDeadline] = useState('');   // 考评截止日
  const [remindMsg, setRemindMsg] = useState('');  // 折办反馈

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/monthly-eval/my-tasks', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.code === 0) setTasks(data.data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const fetchTargetTasks = async (userId: string, month: string) => {
    setTargetTasksLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/monthly-eval/user-tasks?userId=${userId}&month=${month}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setTargetTasks(data.data || []);
    } catch(e) {}
    setTargetTasksLoading(false);
  };

  const fetchHrData = async () => {
    const isManagementRole = hasPermission('module_monthly_eval') || hasPermission('module_monthly_eval_score') || currentUser?.is_super_admin;
    if (!isManagementRole) return;
    setHrLoading(true);
    const token = localStorage.getItem('token');
    try {
      const [resEmp, resUsers] = await Promise.all([
        fetch(`/api/monthly-eval/hr/employees-status?month=${triggerMonth}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/monthly-eval/hr/all-users`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      const empData = await resEmp.json();
      const userData = await resUsers.json();
      setHrEmployees(empData.data || []);
      setAllUsers(userData.data || []);
    } catch (e) {}
    setHrLoading(false);
  };

  useEffect(() => {
    fetchTasks();
    fetchHrData();
  }, [triggerMonth]);

  const submitScore = async () => {
    if (scoreInput === '' || scoreInput < 0 || scoreInput > 100) return alert('请输入 0-100 之间的分数');
    if (!scoringTask) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/monthly-eval/submit-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          reviewer_task_id: scoringTask.reviewer_task_id,
          score: Number(scoreInput),
          comment: commentInput
        })
      });
      const data = await res.json();
      if (data.code === 0) {
        setScoringTask(null);
        fetchTasks();
        fetchHrData(); // Refresh HR view if needed
      } else {
        alert(data.message);
      }
    } catch (e: any) { alert('提交失败: ' + e.message); }
  };

  const getRoleLabel = (role: string) => {
    switch(role) {
      case 'self': return { label: '员工自评 (20%)', color: 'text-indigo-600 bg-indigo-100 border-indigo-200' };
      case 'manager': return { label: '主管直评 (30%)', color: 'text-rose-600 bg-rose-100 border-rose-200' };
      case 'prof': return { label: '专业环评 (40%)', color: 'text-amber-600 bg-amber-100 border-amber-200' };
      case 'peer': return { label: '关联人环评 (10%)', color: 'text-emerald-600 bg-emerald-100 border-emerald-200' };
      default: return { label: role, color: 'text-slate-600 bg-slate-100 border-slate-200' };
    }
  };

  // HR 端操作

  const openPreview = async (user: any) => {
    setPreviewUser(user);
    setPreviewLoading(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/monthly-eval/hr/preview-reviewers?month=${triggerMonth}&userId=${user.user_id}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setPreviewReviewers({
        self: data.data.self.map((u:any)=>u.id),
        manager: data.data.manager.map((u:any)=>u.id),
        prof: data.data.prof.map((u:any)=>u.id),
        peer: data.data.peer.map((u:any)=>u.id)
      });
    } catch(err) { console.error(err); }
    setPreviewLoading(false);
  };

  const handleManualPublish = async () => {
    if (!previewUser) return;
    const manualReviewers = {
      targetUserId: previewUser.user_id,
      self: previewReviewers.self,
      manager: previewReviewers.manager,
      prof: previewReviewers.prof,
      peer: previewReviewers.peer
    };
    
    setIsPublishing(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/monthly-eval/hr/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ month: triggerMonth, userIds: [previewUser.user_id], manualReviewers, deadline: deadline || undefined })
      });
      const data = await res.json();
      alert(data.message);
      setPreviewUser(null);
      fetchHrData();
      fetchTasks();
    } catch(err: any) { alert(err.message); }
    setIsPublishing(false);
  };

  const handleSetDeadline = async () => {
    if (!deadline) return alert('请选择截止日');
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/monthly-eval/hr/set-deadline', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ month: triggerMonth, deadline })
      });
      const data = await res.json();
      alert(data.message || '设置成功');
    } catch { alert('设置失败'); }
  };

  const handleRemind = async (evaluationIds?: number[]) => {
    setRemindMsg('');
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/monthly-eval/hr/remind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ month: triggerMonth, evaluationIds })
      });
      const data = await res.json();
      setRemindMsg(data.message || '已发送折办');
      setTimeout(() => setRemindMsg(''), 4000);
    } catch { setRemindMsg('折办失败'); }
  };

  const handleReviewerChange = (role: string, index: number, val: string) => {
    const arr = [...previewReviewers[role]];
    if (val === '') arr.splice(index, 1);
    else arr[index] = val;
    setPreviewReviewers({ ...previewReviewers, [role]: arr });
  };
  const addReviewer = (role: string) => {
    setPreviewReviewers({ ...previewReviewers, [role]: [...previewReviewers[role], ''] });
  };

  const pendingCount = tasks.filter(t => t.status === 'pending').length;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 font-sans">
      <Sidebar currentView="dashboard" navigate={navigate} />

      <main className="flex-1 overflow-y-auto h-[calc(100vh-4rem)] mt-16 p-4 lg:p-10 relative pb-24 lg:pb-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <button 
              onClick={() => navigate('dashboard')} 
              className="mb-4 text-sm font-bold text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              返回上一页
            </button>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
              <span className="material-symbols-outlined text-4xl text-blue-600 dark:text-blue-400">rule</span>
              月度四大维度考评
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm max-w-2xl leading-relaxed">
              您的打分直接决定被评价同事月底的实发薪资底座。请秉持客观、公正的原则完成所有的发薪前置评价。
            </p>
          </div>
        </div>

        {/* 概览卡片 - 仅展示自己的待办 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-blue-500/20 shadow-sm shadow-blue-500/5 relative overflow-hidden group">
             <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform"><span className="material-symbols-outlined text-8xl text-blue-500">pending_actions</span></div>
             <p className="text-sm font-bold text-blue-600 mb-1">待我打分</p>
             <p className="text-4xl font-black text-slate-800 dark:text-white relative z-10">{pendingCount}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-emerald-500/20 shadow-sm shadow-emerald-500/5 relative overflow-hidden group">
             <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform"><span className="material-symbols-outlined text-8xl text-emerald-500">check_circle</span></div>
             <p className="text-sm font-bold text-emerald-600 mb-1">已打分</p>
             <p className="text-4xl font-black text-slate-800 dark:text-white relative z-10">{tasks.length - pendingCount}</p>
          </div>
        </div>

        {/* 我的任务列表 */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden mb-10">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-500">assignment_ind</span> 我的评分区
            </h3>
          </div>
          {loading ? (
             <div className="py-20 text-center text-slate-400 font-medium">加载中...</div>
          ) : tasks.length === 0 ? (
             <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-4">
               <span className="material-symbols-outlined text-6xl text-slate-200">free_cancellation</span>
               <p className="font-bold">当月暂无需要您打分的考评任务</p>
             </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-white dark:bg-slate-800 border-b border-slate-100">
                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase">被评人</th>
                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase">考核月份</th>
                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase">我的评价身份</th>
                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase">打分状态</th>
                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tasks.map(t => {
                    const roleInfo = getRoleLabel(t.role);
                    return (
                      <tr key={t.reviewer_task_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs">{t.target_user_name.charAt(0)}</div>
                            <div>
                              <p className="font-bold text-slate-800 dark:text-slate-200">{t.target_user_name}</p>
                              <p className="text-[10px] text-slate-400">{t.target_department_name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-slate-500">{t.month}</td>
                        <td className="px-6 py-4"><span className={`px-2 py-1 text-[11px] font-bold border rounded-lg ${roleInfo.color}`}>{roleInfo.label}</span></td>
                        <td className="px-6 py-4">
                          {t.status === 'pending' ? (
                            <span className="flex items-center gap-1.5 text-orange-500 text-xs font-bold"><span className="material-symbols-outlined text-[16px]">schedule</span> 待打分</span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-emerald-500 text-xs font-bold"><span className="material-symbols-outlined text-[16px]">verified</span> 已打分 ({t.score}分)</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {t.status === 'pending' ? (
                            <button onClick={() => { setScoringTask(t); setScoreInput(''); setCommentInput(''); setTaskSearchQuery(''); fetchTargetTasks(t.target_user_id, t.month); }} className="px-4 py-1.5 bg-blue-600 text-white font-bold text-xs rounded-lg hover:bg-blue-700 transition-all shadow shadow-blue-500/30">立即打分</button>
                          ) : (
                            <button onClick={() => { setScoringTask(t); setScoreInput(t.score || ''); setCommentInput(t.comment || ''); setTaskSearchQuery(''); fetchTargetTasks(t.target_user_id, t.month); }} className="px-4 py-1.5 bg-slate-100 text-slate-600 border border-slate-200 font-bold text-xs rounded-lg hover:bg-slate-200 transition-all">修改评分</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* --- HR/管理员/主管 全景控制台 --- */}
        {(hasPermission('module_monthly_eval') || hasPermission('module_monthly_eval_score') || currentUser?.is_super_admin) && (
          <div className="mt-10 mb-20 animate-in slide-in-from-bottom-5">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-500 text-3xl">admin_panel_settings</span>
                  {currentUser?.role === 'supervisor' || currentUser?.role === 'manager'
                    ? '部门考评概览'
                    : 'HR 考评统筹控制台'}
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  {currentUser?.role === 'supervisor' || currentUser?.role === 'manager'
                    ? '查看本部门员工的月度考评进度，确认评分是否完成。'
                    : '全局总览并调配人员的四大维度打分池，一键流转到终端。'}
                </p>
              </div>
              <div className="flex items-center gap-3 bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded-xl border border-indigo-100 dark:border-indigo-800 flex-wrap">
                <input type="month" value={triggerMonth} onChange={e => setTriggerMonth(e.target.value)} className="px-3 py-2 rounded-lg border border-indigo-200 dark:border-indigo-700 font-bold bg-white dark:bg-slate-800 outline-none w-48" />
                {/* 截止日设置 */}
                {(hasPermission('module_monthly_eval') || hasPermission('module_monthly_eval_score') || currentUser?.is_super_admin) && (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={deadline}
                      onChange={e => setDeadline(e.target.value)}
                      className="px-3 py-2 rounded-lg border border-indigo-200 dark:border-indigo-700 text-sm bg-white dark:bg-slate-800 outline-none"
                      title="考评截止日"
                    />
                    <button
                      onClick={handleSetDeadline}
                      disabled={!deadline}
                      className="px-3 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1"
                      title="设置该月考评的截止日"
                    >
                      <span className="material-symbols-outlined text-[14px]">event</span>
                      设置截止日
                    </button>
                    <button
                      onClick={() => handleRemind()}
                      className="px-3 py-2 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600 flex items-center gap-1"
                      title="向未打分人发送折办通知"
                    >
                      <span className="material-symbols-outlined text-[14px]">notification_important</span>
                      全员折办
                    </button>
                    {remindMsg && (
                      <span className="text-xs text-emerald-600 font-bold animate-pulse">{remindMsg}</span>
                    )}
                  </div>
                )}
                {(hasPermission('module_monthly_eval') || hasPermission('module_monthly_eval_view') || currentUser?.is_super_admin) && (
                  <div className="px-5 py-2 bg-slate-200 text-slate-500 font-bold rounded-lg text-sm flex items-center gap-1.5 cursor-not-allowed" title="根据最新业务流程，已剥离一键发布功能，请下方逐一核实。">
                    <span className="material-symbols-outlined text-[18px]">block</span>
                    一键发布已停用
                  </div>
                )}
              </div>
            </div>
            
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              {hrLoading ? <div className="p-20 text-center text-slate-400 font-bold">同步全员人员名单中...</div> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 text-xs font-black text-slate-500 uppercase tracking-widest">
                      <tr>
                        <th className="px-6 py-4 w-10 text-center text-slate-300">#</th>
                        <th className="px-6 py-4">被评人名片</th>
                        <th className="px-6 py-4">月份进度追踪</th>
                        <th className="px-6 py-4 text-right">精细化操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {hrEmployees.map(u => {
                        const isComplete = u.eval_status === 'completed';
                        let statusEl = <span className="text-slate-400 font-bold bg-slate-100 px-2.5 py-1 rounded-md">未排发</span>;
                        if (u.eval_status === 'pending') statusEl = <span className="text-amber-600 font-bold bg-amber-50 px-2.5 py-1 rounded-md"><span className="animate-pulse mr-1">•</span> 打分采集中</span>;
                        if (isComplete) statusEl = <span className="text-emerald-600 font-bold bg-emerald-50 px-2.5 py-1 rounded-md">✅ 已轧帐 ({u.final_score}分)</span>;
                        
                        return (
                          <tr key={u.user_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-6 py-4 text-center text-slate-300 font-mono text-xs">-</td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600 font-black">{u.user_name.charAt(0)}</div>
                                <div>
                                  <p className="font-bold text-slate-800 dark:text-slate-200">{u.user_name}</p>
                                  <p className="text-[10px] text-slate-400">{u.department_name}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">{statusEl}</td>
                            <td className="px-6 py-4 text-right">
                              {(hasPermission('module_monthly_eval') || currentUser?.is_super_admin) ? (
                                <button onClick={() => openPreview(u)} className="px-4 py-1.5 bg-white text-indigo-600 font-bold rounded-lg border border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300 text-xs transition-all shadow-sm">
                                  {u.eval_status ? '覆盖重设考评人' : '核定考评人'}
                                </button>
                              ) : (
                                <span className={`text-xs font-bold px-3 py-1.5 rounded-lg ${u.eval_status === 'completed' ? 'text-emerald-600 bg-emerald-50' : u.eval_status ? 'text-amber-600 bg-amber-50' : 'text-slate-400 bg-slate-100'}`}>
                                  {u.eval_status === 'completed' ? '✅ 已完成' : u.eval_status ? '⏳ 进行中' : '未开始'}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* HR 人工配置考评 Modal */}
      {previewUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-indigo-50 dark:bg-indigo-900/30">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2 text-indigo-900 dark:text-indigo-100">
                  <span className="material-symbols-outlined text-indigo-500">manage_accounts</span>
                  核查与调整考评关系
                </h3>
                <p className="text-xs text-indigo-600/80 mt-1 font-medium">配置为 <strong>{previewUser.user_name}</strong> ({triggerMonth}) 提供打分的人员。</p>
              </div>
              <button onClick={() => setPreviewUser(null)} className="text-indigo-400 hover:bg-indigo-100 p-1.5 rounded-full"><span className="material-symbols-outlined text-xl">close</span></button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50 dark:bg-slate-900/50">
              {previewLoading ? <div className="py-20 text-center font-bold text-indigo-400 animate-pulse">系统引擎推演中...</div> : (
                <div className="space-y-6">
                  {/* Option Generator */}
                  {[{ key: 'self', label: '自我评价 (20%)', icon: 'person', max: 1, desc:'默认自带员工本人' },
                    { key: 'manager', label: '主管直评 (30%)', icon: 'shield_person', max: 1, desc:'系统默认溯源其所在部门的负责人' },
                    { key: 'prof', label: '专业环评 (40%)', icon: 'workspace_premium', max: 3, desc:'强关联指标，自动溯源当月任务被签收的验收人' },
                    { key: 'peer', label: '关联人环评 (10%)', icon: 'group', max: 3, desc:'同生共死，自动溯源当月在同一个任务池的同事' }].map(role => (
                    <div key={role.key} className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-bold flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                          <span className="material-symbols-outlined text-base text-slate-400">{role.icon}</span>
                          {role.label}
                        </h4>
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase font-black tracking-wider">限 {role.max} 人</span>
                      </div>
                      <p className="text-xs text-slate-400 mb-3 ml-6 font-medium">{role.desc}</p>
                      
                      <div className="space-y-2 ml-6">
                        {previewReviewers[role.key].map((uid: string, idx: number) => (
                          <div key={idx} className="flex gap-2 items-center">
                            <SearchableUserSelect
                              value={uid}
                              users={allUsers}
                              onChange={newUid => handleReviewerChange(role.key, idx, newUid)}
                            />
                            <button onClick={() => handleReviewerChange(role.key, idx, '')} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><span className="material-symbols-outlined text-[18px]">delete</span></button>
                          </div>
                        ))}
                        {previewReviewers[role.key].length < role.max && (
                          <button onClick={() => addReviewer(role.key)} className="flex items-center gap-1 text-xs font-bold text-indigo-500 hover:text-indigo-700 mt-2 px-2 py-1 hover:bg-indigo-50 rounded-md transition-colors"><span className="material-symbols-outlined text-[14px]">add</span> 手工添加名额</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-5 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800">
              <p className="text-xs text-slate-400 flex items-center gap-1.5"><span className="material-symbols-outlined text-[14px]">info</span> 保存即会通过企微下发并覆盖旧进度</p>
              <div className="flex gap-3">
                <button onClick={() => setPreviewUser(null)} className="px-6 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all text-sm">暂不发送</button>
                <button onClick={handleManualPublish} disabled={previewLoading || isPublishing} className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 active:scale-95 transition-all disabled:opacity-50 text-sm flex items-center gap-1">
                  只核并派发这一条 <span className="material-symbols-outlined text-[16px]">send</span> 
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 普通打分 Modal 增强版 (附任务检索) */}
      {scoringTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-5xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            <div className="flex flex-col md:flex-row h-[85vh] md:max-h-[800px]">
              
              {/* 左侧：任务展示与检索 */}
              <div className="hidden md:flex flex-col w-2/3 border-r border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30">
                <div className="p-6 border-b border-slate-100 dark:border-slate-700">
                  <h3 className="font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-indigo-500">history_edu</span>
                    被评人 {scoringTask.month} 核心任务交付参考
                  </h3>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400">search</span>
                    <input 
                      type="text" 
                      value={taskSearchQuery}
                      onChange={e => setTaskSearchQuery(e.target.value)}
                      placeholder="检索任务名、事项或关键内容..." 
                      className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all text-sm font-medium"
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                  {targetTasksLoading ? (
                    <div className="py-20 text-center font-bold text-indigo-400 animate-pulse">系统正在为您调取履历...</div>
                  ) : targetTasks.length === 0 ? (
                    <div className="py-20 text-center text-slate-400 font-bold flex flex-col items-center gap-2">
                       <span className="material-symbols-outlined text-5xl">inventory_2</span>
                       该员工当月未在系统中留下完结任务轨迹
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {targetTasks.filter(t => (t.title && t.title.includes(taskSearchQuery)) || (t.description && t.description.includes(taskSearchQuery))).map(t => (
                        <div key={t.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-bold text-slate-800 dark:text-slate-200 flex-1">{t.title}</h4>
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-wider rounded-lg border border-emerald-100">完结</span>
                          </div>
                          <p className="text-xs text-slate-500 mb-3 line-clamp-2 leading-relaxed">{t.description}</p>
                          <div className="flex flex-wrap gap-2 text-[11px] font-bold">
                            <span className="px-2 py-1 bg-slate-50 text-slate-500 rounded-md border border-slate-100">衡量标准: {t.metric || '-'}</span>
                            <span className="px-2 py-1 bg-slate-50 text-slate-500 rounded-md border border-slate-100">验收得分: {t.score != null ? t.score : '未评'}</span>
                            <span className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-md border border-indigo-100">奖金标的: ¥{t.reward != null ? t.reward : 0}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 右侧：评分区 */}
              <div className="flex flex-col w-full md:w-1/3 bg-white dark:bg-slate-800">
                <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-500">rate_review</span> 为 {scoringTask.target_user_name} 打分
                  </h3>
                  <button onClick={() => setScoringTask(null)} className="text-slate-400 hover:bg-slate-200 p-1 rounded-full"><span className="material-symbols-outlined text-xl">close</span></button>
                </div>
                
                <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                  <div className="text-xs text-slate-500 bg-blue-50 p-3 rounded-xl border border-blue-100 leading-relaxed">
                    当前打分权重：<strong>{getRoleLabel(scoringTask.role).label}</strong>。<br/>结合左侧交付物，请输入 0-100 的百分制分数。
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">绩效发薪依据得分 <span className="text-red-500">*</span></label>
                    <div className={`w-full flex items-center justify-center rounded-2xl py-5 mb-3 transition-all duration-300 ${Number(scoreInput) >= 81 ? 'bg-emerald-50 border-2 border-emerald-200' : Number(scoreInput) >= 61 ? 'bg-amber-50 border-2 border-amber-200' : Number(scoreInput) > 0 ? 'bg-red-50 border-2 border-red-200' : 'bg-slate-50 border-2 border-slate-200'}`}>
                      <span className={`text-6xl font-black tracking-tighter transition-colors duration-300 tabular-nums ${Number(scoreInput) >= 81 ? 'text-emerald-600' : Number(scoreInput) >= 61 ? 'text-amber-600' : Number(scoreInput) > 0 ? 'text-red-500' : 'text-slate-300'}`}>
                        {scoreInput || '–'}
                      </span>
                      {Number(scoreInput) > 0 && <span className={`text-lg font-bold ml-1 mt-4 ${Number(scoreInput) >= 81 ? 'text-emerald-500' : Number(scoreInput) >= 61 ? 'text-amber-500' : 'text-red-400'}`}>分</span>}
                    </div>
                    {Number(scoreInput) > 0 && (
                      <div className={`text-center text-xs font-bold mb-3 ${Number(scoreInput) >= 81 ? 'text-emerald-600' : Number(scoreInput) >= 61 ? 'text-amber-600' : 'text-red-500'}`}>
                        {Number(scoreInput) >= 81 ? '✓ 优秀 — 超额完成目标，表现卓越' : Number(scoreInput) >= 61 ? '◎ 达标 — 基本完成目标，需提升' : '⚠ 不达标 — 未完成目标，请填写评价'}
                      </div>
                    )}
                    <input type="number" min="0" max="100" value={scoreInput || ''} onChange={e => setScoreInput(Math.min(100, Math.max(0, Number(e.target.value))))} className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all text-xl font-black text-center text-slate-700 bg-white" placeholder="输入分数 0-100" autoFocus />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">综合简要评价 {Number(scoreInput) < 61 && Number(scoreInput) > 0 ? <span className="text-red-500 text-xs font-semibold">(不达标时必填)</span> : '(选填)'}</label>
                    <textarea rows={5} value={commentInput} onChange={e => setCommentInput(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-sm resize-none bg-slate-50/50" placeholder="输入评价，如：本月交付响应极快，质量可靠..." />
                  </div>
                </div>

                <div className="p-5 bg-slate-50 border-t border-slate-100 flex gap-3 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
                  <button onClick={() => setScoringTask(null)} className="flex-1 py-3 bg-white text-slate-600 font-bold rounded-xl border border-slate-200 hover:bg-slate-100 transition-all">取消</button>
                  <button onClick={submitScore} disabled={!scoreInput} className="flex-[2] py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-xl shadow-blue-500/30 active:scale-95 transition-all text-lg disabled:opacity-40 disabled:cursor-not-allowed">不可逆·确认提交</button>
                </div>
              </div>
              
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
