import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';

type Module = 'org' | 'perf' | 'salary' | 'msg' | 'pool' | 'settings' | 'permissions' | 'admin_mgmt' | 'approval_flows' | null;

function useApiGet(url: string, deps: any[] = []) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token || !url) return;
    setLoading(true);
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.code === 0) setData(json.data);
      else setError(json.message);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps]);

  useEffect(() => { refetch(); }, [refetch]);
  return { data, loading, error, refetch };
}

async function apiCall(url: string, method: string, body?: any) {
  const token = localStorage.getItem('token');
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

// ─── STATUS BADGE ────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    draft: ['草稿', 'bg-slate-100 text-slate-500'],
    pending_review: ['待审批', 'bg-amber-100 text-amber-700'],
    approved: ['已通过', 'bg-emerald-100 text-emerald-700'],
    rejected: ['已驳回', 'bg-red-100 text-red-600'],
    completed: ['已完成', 'bg-blue-100 text-blue-700'],
    open: ['开放中', 'bg-green-100 text-green-700'],
    in_progress: ['进行中', 'bg-blue-100 text-blue-700'],
    closed: ['已关闭', 'bg-slate-100 text-slate-500'],
    pending_approval: ['待审批', 'bg-amber-100 text-amber-700'],
    published: ['已发放', 'bg-emerald-100 text-emerald-700'],
    pending: ['待处理', 'bg-amber-100 text-amber-700'],
    sent: ['已发送', 'bg-green-100 text-green-700'],
    failed: ['发送失败', 'bg-red-100 text-red-600'],
    assessed: ['已评分', 'bg-violet-100 text-violet-700'],
    pending_assessment: ['待评分', 'bg-purple-100 text-purple-700'],
    pending_reward: ['待发奖', 'bg-orange-100 text-orange-700'],
  };
  const [label, cls] = map[status] || [status, 'bg-slate-100 text-slate-500'];
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{label}</span>;
}

