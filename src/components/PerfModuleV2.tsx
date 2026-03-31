import React, { useState, useCallback, useEffect } from 'react';
import SmartTaskModal from './SmartTaskModal';

// ─── Shared helpers ──────────────────────────────────────────────
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
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
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
    draft: ['草稿', 'bg-slate-100 text-slate-500'], pending_review: ['待审批', 'bg-amber-100 text-amber-700'],
    approved: ['已通过', 'bg-emerald-100 text-emerald-700'], rejected: ['已驳回', 'bg-red-100 text-red-600'],
    completed: ['已完成', 'bg-blue-100 text-blue-700'], in_progress: ['进行中', 'bg-blue-100 text-blue-700'],
    assessed: ['已结案', 'bg-violet-100 text-violet-700'], pending_assessment: ['待评级', 'bg-purple-100 text-purple-700'],
    pending_receipt: ['待签收', 'bg-cyan-100 text-cyan-700'],
  };
  const [label, cls] = map[status] || [status, 'bg-slate-100 text-slate-500'];
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{label}</span>;
}

// ─── Main PerfModule ─────────────────────────────────────────────
type PerfTab = 'dashboard' | 'pdca' | 'dimensions' | 'supervision' | 'finance' | 'plans';

export default function PerfModuleV2() {
  const [tab, setTab] = useState<PerfTab>('dashboard');
  const TABS: { key: PerfTab; label: string; icon: string }[] = [
    { key: 'dashboard', label: '数据驾驶舱', icon: 'dashboard' },
    { key: 'pdca', label: 'PDCA监管', icon: 'cycle' },
    { key: 'dimensions', label: '多维透析', icon: 'analytics' },
    { key: 'supervision', label: '过程监管', icon: 'shield_person' },
    { key: 'finance', label: '财务核算', icon: 'account_balance' },
    { key: 'plans', label: '计划管理', icon: 'assignment' },
  ];

  return (
    <div>
      <div className="flex gap-1 mb-5 bg-slate-100 rounded-xl p-1 flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              tab === t.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
            }`}>
            <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'dashboard' && <DashboardTab />}
      {tab === 'pdca' && <PDCATab />}
      {tab === 'dimensions' && <DimensionsTab />}
      {tab === 'supervision' && <SupervisionTab />}
      {tab === 'finance' && <FinanceTab />}
      {tab === 'plans' && <PlansTab />}
    </div>
  );
}

// ═══════════════════════════════════════════
//  TAB 1: 数据驾驶舱
// ═══════════════════════════════════════════
function DashboardTab() {
  const { data, loading } = useApiGet('/api/perf/analytics/overview');
  if (loading || !data) return <div className="text-center py-12 text-slate-400">加载中...</div>;

  const kpis = [
    { label: '活跃计划', value: data.activePlans, icon: 'rocket_launch', color: '#3b82f6', bg: '#eff6ff', sub: `共 ${data.totalPlans} 项` },
    { label: '平均进度', value: `${data.avgProgress}%`, icon: 'trending_up', color: '#10b981', bg: '#ecfdf5', sub: '执行中计划' },
    { label: '审批效率', value: `${data.avgApprovalHours}h`, icon: 'speed', color: '#f59e0b', bg: '#fffbeb', sub: '平均审批时长' },
    { label: '达标率', value: `${Math.round(data.achievementRate * 100)}%`, icon: 'verified', color: '#8b5cf6', bg: '#f5f3ff', sub: '评分≥80' },
    { label: '奖金总额', value: `¥${(data.totalBudget || 0).toLocaleString()}`, icon: 'payments', color: '#ef4444', bg: '#fef2f2', sub: '累计发放' },
  ];

  const statusLabels: Record<string, string> = {
    pending_review: '待审批', in_progress: '进行中', approved: '已通过',
    rejected: '已驳回', assessed: '已结案', completed: '已完成',
    pending_assessment: '待评级', pending_receipt: '待签收'
  };
  const statusColors: Record<string, string> = {
    pending_review: '#f59e0b', in_progress: '#3b82f6', approved: '#10b981',
    rejected: '#ef4444', assessed: '#8b5cf6', completed: '#06b6d4',
    pending_assessment: '#a855f7', pending_receipt: '#06b6d4'
  };

  const totalStatus = Object.values(data.statusDistribution || {}).reduce((a: number, b: any) => a + (b as number), 0) as number || 1;

  return (
    <div className="space-y-5">
      {/* KPI 指标卡 */}
      <div className="grid grid-cols-5 gap-3">
        {kpis.map((k, i) => (
          <div key={i} className="rounded-xl p-4 border border-slate-200 bg-white hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: k.bg }}>
                <span className="material-symbols-outlined text-[18px]" style={{ color: k.color }}>{k.icon}</span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">{k.label}</span>
            </div>
            <div className="text-2xl font-black text-slate-800">{k.value}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* 状态分布 */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-blue-500">pie_chart</span>
            状态分布
          </h4>
          <div className="space-y-2">
            {Object.entries(data.statusDistribution || {}).map(([status, count]: any) => (
              <div key={status} className="flex items-center gap-2">
                <span className="text-xs w-14 text-slate-500 font-medium">{statusLabels[status] || status}</span>
                <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${(count / totalStatus) * 100}%`, backgroundColor: statusColors[status] || '#94a3b8' }} />
                </div>
                <span className="text-xs font-bold text-slate-600 w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 部门绩效 */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-indigo-500">groups</span>
            部门绩效
          </h4>
          <div className="space-y-2">
            {(data.departmentDistribution || []).map((d: any, i: number) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs w-16 text-slate-500 font-medium truncate">{d.department}</span>
                <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-indigo-500 transition-all duration-500" style={{ width: `${d.avg_progress || 0}%` }} />
                </div>
                <span className="text-xs font-bold text-slate-600 w-10 text-right">{d.avg_score ?? '—'}</span>
              </div>
            ))}
            {(data.departmentDistribution || []).length === 0 && <p className="text-xs text-slate-400 text-center py-4">暂无部门数据</p>}
          </div>
        </div>
      </div>

      {/* 季度趋势 */}
      {(data.quarterTrend || []).length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-emerald-500">show_chart</span>
            季度趋势
          </h4>
          <div className="grid grid-cols-4 gap-3">
            {data.quarterTrend.map((q: any, i: number) => (
              <div key={i} className="bg-slate-50 rounded-lg p-3 text-center">
                <div className="text-xs font-bold text-slate-500 mb-1">{q.quarter}</div>
                <div className="text-lg font-black text-slate-800">{q.avg_score ?? '—'}</div>
                <div className="text-[10px] text-slate-400">{q.total_plans}项 · ¥{(q.total_bonus || 0).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
//  TAB 2: 多维透析
// ═══════════════════════════════════════════
function DimensionsTab() {
  const [groupBy, setGroupBy] = useState('department');
  const [quarter, setQuarter] = useState('');
  const [category, setCategory] = useState('');
  const { data, loading } = useApiGet(`/api/perf/analytics/dimensions?group_by=${groupBy}&quarter=${quarter}&category=${category}`, [groupBy, quarter, category]);
  if (loading || !data) return <div className="text-center py-12 text-slate-400">加载中...</div>;

  return (
    <div className="space-y-4">
      {/* 筛选栏 */}
      <div className="flex gap-2 flex-wrap items-center">
        <select value={groupBy} onChange={e => setGroupBy(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs bg-white focus:ring-2 focus:ring-indigo-300 outline-none">
          <option value="department">按部门</option>
          <option value="quarter">按季度</option>
          <option value="category">按类型</option>
        </select>
        <select value={quarter} onChange={e => setQuarter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs bg-white outline-none">
          <option value="">全部季度</option>
          {(data.filters?.quarters || []).map((q: string) => <option key={q} value={q}>{q}</option>)}
        </select>
        <select value={category} onChange={e => setCategory(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs bg-white outline-none">
          <option value="">全部类型</option>
          {(data.filters?.categories || []).map((c: string) => <option key={c} value={c}>{c}</option>)}
        </select>
        <span className="text-xs text-slate-400 ml-auto">共 {data.total} 项计划</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* 分组对比柱状图 */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h4 className="text-sm font-bold text-slate-700 mb-3">分组对比 (评分均值)</h4>
          <div className="space-y-2">
            {(data.groups || []).map((g: any, i: number) => {
              const maxScore = Math.max(...(data.groups || []).map((x: any) => x.avg_score || 0), 100);
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs w-20 text-slate-500 truncate font-medium">{g.label}</span>
                  <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden relative">
                    <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500 flex items-center justify-end pr-2"
                      style={{ width: `${((g.avg_score || 0) / maxScore) * 100}%` }}>
                      {g.avg_score != null && <span className="text-[10px] text-white font-bold">{g.avg_score}</span>}
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 w-10 text-right">{g.count}项</span>
                </div>
              );
            })}
            {(data.groups || []).length === 0 && <p className="text-xs text-slate-400 text-center py-4">暂无分组数据</p>}
          </div>
        </div>

        {/* 评分分布直方图 */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h4 className="text-sm font-bold text-slate-700 mb-3">评分分布</h4>
          <div className="flex items-end gap-2 h-32">
            {['0-20', '20-40', '40-60', '60-80', '80-100'].map((label, i) => {
              const val = data.scoreDistribution?.[i] || 0;
              const max = Math.max(...(data.scoreDistribution || [1]));
              const colors = ['#ef4444', '#f59e0b', '#eab308', '#3b82f6', '#10b981'];
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-bold text-slate-600">{val}</span>
                  <div className="w-full rounded-t-md transition-all duration-500"
                    style={{ height: `${max > 0 ? (val / max) * 100 : 0}%`, backgroundColor: colors[i], minHeight: val > 0 ? '8px' : '2px' }} />
                  <span className="text-[9px] text-slate-400">{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 人员排行 */}
      {(data.personRanking || []).length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-amber-500">emoji_events</span>
            绩效排行 TOP 10
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {data.personRanking.map((p: any, i: number) => (
              <div key={i} className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-2">
                <span className={`text-sm font-black w-6 text-center ${i < 3 ? 'text-amber-500' : 'text-slate-400'}`}>#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-bold text-slate-700">{p.name || p.assignee_id}</span>
                  <span className="text-[10px] text-slate-400 ml-1.5">{p.department_name || ''}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black text-indigo-600">{p.avg_score ?? '—'}</span>
                  <span className="text-[10px] text-slate-400 ml-1">分</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
//  TAB 3: 过程监管
// ═══════════════════════════════════════════
function SupervisionTab() {
  const { data, loading, refetch } = useApiGet('/api/perf/supervision/overview');
  const [nudging, setNudging] = useState<number | null>(null);

  const doNudge = async (planId: number, approverId: string) => {
    setNudging(planId);
    await apiCall('/api/perf/supervision/nudge', 'POST', { plan_id: planId, approver_id: approverId });
    setNudging(null);
    refetch();
  };

  if (loading || !data) return <div className="text-center py-12 text-slate-400">加载中...</div>;

  return (
    <div className="space-y-4">
      {/* 汇总卡 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-red-50 rounded-xl p-4 border border-red-100">
          <div className="text-2xl font-black text-red-600">{data.summary?.totalOverdue || 0}</div>
          <div className="text-xs text-red-500 font-medium">超期计划</div>
        </div>
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
          <div className="text-2xl font-black text-amber-600">{data.summary?.totalBottlenecks || 0}</div>
          <div className="text-xs text-amber-500 font-medium">卡点预警（≥3天）</div>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <div className="text-2xl font-black text-blue-600">{data.summary?.totalPending || 0}</div>
          <div className="text-xs text-blue-500 font-medium">待审批</div>
        </div>
      </div>

      {/* 超期计划 */}
      {(data.overduePlans || []).length > 0 && (
        <div className="bg-white rounded-xl border border-red-200 p-4">
          <h4 className="text-sm font-bold text-red-700 mb-3 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">warning</span>
            超期计划 ({data.overduePlans.length})
          </h4>
          <div className="space-y-2">
            {data.overduePlans.map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 bg-red-50/50 rounded-lg px-3 py-2">
                <span className="text-xs font-mono text-red-400">PF-{String(p.id).padStart(6, '0')}</span>
                <span className="text-xs font-medium text-slate-700 flex-1 truncate">{p.title}</span>
                <span className="text-xs text-slate-500">{p.assignee_name}</span>
                <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">超期{p.days_overdue}天</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 审批人效率 */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px] text-amber-500">timer</span>
          审批人效率排名
        </h4>
        <div className="space-y-2">
          {(data.approverEfficiency || []).map((a: any, i: number) => (
            <div key={i} className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-2">
              <span className="text-xs font-bold text-slate-700 w-20">{a.approver_name || a.approver_id}</span>
              <div className="flex-1 flex items-center gap-3">
                <span className="text-xs text-slate-400">待处理 <b className="text-amber-600">{a.pending_count}</b></span>
                <span className="text-xs text-slate-400">已审 <b className="text-emerald-600">{a.reviewed_count}</b></span>
                {a.avg_hours != null && <span className="text-xs text-slate-400">均耗 <b className="text-blue-600">{a.avg_hours}h</b></span>}
              </div>
              {a.pending_count > 0 && (
                <button onClick={() => doNudge(0, a.approver_id)} disabled={nudging != null}
                  className="px-2 py-1 text-[10px] font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors disabled:opacity-50">
                  一键催办
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 最近日志 */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h4 className="text-sm font-bold text-slate-700 mb-3">最近操作日志</h4>
        <div className="max-h-48 overflow-y-auto space-y-1">
          {(data.recentLogs || []).slice(0, 15).map((l: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-xs py-1 border-b border-slate-100 last:border-0">
              <span className="text-slate-400 w-28 shrink-0">{(l.created_at || '').replace('T', ' ').slice(0, 16)}</span>
              <span className="font-medium text-slate-600 w-14 shrink-0">{l.user_name || l.user_id}</span>
              <span className="text-slate-500 flex-1 truncate">
                {l.action === 'submit' ? '提交审批' : l.action === 'approve' ? '✅ 通过' : l.action === 'reject' ? '❌ 驳回' : l.action}
                {l.plan_title && ` · ${l.plan_title}`}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  TAB 4: 财务核算
// ═══════════════════════════════════════════
function FinanceTab() {
  const [quarter, setQuarter] = useState('');
  const { data, loading, refetch } = useApiGet(`/api/perf/finance/summary?quarter=${quarter}`, [quarter]);
  const [budgetForm, setBudgetForm] = useState({ quarter: '', amount: '' });
  const [saving, setSaving] = useState(false);

  const saveBudget = async () => {
    if (!budgetForm.quarter || !budgetForm.amount) return;
    setSaving(true);
    await apiCall('/api/perf/finance/budgets', 'POST', { quarter: budgetForm.quarter, budget_amount: Number(budgetForm.amount) });
    setSaving(false);
    setBudgetForm({ quarter: '', amount: '' });
    refetch();
  };

  const exportCSV = () => {
    const token = localStorage.getItem('token');
    window.open(`/api/perf/finance/export?quarter=${quarter}&token=${token}`, '_blank');
  };

  if (loading || !data) return <div className="text-center py-12 text-slate-400">加载中...</div>;
  const utilPct = Math.round((data.utilization || 0) * 100);

  return (
    <div className="space-y-4">
      {/* 概览卡 */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500 mb-1">当前季度</div>
          <div className="text-lg font-black text-slate-800">{data.currentQuarter}</div>
          <select value={quarter} onChange={e => setQuarter(e.target.value)} className="mt-1 text-[10px] border border-slate-200 rounded px-1 py-0.5">
            <option value="">当前季度</option>
            {(data.availableQuarters || []).map((q: string) => <option key={q} value={q}>{q}</option>)}
          </select>
        </div>
        <div className="bg-emerald-50 rounded-xl border border-emerald-100 p-4">
          <div className="text-xs text-emerald-600 mb-1">预算总额</div>
          <div className="text-lg font-black text-emerald-700">¥{(data.budget || 0).toLocaleString()}</div>
        </div>
        <div className="bg-blue-50 rounded-xl border border-blue-100 p-4">
          <div className="text-xs text-blue-600 mb-1">已支出</div>
          <div className="text-lg font-black text-blue-700">¥{(data.spent || 0).toLocaleString()}</div>
          <div className="mt-1 h-2 bg-blue-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(utilPct, 100)}%` }} />
          </div>
          <div className="text-[10px] text-blue-500 mt-0.5">消耗率 {utilPct}%</div>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-100 p-4">
          <div className="text-xs text-amber-600 mb-1">待发放</div>
          <div className="text-lg font-black text-amber-700">¥{(data.pendingPayout || 0).toLocaleString()}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* 部门支出 */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-slate-700">部门支出明细</h4>
            <button onClick={exportCSV} className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg hover:bg-emerald-100">
              导出 CSV
            </button>
          </div>
          <table className="w-full text-xs">
            <thead><tr className="text-slate-400 border-b"><th className="text-left py-1">部门</th><th className="text-right">人数</th><th className="text-right">支出</th><th className="text-right">均分</th></tr></thead>
            <tbody>
              {(data.byDepartment || []).map((d: any, i: number) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="py-1.5 font-medium text-slate-700">{d.dept}</td>
                  <td className="text-right text-slate-500">{d.headcount}</td>
                  <td className="text-right font-bold text-emerald-600">¥{(d.spent || 0).toLocaleString()}</td>
                  <td className="text-right text-slate-500">{d.avg_score ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(data.byDepartment || []).length === 0 && <p className="text-xs text-slate-400 text-center py-4">暂无数据</p>}
        </div>

        {/* 预算设定 + 人员奖金 */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h4 className="text-sm font-bold text-slate-700 mb-3">设定预算</h4>
          <div className="flex gap-2 mb-3">
            <input type="text" placeholder="如: 2024 Q2" value={budgetForm.quarter} onChange={e => setBudgetForm({ ...budgetForm, quarter: e.target.value })}
              className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-emerald-300" />
            <input type="number" placeholder="预算金额" value={budgetForm.amount} onChange={e => setBudgetForm({ ...budgetForm, amount: e.target.value })}
              className="w-28 border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-emerald-300" />
            <button onClick={saveBudget} disabled={saving} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 disabled:opacity-50">保存</button>
          </div>
          <h5 className="text-xs font-bold text-slate-500 mb-2 mt-4">人员奖金明细</h5>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {(data.byPerson || []).map((p: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-xs py-1 border-b border-slate-50">
                <span className="font-medium text-slate-700 w-14">{p.name || p.assignee_id}</span>
                <span className="text-slate-400 flex-1">{p.dept || ''} · {p.plans_completed}项</span>
                <span className="font-bold text-amber-600">¥{(p.total_bonus || 0).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  TAB 5: 计划管理 (保留原有功能)
// ═══════════════════════════════════════════
function PlansTab() {
  const { data: allPlans, loading, refetch } = useApiGet('/api/perf/plans');
  const [tab, setTab] = useState<'pending' | 'active' | 'assess' | 'done'>('pending');
  const [actionMsg, setActionMsg] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [scoreInputs, setScoreInputs] = useState<Record<number, string>>({});
  const [bonusInputs, setBonusInputs] = useState<Record<number, string>>({});
  const [working, setWorking] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const filteredPlans = allPlans?.filter((p: any) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (p.title || '').toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q) ||
      (p.creator_name || p.creator_id || '').toLowerCase().includes(q) ||
      (p.assignee_name || p.assignee_id || '').toLowerCase().includes(q)
    );
  }) || [];

  const pending = filteredPlans.filter((p: any) => p.status === 'pending_review');
  const active = filteredPlans.filter((p: any) => ['in_progress', 'approved'].includes(p.status));
  const assess = filteredPlans.filter((p: any) => ['in_progress', 'assessed'].includes(p.status));
  const done = filteredPlans.filter((p: any) => p.status === 'completed');

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
            <div key={plan.id} className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden transition-all hover:shadow-md group">
              <div 
                className="p-4 cursor-pointer"
                onClick={() => setExpandedId(expandedId === plan.id ? null : plan.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 flex items-start gap-2">
                    <button className="mt-0.5 text-slate-400 hover:text-slate-600 transition-colors shrink-0">
                      <span className="material-symbols-outlined text-[18px]">
                        {expandedId === plan.id ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
                      </span>
                    </button>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] font-mono text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">PF-{String(plan.id).padStart(6, '0')}</span>
                        <span className="font-bold text-sm text-slate-800 line-clamp-1 group-hover:text-violet-700 transition-colors">{plan.title}</span>
                        <StatusBadge status={plan.status} />
                        {plan.score != null && <span className="text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-100 px-1.5 py-0.5 rounded shadow-sm">{plan.score}分</span>}
                        {plan.bonus != null && <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded shadow-sm">¥{plan.bonus}</span>}
                      </div>
                      <p className="text-xs text-slate-500 font-medium">发起人: <span className="text-slate-700">{plan.creator_name || plan.creator_id}</span> · 负责人: <span className="text-slate-700">{plan.assignee_name || plan.assignee_id}</span> · 截止: {plan.deadline || '—'}</p>
                      
                      {plan.progress != null && plan.status !== 'completed' && (
                        <div className="mt-2.5 flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${plan.progress}%` }} />
                          </div>
                          <span className="text-[10px] font-bold text-slate-500">{plan.progress}%</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center" onClick={e => e.stopPropagation()}>
                    {tab === 'pending' && plan.status === 'pending_review' && (
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => doAction(plan.id, 'approve')} disabled={working}
                          className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 disabled:opacity-60">通过</button>
                        <button onClick={() => setRejectingId(plan.id)}
                          className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100">驳回</button>
                      </div>
                    )}

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

                    {tab === 'assess' && (plan.status === 'assessed' || plan.status === 'completed') && plan.score != null && (
                      <div className="flex gap-2 shrink-0 items-center">
                        <span className="text-xs text-violet-600 font-bold">{plan.score}分</span>
                        <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-200">✅ 已结案</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {expandedId === plan.id && (
                <div className="px-5 pb-5 pt-0 border-t border-slate-100 bg-slate-50/50 mt-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">description</span> 目标详情
                      </h4>
                      <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed bg-white p-3 rounded-lg border border-slate-100 shadow-sm">{plan.description || <span className="text-slate-400 italic">未提供详情描述</span>}</p>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">flag</span> 预期目标值 (Target)
                        </h4>
                        <p className="text-xs text-slate-700 bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm">{plan.target_value || '—'}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm">
                          <div className="text-[10px] font-bold text-slate-400 mb-1">对齐上层目标</div>
                          <div className="text-xs text-slate-700 line-clamp-1">{plan.alignment || '无'}</div>
                        </div>
                        <div className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm">
                          <div className="text-[10px] font-bold text-slate-400 mb-1">评估难度</div>
                          <div className="text-xs font-bold text-slate-600">{plan.difficulty || '正常'}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {rejectingId === plan.id && (
                <div className="p-4 bg-red-50/50 border-t border-red-100 flex gap-2">
                  <input className="flex-1 bg-white border border-red-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-300"
                    placeholder="驳回原因（必填）" value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
                  <button onClick={() => { doAction(plan.id, 'reject', { reason: rejectReason }); setRejectingId(null); setRejectReason(''); }}
                    disabled={!rejectReason.trim() || working}
                    className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-60 shadow-sm">确认驳回</button>
                  <button onClick={() => { setRejectingId(null); setRejectReason(''); }} className="px-2 py-1.5 text-slate-400 hover:text-slate-600 bg-white border border-slate-200 rounded-lg">
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

// ═══════════════════════════════════════════
//  TAB 7: PDCA 状态监管
// ═══════════════════════════════════════════
function PDCATab() {
  const { data, loading } = useApiGet('/api/perf/pdca/overview');
  const [phaseFilter, setPhaseFilter] = useState<string>('');
  const [selectedPlan, setSelectedPlan] = useState<any>(null);

  const openPlanDetail = async (planId: number) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/perf/plans/${planId}`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.code === 0 && json.data) setSelectedPlan(json.data);
    } catch {}
  };

  if (loading || !data) return <div className="text-center py-12 text-slate-400">加载中...</div>;

  const phaseConfig: Record<string, { label: string; color: string; bg: string; icon: string; desc: string }> = {
    P: { label: '计划', color: '#3b82f6', bg: '#eff6ff', icon: 'edit_note', desc: '目标设定与审批' },
    D: { label: '执行', color: '#10b981', bg: '#ecfdf5', icon: 'play_circle', desc: '方案执行中' },
    C: { label: '检查', color: '#f59e0b', bg: '#fffbeb', icon: 'fact_check', desc: '评估与评分' },
    A: { label: '处理', color: '#8b5cf6', bg: '#f5f3ff', icon: 'task_alt', desc: '复盘与奖励' },
  };

  const healthConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
    normal: { label: '正常', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
    warning: { label: '临期', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
    danger: { label: '超期', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' },
    completed: { label: '已完成', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
  };

  const filteredPlans = phaseFilter
    ? (data.plans || []).filter((p: any) => p.phase === phaseFilter)
    : (data.plans || []);

  return (
    <>
    <div className="space-y-5">
      {/* PDCA 四阶段分布卡 */}
      <div className="grid grid-cols-4 gap-3">
        {(['P', 'D', 'C', 'A'] as const).map(phase => {
          const cfg = phaseConfig[phase];
          const count = data.phaseStats?.[phase] || 0;
          const isActive = phaseFilter === phase;
          return (
            <div key={phase} onClick={() => setPhaseFilter(isActive ? '' : phase)}
              className={`rounded-xl p-4 border-2 cursor-pointer transition-all hover:shadow-md ${
                isActive ? 'ring-2 ring-offset-1 shadow-md' : ''
              }`} style={{
                borderColor: isActive ? cfg.color : '#e2e8f0',
                backgroundColor: isActive ? cfg.bg : 'white',
              }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: cfg.bg }}>
                  <span className="material-symbols-outlined text-[22px]" style={{ color: cfg.color }}>{cfg.icon}</span>
                </div>
                <div>
                  <div className="text-[10px] font-bold tracking-widest" style={{ color: cfg.color }}>{phase}</div>
                  <div className="text-xs font-bold text-slate-600">{cfg.label}</div>
                </div>
              </div>
              <div className="text-3xl font-black text-slate-800">{count}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{cfg.desc}</div>
            </div>
          );
        })}
      </div>

      {/* 健康状态汇总 */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-2">
          {Object.entries(healthConfig).map(([key, cfg]) => (
            <div key={key} className={`${cfg.bg} ${cfg.border} border rounded-lg px-3 py-1.5 flex items-center gap-1.5`}>
              <div className={`w-2 h-2 rounded-full ${cfg.color.replace('text-', 'bg-')}`}></div>
              <span className={`text-xs font-bold ${cfg.color}`}>{data.healthStats?.[key] || 0}</span>
              <span className="text-[10px] text-slate-500">{cfg.label}</span>
            </div>
          ))}
        </div>
        <span className="ml-auto text-xs text-slate-400">共 {filteredPlans.length} 项{phaseFilter ? ` (${phaseConfig[phaseFilter]?.label}阶段)` : ''}</span>
      </div>

      {/* 滞后预警 */}
      {(data.laggingPlans || []).length > 0 && !phaseFilter && (
        <div className="bg-gradient-to-r from-red-50 to-amber-50 rounded-xl border border-red-200 p-4">
          <h4 className="text-sm font-bold text-red-700 mb-3 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">warning</span>
            进度滞后预警 ({data.laggingPlans.length})
            <span className="text-[10px] font-normal text-red-400 ml-1">时间消耗 &gt; 任务进度 20%+</span>
          </h4>
          <div className="space-y-2">
            {data.laggingPlans.slice(0, 5).map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 bg-white/80 rounded-lg px-3 py-2">
                <span className="text-[10px] font-mono text-blue-500 hover:text-blue-700 cursor-pointer hover:underline transition-colors" onClick={(e) => { e.stopPropagation(); openPlanDetail(p.id); }}>PF-{String(p.id).padStart(6, '0')}</span>
                <span className="w-8 h-5 rounded text-[10px] font-black text-center leading-5 text-white"
                  style={{ backgroundColor: phaseConfig[p.phase]?.color }}>{p.phase}</span>
                <span className="text-xs font-medium text-slate-700 flex-1 truncate">{p.title}</span>
                <span className="text-xs text-slate-500">{p.assignee_name || p.assignee_id}</span>
                <div className="w-32 flex items-center gap-1">
                  <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden relative">
                    <div className="absolute inset-0 h-full bg-red-200 rounded-full" style={{ width: `${p.timeProgress}%` }} />
                    <div className="absolute inset-0 h-full bg-blue-500 rounded-full" style={{ width: `${p.progress || 0}%` }} />
                  </div>
                </div>
                <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full whitespace-nowrap">差{p.progressGap}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 即将到期 */}
      {(data.upcomingDeadlines || []).length > 0 && !phaseFilter && (
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
          <h4 className="text-sm font-bold text-amber-700 mb-3 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">schedule</span>
            即将到期 · 7天内 ({data.upcomingDeadlines.length})
          </h4>
          <div className="flex gap-2 flex-wrap">
            {data.upcomingDeadlines.map((p: any) => (
              <div key={p.id} className="bg-white rounded-lg px-3 py-2 border border-amber-100 flex items-center gap-2">
                <span className="w-6 h-5 rounded text-[10px] font-black text-center leading-5 text-white"
                  style={{ backgroundColor: phaseConfig[p.phase]?.color }}>{p.phase}</span>
                <span className="text-xs text-slate-700 font-medium max-w-[120px] truncate">{p.title}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  p.daysRemaining <= 1 ? 'bg-red-100 text-red-600' : p.daysRemaining <= 3 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                }`}>
                  {p.daysRemaining === 0 ? '今天' : p.daysRemaining === 1 ? '明天' : `${p.daysRemaining}天后`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 项目进度监管 */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px] text-teal-500">timeline</span>
          项目进度监管
        </h4>
        <div className="space-y-2">
          {filteredPlans.length > 0 ? filteredPlans.map((p: any) => {
            const pCfg = phaseConfig[p.phase] || phaseConfig.P;
            const hCfg = healthConfig[p.timeHealthy] || healthConfig.normal;
            return (
              <div key={p.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                <span className="w-8 h-6 rounded text-[10px] font-black text-center leading-6 text-white shrink-0"
                  style={{ backgroundColor: pCfg.color }}>{p.phase}</span>
                <span className="text-[10px] font-mono text-blue-500 hover:text-blue-700 cursor-pointer hover:underline transition-colors shrink-0" onClick={(e) => { e.stopPropagation(); openPlanDetail(p.id); }}>PF-{String(p.id).padStart(6, '0')}</span>
                <span className="text-xs font-medium text-slate-700 w-36 truncate shrink-0 cursor-pointer hover:text-blue-600 transition-colors" onClick={() => openPlanDetail(p.id)}>{p.title}</span>
                <span className="text-[10px] text-slate-400 w-12 truncate shrink-0">{p.assignee_name || '—'}</span>
                <div className="flex-1 min-w-[180px]">
                  <div className="relative h-5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                      style={{
                        width: `${p.timeProgress}%`,
                        backgroundColor: p.timeHealthy === 'danger' ? '#fecaca' : p.timeHealthy === 'warning' ? '#fef3c7' : '#e0f2fe'
                      }} />
                    <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                      style={{
                        width: `${p.progress || 0}%`,
                        backgroundColor: p.timeHealthy === 'danger' ? '#ef4444' : p.timeHealthy === 'warning' ? '#f59e0b' : '#3b82f6'
                      }} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[9px] font-bold text-slate-700">
                        进度 {p.progress || 0}% / 时间 {p.timeProgress}%
                      </span>
                    </div>
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${hCfg.bg} ${hCfg.color} ${hCfg.border} border`}>
                  {p.daysRemaining == null ? '无期限' :
                    p.timeHealthy === 'completed' ? '✓ 完成' :
                    p.daysRemaining < 0 ? `超${Math.abs(p.daysRemaining)}天` :
                    p.daysRemaining === 0 ? '今天到期' : `剩${p.daysRemaining}天`}
                </span>
              </div>
            );
          }) : <p className="text-sm text-slate-400 text-center py-6">暂无{phaseFilter ? phaseConfig[phaseFilter]?.label + '阶段的' : ''}项目</p>}
        </div>
      </div>

      {/* 部门 PDCA 分布 */}
      {(data.departmentPDCA || []).length > 0 && !phaseFilter && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-indigo-500">groups</span>
            部门 PDCA 分布
          </h4>
          <div className="space-y-3">
            {data.departmentPDCA.map((d: any, i: number) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-slate-700">{d.dept}</span>
                  <span className="text-[10px] text-slate-400">共 {d.total} 项</span>
                </div>
                <div className="flex h-6 rounded-full overflow-hidden bg-slate-100">
                  {(['P', 'D', 'C', 'A'] as const).map(phase => {
                    const pct = d.total > 0 ? (d[phase] / d.total) * 100 : 0;
                    if (pct === 0) return null;
                    return (
                      <div key={phase} className="h-full flex items-center justify-center transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: phaseConfig[phase].color, minWidth: pct > 0 ? '24px' : 0 }}>
                        <span className="text-[9px] font-bold text-white">{phase}:{d[phase]}</span>
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

    {/* 任务卡片详情弹窗 */}
    {selectedPlan && (
      <SmartTaskModal
        isOpen={true}
        title="绩效目标详情"
        type="personal"
        initialData={{...selectedPlan, flow_type: 'perf_plan'}}
        readonly={true}
        users={[]}
        onClose={() => setSelectedPlan(null)}
        onSubmit={() => {}}
      />
    )}
    </>
  );
}


