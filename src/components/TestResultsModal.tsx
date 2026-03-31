import React, { useState, useEffect } from 'react';

interface TestResult {
  assignment_id: number;
  user_id: string;
  status: string;
  final_score: number | null;
  assigned_by: string;
  created_at: string;
  completed_at: string | null;
  user_name: string;
  avatar_url: string;
  department_name: string;
}

export default function TestResultsModal({ bankId, onClose }: { bankId: number, onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    bank: any,
    stats: any,
    results: TestResult[]
  } | null>(null);

  useEffect(() => {
    fetchResults();
  }, [bankId]);

  const fetchResults = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/tests/bank/${bankId}/results`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.code === 0) {
        setData(json.data);
      } else {
        alert(json.message);
      }
    } catch (e) {
      alert('加载失败');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 flex items-center justify-center">
              <span className="material-symbols-outlined mb-0.5">query_stats</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                {data?.bank?.title || '测评结果分析'}
              </h2>
              <p className="text-xs text-slate-500 line-clamp-1">{data?.bank?.description}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
            <span className="material-symbols-outlined animate-spin text-4xl text-slate-300">progress_activity</span>
            <p className="mt-4 text-sm text-slate-500 font-medium tracking-wide">加载数据中...</p>
          </div>
        ) : !data ? (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
            <span className="material-symbols-outlined text-4xl text-slate-300 mb-4">sentiment_dissatisfied</span>
            <p className="text-sm text-slate-500">暂无数据</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-900/50 p-6">
            
            {/* 顶部统计卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/40 text-blue-500 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined">people</span>
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-500 dark:text-slate-400">总派发人数</div>
                  <div className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">{data.stats.totalAssigned}</div>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-emerald-100 dark:border-emerald-900/30 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-900/40 text-emerald-500 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined">task_alt</span>
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-slate-500 dark:text-slate-400 flex justify-between">
                    已完成 <span>{data.stats.totalCompleted} / {data.stats.totalAssigned}</span>
                  </div>
                  <div className="mt-2 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all" 
                      style={{ width: `${data.stats.totalAssigned ? (data.stats.totalCompleted/data.stats.totalAssigned*100) : 0}%` }} />
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-indigo-100 dark:border-indigo-900/30 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-900/40 text-indigo-500 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined">workspace_premium</span>
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-500 dark:text-slate-400">平均得分</div>
                  <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
                    {data.stats.averageScore} <span className="text-base font-normal text-slate-400">分</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 人员列表 */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-400">list_alt</span>
                  答题详细名单
                </h3>
              </div>
              
              {data.results.length === 0 ? (
                 <div className="p-8 text-center text-slate-400 text-sm">暂无答题记录</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/80 text-xs text-slate-500 dark:text-slate-400">
                        <th className="px-6 py-3 font-bold">员工</th>
                        <th className="px-6 py-3 font-bold">部门</th>
                        <th className="px-6 py-3 font-bold">状态</th>
                        <th className="px-6 py-3 font-bold">分数</th>
                        <th className="px-6 py-3 font-bold text-right">交卷时间</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {data.results.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-3">
                              {r.avatar_url ? (
                                <img src={r.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300">
                                  {r.user_name.charAt(0)}
                                </div>
                              )}
                              <div>
                                <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{r.user_name}</div>
                                <div className="text-[10px] text-slate-400">{r.user_id}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-3 text-sm text-slate-600 dark:text-slate-300">
                            {r.department_name || '—'}
                          </td>
                          <td className="px-6 py-3">
                            {r.status === 'completed' ? (
                              <span className="px-2.5 py-1 text-[11px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 rounded-lg">
                                已完成
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 text-[11px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 rounded-lg">
                                待作答
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-3">
                            {r.status === 'completed' ? (
                              <div className="font-black text-indigo-600 dark:text-indigo-400">
                                {r.final_score} <span className="text-xs text-slate-400 font-medium">分</span>
                              </div>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-6 py-3 text-right text-xs text-slate-500 tabular-nums">
                            {r.completed_at ? new Date(r.completed_at).toLocaleString('zh-CN', {
                              month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
                            }) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