// ─── MODULE: 组织架构管理 ─────────────────────────────────────────────
function OrgModule() {
  const { data: tree, loading, refetch } = useApiGet('/api/org/tree');
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState('');
  const [editDept, setEditDept] = useState<any>(null);
  const [editUser, setEditUser] = useState<any>(null);
  const [editUserForm, setEditUserForm] = useState<any>({});
  const [userSaving, setUserSaving] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    setMsg('');
    const result = await apiCall('/api/org/sync', 'POST');
    setSyncing(false);
    if (result.code === 0) {
      setMsg(`✅ 同步成功：${result.data.departments} 个部门，${result.data.members} 名成员（新增 ${result.data.new_members || 0}，更新 ${result.data.updated_members || 0}）${result.data.failed_departments?.length ? `\n⚠️ 失败部门: ${result.data.failed_departments.join('、')}` : ''}`);
      refetch();
    } else {
      setMsg(`❌ 同步失败：${result.message}`);
    }
  };

  const handleViewDept = async (deptId: number) => {
    const res = await apiCall(`/api/org/departments/${deptId}`, 'GET');
    if (res.code === 0) setEditDept(res.data);
  };

  const handleEditUser = (user: any) => {
    setEditUser(user);
    setEditUserForm({ ...user });
  };

  const handleSaveUser = async () => {
    if (!editUser) return;
    setUserSaving(true);
    const res = await apiCall(`/api/org/users/${editUser.id}`, 'PUT', editUserForm);
    setUserSaving(false);
    if (res.code === 0) {
      setMsg('✅ 保存成功');
      setEditUser(null);
      if (editDept) {
        const deptRes = await apiCall(`/api/org/departments/${editDept.id}`, 'GET');
        if (deptRes.code === 0) setEditDept(deptRes.data);
      }
    } else {
      setMsg(`❌ ${res.message}`);
    }
  };

  const renderTree = (nodes: any[], depth = 0) => nodes.map(dept => (
    <div key={dept.id} style={{ paddingLeft: depth * 20 }}>
      <div
        className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-slate-50 cursor-pointer group transition-colors"
        onClick={() => handleViewDept(dept.id)}
      >
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px] text-slate-400">{depth === 0 ? 'corporate_fare' : 'folder'}</span>
          <span className="text-sm font-medium text-slate-700">{dept.name}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
          <span>{dept.member_count} 人</span>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        </div>
      </div>
      {dept.children?.length > 0 && renderTree(dept.children, depth + 1)}
    </div>
  ));

  return (
    <div className="flex gap-6">
      {/* Left: Org Tree */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-bold text-slate-700">部门架构</h4>
          <button onClick={handleSync} disabled={syncing}
            className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5 disabled:opacity-60">
            <span className="material-symbols-outlined text-[14px]">{syncing ? 'hourglass_empty' : 'sync'}</span>
            {syncing ? '同步中...' : '同步企微通讯录'}
          </button>
        </div>
        {msg && <div className="mb-3 text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">{msg}</div>}
        {loading ? <div className="text-center py-8 text-slate-400">加载中...</div> : (
          <div className="bg-slate-50 rounded-xl p-3">
            {tree?.length ? renderTree(tree) : <p className="text-sm text-slate-400 text-center py-4">暂无部门数据</p>}
          </div>
        )}
      </div>

      {/* Right: Dept Detail */}
      {editDept && (
        <div className="w-80 shrink-0 bg-slate-50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-bold text-slate-700">{editDept.name}</h4>
            <button onClick={() => setEditDept(null)} className="text-slate-400 hover:text-slate-600">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
          <p className="text-xs text-slate-500 mb-3">{editDept.members?.length || 0} 名成员</p>
          <div className="space-y-2">
            {editDept.members?.map((m: any) => (
              <div key={m.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">{m.name[0]}</div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">{m.name}</p>
                    <p className="text-xs text-slate-400">{m.title || '—'}</p>
                  </div>
                </div>
                <button onClick={() => handleEditUser(m)}
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">edit</span>编辑
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editUser && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setEditUser(null)}>
          <div className="bg-white rounded-2xl p-6 w-96 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h4 className="font-bold text-slate-800 mb-4">编辑员工信息</h4>
            <div className="space-y-3">
              {[['name', '姓名'], ['title', '职位'], ['mobile', '手机号'], ['email', '邮箱']].map(([field, label]) => (
                <div key={field}>
                  <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
                  <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={editUserForm[field] || ''} onChange={e => setEditUserForm({ ...editUserForm, [field]: e.target.value })} />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">角色</label>
                <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={editUserForm.role || 'employee'} onChange={e => setEditUserForm({ ...editUserForm, role: e.target.value })}>
                  {[['admin', '系统管理员'], ['hr', 'HR'], ['manager', '主管'], ['employee', '员工']].map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">状态</label>
                <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={editUserForm.status || 'active'} onChange={e => setEditUserForm({ ...editUserForm, status: e.target.value })}>
                  <option value="active">在职</option>
                  <option value="inactive">离职</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setEditUser(null)} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">取消</button>
              <button onClick={handleSaveUser} disabled={userSaving}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
                {userSaving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MODULE: 绩效管理 ─────────────────────────────────────────────────
function PerfModule() {
  const { data: allPlans, loading, refetch } = useApiGet('/api/perf/plans');
  const [tab, setTab] = useState<'pending' | 'active' | 'assess' | 'done'>('pending');
  const [actionMsg, setActionMsg] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [scoreInputs, setScoreInputs] = useState<Record<number, string>>({});
  const [bonusInputs, setBonusInputs] = useState<Record<number, string>>({});
  const [working, setWorking] = useState(false);

  const pending = allPlans?.filter((p: any) => p.status === 'pending_review') || [];
  const active = allPlans?.filter((p: any) => ['in_progress', 'approved'].includes(p.status)) || [];
  const assess = allPlans?.filter((p: any) => ['in_progress', 'assessed'].includes(p.status)) || [];
  const done = allPlans?.filter((p: any) => p.status === 'completed') || [];

  const doAction = async (id: number, action: string, extra?: any) => {
    setWorking(true);
    const res = await apiCall(`/api/perf/plans/${id}/review`, 'POST', { action, ...extra });
    setWorking(false);
    setActionMsg(res.code === 0 ? `✅ ${res.message}` : `❌ ${res.message}`);
    refetch();
  };

  const TABS = [
    { key: 'pending', label: '待审批', count: pending.length, color: 'amber' },
    { key: 'active', label: '进行中', count: active.length, color: 'blue' },
    { key: 'assess', label: '评分/奖金', count: assess.length, color: 'violet' },
    { key: 'done', label: '已完成', count: done.length, color: 'emerald' },
  ];

  const displayList = tab === 'pending' ? pending : tab === 'active' ? active : tab === 'assess' ? assess : done;

  return (
    <div>
      {actionMsg && <div className="mb-3 text-sm bg-slate-50 rounded-lg px-3 py-2">{actionMsg}</div>}
      <div className="flex gap-2 mb-4 flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === t.key ? `bg-${t.color}-600 text-white` : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {t.label} ({t.count})
          </button>
        ))}
      </div>
      {loading ? <div className="text-center py-8 text-slate-400">加载中...</div> : (
        <div className="space-y-3">
          {displayList?.length ? displayList.map((plan: any) => (
            <div key={plan.id} className="bg-slate-50 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm text-slate-800 truncate">{plan.title}</span>
                    <StatusBadge status={plan.status} />
                    {plan.score != null && <span className="text-xs font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">{plan.score}分</span>}
                    {plan.bonus != null && <span className="text-xs font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">¥{plan.bonus}</span>}
                  </div>
                  <p className="text-xs text-slate-400">发起人: {plan.creator_id} · 负责人: {plan.assignee_id} · 截止: {plan.deadline || '—'}</p>
                  {plan.progress != null && plan.status !== 'completed' && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${plan.progress}%` }} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-500">{plan.progress}%</span>
                    </div>
                  )}
                </div>

                {/* 审批操作 */}
                {tab === 'pending' && plan.status === 'pending_review' && (
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => doAction(plan.id, 'approve')} disabled={working}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 disabled:opacity-60">通过</button>
                    <button onClick={() => setRejectingId(plan.id)}
                      className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100">驳回</button>
                  </div>
                )}

                {/* 评分操作 */}
                {tab === 'assess' && plan.status === 'in_progress' && (
                  <div className="flex gap-2 shrink-0 items-center">
                    <input type="number" min="0" max="100" placeholder="分数"
                      value={scoreInputs[plan.id] || ''} onChange={e => setScoreInputs({ ...scoreInputs, [plan.id]: e.target.value })}
                      className="w-16 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none focus:ring-2 focus:ring-violet-300" />
                    <button onClick={() => doAction(plan.id, 'assess', { score: Number(scoreInputs[plan.id]) })}
                      disabled={working || !scoreInputs[plan.id]}
                      className="px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-medium hover:bg-violet-700 disabled:opacity-60">评分</button>
                  </div>
                )}

                {/* 发放奖金操作 */}
                {tab === 'assess' && plan.status === 'assessed' && (
                  <div className="flex gap-2 shrink-0 items-center">
                    <span className="text-xs text-violet-600 font-bold">{plan.score}分</span>
                    <input type="number" min="0" placeholder="奖金 ¥"
                      value={bonusInputs[plan.id] || ''} onChange={e => setBonusInputs({ ...bonusInputs, [plan.id]: e.target.value })}
                      className="w-20 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none focus:ring-2 focus:ring-amber-300" />
                    <button onClick={() => doAction(plan.id, 'reward', { bonus: Number(bonusInputs[plan.id]) })}
                      disabled={working || !bonusInputs[plan.id]}
                      className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 disabled:opacity-60">发放</button>
                  </div>
                )}
              </div>
              {rejectingId === plan.id && (
                <div className="mt-3 flex gap-2">
                  <input className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-300"
                    placeholder="驳回原因（必填）" value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
                  <button onClick={() => { doAction(plan.id, 'reject', { reason: rejectReason }); setRejectingId(null); setRejectReason(''); }}
                    disabled={!rejectReason.trim() || working}
                    className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-60">确认驳回</button>
                  <button onClick={() => { setRejectingId(null); setRejectReason(''); }} className="px-2 py-1.5 text-slate-400 hover:text-slate-600">
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>
              )}
            </div>
          )) : <p className="text-sm text-slate-400 text-center py-8">暂无数据</p>}
        </div>
      )}
    </div>
  );
}

// ─── MODULE: 工资表管理 ─────────────────────────────────────────────
function SalaryModule() {
  const { data: sheets, loading, refetch } = useApiGet('/api/salary/sheets');
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [genForm, setGenForm] = useState({ month: new Date().toISOString().slice(0, 7), department_id: '' });
  const [genMsg, setGenMsg] = useState('');
  const [generating, setGenerating] = useState(false);
  const { data: depts } = useApiGet('/api/org/tree');

  const handleGenerate = async () => {
    setGenerating(true);
    setGenMsg('');
    const res = await apiCall('/api/salary/sheets/generate', 'POST', {
      month: genForm.month,
      department_id: genForm.department_id ? parseInt(genForm.department_id) : undefined,
    });
    setGenerating(false);
    if (res.code === 0) {
      setGenMsg(`✅ 已生成：${res.data.employee_count} 名员工，合计 ¥${res.data.total_amount?.toFixed(0)}`);
      refetch();
    } else {
      setGenMsg(`❌ ${res.message}`);
    }
  };

  const handleViewDetail = async (id: number) => {
    setDetailLoading(true);
    const res = await apiCall(`/api/salary/sheets/${id}`, 'GET');
    setDetailLoading(false);
    if (res.code === 0) setDetail(res.data);
  };

  const handleAction = async (id: number, action: string) => {
    await apiCall(`/api/salary/sheets/${id}/${action}`, 'POST');
    refetch();
    if (detail?.id === id) {
      const res = await apiCall(`/api/salary/sheets/${id}`, 'GET');
      if (res.code === 0) setDetail(res.data);
    }
  };

  const flattenDepts = (nodes: any[]): any[] => nodes.flatMap(d => [d, ...(d.children ? flattenDepts(d.children) : [])]);

  return (
    <div className="flex gap-6">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-bold text-slate-700">工资表列表</h4>
          <button onClick={() => setShowGenerate(!showGenerate)}
            className="px-3 py-1.5 text-xs bg-amber-600 text-white rounded-lg hover:bg-amber-700 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px]">add</span>生成工资表
          </button>
        </div>

        {showGenerate && (
          <div className="mb-4 bg-amber-50 rounded-xl p-4 border border-amber-200">
            <h5 className="font-semibold text-amber-800 text-sm mb-3">生成月度工资表</h5>
            <div className="flex gap-3 flex-wrap">
              <div>
                <label className="block text-xs text-amber-700 mb-1">月份</label>
                <input type="month" className="border border-amber-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  value={genForm.month} onChange={e => setGenForm({ ...genForm, month: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-amber-700 mb-1">部门（可选，默认全员）</label>
                <select className="border border-amber-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  value={genForm.department_id} onChange={e => setGenForm({ ...genForm, department_id: e.target.value })}>
                  <option value="">全员</option>
                  {flattenDepts(depts || []).map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>
            {genMsg && <p className="text-sm mt-2">{genMsg}</p>}
            <div className="flex gap-2 mt-3">
              <button onClick={handleGenerate} disabled={generating}
                className="px-4 py-1.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-60">
                {generating ? '生成中...' : '确认生成'}
              </button>
              <button onClick={() => setShowGenerate(false)} className="px-4 py-1.5 bg-white text-slate-600 rounded-lg text-sm border border-slate-200 hover:bg-slate-50">取消</button>
            </div>
          </div>
        )}

        {loading ? <div className="text-center py-8 text-slate-400">加载中...</div> : (
          <div className="space-y-2">
            {sheets?.length ? sheets.map((s: any) => (
              <div key={s.id} onClick={() => handleViewDetail(s.id)}
                className="flex items-center justify-between bg-slate-50 hover:bg-amber-50 rounded-xl px-4 py-3 cursor-pointer transition-colors group">
                <div>
                  <p className="text-sm font-medium text-slate-800">{s.title}</p>
                  <p className="text-xs text-slate-400">{s.employee_count} 人 · ¥{s.total_amount?.toFixed(0)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={s.status} />
                  <span className="material-symbols-outlined text-[16px] text-slate-300 group-hover:text-amber-500 transition-colors">chevron_right</span>
                </div>
              </div>
            )) : <p className="text-sm text-slate-400 text-center py-8">暂无工资表，请先生成</p>}
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {detail && (
        <div className="w-96 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="font-bold text-slate-700 text-sm">{detail.title}</h4>
              <StatusBadge status={detail.status} />
            </div>
            <button onClick={() => setDetail(null)} className="text-slate-400 hover:text-slate-600">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
          <div className="flex gap-2 mb-3 flex-wrap">
            {detail.status === 'draft' && (
              <button onClick={() => handleAction(detail.id, 'submit')}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">提交审批</button>
            )}
            {detail.status === 'pending_approval' && (
              <>
                <button onClick={() => handleAction(detail.id, 'approve')}
                  className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">审批通过</button>
                <button onClick={() => handleAction(detail.id, 'reject')}
                  className="px-3 py-1.5 text-xs bg-red-50 text-red-600 rounded-lg hover:bg-red-100">驳回</button>
              </>
            )}
            {detail.status === 'approved' && (
              <button onClick={() => handleAction(detail.id, 'publish')}
                className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700">发放工资条</button>
            )}
          </div>
          <div className="overflow-auto max-h-96 text-xs">
            <table className="w-full">
              <thead>
                <tr className="text-slate-400 border-b border-slate-100">
                  <th className="text-left py-2 pr-3">姓名</th>
                  <th className="text-right py-2 pr-3">基本工资</th>
                  <th className="text-right py-2 pr-3">绩效奖金</th>
                  <th className="text-right py-2">实发</th>
                </tr>
              </thead>
              <tbody>
                {detail.rows?.map((row: any) => (
                  <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2 pr-3 font-medium text-slate-700">{row.user_name}</td>
                    <td className="py-2 pr-3 text-right text-slate-500">¥{row.base_salary?.toFixed(0)}</td>
                    <td className="py-2 pr-3 text-right text-emerald-600">+¥{row.perf_bonus?.toFixed(0)}</td>
                    <td className="py-2 text-right font-bold text-slate-800">¥{row.net_pay?.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MODULE: 消息推送 ─────────────────────────────────────────────────
function MsgModule() {
  const { data: history, loading, refetch } = useApiGet('/api/notify/history');
  const { data: users } = useApiGet('/api/perf/team-status');
  const [form, setForm] = useState({ content: '', userIds: [] as string[], msgType: 'text' });
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState('');

  const toggleUser = (id: string) => {
    setForm(f => ({
      ...f,
      userIds: f.userIds.includes(id) ? f.userIds.filter(u => u !== id) : [...f.userIds, id],
    }));
  };

  const handleSendAll = () => {
    if (users) setForm(f => ({ ...f, userIds: users.map((u: any) => u.id) }));
  };

  const handleSend = async () => {
    if (!form.content.trim() || form.userIds.length === 0) return;
    setSending(true);
    const res = await apiCall('/api/notify/send', 'POST', { userIds: form.userIds, content: form.content });
    setSending(false);
    setMsg(res.code === 0 ? '✅ 发送成功' : `❌ ${res.message}`);
    if (res.code === 0) { setForm(f => ({ ...f, content: '', userIds: [] })); refetch(); }
  };

  return (
    <div className="flex gap-6">
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-slate-700 mb-3">推送历史</h4>
        {loading ? <div className="text-center py-8 text-slate-400">加载中...</div> : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {history?.length ? history.map((log: any) => (
              <div key={log.id} className="bg-slate-50 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-400">→ {log.user_id}</span>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={log.status} />
                    <span className="text-xs text-slate-400">{log.created_at?.slice(0, 16)}</span>
                  </div>
                </div>
                <p className="text-sm text-slate-700 truncate">{log.content || log.title}</p>
              </div>
            )) : <p className="text-sm text-slate-400 text-center py-8">暂无推送记录</p>}
          </div>
        )}
      </div>

      <div className="w-72 shrink-0">
        <h4 className="font-bold text-slate-700 mb-3">群发消息</h4>
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-slate-500">接收人</label>
            <button onClick={handleSendAll} className="text-xs text-purple-600 hover:underline">全选</button>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto bg-slate-50 rounded-lg p-2">
            {users?.map((u: any) => (
              <button key={u.id} onClick={() => toggleUser(u.id)}
                className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${form.userIds.includes(u.id) ? 'bg-purple-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-purple-300'}`}>
                {u.name}
              </button>
            ))}
          </div>
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-slate-500 mb-1">消息内容</label>
          <textarea rows={4} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
            placeholder="输入要发送的消息内容..." value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} />
        </div>
        {msg && <p className="text-sm mb-2">{msg}</p>}
        <button onClick={handleSend} disabled={sending || !form.content.trim() || form.userIds.length === 0}
          className="w-full py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2">
          <span className="material-symbols-outlined text-[16px]">send</span>
          {sending ? '发送中...' : `发送给 ${form.userIds.length} 人`}
        </button>
      </div>
    </div>
  );
}

// ─── MODULE: 绩效池管理 ────────────────────────────────────────────────
function PoolModule() {
  const { data: tasks, loading, refetch } = useApiGet('/api/pool/tasks');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', department: '', difficulty: 'normal', bonus: '', max_participants: '5' });
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState('');

  // Proposal review state
  const [proposals, setProposals] = useState<any[]>([]);
  const [proposalLoading, setProposalLoading] = useState(true);
  const [reviewTab, setReviewTab] = useState<'pending_hr' | 'pending_admin'>('pending_hr');
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [reviewMsg, setReviewMsg] = useState('');

  const fetchProposals = async () => {
    setProposalLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/pool/proposals', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.code === 0) setProposals(json.data || []);
    } catch {}
    setProposalLoading(false);
  };

  useEffect(() => { fetchProposals(); }, []);

  const handleReview = async (id: number, action: 'approve' | 'reject', reason?: string) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/pool/proposals/${id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, reason }),
    });
    const json = await res.json();
    setReviewMsg(json.code === 0 ? `✅ ${json.message}` : `❌ ${json.message}`);
    setRejectingId(null);
    setRejectReason('');
    fetchProposals();
    if (action === 'approve' && json.code === 0) refetch();
    setTimeout(() => setReviewMsg(''), 3000);
  };

  const handleCreate = async () => {
    if (!form.title.trim() || !form.bonus) return;
    setCreating(true);
    const res = await apiCall('/api/pool/tasks', 'POST', {
      ...form,
      bonus: parseFloat(form.bonus),
      max_participants: parseInt(form.max_participants),
    });
    setCreating(false);
    if (res.code === 0) {
      setMsg('✅ 创建成功');
      setForm({ title: '', department: '', difficulty: 'normal', bonus: '', max_participants: '5' });
      setShowCreate(false);
      refetch();
    } else {
      setMsg(`❌ ${res.message}`);
    }
  };

  const difficultyMap: Record<string, string> = { easy: '简单', normal: '普通', hard: '困难', expert: '专家级', '低': '低', '中': '中', '高': '高', '专家': '专家' };
  const difficultyColor: Record<string, string> = { easy: 'text-green-600', normal: 'text-blue-600', hard: 'text-amber-600', expert: 'text-red-600', '低': 'text-green-600', '中': 'text-blue-600', '高': 'text-amber-600', '专家': 'text-red-600' };

  const pendingHr = proposals.filter(p => p.proposal_status === 'pending_hr');
  const pendingAdmin = proposals.filter(p => p.proposal_status === 'pending_admin');
  const rejectedList = proposals.filter(p => p.proposal_status === 'rejected');
  const filtered = reviewTab === 'pending_hr' ? pendingHr : pendingAdmin;

  return (
    <div>
      {/* ── Proposal Review Section ── */}
      <div className="mb-6">
        <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px] text-amber-500">rate_review</span>
          员工提案审批
          {(pendingHr.length + pendingAdmin.length) > 0 && (
            <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">{pendingHr.length + pendingAdmin.length} 待处理</span>
          )}
        </h4>
        {reviewMsg && <div className="text-sm mb-3 bg-slate-50 rounded-lg px-3 py-2">{reviewMsg}</div>}
        <div className="flex gap-2 mb-3">
          {[
            { key: 'pending_hr' as const, label: `待人事审核 (${pendingHr.length})` },
            { key: 'pending_admin' as const, label: `待总经理复核 (${pendingAdmin.length})` },
          ].map(tab => (
            <button key={tab.key} onClick={() => setReviewTab(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${reviewTab === tab.key ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
              {tab.label}
            </button>
          ))}
        </div>
        {proposalLoading ? <p className="text-slate-400 text-sm py-4 text-center">加载中...</p> : (
          <div className="space-y-2">
            {filtered.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6 bg-slate-50 rounded-xl">暂无待审批提案</p>
            ) : filtered.map((p: any) => (
              <div key={p.id} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-bold text-sm text-slate-800">{p.title}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">提案人: {p.creator_name || p.created_by} · {new Date(p.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className="text-sm font-black text-rose-600">¥{(p.bonus || 0).toLocaleString()}</span>
                </div>
                {p.description && <p className="text-xs text-slate-500 mb-2">{p.description}</p>}
                <div className="flex items-center gap-2 text-[10px] text-slate-400 mb-3">
                  {p.department && <span>部门: {p.department}</span>}
                  <span>难度: {difficultyMap[p.difficulty] || p.difficulty}</span>
                  <span>上限: {p.max_participants} 人</span>
                </div>
                {rejectingId === p.id ? (
                  <div className="flex gap-2">
                    <input className="flex-1 border border-red-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-300"
                      placeholder="驳回原因..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
                    <button onClick={() => handleReview(p.id, 'reject', rejectReason)} disabled={!rejectReason.trim()}
                      className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-600 disabled:opacity-50">确认驳回</button>
                    <button onClick={() => setRejectingId(null)} className="px-3 py-1.5 bg-slate-200 rounded-lg text-xs">取消</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => handleReview(p.id, 'approve')}
                      className="px-4 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-bold hover:bg-emerald-600 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">check</span>
                      {p.proposal_status === 'pending_hr' ? '人事通过' : '总经理通过'}
                    </button>
                    <button onClick={() => setRejectingId(p.id)}
                      className="px-4 py-1.5 bg-white text-red-500 rounded-lg text-xs font-bold border border-red-200 hover:bg-red-50 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">close</span>驳回
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {rejectedList.length > 0 && (
          <details className="mt-3">
            <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600">已驳回 ({rejectedList.length})</summary>
            <div className="mt-2 space-y-2">
              {rejectedList.map((p: any) => (
                <div key={p.id} className="bg-red-50/50 rounded-lg p-3">
                  <p className="text-sm font-medium text-slate-600">{p.title}</p>
                  <p className="text-[10px] text-red-500 mt-1">驳回原因: {p.reject_reason}</p>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      <hr className="border-slate-100 mb-4" />

      {/* ── Existing Pool Tasks ── */}
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-bold text-slate-700">绩效池任务</h4>
        <button onClick={() => setShowCreate(!showCreate)}
          className="px-3 py-1.5 text-xs bg-rose-600 text-white rounded-lg hover:bg-rose-700 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[14px]">add</span>创建任务
        </button>
      </div>

      {showCreate && (
        <div className="mb-4 bg-rose-50 rounded-xl p-4 border border-rose-200">
          <h5 className="font-semibold text-rose-800 text-sm mb-3">新建绩效池任务</h5>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-rose-700 mb-1">任务名称*</label>
              <input className="w-full border border-rose-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                placeholder="如：Q2 用户增长专项" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-rose-700 mb-1">负责部门</label>
              <input className="w-full border border-rose-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                placeholder="如：产品部" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-rose-700 mb-1">难度</label>
              <select className="w-full border border-rose-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                value={form.difficulty} onChange={e => setForm({ ...form, difficulty: e.target.value })}>
                {Object.entries(difficultyMap).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-rose-700 mb-1">奖金金额 (¥)*</label>
              <input type="number" className="w-full border border-rose-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                placeholder="如：5000" value={form.bonus} onChange={e => setForm({ ...form, bonus: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-rose-700 mb-1">最大参与人数</label>
              <input type="number" className="w-full border border-rose-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                value={form.max_participants} onChange={e => setForm({ ...form, max_participants: e.target.value })} />
            </div>
          </div>
          {msg && <p className="text-sm mt-2">{msg}</p>}
          <div className="flex gap-2 mt-3">
            <button onClick={handleCreate} disabled={creating || !form.title || !form.bonus}
              className="px-4 py-1.5 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 disabled:opacity-60">
              {creating ? '创建中...' : '确认创建'}
            </button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-1.5 bg-white text-slate-600 rounded-lg text-sm border border-slate-200 hover:bg-slate-50">取消</button>
          </div>
        </div>
      )}

      {loading ? <div className="text-center py-8 text-slate-400">加载中...</div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {tasks?.length ? tasks.map((t: any) => (
            <div key={t.id} className="bg-slate-50 rounded-xl p-4">
              <div className="flex items-start justify-between mb-2">
                <p className="font-medium text-slate-800 text-sm">{t.title}</p>
                <StatusBadge status={t.status} />
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 mb-2">
                {t.department && <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">apartment</span>{t.department}</span>}
                <span className={`font-semibold ${difficultyColor[t.difficulty] || 'text-slate-500'}`}>{difficultyMap[t.difficulty] || t.difficulty}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-rose-600">¥{t.bonus?.toLocaleString()}</span>
                <span className="text-xs text-slate-400">{t.current_participants || 0}/{t.max_participants} 人参与</span>
              </div>
              {t.max_participants > 0 && (
                <div className="mt-2 w-full bg-slate-200 rounded-full h-1.5">
                  <div className="bg-rose-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (t.current_participants / t.max_participants) * 100)}%` }} />
                </div>
              )}
            </div>
          )) : <p className="text-sm text-slate-400 text-center py-8 col-span-2">暂无绩效池任务</p>}
        </div>
      )}
    </div>
  );
}

// ─── MODULE: 系统设置 ─────────────────────────────────────────────────
function SettingsModule({ currentUser }: { currentUser: any }) {
  const [settings, setSettings] = useState({
    wecom_corp_id: '',
    wecom_agent_id: '',
    ai_provider: 'iflytek',
    ai_api_key: '',
  });
  const [saved, setSaved] = useState(false);
  const [showDbInfo, setShowDbInfo] = useState(false);

  const handleSave = async () => {
    // Settings are persisted in .env. For demo, we just show a success toast.
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const sections = [
    {
      title: '企微集成配置',
      icon: 'hub',
      color: 'blue',
      fields: [
        { key: 'wecom_corp_id', label: '企业 Corp ID', placeholder: 'wx...' },
        { key: 'wecom_agent_id', label: 'Agent ID', placeholder: '1000000' },
      ]
    },
    {
      title: 'AI 分析设置',
      icon: 'psychology',
      color: 'purple',
      fields: [
        { key: 'ai_provider', label: 'AI 提供商', placeholder: 'iflytek / openai' },
        { key: 'ai_api_key', label: 'API Key', placeholder: '请输入 API Key' },
      ]
    },
  ];

  return (
    <div className="space-y-6">
      {sections.map(section => (
        <div key={section.title} className="bg-slate-50 rounded-xl p-5">
          <h5 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-slate-500">{section.icon}</span>
            {section.title}
          </h5>
          <div className="grid grid-cols-2 gap-4">
            {section.fields.map(field => (
              <div key={field.key}>
                <label className="block text-xs font-medium text-slate-500 mb-1">{field.label}</label>
                <input
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder={field.placeholder}
                  value={(settings as any)[field.key]}
                  onChange={e => setSettings(s => ({ ...s, [field.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="bg-slate-50 rounded-xl p-5">
        <h5 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-slate-500">storage</span>
          数据管理
        </h5>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => setShowDbInfo(!showDbInfo)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:border-blue-300 hover:text-blue-600 flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">info</span>
            查看数据库信息
          </button>
          <button onClick={() => alert('备份功能：在生产环境中，请通过 SSH 访问服务器执行 cp data/hrm.db data/hrm_backup.db')}
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:border-amber-300 hover:text-amber-600 flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">backup</span>
            数据备份
          </button>
        </div>
        {showDbInfo && (
          <div className="mt-3 bg-slate-900 text-slate-100 rounded-xl p-4 text-xs font-mono space-y-1">
            <p>📦 数据库: SQLite (better-sqlite3)</p>
            <p>📂 路径: ./data/hrm.db</p>
            <p>👤 当前用户: {currentUser?.id} ({currentUser?.role})</p>
            <p>🌐 API: http://localhost:3001/api</p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button onClick={handleSave}
          className="px-6 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-900 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">save</span>
          保存设置
        </button>
        {saved && <span className="text-sm text-emerald-600 flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">check_circle</span>已保存</span>}
      </div>
    </div>
  );
}

// ─── MODULE: 流程审批设置 (企微风格) ─────────────────────────────────
const NODE_TYPES: Record<string, { label: string; icon: string; color: string }> = {
  initiator: { label: '申请人', icon: 'person', color: 'bg-blue-500' },
  approver: { label: '审批人', icon: 'how_to_reg', color: 'bg-orange-500' },
  handler: { label: '办理人', icon: 'engineering', color: 'bg-indigo-500' },
  cc: { label: '抄送人', icon: 'forward_to_inbox', color: 'bg-teal-500' },
  condition: { label: '条件分支', icon: 'call_split', color: 'bg-purple-500' },
};

const APPROVE_MODES: Record<string, string> = {
  serial: '依次审批（按顺序依次审批）',
  parallel: '会签（须所有成员同意）',
  or_sign: '或签（一名成员同意即可）',
};

const ASSIGNEE_TYPES: { value: string; label: string; icon: string }[] = [
  { value: 'specified', label: '指定成员', icon: 'person_pin' },
  { value: 'superior', label: '指定上级', icon: 'supervisor_account' },
  { value: 'multi_superior', label: '连续多级上级', icon: 'account_tree' },
  { value: 'dept_head', label: '部门负责人', icon: 'corporate_fare' },
  { value: 'multi_dept_head', label: '连续多级部门负责人', icon: 'domain' },
  { value: 'self', label: '申请人本人', icon: 'person' },
  { value: 'self_select', label: '申请人自选', icon: 'person_search' },
  { value: 'role_hr', label: '指定角色: HR', icon: 'badge' },
  { value: 'role_admin', label: '指定角色: 管理员', icon: 'admin_panel_settings' },
];

const BUSINESS_TYPES: { value: string; label: string; icon: string }[] = [
  { value: 'perf_submit', label: '绩效申请', icon: 'trending_up' },
  { value: 'perf_assign', label: '绩效下发', icon: 'assignment_ind' },
  { value: 'pool_proposal', label: '绩效池提案', icon: 'lightbulb' },
  { value: 'leave_request', label: '请假申请', icon: 'event_note' },
  { value: 'expense_claim', label: '报销申请', icon: 'receipt_long' },
  { value: 'transfer', label: '调岗申请', icon: 'swap_horiz' },
  { value: 'onboarding', label: '入职审批', icon: 'badge' },
  { value: 'offboarding', label: '离职审批', icon: 'exit_to_app' },
];

function ApprovalFlowModule() {
  const { data: allUsers } = useApiGet('/api/org/users-list');
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [nodes, setNodes] = useState<any[]>([]);
  const [selectedNodeIdx, setSelectedNodeIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newIcon, setNewIcon] = useState('approval');
  const [newBizTypes, setNewBizTypes] = useState<string[]>([]);
  const [configTab, setConfigTab] = useState<'approver' | 'permissions'>('approver');

  const loadTemplates = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    const res = await fetch('/api/approval-flows', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
    if (res.code === 0) setTemplates(res.data || []);
    setLoading(false);
  };

  useEffect(() => { loadTemplates(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const res = await apiCall('/api/approval-flows', 'POST', { name: newName.trim(), description: newDesc.trim(), icon: newIcon, business_types: newBizTypes });
    if (res.code === 0) {
      setTemplates(prev => [...prev, res.data]);
      setShowCreate(false);
      setNewName(''); setNewDesc(''); setNewIcon('approval'); setNewBizTypes([]);
      setMsg('✅ 模板已创建');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除此审批流模板？')) return;
    await apiCall(`/api/approval-flows/${id}`, 'DELETE');
    setTemplates(prev => prev.filter(t => t.id !== id));
    if (editing?.id === id) { setEditing(null); setNodes([]); setSelectedNodeIdx(null); }
    setMsg('已删除');
  };

  const handleToggle = async (tpl: any) => {
    await apiCall(`/api/approval-flows/${tpl.id}`, 'PUT', { enabled: !tpl.enabled });
    setTemplates(prev => prev.map(t => t.id === tpl.id ? { ...t, enabled: !t.enabled } : t));
  };

  const openEditor = (tpl: any) => {
    setEditing(tpl);
    setNodes(tpl.nodes?.length ? tpl.nodes : [
      { node_type: 'initiator', label: '申请人', approve_type: 'serial', config: {} },
    ]);
    setSelectedNodeIdx(null); setMsg(''); setConfigTab('approver');
  };

  const addNode = (type: string) => {
    const label = NODE_TYPES[type]?.label || type;
    const newNode = { node_type: type, label, approve_type: 'serial', config: { assigneeType: 'specified', assignees: [], selectionMode: 'multi', requireComment: false, allowActions: ['approve', 'reject'] } };
    setNodes(prev => [...prev, newNode]);
    setSelectedNodeIdx(nodes.length);
  };

  const removeNode = (idx: number) => {
    if (nodes[idx].node_type === 'initiator') return;
    setNodes(prev => prev.filter((_, i) => i !== idx));
    if (selectedNodeIdx === idx) setSelectedNodeIdx(null);
    else if (selectedNodeIdx !== null && selectedNodeIdx > idx) setSelectedNodeIdx(selectedNodeIdx - 1);
  };

  const updateNode = (idx: number, patch: any) => {
    setNodes(prev => prev.map((n, i) => i === idx ? { ...n, ...patch } : n));
  };

  const moveNode = (idx: number, dir: -1 | 1) => {
    if (idx === 0 && dir === -1) return;
    if (idx === nodes.length - 1 && dir === 1) return;
    const next = [...nodes];
    [next[idx], next[idx + dir]] = [next[idx + dir], next[idx]];
    setNodes(next);
    if (selectedNodeIdx === idx) setSelectedNodeIdx(idx + dir);
    else if (selectedNodeIdx === idx + dir) setSelectedNodeIdx(idx);
  };

  const handleSaveNodes = async () => {
    if (!editing) return;
    setSaving(true);
    // Save template-level permissions
    await apiCall(`/api/approval-flows/${editing.id}`, 'PUT', {
      business_types: editing.business_types,
      permissions: editing.permissions,
    });
    const res = await apiCall(`/api/approval-flows/${editing.id}/nodes`, 'PUT', { nodes });
    setSaving(false);
    if (res.code === 0) {
      setMsg('✅ 流程已保存');
      setTemplates(prev => prev.map(t => t.id === editing.id ? { ...t, nodes: res.data, business_types: editing.business_types, permissions: editing.permissions } : t));
    } else {
      setMsg(`❌ ${res.message}`);
    }
  };

  const updateTemplateBizTypes = (types: string[]) => {
    setEditing((prev: any) => ({ ...prev, business_types: types }));
  };

  const updateTemplatePermissions = (key: string, val: boolean) => {
    setEditing((prev: any) => ({ ...prev, permissions: { ...(prev.permissions || {}), [key]: val } }));
  };

  const ICON_OPTIONS = [
    { value: 'approval', label: '审批' },
    { value: 'event_note', label: '请假' },
    { value: 'receipt_long', label: '报销' },
    { value: 'business_center', label: '出差' },
    { value: 'trending_up', label: '绩效' },
    { value: 'payments', label: '薪酬' },
    { value: 'badge', label: '入职' },
    { value: 'exit_to_app', label: '离职' },
    { value: 'swap_horiz', label: '调岗' },
    { value: 'handshake', label: '合同' },
  ];

  const selectedNode = selectedNodeIdx !== null ? nodes[selectedNodeIdx] : null;
  const userList: any[] = Array.isArray(allUsers) ? allUsers : [];

  // ── Editing View (Two-panel layout) ──
  if (editing) {
    return (
      <div>
        {/* Header with save */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => { setEditing(null); setNodes([]); setSelectedNodeIdx(null); }}
              className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
              <span className="material-symbols-outlined text-[16px] text-slate-600">arrow_back</span>
            </button>
            <div>
              <h4 className="text-base font-bold text-slate-800 dark:text-slate-100">{editing.name}</h4>
              <p className="text-xs text-slate-400">{editing.description || '审批流程设置'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {msg && <span className="text-xs">{msg}</span>}
            <button onClick={handleSaveNodes} disabled={saving}
              className="px-4 py-2 bg-[#0060a9] text-white text-sm font-medium rounded-lg hover:bg-[#004d8a] disabled:opacity-60 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px]">{saving ? 'hourglass_empty' : 'save'}</span>
              {saving ? '保存中...' : '保存流程'}
            </button>
          </div>
        </div>

        {/* Business types binding */}
        <div className="mb-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <h5 className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2.5 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px]">link</span>关联业务操作
          </h5>
          <div className="flex flex-wrap gap-2">
            {BUSINESS_TYPES.map(bt => {
              const isActive = (editing.business_types || []).includes(bt.value);
              return (
                <button key={bt.value} onClick={() => {
                  const cur = editing.business_types || [];
                  updateTemplateBizTypes(isActive ? cur.filter((v: string) => v !== bt.value) : [...cur, bt.value]);
                }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    isActive ? 'bg-[#0060a9]/10 border-[#0060a9]/30 text-[#0060a9]' : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-500 hover:border-slate-300'
                  }`}>
                  <span className="material-symbols-outlined text-[14px]">{bt.icon}</span>
                  {bt.label}
                  {isActive && <span className="material-symbols-outlined text-[12px]">check</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Two-panel layout */}
        <div className="flex gap-4" style={{ minHeight: '500px' }}>
          {/* Left Panel: Visual Flow */}
          <div className="w-[340px] shrink-0 flex flex-col items-center gap-0 py-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 px-4 overflow-y-auto">
            {nodes.map((node, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && (
                  <div className="flex flex-col items-center">
                    <div className="w-0.5 h-4 bg-slate-300" />
                    <button onClick={() => {
                      // Insert node between
                    }} className="w-5 h-5 rounded-full bg-white border-2 border-slate-300 hover:border-[#0060a9] flex items-center justify-center transition-colors group -my-0.5 z-10">
                      <span className="material-symbols-outlined text-[12px] text-slate-300 group-hover:text-[#0060a9]">add</span>
                    </button>
                    <div className="w-0.5 h-4 bg-slate-300" />
                  </div>
                )}
                {/* Node Card */}
                <div onClick={() => { setSelectedNodeIdx(idx); setConfigTab('approver'); }}
                  className={`relative w-full rounded-xl border-2 p-3 cursor-pointer transition-all ${
                    selectedNodeIdx === idx ? 'ring-2 ring-[#0060a9]/30 shadow-md' : ''
                  } ${
                    node.node_type === 'initiator' ? 'border-blue-300 bg-blue-50/80 dark:bg-blue-900/20' :
                    node.node_type === 'approver' ? 'border-orange-300 bg-orange-50/80 dark:bg-orange-900/20' :
                    node.node_type === 'handler' ? 'border-indigo-300 bg-indigo-50/80 dark:bg-indigo-900/20' :
                    node.node_type === 'cc' ? 'border-teal-300 bg-teal-50/80 dark:bg-teal-900/20' :
                    'border-purple-300 bg-purple-50/80 dark:bg-purple-900/20'
                  }`}>
                  <div className={`absolute top-0 left-0 right-0 h-6 rounded-t-[10px] text-[10px] font-bold text-white px-3 flex items-center ${NODE_TYPES[node.node_type]?.color || 'bg-slate-500'}`}>
                    {NODE_TYPES[node.node_type]?.label || node.node_type}
                  </div>
                  <div className="mt-5 flex items-center justify-between">
                    <div className="text-sm text-slate-700 dark:text-slate-200 truncate flex-1">
                      {node.node_type === 'initiator' ? (
                        <span className="text-slate-500">{node.config?.scope || '所有人'}</span>
                      ) : node.node_type === 'approver' || node.node_type === 'handler' ? (
                        <span className="text-slate-500 text-xs">
                          {ASSIGNEE_TYPES.find(a => a.value === (node.config?.assigneeType || 'specified'))?.label}
                          {(node.config?.assigneeType || 'specified') === 'specified' && node.config?.assignees?.length > 0
                            ? ` · ${node.config.assignees.length}人` : ''}
                          {node.node_type === 'approver' && ` · ${node.approve_type === 'or_sign' ? '或签' : node.approve_type === 'parallel' ? '会签' : '依次'}`}
                        </span>
                      ) : node.node_type === 'cc' ? (
                        <span className="text-slate-500 text-xs">{node.config?.assigneeType === 'self_select' ? '申请人自选' : '指定成员'}</span>
                      ) : (
                        <span className="text-xs text-slate-500">条件分支</span>
                      )}
                    </div>
                    <span className="material-symbols-outlined text-[14px] text-slate-300">chevron_right</span>
                  </div>
                  {/* Delete/Move buttons */}
                  {node.node_type !== 'initiator' && selectedNodeIdx === idx && (
                    <div className="absolute -top-2 -right-2 flex gap-0.5">
                      <button onClick={e => { e.stopPropagation(); moveNode(idx, -1); }} className="w-5 h-5 rounded-full bg-white shadow border border-slate-200 flex items-center justify-center text-slate-400 hover:text-blue-500">
                        <span className="material-symbols-outlined text-[11px]">arrow_upward</span>
                      </button>
                      <button onClick={e => { e.stopPropagation(); moveNode(idx, 1); }} className="w-5 h-5 rounded-full bg-white shadow border border-slate-200 flex items-center justify-center text-slate-400 hover:text-blue-500">
                        <span className="material-symbols-outlined text-[11px]">arrow_downward</span>
                      </button>
                      <button onClick={e => { e.stopPropagation(); removeNode(idx); }} className="w-5 h-5 rounded-full bg-white shadow border border-slate-200 flex items-center justify-center text-slate-400 hover:text-red-500">
                        <span className="material-symbols-outlined text-[11px]">close</span>
                      </button>
                    </div>
                  )}
                </div>
              </React.Fragment>
            ))}

            {/* End + Add */}
            <div className="flex flex-col items-center">
              <div className="w-0.5 h-4 bg-slate-300" />
              <button className="w-5 h-5 rounded-full bg-white border-2 border-slate-300 hover:border-[#0060a9] flex items-center justify-center transition-colors group -my-0.5 z-10"
                onClick={() => addNode('approver')}>
                <span className="material-symbols-outlined text-[12px] text-slate-300 group-hover:text-[#0060a9]">add</span>
              </button>
              <div className="w-0.5 h-4 bg-slate-300" />
            </div>
            <div className="w-full rounded-xl border-2 border-dashed border-slate-300 bg-white dark:bg-slate-800 p-2.5 text-center">
              <span className="text-xs font-bold text-slate-400">流程结束</span>
            </div>

            {/* Quick add buttons */}
            <div className="flex flex-wrap justify-center gap-1.5 mt-4 pt-3 border-t border-slate-200 dark:border-slate-700 w-full">
              {(['approver', 'handler', 'cc', 'condition'] as const).map(type => (
                <button key={type} onClick={() => addNode(type)}
                  className="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-[11px] font-medium text-slate-500 hover:border-[#0060a9]/30 hover:text-[#0060a9] transition-all">
                  <span className={`w-4 h-4 rounded ${NODE_TYPES[type].color} flex items-center justify-center`}>
                    <span className="material-symbols-outlined text-white text-[10px]">{NODE_TYPES[type].icon}</span>
                  </span>
                  {NODE_TYPES[type].label}
                </button>
              ))}
            </div>
          </div>

          {/* Right Panel: Node Config */}
          <div className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            {selectedNode ? (
              <div className="h-full flex flex-col">
                {/* Config Tabs */}
                <div className="flex border-b border-slate-200 dark:border-slate-700 shrink-0">
                  {(selectedNode.node_type === 'approver' || selectedNode.node_type === 'handler') && (
                    <>
                      <button onClick={() => setConfigTab('approver')}
                        className={`px-5 py-3 text-sm font-medium transition-colors relative ${configTab === 'approver' ? 'text-[#0060a9]' : 'text-slate-500 hover:text-slate-700'}`}>
                        {selectedNode.node_type === 'handler' ? '办理人设置' : '审批人设置'}
                        {configTab === 'approver' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0060a9]" />}
                      </button>
                      <button onClick={() => setConfigTab('permissions')}
                        className={`px-5 py-3 text-sm font-medium transition-colors relative ${configTab === 'permissions' ? 'text-[#0060a9]' : 'text-slate-500 hover:text-slate-700'}`}>
                        权限设置
                        {configTab === 'permissions' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0060a9]" />}
                      </button>
                    </>
                  )}
                  {selectedNode.node_type === 'cc' && (
                    <div className="px-5 py-3 text-sm font-medium text-[#0060a9] relative">
                      抄送人设置
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0060a9]" />
                    </div>
                  )}
                  {selectedNode.node_type === 'initiator' && (
                    <div className="px-5 py-3 text-sm font-medium text-[#0060a9] relative">
                      发起人设置
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0060a9]" />
                    </div>
                  )}
                  {selectedNode.node_type === 'condition' && (
                    <div className="px-5 py-3 text-sm font-medium text-[#0060a9] relative">
                      条件设置
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0060a9]" />
                    </div>
                  )}
                </div>

                {/* Config Content */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                  {/* ── Node Name ── */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">节点名称</label>
                    <input value={selectedNode.label} onChange={e => updateNode(selectedNodeIdx!, { label: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 outline-none focus:ring-2 focus:ring-[#0060a9]/20" />
                  </div>

                  {/* ── Initiator Config ── */}
                  {selectedNode.node_type === 'initiator' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">发起范围</label>
                      <div className="space-y-2">
                        {['所有人', '指定部门', '指定角色'].map(scope => (
                          <label key={scope} className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="initiator_scope" checked={(selectedNode.config?.scope || '所有人') === scope}
                              onChange={() => updateNode(selectedNodeIdx!, { config: { ...selectedNode.config, scope } })}
                              className="w-3.5 h-3.5 text-[#0060a9]" />
                            <span className="text-sm text-slate-600 dark:text-slate-300">{scope}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Approver/Handler Config (Tab: 审批人设置) ── */}
                  {(selectedNode.node_type === 'approver' || selectedNode.node_type === 'handler') && configTab === 'approver' && (
                    <>
                      {/* Assignee Type (radio grid) */}
                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
                          {selectedNode.node_type === 'handler' ? '办理人' : '审批人'}
                        </label>
                        <div className="grid grid-cols-3 gap-x-4 gap-y-2.5">
                          {ASSIGNEE_TYPES.map(at => (
                            <label key={at.value} className="flex items-center gap-1.5 cursor-pointer">
                              <input type="radio" name={`assignee_type_${selectedNodeIdx}`}
                                checked={(selectedNode.config?.assigneeType || 'specified') === at.value}
                                onChange={() => updateNode(selectedNodeIdx!, { config: { ...selectedNode.config, assigneeType: at.value } })}
                                className="w-3.5 h-3.5 text-[#0060a9]" />
                              <span className="text-xs text-slate-600 dark:text-slate-300">{at.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Person picker — when specified */}
                      {(selectedNode.config?.assigneeType || 'specified') === 'specified' && (() => {
                        const selectedIds: string[] = selectedNode.config?.assignees || [];
                        return (
                          <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">指定成员</label>
                            {selectedIds.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mb-2">
                                {selectedIds.map((uid: string) => {
                                  const u = userList.find(u => u.id === uid);
                                  return (
                                    <span key={uid} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-[11px] font-medium">
                                      <span className="material-symbols-outlined text-[12px]">person</span>
                                      {u?.name || uid}
                                      <button onClick={() => updateNode(selectedNodeIdx!, { config: { ...selectedNode.config, assignees: selectedIds.filter(id => id !== uid) } })}
                                        className="text-blue-400 hover:text-red-500 ml-0.5">×</button>
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                            <select value="" onChange={e => {
                              if (e.target.value && !selectedIds.includes(e.target.value)) {
                                updateNode(selectedNodeIdx!, { config: { ...selectedNode.config, assignees: [...selectedIds, e.target.value] } });
                              }
                              e.target.value = '';
                            }} className="w-full bg-white dark:bg-slate-700 border border-dashed border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-500 outline-none">
                              <option value="">+ 添加成员...</option>
                              {userList.filter(u => !selectedIds.includes(u.id)).map((u: any) => (
                                <option key={u.id} value={u.id}>{u.name} ({u.department_name || u.title || ''})</option>
                              ))}
                            </select>
                          </div>
                        );
                      })()}

                      {/* Selection scope */}
                      {selectedNode.config?.assigneeType === 'self_select' && (
                        <>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">可选范围</label>
                            <div className="flex gap-4">
                              {['不限范围', '指定范围'].map(s => (
                                <label key={s} className="flex items-center gap-1.5 cursor-pointer">
                                  <input type="radio" checked={(selectedNode.config?.selectionScope || '不限范围') === s}
                                    onChange={() => updateNode(selectedNodeIdx!, { config: { ...selectedNode.config, selectionScope: s } })}
                                    className="w-3.5 h-3.5 text-[#0060a9]" />
                                  <span className="text-xs text-slate-600 dark:text-slate-300">{s}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">选人方式</label>
                            <div className="flex gap-4">
                              {[{ v: 'single', l: '单选' }, { v: 'multi', l: '多选' }].map(m => (
                                <label key={m.v} className="flex items-center gap-1.5 cursor-pointer">
                                  <input type="radio" checked={(selectedNode.config?.selectionMode || 'multi') === m.v}
                                    onChange={() => updateNode(selectedNodeIdx!, { config: { ...selectedNode.config, selectionMode: m.v } })}
                                    className="w-3.5 h-3.5 text-[#0060a9]" />
                                  <span className="text-xs text-slate-600 dark:text-slate-300">{m.l}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </>
                      )}

                      {/* Multi-approval mode (for approver only) */}
                      {selectedNode.node_type === 'approver' && (
                        <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">多人审批方式</label>
                          <div className="space-y-2">
                            {Object.entries(APPROVE_MODES).map(([k, v]) => (
                              <label key={k} className="flex items-center gap-1.5 cursor-pointer">
                                <input type="radio" name={`approve_mode_${selectedNodeIdx}`}
                                  checked={(selectedNode.approve_type || 'serial') === k}
                                  onChange={() => updateNode(selectedNodeIdx!, { approve_type: k })}
                                  className="w-3.5 h-3.5 text-[#0060a9]" />
                                <span className="text-xs text-slate-600 dark:text-slate-300">{v}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Approval opinions */}
                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
                          {selectedNode.node_type === 'handler' ? '办理意见' : '审批意见'}
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={selectedNode.config?.requireComment || false}
                            onChange={e => updateNode(selectedNodeIdx!, { config: { ...selectedNode.config, requireComment: e.target.checked } })}
                            className="w-3.5 h-3.5 rounded text-[#0060a9]" />
                          <span className="text-xs text-slate-600 dark:text-slate-300">
                            {selectedNode.node_type === 'handler'
                              ? '办理人提交办理结果时，必须填写办理意见'
                              : '审批人同意或驳回单据时，必须填写审批意见'}
                          </span>
                        </label>
                      </div>

                      {/* Node actions */}
                      {selectedNode.node_type === 'approver' && (
                        <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">节点操作</label>
                          <div className="flex flex-wrap gap-3">
                            {[{ k: 'approve', l: '同意' }, { k: 'reject', l: '驳回' }, { k: 'transfer', l: '转交' }].map(a => (
                              <label key={a.k} className="flex items-center gap-1.5 cursor-pointer">
                                <input type="checkbox" checked={(selectedNode.config?.allowActions || ['approve', 'reject']).includes(a.k)}
                                  onChange={e => {
                                    const cur = selectedNode.config?.allowActions || ['approve', 'reject'];
                                    const next = e.target.checked ? [...cur, a.k] : cur.filter((x: string) => x !== a.k);
                                    updateNode(selectedNodeIdx!, { config: { ...selectedNode.config, allowActions: next } });
                                  }}
                                  className="w-3.5 h-3.5 rounded text-[#0060a9]" />
                                <span className="text-xs text-slate-600 dark:text-slate-300">{a.l}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* ── Approver/Handler Config (Tab: 权限设置) ── */}
                  {(selectedNode.node_type === 'approver' || selectedNode.node_type === 'handler') && configTab === 'permissions' && (
                    <div className="space-y-5">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-3">修改权限</label>
                        <div className="space-y-2.5">
                          {[
                            { k: 'lockApprover', l: '提交申请时，员工不可修改固定审批人' },
                            { k: 'lockCc', l: '提交申请时，员工不可删除固定抄送人' },
                            { k: 'lockHandler', l: '提交申请时，员工不可修改固定办理人' },
                          ].map(p => (
                            <label key={p.k} className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={editing.permissions?.[p.k] || false}
                                onChange={e => updateTemplatePermissions(p.k, e.target.checked)}
                                className="w-3.5 h-3.5 rounded text-[#0060a9]" />
                              <span className="text-xs text-slate-600 dark:text-slate-300">{p.l}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-3">撤销权限</label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={editing.permissions?.allowRevoke || false}
                            onChange={e => updateTemplatePermissions('allowRevoke', e.target.checked)}
                            className="w-3.5 h-3.5 rounded text-[#0060a9]" />
                          <span className="text-xs text-slate-600 dark:text-slate-300">通过后允许撤销 — 审批通过后，经审批人和办理人同意可撤销申请</span>
                        </label>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-3">加签权限</label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={editing.permissions?.allowAddSigner || false}
                            onChange={e => updateTemplatePermissions('allowAddSigner', e.target.checked)}
                            className="w-3.5 h-3.5 rounded text-[#0060a9]" />
                          <span className="text-xs text-slate-600 dark:text-slate-300">允许在审批单中增加临时审批人</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* ── CC Config ── */}
                  {selectedNode.node_type === 'cc' && (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">抄送人类型</label>
                        <div className="space-y-2">
                          {[{ v: 'specified', l: '指定成员' }, { v: 'self_select', l: '申请人自选' }].map(t => (
                            <label key={t.v} className="flex items-center gap-1.5 cursor-pointer">
                              <input type="radio" name={`cc_type_${selectedNodeIdx}`}
                                checked={(selectedNode.config?.assigneeType || 'specified') === t.v}
                                onChange={() => updateNode(selectedNodeIdx!, { config: { ...selectedNode.config, assigneeType: t.v } })}
                                className="w-3.5 h-3.5 text-[#0060a9]" />
                              <span className="text-xs text-slate-600 dark:text-slate-300">{t.l}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      {(selectedNode.config?.assigneeType || 'specified') === 'specified' && (() => {
                        const selectedIds: string[] = selectedNode.config?.assignees || [];
                        return (
                          <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">指定抄送人</label>
                            {selectedIds.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mb-2">
                                {selectedIds.map((uid: string) => {
                                  const u = userList.find(u => u.id === uid);
                                  return (
                                    <span key={uid} className="inline-flex items-center gap-1 px-2 py-1 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 rounded-lg text-[11px] font-medium">
                                      <span className="material-symbols-outlined text-[12px]">person</span>
                                      {u?.name || uid}
                                      <button onClick={() => updateNode(selectedNodeIdx!, { config: { ...selectedNode.config, assignees: selectedIds.filter(id => id !== uid) } })}
                                        className="text-teal-400 hover:text-red-500 ml-0.5">×</button>
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                            <select value="" onChange={e => {
                              if (e.target.value && !selectedIds.includes(e.target.value)) {
                                updateNode(selectedNodeIdx!, { config: { ...selectedNode.config, assignees: [...selectedIds, e.target.value] } });
                              }
                              e.target.value = '';
                            }} className="w-full bg-white dark:bg-slate-700 border border-dashed border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-500 outline-none">
                              <option value="">+ 添加抄送人...</option>
                              {userList.filter(u => !selectedIds.includes(u.id)).map((u: any) => (
                                <option key={u.id} value={u.id}>{u.name} ({u.department_name || u.title || ''})</option>
                              ))}
                            </select>
                          </div>
                        );
                      })()}
                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">通知方式</label>
                        <select value={selectedNode.config?.notifyType || 'both'} onChange={e => updateNode(selectedNodeIdx!, { config: { ...selectedNode.config, notifyType: e.target.value } })}
                          className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-xs outline-none">
                          <option value="system">系统通知</option>
                          <option value="wecom">企微消息</option>
                          <option value="both">系统 + 企微</option>
                        </select>
                      </div>
                    </>
                  )}

                  {/* ── Condition Config ── */}
                  {selectedNode.node_type === 'condition' && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-500 shrink-0">条件字段：</label>
                        <input value={selectedNode.config?.field || ''} onChange={e => updateNode(selectedNodeIdx!, { config: { ...selectedNode.config, field: e.target.value } })}
                          placeholder="例如: amount" className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-xs outline-none w-32" />
                        <select value={selectedNode.config?.operator || 'gt'} onChange={e => updateNode(selectedNodeIdx!, { config: { ...selectedNode.config, operator: e.target.value } })}
                          className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-2 text-xs outline-none">
                          <option value="gt">&gt;</option>
                          <option value="gte">&ge;</option>
                          <option value="lt">&lt;</option>
                          <option value="lte">&le;</option>
                          <option value="eq">=</option>
                        </select>
                        <input value={selectedNode.config?.value || ''} onChange={e => updateNode(selectedNodeIdx!, { config: { ...selectedNode.config, value: e.target.value } })}
                          placeholder="值" className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-xs outline-none w-24" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-600 p-8">
                <span className="material-symbols-outlined text-[48px] mb-3">touch_app</span>
                <p className="text-sm font-medium">点击左侧节点进行配置</p>
                <p className="text-xs mt-1">选择节点后可设置审批人、权限等</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── List View ──
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-slate-500">配置各类审批流程的节点、审批人和条件分支</p>
        <button onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-[#0060a9] text-white text-sm font-medium rounded-lg hover:bg-[#004d8a] flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[14px]">add</span>
          新建审批流
        </button>
      </div>

      {msg && <div className="mb-3 text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2">{msg}</div>}

      {/* Create Form */}
      {showCreate && (
        <div className="mb-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
          <h5 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">新建审批流模板</h5>
          <div className="grid grid-cols-[1fr_auto] gap-3 mb-3">
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="审批流名称 *"
              className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-200 bg-white dark:bg-slate-700" autoFocus />
            <select value={newIcon} onChange={e => setNewIcon(e.target.value)}
              className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm outline-none bg-white dark:bg-slate-700">
              {ICON_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="描述说明（可选）"
            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm outline-none mb-3 focus:ring-2 focus:ring-blue-200 bg-white dark:bg-slate-700" />
          {/* Business types selection */}
          <div className="mb-3">
            <label className="block text-xs font-bold text-slate-500 mb-2">关联业务（可选）</label>
            <div className="flex flex-wrap gap-1.5">
              {BUSINESS_TYPES.map(bt => {
                const active = newBizTypes.includes(bt.value);
                return (
                  <button key={bt.value} onClick={() => setNewBizTypes(prev => active ? prev.filter(v => v !== bt.value) : [...prev, bt.value])}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                      active ? 'bg-[#0060a9]/10 border-[#0060a9]/30 text-[#0060a9]' : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}>
                    <span className="material-symbols-outlined text-[12px]">{bt.icon}</span>
                    {bt.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowCreate(false); setNewName(''); setNewDesc(''); setNewBizTypes([]); }}
              className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-50">取消</button>
            <button onClick={handleCreate} disabled={!newName.trim()}
              className="px-4 py-1.5 bg-[#0060a9] text-white text-xs font-medium rounded-lg hover:bg-[#004d8a] disabled:opacity-50">创建</button>
          </div>
        </div>
      )}

      {/* Template List */}
      {loading ? (
        <div className="text-center py-12 text-sm text-slate-400">加载中...</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-16">
          <span className="material-symbols-outlined text-[48px] text-slate-200 mb-3">account_tree</span>
          <p className="text-sm text-slate-400">暂无审批流模板</p>
          <p className="text-xs text-slate-300 mt-1">点击「新建审批流」开始配置</p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map(tpl => (
            <div key={tpl.id} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 flex items-center justify-between group hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">
              <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => openEditor(tpl)}>
                <div className="w-10 h-10 rounded-xl bg-[#0060a9] flex items-center justify-center">
                  <span className="material-symbols-outlined text-white text-lg">{tpl.icon || 'approval'}</span>
                </div>
                <div>
                  <h5 className="text-sm font-bold text-slate-700 dark:text-slate-200">{tpl.name}</h5>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-slate-400">{tpl.description || '暂无描述'} · {tpl.nodes?.length || 0} 个节点</span>
                    {(tpl.business_types || []).length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded font-medium">
                        {(tpl.business_types || []).length} 项业务
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div onClick={() => handleToggle(tpl)}
                  className={`relative w-9 h-5 rounded-full cursor-pointer transition-all duration-200 ${tpl.enabled ? 'bg-[#0060a9]' : 'bg-slate-200'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${tpl.enabled ? 'translate-x-4' : ''}`} />
                </div>
                <button onClick={() => openEditor(tpl)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-[#0060a9] hover:bg-white transition-all opacity-0 group-hover:opacity-100">
                  <span className="material-symbols-outlined text-[16px]">edit</span>
                </button>
                <button onClick={() => handleDelete(tpl.id)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-white transition-all opacity-0 group-hover:opacity-100">
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
// ─── MODULE: 权限管理 ─────────────────────────────────────────────────
const PRESETS_KEY = 'hrm_perm_presets';
interface PermPreset { name: string; keys: string[] }

function PermissionsModule() {
  const { data: orgTree, loading: orgLoading } = useApiGet('/api/org/tree');
  const { data: permDefs, loading: permLoading } = useApiGet('/api/permissions/definitions');

  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [grantedKeys, setGrantedKeys] = useState<Set<string>>(new Set());
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [expandedDepts, setExpandedDepts] = useState<Set<number>>(new Set());
  const [deptMembers, setDeptMembers] = useState<Record<number, any[]>>({});
  const [presets, setPresets] = useState<PermPreset[]>(() => {
    try { return JSON.parse(localStorage.getItem(PRESETS_KEY) || '[]'); } catch { return []; }
  });
  const [showPresetInput, setShowPresetInput] = useState(false);
  const [presetName, setPresetName] = useState('');

  const handleSavePreset = () => {
    const trimmed = presetName.trim();
    if (!trimmed) return;
    const existing = presets.findIndex(p => p.name === trimmed);
    const updated = [...presets];
    if (existing >= 0) {
      updated[existing] = { name: trimmed, keys: [...grantedKeys] };
    } else {
      updated.push({ name: trimmed, keys: [...grantedKeys] });
    }
    setPresets(updated);
    localStorage.setItem(PRESETS_KEY, JSON.stringify(updated));
    setMsg(`✅ 已保存预设「${trimmed}」`);
    setPresetName('');
    setShowPresetInput(false);
  };

  const loading = orgLoading || permLoading;

  // 部门维度默认全部展开，并加载成员
  useEffect(() => {
    if (!orgTree?.length) return;
    const topIds = orgTree.map((d: any) => d.id);
    setExpandedDepts(new Set(topIds));
    topIds.forEach((id: number) => loadDeptMembers(id));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgTree]);

  const loadDeptMembers = async (deptId: number) => {
    if (deptMembers[deptId]) return;
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/org/departments/${deptId}`, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    if (json.code === 0) setDeptMembers(prev => ({ ...prev, [deptId]: json.data.members || [] }));
  };

  const toggleDept = async (deptId: number) => {
    const next = new Set(expandedDepts);
    if (next.has(deptId)) next.delete(deptId);
    else { next.add(deptId); await loadDeptMembers(deptId); }
    setExpandedDepts(next);
  };

  const toggleAllInDept = (deptId: number) => {
    const members = deptMembers[deptId] || [];
    const ids = members.map((m: any) => m.id);
    const allSelected = ids.every(id => selectedUsers.has(id));
    const next = new Set(selectedUsers);
    ids.forEach(id => allSelected ? next.delete(id) : next.add(id));
    setSelectedUsers(next);
  };

  const toggleUser = (userId: string) => {
    const next = new Set(selectedUsers);
    next.has(userId) ? next.delete(userId) : next.add(userId);
    setSelectedUsers(next);
  };

  useEffect(() => {
    if (selectedUsers.size === 0) { setGrantedKeys(new Set()); return; }
    const load = async () => {
      setLoadingPerms(true);
      const token = localStorage.getItem('token');
      const firstId = [...selectedUsers][0];
      const res = await fetch(`/api/permissions/user/${firstId}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
      setGrantedKeys(new Set(res.data || []));
      setLoadingPerms(false);
    };
    load();
  }, [selectedUsers]);

  const togglePerm = (key: string) => {
    const next = new Set(grantedKeys);
    next.has(key) ? next.delete(key) : next.add(key);
    setGrantedKeys(next);
  };

  const handleSave = async () => {
    if (selectedUsers.size === 0) return;
    setSaving(true); setMsg('');
    const token = localStorage.getItem('token');
    const grantedKeysArr = [...grantedKeys];
    let ok = 0, fail = 0;
    for (const userId of selectedUsers) {
      const res = await fetch(`/api/permissions/user/${userId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ grantedKeys: grantedKeysArr }),
      }).then(r => r.json());
      res.code === 0 ? ok++ : fail++;
    }
    setSaving(false);
    setMsg(fail === 0 ? `✅ 已保存 ${ok} 人的权限` : `⚠️ ${ok} 成功，${fail} 失败`);
  };

  const renderTree = (nodes: any[]): React.ReactNode => nodes.map(dept => {
    const members = deptMembers[dept.id] || [];
    const isExpanded = expandedDepts.has(dept.id);
    const allSel = members.length > 0 && members.every((m: any) => selectedUsers.has(m.id));
    const someSel = members.some((m: any) => selectedUsers.has(m.id));
    return (
      <div key={dept.id}>
        <div className="flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-slate-100 cursor-pointer group" onClick={() => toggleDept(dept.id)}>
          <span className={`material-symbols-outlined text-[14px] text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>chevron_right</span>
          <button onClick={e => { e.stopPropagation(); loadDeptMembers(dept.id).then(() => toggleAllInDept(dept.id)); }}
            className={`w-4 h-4 rounded flex items-center justify-center border-2 transition-all shrink-0 ${allSel ? 'bg-violet-600 border-violet-600' : someSel ? 'bg-violet-200 border-violet-400' : 'border-slate-300 bg-white hover:border-violet-400'}`}>
            {allSel && <span className="material-symbols-outlined text-white text-[10px]">check</span>}
            {someSel && !allSel && <div className="w-1.5 h-1.5 bg-violet-500 rounded-sm"/>}
          </button>
          <span className="material-symbols-outlined text-[14px] text-violet-500">corporate_fare</span>
          <span className="text-sm font-medium text-slate-700 flex-1">{dept.name}</span>
          <span className="text-xs text-slate-400 opacity-0 group-hover:opacity-100">{dept.member_count} 人</span>
        </div>
        {isExpanded && (
          <div className="ml-6">
            {members.map((m: any) => (
              <div key={m.id} onClick={() => toggleUser(m.id)}
                className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-100 cursor-pointer">
                <button className={`w-4 h-4 rounded flex items-center justify-center border-2 transition-all shrink-0 ${selectedUsers.has(m.id) ? 'bg-violet-600 border-violet-600' : 'border-slate-300 bg-white hover:border-violet-400'}`}>
                  {selectedUsers.has(m.id) && <span className="material-symbols-outlined text-white text-[10px]">check</span>}
                </button>
                <div className="w-6 h-6 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-xs font-bold shrink-0">{m.name[0]}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-700 truncate">{m.name}</p>
                  <p className="text-[10px] text-slate-400 truncate">{m.title || m.role}</p>
                </div>
              </div>
            ))}
            {members.length === 0 && <p className="text-xs text-slate-400 px-2 py-1">暂无直属成员</p>}
            {dept.children?.length > 0 && renderTree(dept.children)}
          </div>
        )}
      </div>
    );
  });

  const permModules = [...new Set((permDefs || []).map((p: any) => p.module))];
  const allMembers = Object.values(deptMembers).flat() as any[];

  return (
    <div className="flex gap-0 min-h-[480px]">
      {/* Left: Org Tree */}
      <div className="w-64 shrink-0 border-r border-slate-100 pr-4 mr-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">选择人员</h4>
          {selectedUsers.size > 0 && (
            <button onClick={() => setSelectedUsers(new Set())} className="text-xs text-slate-400 hover:text-slate-600">清空 ({selectedUsers.size})</button>
          )}
        </div>
        {loading ? <div className="text-sm text-slate-400 text-center py-8">加载中...</div> : (
          <div className="space-y-0.5 max-h-[430px] overflow-y-auto">
            {orgTree?.length ? renderTree(orgTree) : <p className="text-sm text-slate-400 text-center py-4">暂无组织数据</p>}
          </div>
        )}
      </div>

      {/* Right: Permission Toggles */}
      <div className="flex-1 min-w-0">
        {selectedUsers.size === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 py-16">
            <span className="material-symbols-outlined text-[52px] mb-3 text-slate-200">person_search</span>
            <p className="text-sm font-semibold text-slate-500">请在左侧选择人员或部门</p>
            <p className="text-xs mt-1.5 text-slate-400">点击部门复选框可批量选择该部门所有成员</p>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="text-xs text-slate-500 font-medium">已选：</span>
              {[...selectedUsers].slice(0, 6).map(uid => {
                const user = allMembers.find((m: any) => m.id === uid);
                return (
                  <span key={uid} className="flex items-center gap-1 px-2 py-0.5 bg-violet-50 border border-violet-200 text-violet-700 rounded-full text-xs font-medium">
                    {user?.name || uid}
                    <button onClick={e => { e.stopPropagation(); toggleUser(uid); }} className="hover:text-violet-900">×</button>
                  </span>
                );
              })}
              {selectedUsers.size > 6 && <span className="text-xs text-slate-400">+{selectedUsers.size - 6} 人</span>}
            </div>

            <div className="mb-4 space-y-2">
              <p className="text-xs text-slate-500">将权限应用至 <strong className="text-violet-600">{selectedUsers.size}</strong> 人（多人选中时以第一人权限为基准）</p>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Preset Dropdown */}
                <div className="relative">
                  <select
                    value=""
                    onChange={e => {
                      const p = presets.find(pr => pr.name === e.target.value);
                      if (p) { setGrantedKeys(new Set(p.keys)); setMsg(`✅ 已应用预设「${p.name}」`); }
                    }}
                    className="appearance-none pl-3 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 cursor-pointer hover:border-violet-300 focus:ring-2 focus:ring-violet-200 outline-none min-w-[100px]"
                  >
                    <option value="" disabled>选择预设…</option>
                    {presets.map(p => (
                      <option key={p.name} value={p.name}>{p.name} ({p.keys.length}项)</option>
                    ))}
                    {presets.length === 0 && <option disabled>暂无预设</option>}
                  </select>
                  <span className="material-symbols-outlined absolute right-1.5 top-1/2 -translate-y-1/2 text-[14px] text-slate-400 pointer-events-none">expand_more</span>
                </div>

                {/* Save Preset Button */}
                <div className="relative">
                  <button
                    onClick={() => { setShowPresetInput(!showPresetInput); setPresetName(''); }}
                    disabled={grantedKeys.size === 0}
                    className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-medium rounded-lg hover:border-violet-300 hover:text-violet-600 disabled:opacity-50 flex items-center gap-1 transition-all"
                  >
                    <span className="material-symbols-outlined text-[14px]">bookmark_add</span>
                    保存预设
                  </button>
                  {/* Custom Preset Name Popover */}
                  {showPresetInput && (
                    <div className="absolute right-0 top-full mt-2 z-50 bg-white rounded-xl shadow-xl border border-slate-200 p-4 w-72 animate-in fade-in slide-in-from-top-2 duration-150">
                      <p className="text-xs font-bold text-slate-700 mb-2">保存为预设模板</p>
                      <input
                        autoFocus
                        value={presetName}
                        onChange={e => setPresetName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSavePreset(); if (e.key === 'Escape') setShowPresetInput(false); }}
                        placeholder="输入预设名称…"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-200 focus:border-violet-400 outline-none transition-all mb-3"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setShowPresetInput(false)} className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-50 transition-colors">取消</button>
                        <button onClick={handleSavePreset} disabled={!presetName.trim()} className="px-4 py-1.5 bg-violet-600 text-white text-xs font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-all flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px]">check</span>确定
                        </button>
                      </div>
                      {presets.some(p => p.name === presetName.trim()) && presetName.trim() && (
                        <p className="text-[10px] text-amber-600 mt-2 flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">warning</span>该名称已存在，保存将覆盖原预设</p>
                      )}
                    </div>
                  )}
                </div>

                {msg && <span className="text-xs">{msg}</span>}
                {loadingPerms && <span className="text-xs text-violet-500 flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">sync</span>加载权限...</span>}
                <button onClick={handleSave} disabled={saving || loadingPerms}
                  className="px-4 py-1.5 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 disabled:opacity-60 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px]">{saving ? 'hourglass_empty' : 'save'}</span>
                  {saving ? '保存中...' : '保存权限'}
                </button>
              </div>
            </div>

            {/* Preset Management Bar (show when presets exist) */}
            {presets.length > 0 && (
              <div className="flex items-center gap-2 mb-4 p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="material-symbols-outlined text-[14px] text-slate-400">bookmark</span>
                <span className="text-[10px] text-slate-400 font-bold mr-1">预设:</span>
                {presets.map(p => (
                  <div key={p.name} className="flex items-center gap-0.5 group">
                    <button
                      onClick={() => { setGrantedKeys(new Set(p.keys)); setMsg(`✅ 已应用预设「${p.name}」`); }}
                      className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:border-violet-300 hover:text-violet-600 transition-all"
                    >
                      {p.name}
                    </button>
                    <button
                      onClick={() => {
                        if (!confirm(`确定删除预设「${p.name}」？`)) return;
                        const updated = presets.filter(x => x.name !== p.name);
                        setPresets(updated);
                        localStorage.setItem(PRESETS_KEY, JSON.stringify(updated));
                        setMsg(`已删除预设「${p.name}」`);
                      }}
                      className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <span className="material-symbols-outlined text-[12px]">close</span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="max-h-[380px] overflow-y-auto space-y-4 pr-1">
              {permModules.map(mod => (
                <div key={mod as string}>
                  <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{mod as string}</h5>
                  <div className="bg-slate-50 rounded-xl overflow-hidden">
                    {(permDefs || []).filter((p: any) => p.module === mod).map((perm: any) => {
                      const on = grantedKeys.has(perm.key);
                      return (
                        <div key={perm.key} onClick={() => togglePerm(perm.key)}
                          className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 last:border-0 hover:bg-white cursor-pointer transition-colors">
                          <span className="text-sm text-slate-700">{perm.label}</span>
                          <div className={`relative w-10 h-5 rounded-full transition-all duration-200 ${on ? 'bg-violet-500' : 'bg-slate-200'}`}
                            onClick={e => { e.stopPropagation(); togglePerm(perm.key); }}>
                            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${on ? 'translate-x-5' : ''}`}/>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MODULE: 系统管理员管理 ───────────────────────────────────────────
function AdminMgmtModule() {
  const { currentUser } = useAuth();
  const { data: adminData, loading, refetch } = useApiGet('/api/org/admins');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [msg, setMsg] = useState('');
  const [searchQ, setSearchQ] = useState('');

  const loadAllUsers = async () => {
    const res = await apiCall('/api/org/all-users', 'GET');
    if (res.code === 0) setAllUsers(res.data);
    setShowPicker(true);
  };

  const toggleAdmin = async (userId: string, isAdmin: boolean) => {
    setMsg('');
    const res = await apiCall('/api/org/admins/set', 'POST', { userId, isAdmin });
    setMsg(res.code === 0 ? `✅ ${res.message}` : `❌ ${res.message}`);
    refetch();
  };

  if (!currentUser?.is_super_admin) {
    return (
      <div className="text-center py-12 text-slate-400">
        <span className="material-symbols-outlined text-[48px] mb-3 block">lock</span>
        <p className="text-sm font-bold">仅最高系统管理员可管理此模块</p>
      </div>
    );
  }

  const admins = adminData?.admins || [];
  const superAdminId = adminData?.super_admin_id || '';
  const filteredUsers = allUsers.filter(u =>
    (u.name?.includes(searchQ) || u.id?.toLowerCase().includes(searchQ.toLowerCase())) &&
    u.role !== 'admin'
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="font-bold text-slate-700">当前系统管理员</h4>
          <p className="text-xs text-slate-400 mt-0.5">最高管理员: {superAdminId}（不可修改）</p>
        </div>
        <button onClick={loadAllUsers}
          className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[14px]">person_add</span>
          添加管理员
        </button>
      </div>

      {msg && <div className="mb-3 text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">{msg}</div>}

      {loading ? <div className="text-center py-8 text-slate-400">加载中...</div> : (
        <div className="space-y-2">
          {admins.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">暂无管理员</p>
          ) : admins.map((admin: any) => (
            <div key={admin.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-600">
                  {admin.name?.[0] || '?'}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    {admin.name}
                    {admin.id.toLowerCase() === superAdminId.toLowerCase() && (
                      <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-bold">最高管理员</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-400">{admin.title || admin.department_name || admin.id}</p>
                </div>
              </div>
              {admin.id.toLowerCase() !== superAdminId.toLowerCase() && (
                <button onClick={() => toggleAdmin(admin.id, false)}
                  className="text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors font-medium">
                  撤销管理员
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* User Picker Modal */}
      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowPicker(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[70vh] flex flex-col">
            <div className="shrink-0 px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">选择人员授予管理员</h3>
              <button onClick={() => setShowPicker(false)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <div className="shrink-0 px-5 py-3 border-b border-slate-100">
              <input type="text" placeholder="搜索姓名或ID..." value={searchQ} onChange={e => setSearchQ(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {filteredUsers.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">没有可添加的用户</p>
              ) : filteredUsers.map((user: any) => (
                <div key={user.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                      {user.name?.[0] || '?'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">{user.name}</p>
                      <p className="text-[10px] text-slate-400">{user.department_name || user.title || user.id}</p>
                    </div>
                  </div>
                  <button onClick={() => { toggleAdmin(user.id, true); setShowPicker(false); }}
                    className="text-xs text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors font-medium">
                    设为管理员
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ─── MAIN PAGE ────────────────────────────────────────────────────────
const MODULES = [
  { key: 'org', label: '组织架构管理', desc: '同步企业微信通讯录，管理部门与人员信息', icon: 'account_tree', color: 'blue', hoverColor: 'hover:border-blue-400/30', iconBg: 'bg-blue-50', iconColor: 'text-[#0060a9]', stats: ['6 个部门', '8 名员工'] },
  { key: 'admin_mgmt', label: '管理员分配', desc: '最高管理员可指定系统管理员，授予或撤销管理权限', icon: 'shield_person', color: 'cyan', hoverColor: 'hover:border-cyan-400/30', iconBg: 'bg-cyan-50', iconColor: 'text-cyan-600', stats: ['角色分配', '权限管控'], superAdminOnly: true },
  { key: 'perf', label: '绩效管理', desc: '绩效计划审批、考核评分与奖金发放', icon: 'trending_up', color: 'emerald', hoverColor: 'hover:border-emerald-400/30', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600', stats: ['审批流程', '评分管理'] },
  { key: 'salary', label: '工资表管理', desc: '制作月度工资表、审批发放、推送工资条', icon: 'payments', color: 'amber', hoverColor: 'hover:border-amber-400/30', iconBg: 'bg-amber-50', iconColor: 'text-amber-600', stats: ['薪资模板', '自动计算'] },
  { key: 'msg', label: '消息推送', desc: '企业微信消息推送、审批卡片与推送记录', icon: 'send', color: 'purple', hoverColor: 'hover:border-purple-400/30', iconBg: 'bg-purple-50', iconColor: 'text-purple-600', stats: ['卡片交互', '推送记录'] },
  { key: 'pool', label: '绩效池管理', desc: '创建与调配绩效池任务、设置奖金额度', icon: 'pool', color: 'rose', hoverColor: 'hover:border-rose-400/30', iconBg: 'bg-rose-50', iconColor: 'text-rose-600', stats: ['任务创建', '奖金配额'] },
  { key: 'settings', label: '系统设置', desc: '企微配置、AI分析设置、数据备份与恢复', icon: 'settings', color: 'slate', hoverColor: 'hover:border-slate-400/30', iconBg: 'bg-slate-100', iconColor: 'text-slate-600', stats: ['企微配置', '数据备份'] },
  { key: 'permissions', label: '权限管理', desc: '按角色管控功能、操作及字段访问权限', icon: 'admin_panel_settings', color: 'violet', hoverColor: 'hover:border-violet-400/30', iconBg: 'bg-violet-50', iconColor: 'text-violet-600', stats: ['功能权限', '字段权限'] },
  { key: 'approval_flows', label: '流程审批设置', desc: '配置审批流模板、审批节点与条件分支', icon: 'account_tree', color: 'teal', hoverColor: 'hover:border-teal-400/30', iconBg: 'bg-teal-50', iconColor: 'text-teal-600', stats: ['流程模板', '节点配置'] },
];

export default function AdminPanel({ navigate }: { navigate: (view: string) => void }) {
  const { currentUser } = useAuth();
  const [activeModule, setActiveModule] = useState<Module>(null);
  const [actionMsg, setActionMsg] = useState('');

  const getModuleLabel = () => MODULES.find(m => m.key === activeModule)?.label || '';

  const handleQuickAction = async (action: string) => {
    setActionMsg('');
    if (action === 'sync') {
      setActionMsg('正在同步企微通讯录...');
      const res = await apiCall('/api/org/sync', 'POST');
      setActionMsg(res.code === 0 ? `✅ 同步成功：${res.data.departments} 个部门，${res.data.members} 名成员（新增 ${res.data.new_members || 0}，更新 ${res.data.updated_members || 0}）` : `❌ ${res.message}`);
    } else if (action === 'generate') {
      const month = new Date().toISOString().slice(0, 7);
      setActionMsg(`正在生成 ${month} 工资表...`);
      const res = await apiCall('/api/salary/sheets/generate', 'POST', { month });
      setActionMsg(res.code === 0 ? `✅ 已生成工资表：${res.data.employee_count} 人，合计 ¥${res.data.total_amount?.toFixed(0)}` : `❌ ${res.message}`);
    } else if (action === 'broadcast') {
      setActiveModule('msg');
    } else if (action === 'ai') {
      setActionMsg('🤖 AI 绩效分析功能需配置 AI 服务密钥，请前往系统设置完成配置。');
      setActiveModule('settings');
    } else if (action === 'batch_perf') {
      setActiveModule('perf');
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-on-surface antialiased">
      <Sidebar currentView="admin" navigate={navigate} />

      <main className="flex-1 h-[calc(100vh-4rem)] mt-16 overflow-y-auto">
        <div className="p-8 max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8 flex items-start justify-between">
            <div>
              <h2 className="text-3xl font-extrabold text-on-surface tracking-tight mb-2">管理后台</h2>
              <p className="text-on-surface-variant">系统设置、组织架构管理与数据维护</p>
            </div>
            {currentUser?.role !== 'admin' && currentUser?.role !== 'hr' && (
              <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 flex items-center gap-2">
                <span className="material-symbols-outlined text-[14px]">warning</span>
                部分功能需要管理员权限
              </div>
            )}
          </div>

          {/* Active Module Modal — only closes via X button */}
          {activeModule && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center">
              <div className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                {/* Modal Header */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center flex-shrink-0">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-[#0060a9]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      {MODULES.find(m => m.key === activeModule)?.icon}
                    </span>
                    {getModuleLabel()}
                  </h3>
                  <button onClick={() => setActiveModule(null)}
                    className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                </div>
                {/* Modal Content — scrollable */}
                <div className="flex-1 overflow-y-auto p-6">
                  {activeModule === 'org' && <OrgModule />}
                  {activeModule === 'perf' && <PerfModule />}
                  {activeModule === 'salary' && <SalaryModule />}
                  {activeModule === 'msg' && <MsgModule />}
                  {activeModule === 'pool' && <PoolModule />}
                  {activeModule === 'settings' && <SettingsModule currentUser={currentUser} />}
                  {activeModule === 'permissions' && <PermissionsModule />}
                  {activeModule === 'admin_mgmt' && <AdminMgmtModule />}
                  {activeModule === 'approval_flows' && <ApprovalFlowModule />}
                </div>
              </div>
            </div>
          )}

          {/* Module Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {MODULES.filter(mod => !(mod as any).superAdminOnly || currentUser?.is_super_admin).map(mod => (
              <div key={mod.key}
                onClick={() => setActiveModule(mod.key as Module)}
                className={`bg-white dark:bg-slate-900 rounded-2xl p-6 border transition-all cursor-pointer group ${
                  activeModule === mod.key
                    ? 'border-[#0060a9]/50 shadow-lg shadow-[#0060a9]/5 ring-2 ring-[#0060a9]/10'
                    : `border-slate-200/60 dark:border-slate-800/60 hover:shadow-lg ${mod.hoverColor}`
                }`}>
                <div className={`w-12 h-12 rounded-xl ${mod.iconBg} dark:bg-opacity-10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <span className={`material-symbols-outlined ${mod.iconColor} text-2xl`}>{mod.icon}</span>
                </div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-2">
                  {mod.label}
                  {activeModule === mod.key && <span className="w-2 h-2 bg-[#0060a9] rounded-full"></span>}
                </h3>
                <p className="text-sm text-slate-500 mb-4">{mod.desc}</p>
                <div className="flex items-center gap-4 text-xs text-slate-400">
                  {mod.stats.map((s, i) => (
                    <span key={i} className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-slate-300 rounded-full"></span>{s}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

        </div>
      </main>
    </div>
  );
}
