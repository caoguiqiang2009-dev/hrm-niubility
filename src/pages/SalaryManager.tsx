import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';

// ─── UTILS ─────────────────────────────────────────────────────────

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

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    draft: ['草稿', 'bg-slate-100 text-slate-500 border border-slate-200'],
    pending_approval: ['待审批', 'bg-amber-50 text-amber-600 border border-amber-200'],
    approved: ['已通过', 'bg-emerald-50 text-emerald-600 border border-emerald-200'],
    published: ['已发放', 'bg-purple-50 text-purple-600 border border-purple-200'],
  };
  const [label, cls] = map[status] || [status, 'bg-slate-100 text-slate-500'];
  return <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${cls}`}>{label}</span>;
}

// ─── COMPONENTS ────────────────────────────────────────────────────

function SalarySheetsManage() {
  const { data: sheets, loading, refetch } = useApiGet('/api/salary/sheets');
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [genForm, setGenForm] = useState({ month: new Date().toISOString().slice(0, 7), department_id: '' });
  const [genMsg, setGenMsg] = useState('');
  const [generating, setGenerating] = useState(false);
  const { data: depts } = useApiGet('/api/org/tree');

  // Row Edit
  const [editingRow, setEditingRow] = useState<any>(null);
  const [rowSaving, setRowSaving] = useState(false);

  const flattenDepts = (nodes: any[]): any[] => nodes ? nodes.flatMap(d => [d, ...(d.children ? flattenDepts(d.children) : [])]) : [];

  const handleGenerate = async () => {
    setGenerating(true);
    setGenMsg('');
    const res = await apiCall('/api/salary/sheets/generate', 'POST', {
      month: genForm.month,
      department_id: genForm.department_id ? parseInt(genForm.department_id) : undefined,
    });
    setGenerating(false);
    if (res.code === 0) {
      setGenMsg(`✅ 已生成：${res.data.employee_count} 名员工，合计 ¥${res.data.total_amount?.toLocaleString()}`);
      refetch();
      setTimeout(() => setShowGenerate(false), 2000);
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
    if (action === 'delete') {
      if (!confirm('确定要删除这份草稿工资表吗？')) return;
      await apiCall(`/api/salary/sheets/${id}`, 'DELETE');
      setDetail(null);
      refetch();
      return;
    }

    if (action === 'publish' && !confirm('确认发放后，员工将可以查看到工资条，不可撤销。确认吗？')) {
      return;
    }

    await apiCall(`/api/salary/sheets/${id}/${action}`, 'POST');
    refetch();
    if (detail?.id === id) {
      const res = await apiCall(`/api/salary/sheets/${id}`, 'GET');
      if (res.code === 0) setDetail(res.data);
    }
  };

  const handleEditRow = (row: any) => {
    setEditingRow({ ...row });
  };

  const handleSaveRow = async () => {
    if (!editingRow) return;
    setRowSaving(true);
    const res = await apiCall(`/api/salary/sheets/${detail.id}/rows/${editingRow.id}`, 'PUT', {
      base_salary: parseFloat(editingRow.base_salary || 0),
      perf_bonus: parseFloat(editingRow.perf_bonus || 0),
      attendance_bonus: parseFloat(editingRow.attendance_bonus || 0),
      overtime_pay: parseFloat(editingRow.overtime_pay || 0),
      other_income: parseFloat(editingRow.other_income || 0),
      other_deduction: parseFloat(editingRow.other_deduction || 0),
      remark: editingRow.remark,
    });
    setRowSaving(false);
    
    if (res.code === 0) {
      setEditingRow(null);
      // Refresh detail
      const docRes = await apiCall(`/api/salary/sheets/${detail.id}`, 'GET');
      if (docRes.code === 0) setDetail(docRes.data);
      refetch(); // Refresh list to update total amount
    } else {
      alert(`保存失败: ${res.message}`);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      {/* List Panel */}
      <div className={`flex-1 transition-all flex flex-col min-h-0 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm ${detail ? 'hidden lg:flex lg:max-w-md' : ''}`}>
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <h2 className="font-bold text-slate-800 dark:text-slate-100">历史工资表</h2>
          <button onClick={() => setShowGenerate(!showGenerate)}
            className="px-3 py-1.5 text-xs bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 font-bold rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-500/20 flex items-center gap-1.5 transition-colors">
            <span className="material-symbols-outlined text-[16px]">add</span>
            生成工资表
          </button>
        </div>

        {showGenerate && (
          <div className="p-4 m-5 mb-0 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl border border-indigo-100 dark:border-indigo-500/20 shrink-0">
            <h5 className="font-bold text-indigo-900 dark:text-indigo-300 text-sm mb-3">生成月度工资表</h5>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-indigo-700 dark:text-indigo-400 mb-1.5">目标月份</label>
                <input type="month" className="w-full border border-indigo-200 dark:border-indigo-500/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 dark:text-slate-200"
                  value={genForm.month} onChange={e => setGenForm({ ...genForm, month: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-indigo-700 dark:text-indigo-400 mb-1.5">部门 (可选)</label>
                <select className="w-full border border-indigo-200 dark:border-indigo-500/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 dark:text-slate-200"
                  value={genForm.department_id} onChange={e => setGenForm({ ...genForm, department_id: e.target.value })}>
                  <option value="">全员核算</option>
                  {flattenDepts(depts || []).map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>
            {genMsg && <p className={`text-xs font-bold mb-3 ${genMsg.startsWith('✅') ? 'text-emerald-600' : 'text-red-600'}`}>{genMsg}</p>}
            <div className="flex gap-2">
              <button onClick={handleGenerate} disabled={generating}
                className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 disabled:opacity-60 transition-colors">
                {generating ? '生成中...' : '开始生成'}
              </button>
              <button onClick={() => setShowGenerate(false)} 
                className="px-4 py-2 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700">
                取消
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex justify-center items-center py-10">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : sheets?.length ? (
            <div className="space-y-3">
              {sheets.map((s: any) => (
                <div key={s.id} onClick={() => handleViewDetail(s.id)}
                  className={`flex flex-col bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 cursor-pointer transition-all border ${detail?.id === s.id ? 'border-indigo-400 shadow-md ring-1 ring-indigo-400' : 'border-slate-100 dark:border-slate-800 hover:border-indigo-200 hover:shadow-sm'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{s.title}</span>
                    <StatusBadge status={s.status} />
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-col gap-1">
                      <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">groups</span> {s.employee_count} 人参与</span>
                      <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">calendar_month</span> {s.month}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 font-medium mb-0.5">总额 (¥)</p>
                      <p className="font-black text-indigo-600 dark:text-indigo-400 text-base">{s.total_amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <span className="material-symbols-outlined text-4xl mb-3 opacity-50">receipt_long</span>
              <p className="text-sm font-semibold">暂无工资表数据</p>
              <p className="text-xs mt-1">点击上方"生成工资表"开始使用</p>
            </div>
          )}
        </div>
      </div>

      {/* Detail Panel */}
      {detail && (
        <div className="flex-[2] transition-all flex flex-col min-h-0 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm animate-in slide-in-from-right-4">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-800/20 rounded-t-2xl">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <button onClick={() => setDetail(null)} className="lg:hidden text-slate-400 hover:text-slate-600 mr-2 flex items-center">
                  <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h2 className="font-black text-lg text-slate-800 dark:text-slate-100">{detail.title}</h2>
                <StatusBadge status={detail.status} />
              </div>
              <p className="text-xs text-slate-500 font-medium ml-0 lg:ml-0 flex items-center gap-4">
                <span>总计: <strong className="text-indigo-600 text-sm">¥{detail.total_amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                <span>人数: <strong>{detail.employee_count}</strong></span>
              </p>
            </div>
            
            <div className="flex gap-2">
              {detail.status === 'draft' && (
                <>
                  <button onClick={() => handleAction(detail.id, 'delete')}
                    className="px-3 py-1.5 text-xs bg-red-50 text-red-600 font-bold rounded-lg hover:bg-red-100 border border-red-100 transition-colors">
                    删除
                  </button>
                  <button onClick={() => handleAction(detail.id, 'submit')}
                    className="px-4 py-1.5 text-xs bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-colors">
                    提交审批
                  </button>
                </>
              )}
              {detail.status === 'pending_approval' && (
                <>
                  <button onClick={() => handleAction(detail.id, 'reject')}
                    className="px-3 py-1.5 text-xs bg-red-50 text-red-600 font-bold rounded-lg hover:bg-red-100 border border-red-100">
                    驳回
                  </button>
                  <button onClick={() => handleAction(detail.id, 'approve')}
                    className="px-4 py-1.5 text-xs bg-emerald-500 text-white font-bold rounded-lg hover:bg-emerald-600 shadow-sm shadow-emerald-200">
                    审批通过
                  </button>
                </>
              )}
              {detail.status === 'approved' && (
                <button onClick={() => handleAction(detail.id, 'publish')}
                  className="px-4 py-1.5 text-xs bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 shadow-sm shadow-purple-200 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">send</span>
                  一键发放工资条
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-auto relative rounded-b-2xl">
            {detailLoading ? (
              <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-10">
                <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : null}
            
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm z-10">
                <tr className="[&>th]:px-4 [&>th]:py-3 [&>th]:text-[11px] [&>th]:font-bold [&>th]:text-slate-500 [&>th]:uppercase [&>th]:tracking-wider [&>th]:whitespace-nowrap">
                  <th>姓名</th>
                  <th>部门</th>
                  <th className="text-right">基本工资</th>
                  <th className="text-right">绩效奖金</th>
                  <th className="text-right">出勤/加班/其他</th>
                  <th className="text-right">社保公积金</th>
                  <th className="text-right">个税</th>
                  <th className="text-right font-black text-indigo-700 dark:text-indigo-400">实发工资</th>
                  {detail.status === 'draft' && <th className="text-center">操作</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {detail.rows?.map((row: any) => (
                  <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">{row.user_name}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">{row.department_name}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-xs font-medium text-slate-600">{row.base_salary?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-xs font-semibold text-emerald-600">+{row.perf_bonus?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-xs font-medium text-slate-600">
                      <div className="flex flex-col items-end gap-0.5">
                        {row.attendance_bonus > 0 && <span className="text-emerald-500">+出勤 {row.attendance_bonus}</span>}
                        {row.overtime_pay > 0 && <span className="text-amber-500">+加班 {row.overtime_pay}</span>}
                        {row.other_income > 0 && <span className="text-blue-500">+其他 {row.other_income}</span>}
                        {row.attendance_bonus === 0 && row.overtime_pay === 0 && row.other_income === 0 && <span className="text-slate-300">-</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-xs font-medium text-rose-500">
                      -{((row.social_insurance || 0) + (row.housing_fund || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-xs font-medium text-rose-500">
                      -{row.tax?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-black text-indigo-600 dark:text-indigo-400">
                      {row.net_pay?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    {detail.status === 'draft' && (
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <button onClick={() => handleEditRow(row)} className="text-indigo-500 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 p-1.5 rounded-md transition-colors opacity-0 group-hover:opacity-100">
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Row Modal */}
      {editingRow && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-500">edit_note</span>
                调整员工薪资明细
              </h3>
              <button onClick={() => setEditingRow(null)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 flex-1 overflow-y-auto">
              <div className="flex items-center gap-3 mb-6 bg-indigo-50 dark:bg-indigo-500/10 p-3 rounded-xl border border-indigo-100 dark:border-indigo-500/20">
                <div className="w-10 h-10 rounded-full bg-indigo-200 dark:bg-indigo-600 flex items-center justify-center font-bold text-indigo-700 dark:text-indigo-100">{editingRow.user_name[0]}</div>
                <div>
                  <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{editingRow.user_name}</p>
                  <p className="text-[11px] text-slate-500">{editingRow.department_name}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">基本工资 (¥)</label>
                  <input type="number" className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-slate-800 dark:text-slate-200"
                    value={editingRow.base_salary} onChange={e => setEditingRow({ ...editingRow, base_salary: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">绩效奖金 (¥) <span className="text-[10px] font-normal text-slate-400">- 系统自动计算</span></label>
                  <input type="number" className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-slate-800 dark:text-slate-200"
                    value={editingRow.perf_bonus} onChange={e => setEditingRow({ ...editingRow, perf_bonus: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-emerald-600 mb-1.5">出勤奖金 (¥)</label>
                  <input type="number" className="w-full border border-emerald-200 dark:border-emerald-900 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-emerald-50/30 dark:bg-slate-800 dark:text-slate-200"
                    value={editingRow.attendance_bonus} onChange={e => setEditingRow({ ...editingRow, attendance_bonus: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-amber-600 mb-1.5">加班费 (¥)</label>
                  <input type="number" className="w-full border border-amber-200 dark:border-amber-900 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-amber-50/30 dark:bg-slate-800 dark:text-slate-200"
                    value={editingRow.overtime_pay} onChange={e => setEditingRow({ ...editingRow, overtime_pay: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-blue-600 mb-1.5">其他收入项 (¥)</label>
                  <input type="number" className="w-full border border-blue-200 dark:border-blue-900 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-blue-50/30 dark:bg-slate-800 dark:text-slate-200"
                    value={editingRow.other_income} onChange={e => setEditingRow({ ...editingRow, other_income: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-rose-600 mb-1.5">其他扣款项 (¥)</label>
                  <input type="number" className="w-full border border-rose-200 dark:border-rose-900 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 outline-none bg-rose-50/30 dark:bg-slate-800 dark:text-slate-200"
                    value={editingRow.other_deduction} onChange={e => setEditingRow({ ...editingRow, other_deduction: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">备注说明</label>
                  <input type="text" className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-slate-800 dark:text-slate-200"
                    placeholder="选填，调整原因..." value={editingRow.remark || ''} onChange={e => setEditingRow({ ...editingRow, remark: e.target.value })} />
                </div>
              </div>
              <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700">
                <p className="text-[11px] text-slate-500 mb-1">提示：</p>
                <p className="text-[10px] text-slate-400">• 保存后，系统会自动根据最新金额重新计算社保、公积金和个税，并得出最终实发金额。</p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex gap-3 justify-end">
              <button onClick={() => setEditingRow(null)} className="px-5 py-2 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">取消</button>
              <button onClick={handleSaveRow} disabled={rowSaving} className="px-5 py-2 rounded-lg text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50">
                {rowSaving ? '保存中...' : '确认并重新核算'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SalaryTemplatesManage() {
  const { data: templates, loading, refetch } = useApiGet('/api/salary/templates');
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!editing.name) return;
    setSaving(true);
    const res = await apiCall('/api/salary/templates', 'POST', editing);
    setSaving(false);
    if (res.code === 0) {
      setEditing(null);
      refetch();
    } else alert(res.message);
  };

  const handleDelete = async (id: number) => {
    if(!confirm('删除后将不再用于新生成的工资表，历史数据不受影响。确认删除？')) return;
    await apiCall(`/api/salary/templates/${id}`, 'DELETE');
    refetch();
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden h-full flex flex-col">
      <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
        <h2 className="font-bold text-slate-800 dark:text-slate-100">薪资结构模板管理</h2>
        <button onClick={() => setEditing({ name: '', type: 'addition', default_amount: 0, sort_order: 10 })}
          className="px-3 py-1.5 text-xs bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 font-bold rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-500/20 flex items-center gap-1.5 transition-colors">
          <span className="material-symbols-outlined text-[16px]">add</span>新增项
        </button>
      </div>

      <div className="flex-1 overflow-auto p-5">
        {loading ? <div className="text-center py-10 text-slate-400">加载中...</div> : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-500 text-xs uppercase tracking-wider">
                <th className="pb-3 px-4 font-bold">项目名称</th>
                <th className="pb-3 px-4 font-bold">类型</th>
                <th className="pb-3 px-4 font-bold text-right">默认金额</th>
                <th className="pb-3 px-4 font-bold text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {templates?.map((t: any) => (
                <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200 text-sm">{t.name}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${t.type === 'addition' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                      {t.type === 'addition' ? '加项 (+)' : '减项 (-)'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-sm dark:text-slate-300 htabular-nums">{t.default_amount}</td>
                  <td className="py-3 px-4 text-center">
                    <button onClick={() => setEditing(t)} className="text-indigo-500 hover:text-indigo-700 mx-2 text-sm">编辑</button>
                    {!['基本工资', '绩效奖金'].includes(t.name) && (
                      <button onClick={() => handleDelete(t.id)} className="text-rose-500 hover:text-rose-700 mx-2 text-sm">删除</button>
                    )}
                  </td>
                </tr>
              ))}
              {!templates?.length && (
                <tr><td colSpan={4} className="text-center py-10 text-slate-400 text-sm">暂无模板配置</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-slate-800 dark:text-white text-lg">{editing.id ? '编辑薪资项' : '新增薪资项'}</h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">名称</label>
                <input className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-800 dark:text-white"
                  value={editing.name} onChange={e => setEditing({...editing, name: e.target.value})} disabled={['基本工资', '绩效奖金'].includes(editing.name)}/>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">类型</label>
                <select className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-800 dark:text-white"
                  value={editing.type} onChange={e => setEditing({...editing, type: e.target.value})}>
                  <option value="addition">加项 (+)</option>
                  <option value="deduction">减项 (-)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">默认金额 (¥)</label>
                <input type="number" className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-800 dark:text-white"
                  value={editing.default_amount} onChange={e => setEditing({...editing, default_amount: e.target.value})}/>
              </div>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
              <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300">取消</button>
              <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MyPayslips() {
  const { data: payslips, loading } = useApiGet('/api/salary/my-payslips');
  const [activeSlip, setActiveSlip] = useState<any>(null);

  if (loading) return <div className="p-8 text-center text-slate-400">加载中...</div>;
  if (!payslips?.length) return (
    <div className="flex flex-col items-center justify-center py-32 text-slate-400">
      <span className="material-symbols-outlined text-5xl mb-4 opacity-30">request_quote</span>
      <h3 className="text-lg font-bold text-slate-600 dark:text-slate-300">暂无工资记录</h3>
      <p className="text-sm mt-2">当 HR 发放工资条后，您可以在这里查看</p>
    </div>
  );

  return (
    <div className="flex flex-col md:flex-row gap-6 h-full p-2 md:p-6 lg:p-10 max-w-6xl mx-auto">
      <div className="flex-1 max-w-xs space-y-3 shrink-0">
        <h2 className="font-black text-xl text-slate-800 dark:text-slate-100 mb-4 px-2">工资记录 ({payslips.length})</h2>
        {payslips.map((p: any) => (
          <div key={p.id} onClick={() => setActiveSlip(p)}
            className={`cursor-pointer p-4 rounded-2xl transition-all ${activeSlip?.id === p.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 scale-105' : 'bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-indigo-300'}`}>
            <h4 className={`text-xl font-black mb-1 ${activeSlip?.id === p.id ? 'text-white' : 'text-slate-800 dark:text-slate-100'}`}>{p.month}</h4>
            <div className="flex justify-between items-end mt-4">
              <p className={`text-xs ${activeSlip?.id === p.id ? 'text-indigo-200' : 'text-slate-500'}`}>{p.sheet_title}</p>
              <p className={`text-sm font-bold ${activeSlip?.id === p.id ? 'text-indigo-100' : 'text-indigo-600'}`}>已发放</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex-[2] min-w-0">
        {activeSlip ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden animate-in slide-in-from-bottom-4">
            <div className="bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-500 via-indigo-600 to-indigo-900 px-8 py-10 text-center relative overflow-hidden">
              {/* Decorative circles */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-400/20 rounded-full blur-2xl -ml-10 -mb-10"></div>
              
              <p className="text-indigo-100 font-medium mb-2 relative z-10">{activeSlip.month} 实发工资</p>
              <h1 className="text-5xl font-black text-white mix-blend-overlay drop-shadow-sm tabular-nums tracking-tight">¥{activeSlip.net_pay?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h1>
            </div>
            
            <div className="p-8">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">明细单</h3>
              
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">基本工资</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">¥{activeSlip.base_salary?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">绩效奖金</span>
                  <span className="font-bold text-emerald-600">+ ¥{activeSlip.perf_bonus?.toLocaleString()}</span>
                </div>
                {activeSlip.attendance_bonus > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">出勤/全勤</span>
                    <span className="font-bold text-emerald-600">+ ¥{activeSlip.attendance_bonus?.toLocaleString()}</span>
                  </div>
                )}
                {activeSlip.overtime_pay > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">加班费</span>
                    <span className="font-bold text-amber-500">+ ¥{activeSlip.overtime_pay?.toLocaleString()}</span>
                  </div>
                )}
                {activeSlip.other_income > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">其他收入</span>
                    <span className="font-bold text-blue-500">+ ¥{activeSlip.other_income?.toLocaleString()}</span>
                  </div>
                )}
                
                <hr className="border-slate-100 dark:border-slate-800 my-4 border-dashed" />
                
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">社保扣缴 (个人)</span>
                  <span className="font-bold text-rose-500">- ¥{activeSlip.social_insurance?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">公积金扣缴 (个人)</span>
                  <span className="font-bold text-rose-500">- ¥{activeSlip.housing_fund?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">个人所得税</span>
                  <span className="font-bold text-rose-500">- ¥{activeSlip.tax?.toLocaleString()}</span>
                </div>
                {activeSlip.other_deduction > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">其他代扣</span>
                    <span className="font-bold text-rose-500">- ¥{activeSlip.other_deduction?.toLocaleString()}</span>
                  </div>
                )}
              </div>
              
              {activeSlip.remark && (
                <div className="mt-8 bg-amber-50 dark:bg-amber-900/10 p-4 rounded-xl border border-amber-100 dark:border-amber-900/30">
                  <p className="text-xs font-bold text-amber-800 dark:text-amber-500 mb-1">备注说明</p>
                  <p className="text-sm text-amber-700 dark:text-amber-400">{activeSlip.remark}</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl flex items-center justify-center text-slate-400">
            👈 请在左侧选择要查看的工资条
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MAIN APP PAGE ─────────────────────────────────────────────────

export default function SalaryManager({ navigate }: { navigate: (v: string) => void }) {
  const { currentUser } = useAuth();
  const isAdminOrHr = currentUser?.role === 'admin' || currentUser?.role === 'hr';
  const [activeTab, setActiveTab] = useState<'sheets' | 'templates'>('sheets');

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 font-['Inter'] antialiased text-slate-800 dark:text-slate-200">
      <Sidebar currentView="salary" navigate={navigate} />
      
      <main className="flex-1 h-screen flex flex-col relative animate-in fade-in duration-300 min-w-0">
        <header className="h-16 flex items-center px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex-shrink-0 z-10 justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <span className="material-symbols-outlined text-white text-[20px]">account_balance_wallet</span>
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                数字薪酬
                <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-900 text-[10px] font-black rounded uppercase tracking-wider">Pro</span>
              </h1>
              <p className="text-[11px] text-slate-500 font-medium">
                {isAdminOrHr ? '员工工资核算与多维项管理' : '我的个人薪资账单明细'}
              </p>
            </div>
          </div>
          
          {isAdminOrHr && (
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shadow-inner border border-slate-200/50 dark:border-slate-700">
              <button onClick={() => setActiveTab('sheets')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${activeTab === 'sheets' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow font-black' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}>核算与发放</button>
              <button onClick={() => setActiveTab('templates')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${activeTab === 'templates' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow font-black' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}>系统配置</button>
            </div>
          )}
        </header>

        <div className="flex-1 overflow-hidden p-6 relative">
          {!isAdminOrHr ? (
            <MyPayslips />
          ) : (
            activeTab === 'sheets' ? <SalarySheetsManage /> : <SalaryTemplatesManage />
          )}
        </div>
      </main>
    </div>
  );
}
