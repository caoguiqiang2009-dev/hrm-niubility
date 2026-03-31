import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import SmartTaskModal from '../components/SmartTaskModal';

interface Plan {
  id: number;
  title: string;
  description: string;
  category: string;
  status: string;
  creator_id: number;
  assignee_id: number;
  approver_id: number;
  department_id: string;
  difficulty: string;
  deadline: string;
  quarter: string;
  alignment: string;
  target_value: string;
  progress: number;
  created_at: string;
  creator_name?: string;
  assignee_name?: string;
}

export default function PerformanceManager({ navigate }: { navigate: (v: string) => void }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [filterQuarter, setFilterQuarter] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('pending_review');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [modalMode, setModalMode] = useState<'view' | 'edit'>('view');
  
  const [aiDiagnostic, setAiDiagnostic] = useState<string | null>(null);
  const [diagnosing, setDiagnosing] = useState(false);

  useEffect(() => {
    fetchPlans();
  }, [filterQuarter, filterStatus]);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      // Fetch users to map names
      const uRes = await fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } });
      const { data: usersData } = await uRes.json();
      setUsers(usersData || []);
      const userMap = new Map((usersData || []).map((u: any) => [u.id, u.name]));

      let url = '/api/perf/plans?';
      if (filterStatus) url += `status=${filterStatus}&`;
      if (filterQuarter) url += `quarter=${filterQuarter}&`;
      
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.code === 0) {
        const enhanced = (json.data || []).map((p: Plan) => ({
          ...p,
          creator_name: userMap.get(p.creator_id) || '未知',
          assignee_name: userMap.get(p.assignee_id) || '未知'
        }));
        setPlans(enhanced);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const statusLabel: Record<string, { label: string, color: string }> = {
    'draft': { label: '草稿', color: 'bg-slate-100 text-slate-500' },
    'pending_review': { label: '待审批', color: 'bg-amber-100 text-amber-700' },
    'approved': { label: '执行中', color: 'bg-blue-100 text-blue-700' },
    'rejected': { label: '已驳回', color: 'bg-red-100 text-red-700' },
    'in_progress': { label: '进行中', color: 'bg-blue-100 text-blue-700' },
    'pending_assessment': { label: '待评级', color: 'bg-purple-100 text-purple-700' },
    'assessed': { label: '已结案', color: 'bg-indigo-100 text-indigo-700' },
    'completed': { label: '已完成', color: 'bg-emerald-100 text-emerald-700' },
    'pending_receipt': { label: '待签收', color: 'bg-cyan-100 text-cyan-700' },
  };

  const handleReview = async (planId: number, action: 'approve' | 'reject', reason?: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/perf/plans/${planId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, reason })
      });
      const json = await res.json();
      if (json.code === 0) {
        fetchPlans();
        setSelectedPlan(null);
      } else {
        alert(json.message);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const runAiDiagnostic = async () => {
    const listToDiagnose = plans.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()));
    if (listToDiagnose.length === 0) {
      alert("当前没有可诊断的绩效目标。");
      return;
    }
    
    setDiagnosing(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/ai/diagnose-perf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plans: listToDiagnose })
      });
      const json = await res.json();
      if (json.code === 0) {
        setAiDiagnostic(json.data.diagnosticReport);
      } else {
        alert("诊断失败: " + json.message);
      }
    } catch (e) {
      console.error(e);
      alert("请求超时或失败");
    }
    setDiagnosing(false);
  };

  const filteredPlans = plans.filter(p => 
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (p.assignee_name && p.assignee_name.includes(searchQuery))
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-['Inter']">
      <Sidebar currentView="perf-manage" navigate={navigate} />
      
      <main className="pt-20 pb-12 px-6 max-w-7xl mx-auto animate-in fade-in duration-300">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-500 text-[28px]">trending_up</span>
              绩效管理
            </h2>
            <p className="text-sm text-slate-500 mt-1">全局绩效审核、进度管理与智能优化诊断</p>
          </div>
          
          <div className="flex bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-1">
            <button onClick={() => setFilterStatus('')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${filterStatus === '' ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100' : 'text-slate-500 hover:text-slate-700'}`}>全部</button>
            <button onClick={() => setFilterStatus('pending_review')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${filterStatus === 'pending_review' ? 'bg-amber-50 text-amber-700' : 'text-slate-500 hover:text-slate-700'}`}>待审批</button>
            <button onClick={() => setFilterStatus('approved')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${filterStatus === 'approved' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}>执行中</button>
            <button onClick={() => setFilterStatus('assessed')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${filterStatus === 'assessed' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}>已结案</button>
          </div>
        </div>

        {/* 顶部工具栏 */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6 relative z-10">
          <div className="relative flex-1 max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
            <input 
              type="text" 
              placeholder="搜索提报内容或责任人..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all shadow-sm"
            />
          </div>
          
          <button 
            onClick={runAiDiagnostic}
            disabled={diagnosing || filteredPlans.length === 0}
            className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-5 py-2 rounded-xl font-bold text-sm shadow-md shadow-indigo-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {diagnosing ? (
              <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
            ) : (
              <span className="material-symbols-outlined text-[18px]">smart_toy</span>
            )}
            AI 智能提报诊断
          </button>
        </div>

        {/* 诊断报告展示区 */}
        {aiDiagnostic && (
          <div className="mb-6 p-6 bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 shadow-inner animate-in slide-in-from-top-4 fade-in relative">
            <button onClick={() => setAiDiagnostic(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <span className="material-symbols-outlined">close</span>
            </button>
            <h3 className="text-lg font-black text-indigo-900 dark:text-indigo-200 mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-500">insights</span>
              AI 深度诊断报告
            </h3>
            <div className="prose prose-sm dark:prose-invert prose-indigo max-w-none whitespace-pre-wrap leading-relaxed">
              {aiDiagnostic}
            </div>
          </div>
        )}

        {/* 提报列表 */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-slate-500 text-sm font-medium">获取绩效数据中...</p>
          </div>
        ) : filteredPlans.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center shadow-sm">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-slate-400 text-3xl">inbox</span>
            </div>
            <h3 className="text-slate-700 dark:text-slate-200 font-bold mb-1">查无提报</h3>
            <p className="text-slate-500 text-sm">当前条件未找到任何相关的绩效计划记录</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredPlans.map(plan => {
              const st = statusLabel[plan.status] || { label: plan.status, color: 'bg-slate-100 text-slate-500' };
              return (
                <div key={plan.id} className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow group">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex gap-2 items-center">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${st.color}`}>
                        {st.label}
                      </span>
                      <span className="text-xs text-slate-500 flex items-center gap-1 font-medium bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                        <span className="material-symbols-outlined text-[12px]">person</span>
                        责任人: {plan.assignee_name}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">{plan.created_at.split('T')[0]}</span>
                  </div>
                  
                  <h4 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-2 truncate group-hover:text-emerald-600 transition-colors">
                    {plan.title}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 h-8 leading-relaxed">
                    {plan.description || '暂无详细描述'}
                  </p>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-slate-400">目前进度评估: <b className="text-slate-600 dark:text-slate-300">{plan.progress}%</b></span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => { setSelectedPlan(plan); setModalMode('view'); }}
                        className="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                      >
                        详情
                      </button>
                      
                      {plan.status === 'pending_review' && (
                        <>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleReview(plan.id, 'reject', '管理者驳回请修改'); }}
                            className="px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                          >
                            驳回
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleReview(plan.id, 'approve'); }}
                            className="px-3 py-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                          >
                            同意
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* 复用全局 SmartTaskModal 予以展示或审批介入 */}
      {selectedPlan && (
        <SmartTaskModal
          isOpen={true}
          title={modalMode === 'view' ? '绩效目标详情' : '编辑绩效目标'}
          type="personal"
          initialData={{...selectedPlan as any, flow_type: 'perf_plan'}}
          readonly={modalMode === 'view'}
          users={users}
          onClose={() => setSelectedPlan(null)}
          onSubmit={async () => {
             // 提交完后重新拉取
             fetchPlans();
             setSelectedPlan(null);
          }}
        />
      )}
    </div>
  );
}
