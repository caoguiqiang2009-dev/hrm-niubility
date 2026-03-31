import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import PerfModuleV2 from '../components/PerfModuleV2';
import { useAuth } from '../context/AuthContext';

type Module = 'org' | 'perf' | 'salary' | 'msg' | 'pool' | 'settings' | 'permissions' | 'admin_mgmt' | 'approval_flows' | 'workflow_fix' | 'team_scope' | null;


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
    assessed: ['已结案', 'bg-violet-100 text-violet-700'],
    pending_assessment: ['待评级', 'bg-purple-100 text-purple-700'],
    pending_receipt: ['待签收', 'bg-cyan-100 text-cyan-700'],
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
  return <PerfModuleV2 />;
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
export function PoolModule() {
  const { data: tasks, loading, refetch } = useApiGet('/api/pool/tasks');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', department: '', difficulty: 'normal', bonus: '', max_participants: '5' });
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState('');
  const [poolTab, setPoolTab] = useState<'tasks' | 'rewards'>('tasks');

  // 奖励台账
  const { data: rewardPlans, loading: rewardLoading, refetch: refetchRewards } = useApiGet('/api/pool/rewards');
  const [markingPaid, setMarkingPaid] = useState<number | null>(null);

  const handleMarkPaid = async (planId: number) => {
    if (!confirm('确认该奖励已实际发放？此操作不可撤销。')) return;
    setMarkingPaid(planId);
    const res = await apiCall(`/api/pool/rewards/${planId}/mark-paid`, 'POST', {});
    setMarkingPaid(null);
    if (res.code === 0) {
      refetchRewards();
    } else {
      alert(res.message || '操作失败');
    }
  };

  const REWARD_STATUS: Record<string, [string, string]> = {
    draft:         ['草稿', 'bg-slate-100 text-slate-500'],
    pending_hr:    ['待HR审核', 'bg-amber-100 text-amber-700'],
    pending_dt:    ['待金主验收', 'bg-purple-100 text-purple-700'],
    pending_admin: ['待总经理确认', 'bg-orange-100 text-orange-700'],
    approved:      ['已批准/待发放', 'bg-blue-100 text-blue-700'],
    paid:          ['✅ 已发放', 'bg-emerald-100 text-emerald-700'],
    rejected:      ['已驳回', 'bg-red-100 text-red-700'],
  };

  // Proposal & Join requests are now handled globally in MyWorkflows.tsx.

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

  return (
    <div>
      {/* Tab switcher */}
      <div className="flex gap-2 mb-5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
        {[['tasks', 'pool', '绩效池任务'] as const, ['rewards', 'payments', '奖励台账'] as const].map(([key, icon, label]) => (
          <button key={key} onClick={() => setPoolTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              poolTab === key ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            <span className="material-symbols-outlined text-[16px]">{icon}</span>
            {label}
          </button>
        ))}
      </div>

      {poolTab === 'tasks' ? (<>
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
      </>) : (
        /* ── 奖励台账 ── */
        <div>
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-slate-700">奖励台账</h4>
            <button onClick={() => refetchRewards()} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">refresh</span>刷新
            </button>
          </div>
          {rewardLoading ? (
            <div className="text-center py-8 text-slate-400">加载中...</div>
          ) : (
            <div className="space-y-2">
              {(rewardPlans || []).length ? (rewardPlans || []).map((p: any) => {
                const [label, cls] = (REWARD_STATUS[p.status] || ['未知', 'bg-slate-100 text-slate-500']) as [string, string];
                return (
                  <div key={p.id} className="bg-slate-50 rounded-xl p-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 text-sm truncate">{p.task_title || `任务 #${p.pool_task_id}`}</p>
                      <p className="text-xs text-slate-400 mt-0.5">发起人：{p.creator_name} · {p.created_at?.slice(0, 10)}</p>
                      {p.pay_period && <p className="text-xs text-slate-400">发放周期：{p.pay_period}</p>}
                      {p.paid_at && <p className="text-xs text-emerald-600 font-medium">✅ 已发放：{p.paid_at?.slice(0, 10)}</p>}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="font-black text-rose-500">¥{(p.total_bonus || 0).toLocaleString()}</span>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
                      {p.status === 'approved' && (
                        <button
                          onClick={() => handleMarkPaid(p.id)}
                          disabled={markingPaid === p.id}
                          className="px-3 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[12px]">check_circle</span>
                          {markingPaid === p.id ? '处理中...' : '确认已发放'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              }) : <p className="text-sm text-slate-400 text-center py-8">暂无奖励台账记录</p>}
            </div>
          )}
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

function ApprovalFlowModule() {
  /* ── 内置流程定义（只读，不可修改） ── */
  const BUILT_IN_FLOWS = [
    {
      name: '团队任务派发',
      icon: 'send',
      desc: '主管向下级派发团队或专项单据任务，直接下达',
      bizTags: ['任务下发', '免审触达'],
      nodes: [
        { type: 'initiator', label: '发单人', color: 'bg-blue-500', detail: '主管/项目经理' },
        { type: 'cc', label: '系统广播', color: 'bg-teal-500', detail: '发送企微卡片通知' },
        { type: 'approver', label: '接收与启动', color: 'bg-emerald-500', detail: '责任验收人(A)确认签收' },
      ],
    },
    {
      name: '个人目标申请',
      icon: 'track_changes',
      desc: '员工向上提出个人OKR/绩效目标，走行政汇报线',
      bizTags: ['目标管理', '行政树寻血'],
      nodes: [
        { type: 'initiator', label: '发起人', color: 'bg-blue-500', detail: '申请人本人' },
        { type: 'approver', label: '直属分管', color: 'bg-orange-500', detail: '部门直管领导初审' },
        { type: 'approver', label: '老总复核', color: 'bg-orange-500', detail: '更高层级总办(兜底防跳)' },
        { type: 'cc', label: '人事备案', color: 'bg-teal-500', detail: 'HRBP归档知会' },
      ],
    },
    {
      name: '赏金任务提案',
      icon: 'lightbulb',
      desc: '打破部门边界，员工发起新的悬赏池榜单提议',
      bizTags: ['悬赏集市', '财务风控线'],
      nodes: [
        { type: 'initiator', label: '提案人', color: 'bg-blue-500', detail: '任何员工皆可' },
        { type: 'approver', label: '人事评审', color: 'bg-orange-500', detail: 'HR统筹算账与设定(A角色)' },
        { type: 'approver', label: '总经理核准', color: 'bg-pink-500', detail: '总办终审立项发布' },
        { type: 'cc', label: '上架市集', color: 'bg-teal-500', detail: '同步至悬赏大厅看板' },
      ],
    },
    {
      name: '赏金认领与参与',
      icon: 'front_hand',
      desc: '员工抢单认领公开悬赏任务，入局瓜分奖励金',
      bizTags: ['任务抢单', '人事卡关'],
      nodes: [
        { type: 'initiator', label: '认领人', color: 'bg-blue-500', detail: '意向接单的员工' },
        { type: 'approver', label: '人事录用配置', color: 'bg-orange-500', detail: 'HR评估是否录用并绑定岗位' },
        { type: 'approver', label: '总经理批示', color: 'bg-pink-500', detail: '跨级裁决(若需)' },
      ],
    },
    {
      name: '任务验收与评价',
      icon: 'fact_check',
      desc: '执行期末，对交付成果打分评价',
      bizTags: ['执行终结', '闭环验收'],
      nodes: [
        { type: 'initiator', label: '提报交付', color: 'bg-blue-500', detail: '具体执行人(R角色)' },
        { type: 'approver', label: '质检验收', color: 'bg-emerald-500', detail: '指定负责人(A角色)评价' },
        { type: 'cc', label: '旁路知悉', color: 'bg-teal-500', detail: '咨询过及需感知的周边人员' },
      ],
    },
    {
      name: '绩效发奖与出账',
      icon: 'payments',
      desc: '月结核算分润，生成并确认最终财务对账单',
      bizTags: ['薪税结算', '入账归表'],
      nodes: [
        { type: 'initiator', label: 'HR排表', color: 'bg-blue-500', detail: '梳理绩效明细与流水单' },
        { type: 'approver', label: '业务背书', color: 'bg-orange-500', detail: '涉及部门的负责人无异议签批' },
        { type: 'approver', label: '法座敲定', color: 'bg-pink-500', detail: '总经理一锤定音指令下发' },
      ],
    },
  ];

  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-xs text-slate-500">以下为系统内置审批流程，所有流程均已启用且不可修改</p>
        </div>
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200/60">
          <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
          {BUILT_IN_FLOWS.length} 个内置流程
        </span>
      </div>

      <div className="space-y-3">
        {BUILT_IN_FLOWS.map((flow, idx) => {
          const isExpanded = expandedIdx === idx;
          return (
            <div key={idx}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700 overflow-hidden transition-all hover:shadow-sm">
              {/* Header Row */}
              <div className="flex items-center justify-between p-4 cursor-pointer select-none"
                onClick={() => setExpandedIdx(isExpanded ? null : idx)}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#0060a9] flex items-center justify-center shadow-sm">
                    <span className="material-symbols-outlined text-white text-lg">{flow.icon}</span>
                  </div>
                  <div>
                    <h5 className="text-sm font-bold text-slate-700 dark:text-slate-200">{flow.name}</h5>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-400">{flow.desc}</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded font-medium">
                        {flow.bizTags.join(' · ')}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {/* 已启用标识 */}
                  <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    已启用
                  </span>
                  {/* 节点数 */}
                  <span className="text-[11px] text-slate-400 font-medium">{flow.nodes.length} 个节点</span>
                  {/* 展开箭头 */}
                  <span className={`material-symbols-outlined text-[18px] text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                    expand_more
                  </span>
                </div>
              </div>

              {/* Expanded: Flow Visualization */}
              {isExpanded && (
                <div className="border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 px-6 py-5">
                  <div className="flex items-center gap-0">
                    {flow.nodes.map((node, nIdx) => (
                      <React.Fragment key={nIdx}>
                        {/* Node */}
                        <div className="flex flex-col items-center min-w-[140px]">
                          <div className={`w-9 h-9 rounded-full ${node.color} flex items-center justify-center shadow-sm`}>
                            <span className="material-symbols-outlined text-white text-[16px]">
                              {node.type === 'initiator' ? 'person' : node.type === 'approver' ? 'how_to_reg' : 'forward_to_inbox'}
                            </span>
                          </div>
                          <span className="mt-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">{node.label}</span>
                          <span className="mt-0.5 text-[10px] text-slate-400 text-center leading-tight max-w-[130px]">{node.detail}</span>
                        </div>
                        {/* Arrow connector */}
                        {nIdx < flow.nodes.length - 1 && (
                          <div className="flex items-center mx-1 -mt-5">
                            <div className="w-8 h-0.5 bg-slate-300 dark:bg-slate-600" />
                            <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 text-[14px] -ml-1">chevron_right</span>
                          </div>
                        )}
                      </React.Fragment>
                    ))}
                    {/* End marker */}
                    <div className="flex items-center mx-1 -mt-5">
                      <div className="w-8 h-0.5 bg-slate-300 dark:bg-slate-600" />
                      <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 text-[14px] -ml-1">chevron_right</span>
                    </div>
                    <div className="flex flex-col items-center min-w-[80px]">
                      <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-500">
                        <span className="material-symbols-outlined text-slate-400 text-[16px]">flag</span>
                      </div>
                      <span className="mt-1.5 text-xs font-bold text-slate-400">结束</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
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

// ─── MODULE: 高层角色配置管理 ───────────────────────────────────────────
function TopRoleMgmtModule() {
  const { currentUser } = useAuth();
  const { data: tagsData, loading, refetch } = useApiGet('/api/org/role-tags');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [showPicker, setShowPicker] = useState<string | null>(null); // 'gm', 'vp', 'hrbp'
  const [msg, setMsg] = useState('');
  const [searchQ, setSearchQ] = useState('');

  const loadAllUsers = async (tag: string) => {
    const res = await apiCall('/api/org/all-users', 'GET');
    if (res.code === 0) setAllUsers(res.data);
    setShowPicker(tag);
    setSearchQ('');
  };

  const toggleTag = async (userId: string, tag: string, isSet: boolean, label: string) => {
    setMsg('');
    const res = await apiCall('/api/org/role-tags', 'POST', { userId, tag, isSet, label });
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

  const tagsList = tagsData || [];
  const gmList = tagsList.filter((t: any) => t.tag === 'gm');
  const vpList = tagsList.filter((t: any) => t.tag === 'vp');
  const hrbpList = tagsList.filter((t: any) => t.tag === 'hrbp');

  const filteredUsers = allUsers.filter(u =>
    u.name?.includes(searchQ) || u.id?.toLowerCase().includes(searchQ.toLowerCase())
  );

  const RoleSection = ({ title, tag, label, currentList }: any) => (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
        <h4 className="font-bold text-slate-700">{title}</h4>
        <button onClick={() => loadAllUsers(tag)}
          className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1 font-bold">
          <span className="material-symbols-outlined text-[14px]">add</span> 添加{label}
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {currentList.length === 0 ? (
          <p className="text-sm text-slate-400 py-2 col-span-2">尚未配置{label}</p>
        ) : currentList.map((t: any) => (
            <div key={t.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-lg font-bold text-slate-600">
                  {t.user_name?.[0] || '?'}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-700">{t.user_name}</p>
                  <p className="text-xs text-slate-400">{t.department_name || '无部门'}</p>
                </div>
              </div>
              <button onClick={() => toggleTag(t.user_id, tag, false, label)}
                className="text-xs text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 px-2 py-1.5 rounded-lg transition-colors font-medium">
                撤销标签
              </button>
            </div>
        ))}
      </div>
    </div>
  );

  const currentLabel = showPicker === 'gm' ? '总经理' : (showPicker === 'vp' ? '副总' : 'HRBP');

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-xl font-bold text-slate-800 tracking-tight">高层角色与特权配置</h3>
        <p className="text-sm text-slate-500 mt-2">仅限最高系统管理员分配，用于配置引擎中的直通免审、跨级兜底逻辑等特殊业务场景。</p>
      </div>

      {msg && <div className="mb-4 text-sm font-medium bg-slate-50 rounded-lg px-4 py-3 border border-slate-200">{msg}</div>}

      {loading ? <div className="text-center py-12 text-slate-400">扩展配置读取中...</div> : (
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
          <RoleSection title="👑 总经理 (GM)" tag="gm" label="总经理" currentList={gmList} />
          <RoleSection title="🎩 副总/大区负责 (VP)" tag="vp" label="副总" currentList={vpList} />
          <RoleSection title="👔 业务政委 (HRBP)" tag="hrbp" label="HRBP" currentList={hrbpList} />
        </div>
      )}

      {/* User Picker Modal */}
      {showPicker && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowPicker(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[70vh] flex flex-col">
            <div className="shrink-0 px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-base font-bold text-slate-800">配置「{currentLabel}」人员</h3>
              <button onClick={() => setShowPicker(null)} className="text-slate-400 hover:text-slate-600 bg-white shadow-sm p-1 rounded-full">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <div className="shrink-0 px-5 py-3 border-b border-slate-100">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-slate-400">search</span>
                <input type="text" placeholder="搜索姓名或账号..." value={searchQ} onChange={e => setSearchQ(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1 bg-slate-50/50">
              {filteredUsers.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">没有人可供选择</p>
              ) : filteredUsers.map((user: any) => (
                <div key={user.id} className="flex items-center justify-between px-3 py-2.5 bg-white rounded-xl border border-transparent hover:border-slate-200 hover:shadow-sm transition-all group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold ring-2 ring-transparent group-hover:ring-blue-100 transition-all">
                      {user.name?.[0] || '?'}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-700 leading-tight">{user.name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{user.department_name || user.id}</p>
                    </div>
                  </div>
                  <button onClick={() => { toggleTag(user.id, showPicker, true, currentLabel); setShowPicker(null); }}
                    className="text-xs text-blue-600 bg-blue-50 hover:bg-blue-600 hover:text-white px-3 py-1.5 rounded-lg transition-colors font-bold">
                    设为{currentLabel}
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


// ─── MODULE: 流程异常管理 ─────────────────────────────────────────────
function WorkflowFixModule() {
  const [broken, setBroken] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [fixing, setFixing] = useState<number | null>(null);
  const [fixForm, setFixForm] = useState<any>({});
  const [msg, setMsg] = useState('');

  const fetchBroken = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/workflow-fix/broken', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.code === 0) setBroken(json.data?.plans || []);
    } catch {}
    setLoading(false);
  };

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/workflow-fix/users', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.code === 0) setUsers(json.data || []);
    } catch {}
  };

  useEffect(() => { fetchBroken(); fetchUsers(); }, []);

  const handleFix = async (planId: number) => {
    setMsg('');
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/workflow-fix/fix/${planId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(fixForm),
    });
    const json = await res.json();
    if (json.code === 0) {
      setMsg('✅ ' + json.message);
      setFixing(null);
      setFixForm({});
      fetchBroken();
    } else {
      setMsg('❌ ' + json.message);
    }
    setTimeout(() => setMsg(''), 3000);
  };

  const statusMap: Record<string, [string, string]> = {
    draft: ['草稿', 'bg-slate-100 text-slate-500'],
    pending_review: ['待一审', 'bg-amber-100 text-amber-700'],
    pending_dept_review: ['待二审', 'bg-orange-100 text-orange-700'],
    in_progress: ['进行中', 'bg-blue-100 text-blue-700'],
    pending_assessment: ['待评分', 'bg-purple-100 text-purple-700'],
    approved: ['已通过', 'bg-emerald-100 text-emerald-700'],
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="font-bold text-slate-700 flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-red-500">warning</span>
            异常流程列表
            {broken.length > 0 && (
              <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">{broken.length} 条异常</span>
            )}
          </h4>
          <p className="text-xs text-slate-400 mt-1">检测到以下绩效计划的审批流程存在节点缺失，请手动指派人员修复</p>
        </div>
        <button onClick={fetchBroken} className="px-3 py-1.5 text-xs bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">refresh</span>刷新
        </button>
      </div>

      {msg && <div className="text-sm mb-3 bg-slate-50 rounded-lg px-3 py-2">{msg}</div>}

      {loading ? <div className="text-center py-8 text-slate-400">加载中...</div> : broken.length === 0 ? (
        <div className="text-center py-12 bg-emerald-50 rounded-xl border border-emerald-100">
          <span className="material-symbols-outlined text-emerald-400 text-4xl mb-2">check_circle</span>
          <p className="text-sm text-emerald-600 font-bold">所有流程正常运行</p>
          <p className="text-xs text-emerald-500 mt-1">暂无需要修复的异常节点</p>
        </div>
      ) : (
        <div className="space-y-3">
          {broken.map((plan: any) => {
            const [statusLabel, statusCls] = statusMap[plan.status] || [plan.status, 'bg-slate-100 text-slate-500'];
            const isFixing = fixing === plan.id;
            return (
              <div key={plan.id} className={`rounded-xl border transition-all ${isFixing ? 'border-blue-300 bg-blue-50/30 shadow-md' : 'border-red-200/60 bg-white hover:shadow-sm'}`}>
                <div className="p-4">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          PF-{String(plan.id).padStart(6, '0')}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusCls}`}>{statusLabel}</span>
                      </div>
                      <h5 className="font-bold text-sm text-slate-800">{plan.title}</h5>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        发起人: {plan.creator_name || plan.creator_id} · 部门: {plan.dept_name || '未知'}
                      </p>
                    </div>
                    <button
                      onClick={() => { setFixing(isFixing ? null : plan.id); setFixForm({}); }}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1 transition-colors ${
                        isFixing ? 'bg-slate-200 text-slate-600' : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">{isFixing ? 'close' : 'build'}</span>
                      {isFixing ? '取消' : '修复'}
                    </button>
                  </div>

                  {/* Issues */}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {plan.issues?.map((issue: string, i: number) => (
                      <span key={i} className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 text-[10px] font-bold rounded-lg border border-red-100">
                        <span className="material-symbols-outlined text-[12px]">error</span>
                        {issue}
                      </span>
                    ))}
                  </div>

                  {/* Current assignments */}
                  <div className="flex items-center gap-4 text-[11px] text-slate-500">
                    <span>审批人: <b className={plan.approver_name ? 'text-emerald-600' : 'text-red-500'}>{plan.approver_name || '未指派'}</b></span>
                    <span>执行人: <b className={plan.assignee_name ? 'text-emerald-600' : 'text-red-500'}>{plan.assignee_name || '未指派'}</b></span>
                    <span>部门负责人: <b className={plan.dept_head_name ? 'text-emerald-600' : 'text-red-500'}>{plan.dept_head_name || '未指派'}</b></span>
                  </div>

                  {/* Fix Form */}
                  {isFixing && (
                    <div className="mt-4 pt-4 border-t border-blue-200">
                      <h6 className="text-xs font-bold text-blue-700 mb-3 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">person_add</span>
                        指派流程节点人员
                      </h6>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {/* 审批人 */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">直属上级(一审)</label>
                          <select
                            className="w-full border border-blue-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                            value={fixForm.approver_id || ''}
                            onChange={e => setFixForm({ ...fixForm, approver_id: e.target.value || undefined })}
                          >
                            <option value="">-- {plan.approver_name ? `当前: ${plan.approver_name}` : '请选择'} --</option>
                            {users.filter(u => u.id !== plan.creator_id).map(u => (
                              <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                            ))}
                          </select>
                        </div>
                        {/* 执行人 */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">执行人</label>
                          <select
                            className="w-full border border-blue-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                            value={fixForm.assignee_id || ''}
                            onChange={e => setFixForm({ ...fixForm, assignee_id: e.target.value || undefined })}
                          >
                            <option value="">-- {plan.assignee_name ? `当前: ${plan.assignee_name}` : '请选择'} --</option>
                            {users.map(u => (
                              <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                            ))}
                          </select>
                        </div>
                        {/* 部门负责人 */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">部门负责人(二审)</label>
                          <select
                            className="w-full border border-blue-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                            value={fixForm.dept_head_id || ''}
                            onChange={e => setFixForm({ ...fixForm, dept_head_id: e.target.value || undefined })}
                          >
                            <option value="">-- {plan.dept_head_name ? `当前: ${plan.dept_head_name}` : '请选择'} --</option>
                            {users.filter(u => ['admin', 'manager', 'hr'].includes(u.role)).map(u => (
                              <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => handleFix(plan.id)}
                          disabled={!fixForm.approver_id && !fixForm.assignee_id && !fixForm.dept_head_id}
                          className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-40 flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[14px]">check</span>确认修复
                        </button>
                        <button onClick={() => { setFixing(null); setFixForm({}); }}
                          className="px-4 py-1.5 bg-white text-slate-600 rounded-lg text-xs border border-slate-200 hover:bg-slate-50">取消</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── MODULE: 团队数据可视范围 ─────────────────────────────────────────
function TeamScopeModule() {
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
    // 获取该人的自定义范围配置
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/team-scope/${user.id}`, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    if (json.code === 0) {
      setSelectedMemberIds(json.data.member_ids || []);
      setHasOverride(json.data.has_override);
    }
  };

  const toggleMember = (memberId: string) => {
    setSelectedMemberIds(prev =>
      prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]
    );
  };

  const toggleAll = () => {
    const filtered = allUsers.filter(u => u.name.includes(searchMember));
    const allSelected = filtered.every(u => selectedMemberIds.includes(u.id));
    if (allSelected) {
      setSelectedMemberIds(prev => prev.filter(id => !filtered.some(u => u.id === id)));
    } else {
      const adds = filtered.map(u => u.id).filter(id => !selectedMemberIds.includes(id));
      setSelectedMemberIds(prev => [...prev, ...adds]);
    }
  };

  const handleSave = async () => {
    if (!selectedMgr) return;
    setSaving(true);
    setMsg('');
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
    if (!selectedMgr || !window.confirm(`确定清除「${selectedMgr.name}」的自定义团队范围？清除后将恢复按部门归属显示。`)) return;
    setSaving(true);
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/team-scope/${selectedMgr.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    setMsg(json.code === 0 ? `✅ ${json.message}` : `❌ ${json.message}`);
    if (json.code === 0) { setSelectedMemberIds([]); setHasOverride(false); fetchAllConfigs(); }
    setSaving(false);
    setTimeout(() => setMsg(''), 4000);
  };

  const filteredMgrs = allUsers.filter(u => u.name.includes(searchMgr));
  const filteredMembers = allUsers.filter(u => u.name.includes(searchMember));

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h4 className="font-bold text-slate-700 flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-indigo-500">manage_accounts</span>
            团队数据可视范围
          </h4>
          <p className="text-xs text-slate-400 mt-1">为指定人员自定义「团队绩效追踪」页面的可见成员范围，不影响其他任何权限</p>
        </div>
        {allConfigs.length > 0 && (
          <div className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full font-bold border border-indigo-100">
            已配置 {allConfigs.length} 人
          </div>
        )}
      </div>

      {/* 已配置概览 */}
      {allConfigs.length > 0 && (
        <div className="flex flex-wrap gap-2 pb-3 border-b border-slate-100">
          {allConfigs.map((cfg: any) => (
            <button
              key={cfg.manager_id}
              onClick={() => selectManager({ id: cfg.manager_id, name: cfg.manager_name, title: cfg.title })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                selectedMgr?.id === cfg.manager_id
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
              }`}
            >
              <span className="material-symbols-outlined text-[12px]">person</span>
              {cfg.manager_name}
              <span className="opacity-70">({cfg.member_count}人)</span>
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* 左侧：选择被配置人 */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-50 px-4 py-2.5 flex items-center gap-2 border-b border-slate-200">
            <span className="material-symbols-outlined text-[14px] text-slate-500">person_search</span>
            <span className="text-xs font-bold text-slate-600">选择被配置人</span>
          </div>
          <div className="p-3">
            <input
              type="text"
              placeholder="搜索姓名..."
              className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              value={searchMgr}
              onChange={e => setSearchMgr(e.target.value)}
            />
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {filteredMgrs.map(u => (
                <button
                  key={u.id}
                  onClick={() => selectManager(u)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs transition-all ${
                    selectedMgr?.id === u.id
                      ? 'bg-indigo-600 text-white'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] flex-shrink-0 ${
                    selectedMgr?.id === u.id ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-600'
                  }`}>{u.name[0]}</span>
                  <span className="font-medium">{u.name}</span>
                  {allConfigs.some((c: any) => c.manager_id === u.id) && (
                    <span className={`ml-auto text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                      selectedMgr?.id === u.id ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-600'
                    }`}>已配置</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 右侧：勾选可见成员 */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-50 px-4 py-2.5 flex items-center gap-2 justify-between border-b border-slate-200">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[14px] text-slate-500">group</span>
              <span className="text-xs font-bold text-slate-600">
                {selectedMgr ? `配置 ${selectedMgr.name} 的可见范围` : '请先选择被配置人'}
              </span>
            </div>
            {selectedMgr && (
              <button onClick={toggleAll} className="text-[10px] text-indigo-600 font-bold hover:underline">
                {filteredMembers.every(u => selectedMemberIds.includes(u.id)) ? '取消全选' : '全选'}
              </button>
            )}
          </div>
          <div className="p-3">
            {selectedMgr ? (
              <>
                <input
                  type="text"
                  placeholder="搜索成员姓名..."
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  value={searchMember}
                  onChange={e => setSearchMember(e.target.value)}
                />
                <div className="space-y-1 max-h-72 overflow-y-auto">
                  {filteredMembers.map(u => {
                    const checked = selectedMemberIds.includes(u.id);
                    return (
                      <label
                        key={u.id}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer text-xs transition-all ${
                          checked ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-slate-50 border border-transparent'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleMember(u.id)}
                          className="accent-indigo-600 w-3.5 h-3.5 flex-shrink-0"
                        />
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[9px] flex-shrink-0 ${
                          checked ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'
                        }`}>{u.name[0]}</span>
                        <span className={`font-medium ${checked ? 'text-indigo-700' : 'text-slate-700'}`}>{u.name}</span>
                        {u.role && (
                          <span className="ml-auto text-[9px] text-slate-400">{u.role}</span>
                        )}
                      </label>
                    );
                  })}
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-xs text-slate-400">
                    {hasOverride ? (
                      <span className="text-amber-600 font-medium">⚡ 已有自定义配置 · 已选 {selectedMemberIds.length} 人</span>
                    ) : (
                      <span>已选 {selectedMemberIds.length} 人 · 未配置则按部门归属显示</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {hasOverride && (
                      <button
                        onClick={handleClear}
                        disabled={saving}
                        className="px-3 py-1.5 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50 font-bold"
                      >清除配置</button>
                    )}
                    <button
                      onClick={handleSave}
                      disabled={saving || selectedMemberIds.length === 0}
                      className="px-4 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold disabled:opacity-40"
                    >{saving ? '保存中...' : '保存配置'}</button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                <span className="material-symbols-outlined text-4xl mb-2 text-slate-300">arrow_back</span>
                <p className="text-xs">请在左侧选择需要配置的人员</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {msg && (
        <div className={`text-sm px-4 py-2.5 rounded-lg font-medium ${
          msg.startsWith('✅') ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'
        }`}>{msg}</div>
      )}
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────
const MODULES = [
  { key: 'org', label: '同步通讯录', desc: '同步企业微信通讯录，管理部门与人员信息', icon: 'account_tree', color: 'blue', hoverColor: 'hover:border-blue-400/30', iconBg: 'bg-blue-50', iconColor: 'text-[#0060a9]', stats: ['一键同步', '组织映射'] },
  { key: 'admin_mgmt', label: '高层角色配置', desc: '最高管理员专属，配置总经理、副总、HRBP特权角色', icon: 'shield_person', color: 'cyan', hoverColor: 'hover:border-cyan-400/30', iconBg: 'bg-cyan-50', iconColor: 'text-cyan-600', stats: ['特权分配', '兜底机制'], superAdminOnly: true },
  { key: 'msg', label: '消息推送', desc: '企业微信消息推送、审批卡片与推送记录', icon: 'send', color: 'purple', hoverColor: 'hover:border-purple-400/30', iconBg: 'bg-purple-50', iconColor: 'text-purple-600', stats: ['卡片交互', '推送记录'] },
  { key: 'settings', label: '系统设置', desc: '企微配置、AI分析设置、数据备份与恢复', icon: 'settings', color: 'slate', hoverColor: 'hover:border-slate-400/30', iconBg: 'bg-slate-100', iconColor: 'text-slate-600', stats: ['企微配置', '数据备份'] },
  { key: 'permissions', label: '权限管理', desc: '按角色管控功能、操作及字段访问权限', icon: 'admin_panel_settings', color: 'violet', hoverColor: 'hover:border-violet-400/30', iconBg: 'bg-violet-50', iconColor: 'text-violet-600', stats: ['功能权限', '字段权限'] },
  { key: 'team_scope', label: '团队可视范围', desc: '为指定人员自由匹配团队成员，单独管理其数据可视范围', icon: 'manage_accounts', color: 'indigo', hoverColor: 'hover:border-indigo-400/30', iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600', stats: ['自由匹配', '仅限视图'] },
  { key: 'approval_flows', label: '全景工作流视图', desc: '查看系统当前运转的 6 大核心业务审批引擎底层流路', icon: 'account_tree', color: 'teal', hoverColor: 'hover:border-teal-400/30', iconBg: 'bg-teal-50', iconColor: 'text-teal-600', stats: ['6大业务流', '引擎驱动'] },
  { key: 'workflow_fix', label: '异常流程检测', desc: '管理悬停、报错或节点丢失的流程审批与任务记录（已整合至「我的工作流」→「流程异常」）', icon: 'healing', color: 'red', hoverColor: 'hover:border-red-400/30', iconBg: 'bg-red-50', iconColor: 'text-red-500', stats: ['跳转工作流', '一站式管理'], redirect: 'workflows?tab=exception_mgmt' },
];

export default function AdminPanel({ navigate, initialModule }: { navigate: (view: string) => void; initialModule?: string }) {
  const { currentUser } = useAuth();
  const [activeModule, setActiveModule] = useState<Module>((initialModule as Module) || null);
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
                  {activeModule === 'salary' && <SalaryModule />}
                  {activeModule === 'msg' && <MsgModule />}
                  {activeModule === 'pool' && <PoolModule />}
                  {activeModule === 'settings' && <SettingsModule currentUser={currentUser} />}
                  {activeModule === 'permissions' && <PermissionsModule />}
                  {activeModule === 'admin_mgmt' && <TopRoleMgmtModule />}
                  {activeModule === 'approval_flows' && <ApprovalFlowModule />}
                  {activeModule === 'workflow_fix' && <WorkflowFixModule />}
                  {activeModule === 'team_scope' && <TeamScopeModule />}

                </div>
              </div>
            </div>
          )}

          {/* Module Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {MODULES.filter(mod => !(mod as any).superAdminOnly || currentUser?.is_super_admin).map(mod => (
              <div key={mod.key}
                onClick={() => (mod as any).redirect ? navigate((mod as any).redirect) : setActiveModule(mod.key as Module)}
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
