import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';

type Module = 'org' | 'perf' | 'salary' | 'msg' | 'pool' | 'settings' | 'permissions' | null;

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
      setMsg(`✅ 同步成功：${result.data.departments} 个部门，${result.data.members} 名成员`);
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
  const { data: plans, loading, refetch } = useApiGet('/api/perf/plans?status=pending_review');
  const { data: allPlans, refetch: refetchAll } = useApiGet('/api/perf/plans');
  const [tab, setTab] = useState<'pending' | 'all'>('pending');
  const [actionMsg, setActionMsg] = useState('');
  const [rejectIds, setRejectIds] = useState<Set<number>>(new Set());
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [working, setWorking] = useState(false);

  const handleApprove = async (id: number) => {
    setWorking(true);
    const res = await apiCall(`/api/perf/plans/${id}/review`, 'POST', { action: 'approve' });
    setWorking(false);
    setActionMsg(res.code === 0 ? '✅ 审批通过' : `❌ ${res.message}`);
    refetch(); refetchAll();
  };

  const handleReject = async (id: number) => {
    if (!rejectReason.trim()) return;
    setWorking(true);
    const res = await apiCall(`/api/perf/plans/${id}/review`, 'POST', { action: 'reject', reason: rejectReason });
    setWorking(false);
    setRejectingId(null);
    setRejectReason('');
    setActionMsg(res.code === 0 ? '✅ 已驳回' : `❌ ${res.message}`);
    refetch(); refetchAll();
  };

  const displayList = tab === 'pending' ? plans : allPlans;

  return (
    <div>
      {actionMsg && <div className="mb-3 text-sm bg-slate-50 rounded-lg px-3 py-2">{actionMsg}</div>}
      <div className="flex gap-2 mb-4">
        {[['pending', `待审批 (${plans?.length || 0})`], ['all', `全部计划 (${allPlans?.length || 0})`]].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k as any)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === k ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {label}
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
                  </div>
                  <p className="text-xs text-slate-400">发起人: {plan.creator_id} · 负责人: {plan.assignee_id} · 截止: {plan.deadline || '—'}</p>
                  {plan.description && <p className="text-xs text-slate-500 mt-1 truncate">{plan.description}</p>}
                </div>
                {plan.status === 'pending_review' && (
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => handleApprove(plan.id)} disabled={working}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 disabled:opacity-60">通过</button>
                    <button onClick={() => setRejectingId(plan.id)}
                      className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100">驳回</button>
                  </div>
                )}
              </div>
              {rejectingId === plan.id && (
                <div className="mt-3 flex gap-2">
                  <input className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-300"
                    placeholder="驳回原因（必填）" value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
                  <button onClick={() => handleReject(plan.id)} disabled={!rejectReason.trim() || working}
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

  const difficultyMap: Record<string, string> = { easy: '简单', normal: '普通', hard: '困难', expert: '专家级' };
  const difficultyColor: Record<string, string> = { easy: 'text-green-600', normal: 'text-blue-600', hard: 'text-amber-600', expert: 'text-red-600' };

  return (
    <div>
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

// ─── MODULE: 权限管理 ─────────────────────────────────────────────────
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

            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-slate-500">将权限应用至 <strong className="text-violet-600">{selectedUsers.size}</strong> 人（多人选中时以第一人权限为基准）</p>
              <div className="flex items-center gap-3">
                {msg && <span className="text-xs">{msg}</span>}
                {loadingPerms && <span className="text-xs text-violet-500 flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">sync</span>加载权限...</span>}
                <button onClick={handleSave} disabled={saving || loadingPerms}
                  className="px-4 py-1.5 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 disabled:opacity-60 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px]">{saving ? 'hourglass_empty' : 'save'}</span>
                  {saving ? '保存中...' : '保存权限'}
                </button>
              </div>
            </div>

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


// ─── MAIN PAGE ────────────────────────────────────────────────────────
const MODULES = [
  { key: 'org', label: '组织架构管理', desc: '同步企业微信通讯录，管理部门与人员信息', icon: 'account_tree', color: 'blue', hoverColor: 'hover:border-blue-400/30', iconBg: 'bg-blue-50', iconColor: 'text-[#0060a9]', stats: ['6 个部门', '8 名员工'] },
  { key: 'perf', label: '绩效管理', desc: '绩效计划审批、考核评分与奖金发放', icon: 'trending_up', color: 'emerald', hoverColor: 'hover:border-emerald-400/30', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600', stats: ['审批流程', '评分管理'] },
  { key: 'salary', label: '工资表管理', desc: '制作月度工资表、审批发放、推送工资条', icon: 'payments', color: 'amber', hoverColor: 'hover:border-amber-400/30', iconBg: 'bg-amber-50', iconColor: 'text-amber-600', stats: ['薪资模板', '自动计算'] },
  { key: 'msg', label: '消息推送', desc: '企业微信消息推送、审批卡片与推送记录', icon: 'send', color: 'purple', hoverColor: 'hover:border-purple-400/30', iconBg: 'bg-purple-50', iconColor: 'text-purple-600', stats: ['卡片交互', '推送记录'] },
  { key: 'pool', label: '绩效池管理', desc: '创建与调配绩效池任务、设置奖金额度', icon: 'pool', color: 'rose', hoverColor: 'hover:border-rose-400/30', iconBg: 'bg-rose-50', iconColor: 'text-rose-600', stats: ['任务创建', '奖金配额'] },
  { key: 'settings', label: '系统设置', desc: '企微配置、AI分析设置、数据备份与恢复', icon: 'settings', color: 'slate', hoverColor: 'hover:border-slate-400/30', iconBg: 'bg-slate-100', iconColor: 'text-slate-600', stats: ['企微配置', '数据备份'] },
  { key: 'permissions', label: '权限管理', desc: '按角色管控功能、操作及字段访问权限', icon: 'admin_panel_settings', color: 'violet', hoverColor: 'hover:border-violet-400/30', iconBg: 'bg-violet-50', iconColor: 'text-violet-600', stats: ['功能权限', '字段权限'] },
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
      setActionMsg(res.code === 0 ? `✅ 同步成功：${res.data.departments} 个部门，${res.data.members} 名成员` : `❌ ${res.message}`);
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

          {/* Active Module Panel */}
          {activeModule && (
            <div className="mb-8 bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm animate-in fade-in slide-in-from-top-3 duration-200">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-[#0060a9]">
                    {MODULES.find(m => m.key === activeModule)?.icon}
                  </span>
                  {getModuleLabel()}
                </h3>
                <button onClick={() => setActiveModule(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
              {activeModule === 'org' && <OrgModule />}
              {activeModule === 'perf' && <PerfModule />}
              {activeModule === 'salary' && <SalaryModule />}
              {activeModule === 'msg' && <MsgModule />}
              {activeModule === 'pool' && <PoolModule />}
              {activeModule === 'settings' && <SettingsModule currentUser={currentUser} />}
              {activeModule === 'permissions' && <PermissionsModule />}
            </div>
          )}

          {/* Module Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {MODULES.map(mod => (
              <div key={mod.key}
                onClick={() => setActiveModule(activeModule === mod.key ? null : mod.key as Module)}
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

          {/* Quick Actions */}
          <div className="mt-8 bg-gradient-to-r from-[#0060a9]/5 to-[#409eff]/5 rounded-2xl p-6 border border-[#0060a9]/10">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#0060a9]">bolt</span>
              快捷操作
            </h3>
            {actionMsg && (
              <div className="mb-4 text-sm bg-white/80 border border-slate-200 rounded-xl px-4 py-2.5">{actionMsg}</div>
            )}
            <div className="flex flex-wrap gap-3">
              {[
                { action: 'sync', icon: 'sync', label: '同步企微通讯录', color: 'hover:border-[#0060a9]/30 hover:text-[#0060a9]' },
                { action: 'batch_perf', icon: 'add_task', label: '绩效计划审批', color: 'hover:border-emerald-400/30 hover:text-emerald-600' },
                { action: 'generate', icon: 'summarize', label: '生成本月工资表', color: 'hover:border-amber-400/30 hover:text-amber-600' },
                { action: 'broadcast', icon: 'campaign', label: '群发消息通知', color: 'hover:border-purple-400/30 hover:text-purple-600' },
                { action: 'ai', icon: 'analytics', label: 'AI 绩效分析', color: 'hover:border-rose-400/30 hover:text-rose-600' },
              ].map(btn => (
                <button key={btn.action} onClick={() => handleQuickAction(btn.action)}
                  className={`px-4 py-2 bg-white dark:bg-slate-900 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-800/60 transition-all flex items-center gap-2 ${btn.color}`}>
                  <span className="material-symbols-outlined text-sm">{btn.icon}</span>
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
