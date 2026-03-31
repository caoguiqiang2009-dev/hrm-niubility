import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import TestBankManager from './TestBankManager';
import TestTakingModal from '../components/TestTakingModal';

export default function CompetencyManager({ navigate, initialTestId, initialTab }: { navigate: (v: string) => void; initialTestId?: number; initialTab?: any; }) {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'models' | 'evaluations' | 'library' | 'gap' | 'my_tests' | 'test_bank'>(initialTab || 'evaluations');
  const [loading, setLoading] = useState(false);

  // Data
  const [models, setModels] = useState<any[]>([]);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [libraryList, setLibraryList] = useState<any[]>([]);
  const [gapAnalysis, setGapAnalysis] = useState<any[]>([]);
  const [myTests, setMyTests] = useState<any[]>([]);

  // Modals
  const [showModelModal, setShowModelModal] = useState(false);
  const [editingModel, setEditingModel] = useState<any>(null);
  const [showEvalModal, setShowEvalModal] = useState(false); // create evaluation
  const [showScoreModal, setShowScoreModal] = useState<any>(null); // scoring detailed evaluation
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [editingLibrary, setEditingLibrary] = useState<any>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [takingTestId, setTakingTestId] = useState<number | null>(null);

  // 发起评估 — 搜索与多选
  const [evalUserSearch, setEvalUserSearch] = useState('');
  const [evalSelectedUsers, setEvalSelectedUsers] = useState<string[]>([]);
  const [evalModelId, setEvalModelId] = useState('');

  useEffect(() => {
    if (initialTestId) {
      setTakingTestId(initialTestId);
      setActiveTab('my_tests');
    }
  }, [initialTestId]);

  useEffect(() => {
    fetchUsers();
    fetchModels();
    fetchEvaluations();
    fetchLibrary();
    fetchGapAnalysis();
    fetchMyTests();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/org/users', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      const json = await res.json();
      if (json.code === 0) setUsers(json.data);
    } catch (e) {}
  };

  const fetchMyTests = async () => {
    try {
      const res = await fetch('/api/tests/my', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      const json = await res.json();
      if (json.code === 0) {
        const tests = (json.data || []).filter((t: any) => t.status === 'pending');
        setMyTests(tests);
        if (tests.length > 0 && activeTab === 'evaluations') {
          setActiveTab('my_tests');
        }
      }
    } catch (e) {}
  };

  const fetchModels = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/competency/models', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      const json = await res.json();
      if (json.code === 0) setModels(json.data);
    } catch (e) {}
    setLoading(false);
  };

  const fetchEvaluations = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/competency/evaluations', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      const json = await res.json();
      if (json.code === 0) setEvaluations(json.data);
    } catch (e) {}
    setLoading(false);
  };

  const fetchLibrary = async () => {
    try {
      const res = await fetch('/api/competency/library', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      const json = await res.json();
      if (json.code === 0) setLibraryList(json.data);
    } catch (e) {}
  };

  const fetchGapAnalysis = async () => {
    try {
      const res = await fetch('/api/competency/gap-analysis', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      const json = await res.json();
      if (json.code === 0) setGapAnalysis(json.data);
    } catch (e) {}
  };

  const saveLibraryItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLibrary.name) return alert('名称必填');
    try {
      const res = await fetch('/api/competency/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify(editingLibrary),
      });
      const json = await res.json();
      if (json.code === 0) {
        setShowLibraryModal(false);
        fetchLibrary();
      } else alert(json.message);
    } catch (e) {
      alert('保存失败');
    }
  };

  const deleteLibraryItem = async (id: number) => {
    if (!confirm('确定删除该预设能力吗？(不会影响已应用此能力的模型)')) return;
    try {
      const res = await fetch(`/api/competency/library/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const json = await res.json();
      if (json.code === 0) fetchLibrary();
      else alert(json.message);
    } catch (e) {
      alert('删除失败');
    }
  };

  const saveModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingModel.name) return alert('模型保存失败：名称必填。');
    if (!editingModel.dimensions || editingModel.dimensions.length === 0) {
      return alert('模型保存失败：能力模型必须包含至少 1 个考核维度。请点击下方“手动追加维度”或“导入能力库”，否则空壳模型将无法发起评估。');
    }
    // Verify each dimension has a name and max_score
    for (const d of editingModel.dimensions) {
      if (!d.name || d.name.trim() === '') return alert('模型保存失败：存在空白维度的名称。请填写或移除该维度。');
      if (!d.max_score || d.max_score <= 0) return alert('模型保存失败：所有维度的满分必须大于 0。');
    }

    try {
      const res = await fetch('/api/competency/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify(editingModel)
      });
      const json = await res.json();
      if (json.code === 0) {
        setShowModelModal(false);
        fetchModels();
      } else alert(json.message);
    } catch (err) {}
  };

  const deleteModel = async (id: number) => {
    if (!confirm('确定要删除此模型吗？')) return;
    try {
      const res = await fetch(`/api/competency/models/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const json = await res.json();
      if (json.code === 0) fetchModels();
      else alert(json.message);
    } catch (err) {}
  };

  const startEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    const uids = evalSelectedUsers;
    const mId = evalModelId;
    if (!uids.length || !mId) return alert('请选择人员和使用的评估模型');
    
    try {
      const res = await fetch('/api/competency/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ user_userIds: uids, model_id: Number(mId) })
      });
      const json = await res.json();
      if (json.code === 0) {
        setShowEvalModal(false);
        setEvalSelectedUsers([]);
        setEvalModelId('');
        setEvalUserSearch('');
        fetchEvaluations();
        setActiveTab('evaluations');
      } else {
        alert(`下发失败：${json.message}\n如果提示“无维度配置”，说明您挑选的这个模型是空的，请先前往“能力模型配置”编辑该模型并添加评估维度。`);
      }
    } catch (err) {
      alert('下发失败：网络或服务器错误');
    }
  };

  const openScoreModal = async (ev: any) => {
    try {
      const res = await fetch(`/api/competency/evaluations/${ev.id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      const json = await res.json();
      if (json.code === 0) setShowScoreModal(json.data);
    } catch (e) {}
  };

  const submitScores = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Collect payload
      const scoresPayload = showScoreModal.scores.map((s: any) => ({
        dimension_id: s.id || s.dimension_id,
        score: Number(s._inputScore),
        comment: s._inputComment
      }));
      
      const res = await fetch(`/api/competency/evaluations/${showScoreModal.id}/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ scores: scoresPayload })
      });
      const json = await res.json();
      if (json.code === 0) {
        setShowScoreModal(null);
        fetchEvaluations();
      } else alert(json.message);
    } catch (er) {}
  };

  // Status map
  const getStatusUI = (st: string) => {
    if (st === 'pending_self') return <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold">待自评</span>;
    if (st === 'pending_manager') return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold">待主管评分</span>;
    if (st === 'completed') return <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">已完成</span>;
    return <span>{st}</span>;
  };

  // Minimal radar UI for visual flair
  const renderSimpleRadar = (scores: any[]) => {
    // If no data, render empty
    if (!scores || !scores.length) return <div className="text-slate-400 text-xs py-4 text-center">暂无雷达数据</div>;
    return (
      <div className="flex flex-col gap-2 mt-4 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
        {scores.map((s, idx) => {
          const mScore = s.manager_score || 0;
          const max = s.max_score || 5;
          const pct = Math.min(100, Math.max(0, (mScore / max) * 100));
          return (
            <div key={idx} className="flex flex-col gap-1">
              <div className="flex justify-between text-[10px] text-slate-500 font-bold">
                <span>{s.name}</span>
                <span>{mScore}/{max}</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div className="bg-indigo-500 h-full rounded-full transition-all" style={{ width: pct + '%' }} />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const isManagerOrAdmin = currentUser?.role === 'admin' || currentUser?.role === 'hr';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-['Inter']">
      <Sidebar currentView="competency" navigate={navigate} />
      
      <main className="pt-20 pb-12 px-6 max-w-7xl mx-auto animate-in fade-in duration-300">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-500 text-[28px]">psychology</span>
              能力大盘 (能力管理)
            </h2>
            <p className="text-sm text-slate-500 mt-1">定制岗位评估模型，实现团队成员能力的客观量化、对比与定级评价。</p>
          </div>
          
          <div className="flex items-center gap-3">
            {isManagerOrAdmin && (
              <button onClick={() => setShowEvalModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-md shadow-indigo-600/20 active:scale-95 transition-all flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                发起评估
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 border-b border-slate-200 dark:border-slate-800 mb-6 relative overflow-x-auto no-scrollbar">
          {myTests.length > 0 && (
            <button 
              onClick={() => setActiveTab('my_tests')} 
              className={`pb-3 font-bold text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'my_tests' ? 'text-indigo-600 border-indigo-600' : 'text-slate-500 border-transparent hover:text-slate-800 dark:hover:text-slate-300'}`}
            >
              待办测评 <span className="ml-1 bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{myTests.length}</span>
            </button>
          )}

          <button 
            onClick={() => setActiveTab('evaluations')} 
            className={`pb-3 font-bold text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'evaluations' ? 'text-indigo-600 border-indigo-600' : 'text-slate-500 border-transparent hover:text-slate-800 dark:hover:text-slate-300'}`}
          >
            团队评估进展
          </button>
          
          {isManagerOrAdmin && (
            <button 
              onClick={() => setActiveTab('gap')} 
              className={`pb-3 font-bold text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'gap' ? 'text-indigo-600 border-indigo-600' : 'text-slate-500 border-transparent hover:text-slate-800 dark:hover:text-slate-300'}`}
            >
              能力短板与预警
            </button>
          )}

          {isManagerOrAdmin && (
            <button 
              onClick={() => setActiveTab('models')} 
              className={`pb-3 font-bold text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'models' ? 'text-indigo-600 border-indigo-600' : 'text-slate-500 border-transparent hover:text-slate-800 dark:hover:text-slate-300'}`}
            >
              能力模型配置
            </button>
          )}

          {isManagerOrAdmin && (
            <button 
              onClick={() => setActiveTab('library')} 
              className={`pb-3 font-bold text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'library' ? 'text-indigo-600 border-indigo-600' : 'text-slate-500 border-transparent hover:text-slate-800 dark:hover:text-slate-300'}`}
            >
              预设能力库(字典)
            </button>
          )}

          {isManagerOrAdmin && (
            <button 
              onClick={() => setActiveTab('test_bank')} 
              className={`pb-3 font-bold text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'test_bank' ? 'text-indigo-600 border-indigo-600' : 'text-slate-500 border-transparent hover:text-slate-800 dark:hover:text-slate-300'}`}
            >
              考卷题库与发卷
            </button>
          )}
        </div>

        {/* Content */}
        {loading ? (
           <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent flex items-center justify-center rounded-full animate-spin"/></div>
        ) : (
          <>
            {/* My Tests Tab */}
            {activeTab === 'my_tests' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {myTests.length === 0 ? (
                  <div className="col-span-full py-20 text-center text-slate-400">目前没有待办的测评试卷</div>
                ) : (
                  myTests.map((t: any) => (
                    <div key={t.id} className="bg-gradient-to-br from-indigo-500 to-blue-600 rounded-3xl p-6 shadow-lg shadow-indigo-500/20 text-white relative overflow-hidden">
                      <div className="relative z-10 flex flex-col h-full">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm shrink-0">
                            <span className="material-symbols-outlined text-[24px]">quiz</span>
                          </div>
                          <div>
                            <h3 className="text-xl font-bold tracking-tight leading-tight line-clamp-2">{t.test_bank_title}</h3>
                          </div>
                        </div>
                        <p className="text-indigo-100 text-sm mb-6 flex-1">您有一份新的能力测评等待作答，完成后将同步评测能力模型分数。</p>
                        <button onClick={() => setTakingTestId(t.id)} className="w-full py-2.5 bg-white text-indigo-600 rounded-xl font-bold shadow-sm hover:shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2">
                          立即答题跑出雷达图 <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                        </button>
                      </div>
                      <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                      <div className="absolute bottom-[-10%] left-[20%] w-24 h-24 bg-blue-400/20 rounded-full blur-xl"></div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Test Bank Tab (Admin Only) */}
            {activeTab === 'test_bank' && isManagerOrAdmin && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm h-[70vh] flex flex-col overflow-hidden relative z-0">
                <TestBankManager isEmbedded={true} />
              </div>
            )}

            {/* Evaluations Tab */}
            {activeTab === 'evaluations' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {evaluations.length === 0 ? (
                  <div className="col-span-full py-20 text-center text-slate-400">目前没有任何能力评估记录</div>
                ) : (
                  evaluations.map(ev => {
                    const amIUser = ev.user_id.toString() === currentUser?.id?.toString();
                    const actionName = ev.status === 'pending_self' && amIUser ? '立即自评' : 
                                      (ev.status === 'pending_manager' && isManagerOrAdmin) ? '主管打分' : '查看报告';
                    return (
                      <div key={ev.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-2">
                          {getStatusUI(ev.status)}
                          <span className="text-[10px] text-slate-400">{ev.created_at.split('T')[0]}</span>
                        </div>
                        <h4 className="font-black text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-1">
                          {ev.user_name}
                        </h4>
                        <p className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded inline-block mb-4">
                          采用模型: {ev.model_name}
                        </p>

                        <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mt-auto">
                          <button 
                            onClick={() => openScoreModal(ev)}
                            className="w-full text-center text-sm font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 py-2 rounded-xl hover:bg-indigo-100 transition-colors"
                          >
                            {actionName}
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )}

            {/* Models Tab */}
            {activeTab === 'models' && isManagerOrAdmin && (
              <>
                <div className="flex justify-end mb-4">
                  <button onClick={() => { setEditingModel({ dimensions: [] }); setShowModelModal(true); }} className="text-sm font-bold bg-white text-indigo-600 border border-indigo-200 px-4 py-1.5 rounded-lg shadow-sm hover:bg-indigo-50 transition-colors flex items-center gap-1">
                    <span className="material-symbols-outlined text-[18px]">add</span> 新增模型
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {models.map(m => (
                    <div key={m.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 relative group">
                      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                        <button onClick={() => { setEditingModel(JSON.parse(JSON.stringify(m))); setShowModelModal(true); }} className="p-1.5 text-slate-400 hover:text-blue-500 rounded hover:bg-slate-100"><span className="material-symbols-outlined text-[16px]">edit</span></button>
                        <button onClick={() => deleteModel(m.id)} className="p-1.5 text-slate-400 hover:text-red-500 rounded hover:bg-slate-100"><span className="material-symbols-outlined text-[16px]">delete</span></button>
                      </div>
                      <h4 className="font-bold text-slate-800 dark:text-slate-100 text-lg mb-1">{m.name}</h4>
                      <p className="text-xs text-slate-500 mb-4">{m.description || '无具体说明'}</p>
                      
                      <div className="flex flex-wrap gap-2">
                        {m.dimensions?.map((d: any, idx: number) => (
                          <span key={idx} className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-1 rounded border border-indigo-100/50">
                            {d.name} (目标:{d.target_score || 3}, 权重:{d.weight || 1}, 满分:{d.max_score || 5})
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Gap Analysis Tab */}
            {activeTab === 'gap' && isManagerOrAdmin && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                <h3 className="font-black text-lg mb-4 text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <span className="material-symbols-outlined text-rose-500">radar</span>
                  团队能力短板预警
                </h3>
                <p className="text-xs text-slate-500 mb-6">基于已完成的所有评估，比对预留基线(目标分)后计算出的平均技能掌握度。标红预警的技能代表急需招聘或加强培训。</p>
                
                {gapAnalysis.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-sm">暂无评估数据用于生成分析</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {gapAnalysis.map(ga => (
                      <div key={ga.library_id} className={`p-4 rounded-xl border-l-4 ${ga.is_deficient ? 'bg-rose-50 border-rose-500 dark:bg-rose-950/30' : 'bg-emerald-50 border-emerald-500 dark:bg-emerald-950/30'}`}>
                        <div className="flex justify-between items-start mb-2">
                          <span className={`text-xs px-2 py-0.5 rounded ${ga.is_deficient ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'} font-bold`}>{ga.category || '通用'}</span>
                          <span className={`text-[10px] font-black ${ga.is_deficient ? 'text-rose-500' : 'text-emerald-500'}`}>
                            {ga.is_deficient ? '⚠️ 人才短缺' : '稳定'}
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-100 text-base mb-1">{ga.skill_name}</h4>
                        <div className="flex justify-between mt-4">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400 font-bold uppercase">考核均分</span>
                            <span className={`text-xl font-black ${ga.is_deficient ? 'text-rose-600' : 'text-slate-700 dark:text-slate-200'}`}>{ga.avg_score}</span>
                          </div>
                          <div className="flex flex-col text-right">
                            <span className="text-[10px] text-slate-400 font-bold uppercase">基线/最高分</span>
                            <span className="text-sm font-bold text-slate-500 mt-1">{ga.target_score} / {ga.top_score}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Library Tab */}
            {activeTab === 'library' && isManagerOrAdmin && (
              <>
                <div className="flex justify-end mb-4">
                  <button onClick={() => { setEditingLibrary({}); setShowLibraryModal(true); }} className="text-sm font-bold bg-white text-indigo-600 border border-indigo-200 px-4 py-1.5 rounded-lg shadow-sm hover:bg-indigo-50 transition-colors flex items-center gap-1">
                    <span className="material-symbols-outlined text-[18px]">add_box</span> 新增入库
                  </button>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse min-w-max">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 text-slate-500 text-xs uppercase font-black">
                        <th className="px-6 py-4 w-32">类别</th>
                        <th className="px-6 py-4">能力名称</th>
                        <th className="px-6 py-4">能力解读</th>
                        <th className="px-6 py-4 w-24">默认满分</th>
                        <th className="px-6 py-4 w-24 text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm text-slate-700 dark:text-slate-300">
                      {libraryList.length === 0 && (
                         <tr><td colSpan={5} className="py-10 text-center text-slate-400">目前没有预设能力库数据</td></tr>
                      )}
                      {libraryList.map((item) => (
                        <tr key={item.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="px-6 py-4 font-bold text-slate-500">{item.category}</td>
                          <td className="px-6 py-4 font-black text-slate-800 dark:text-slate-100">{item.name}</td>
                          <td className="px-6 py-4 text-xs text-slate-500 line-clamp-2 max-w-md">{item.description}</td>
                          <td className="px-6 py-4 font-bold text-indigo-500">{item.default_max_score}</td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => { setEditingLibrary(JSON.parse(JSON.stringify(item))); setShowLibraryModal(true); }} className="text-blue-500 hover:text-blue-600 mr-3"><span className="material-symbols-outlined text-[18px]">edit</span></button>
                            <button onClick={() => deleteLibraryItem(item.id)} className="text-red-500 hover:text-red-600"><span className="material-symbols-outlined text-[18px]">delete</span></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </main>

      {/* Model Edit Modal */}
      {showModelModal && editingModel && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowModelModal(false)}/>
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900">
              <h3 className="font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-500">model_training</span>
                {editingModel.id ? '编辑评估模型' : '构建新模型'}
              </h3>
              <button onClick={() => setShowModelModal(false)} className="text-slate-400 hover:text-slate-600"><span className="material-symbols-outlined">close</span></button>
            </div>
            
            <form onSubmit={saveModel} className="flex-1 overflow-y-auto p-6 space-y-4 font-['Inter'] custom-scrollbar">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">模型名称 (如：高级研发序列能力模型) *</label>
                <input required type="text" value={editingModel.name || ''} onChange={e => setEditingModel({...editingModel, name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 outline-none" placeholder="输入名称"/>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">适用部门 (选填)</label>
                <input type="text" value={editingModel.department_id || ''} onChange={e => setEditingModel({...editingModel, department_id: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 outline-none" placeholder="业务部 / 技术部..."/>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">
                  岗位说明 <span className="text-slate-400 font-normal">(选填)</span>
                </label>
                <p className="text-[10px] text-slate-400">描述该模型适用的岗位职责、用途或考核背景，方便后续快速识别。</p>
                <textarea
                  rows={3}
                  value={editingModel.description || ''}
                  onChange={e => setEditingModel({...editingModel, description: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 outline-none resize-none"
                  placeholder="例如：适用于招聘周期短的岗位，重点考查快速上手能力与项目执行力..."
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">能力维度设置 *</label>
                <p className="text-[10px] text-slate-400 mb-2">为该模型添加考核的衡量维度（通常 4-6 项）</p>
                <div className="space-y-2">
                  {editingModel.dimensions?.map((d: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-2 rounded-lg">
                      <input type="text" placeholder="维度名称 (如 技术视野)" value={d.name || ''} onChange={e => {
                        const newD = [...editingModel.dimensions];
                        newD[i].name = e.target.value;
                        setEditingModel({...editingModel, dimensions: newD});
                      }} className="flex-1 p-1.5 text-sm border border-slate-200 rounded outline-none" required/>
                      
                      <div className="flex items-center gap-1 w-20">
                         <span className="text-[10px] text-slate-500">满分</span>
                         <input type="number" value={d.max_score || 5} onChange={e => {
                          const newD = [...editingModel.dimensions];
                          newD[i].max_score = Number(e.target.value);
                          setEditingModel({...editingModel, dimensions: newD});
                        }} className="w-full p-1 border rounded text-xs text-center outline-none" step="1"/>
                      </div>
                      
                      <div className="flex items-center gap-1 w-20">
                         <span className="text-[10px] text-slate-500">达标分</span>
                         <input title="目标/基线得分" type="number" value={d.target_score || 3} onChange={e => {
                          const newD = [...editingModel.dimensions];
                          newD[i].target_score = Number(e.target.value);
                          setEditingModel({...editingModel, dimensions: newD});
                        }} className="w-full p-1 border rounded text-xs text-center outline-none shrink-0" step="0.5"/>
                      </div>

                       <div className="flex items-center gap-1 w-20">
                         <span className="text-[10px] text-slate-500">权重</span>
                         <input type="number" value={d.weight || 1} onChange={e => {
                          const newD = [...editingModel.dimensions];
                          newD[i].weight = Number(e.target.value);
                          setEditingModel({...editingModel, dimensions: newD});
                        }} className="w-full p-1 border rounded text-xs text-center outline-none" step="0.1"/>
                      </div>

                      <button type="button" onClick={() => {
                        const newD = [...editingModel.dimensions];
                        newD.splice(i, 1);
                        setEditingModel({...editingModel, dimensions: newD});
                      }} className="p-1 text-slate-400 hover:text-red-500"><span className="material-symbols-outlined text-[16px]">close</span></button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setShowImportModal(true)} className="flex-1 py-2 border border-solid border-emerald-300 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1 shadow-sm">
                      <span className="material-symbols-outlined text-[14px]">checklist_rtl</span> 从能力库导入({libraryList.length})
                    </button>
                    <button type="button" onClick={() => {
                      setEditingModel({...editingModel, dimensions: [...(editingModel.dimensions||[]), { name: '', max_score: 5, target_score: 3, weight: 1, category: '通用' }]});
                    }} className="flex-1 py-2 border border-dashed border-indigo-300 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-50 flex items-center justify-center gap-1 transition-colors">
                      <span className="material-symbols-outlined text-[14px]">add</span> 手动追加维度
                    </button>
                  </div>
                </div>
              </div>
            </form>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-white">
              <button onClick={() => setShowModelModal(false)} className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-100">取消</button>
              <button onClick={saveModel} className="px-5 py-2 rounded-lg text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-md">保存配置</button>
            </div>
          </div>
        </div>
      )}

      {/* Initiation Modal */}
      {showEvalModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowEvalModal(false)}/>
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
             <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-black text-slate-800 flex items-center gap-2">发起人员能力评估</h3>
                <button onClick={() => { setShowEvalModal(false); setEvalSelectedUsers([]); setEvalModelId(''); setEvalUserSearch(''); }} className="text-slate-400"><span className="material-symbols-outlined">close</span></button>
             </div>
             <form onSubmit={startEvaluation} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-2">选择考核标准(能力模型)</label>
                  <select
                    value={evalModelId}
                    onChange={e => setEvalModelId(e.target.value)}
                    required
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
                  >
                    <option value="">--请选择--</option>
                    {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-600">下发评估大名单</label>
                    {evalSelectedUsers.length > 0 && (
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                        已选 {evalSelectedUsers.length} 人
                      </span>
                    )}
                  </div>
                  {/* 搜索框 */}
                  <div className="relative mb-2">
                    <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[16px]">search</span>
                    <input
                      type="text"
                      placeholder="输入姓名搜索..."
                      value={evalUserSearch}
                      onChange={e => setEvalUserSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 bg-slate-50"
                    />
                  </div>
                  {/* 可勾选列表 */}
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    {/* 全选 / 反选 */}
                    <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          const filtered = users.filter(u =>
                            !evalUserSearch || u.name?.includes(evalUserSearch) || (u.department || '').includes(evalUserSearch)
                          );
                          const filteredIds = filtered.map((u: any) => String(u.id));
                          const allSelected = filteredIds.every(id => evalSelectedUsers.includes(id));
                          if (allSelected) {
                            setEvalSelectedUsers(prev => prev.filter(id => !filteredIds.includes(id)));
                          } else {
                            setEvalSelectedUsers(prev => [...new Set([...prev, ...filteredIds])]);
                          }
                        }}
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
                      >
                        {users.filter(u =>
                          !evalUserSearch || u.name?.includes(evalUserSearch) || (u.department || '').includes(evalUserSearch)
                        ).every((u: any) => evalSelectedUsers.includes(String(u.id)))
                          ? '取消全选' : '全选当前'}
                      </button>
                      <span className="text-[10px] text-slate-400">共 {users.length} 人</span>
                    </div>
                    <div className="max-h-52 overflow-y-auto divide-y divide-slate-50">
                      {users
                        .filter((u: any) =>
                          !evalUserSearch ||
                          u.name?.includes(evalUserSearch) ||
                          (u.department || '').includes(evalUserSearch)
                        )
                        .map((u: any) => {
                          const selected = evalSelectedUsers.includes(String(u.id));
                          return (
                            <label
                              key={u.id}
                              className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                                selected ? 'bg-indigo-50' : 'hover:bg-slate-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => {
                                  const uid = String(u.id);
                                  setEvalSelectedUsers(prev =>
                                    prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
                                  );
                                }}
                                className="w-3.5 h-3.5 rounded accent-indigo-600"
                              />
                              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-[11px] font-black flex-shrink-0">
                                {u.name?.charAt(0)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-bold truncate ${ selected ? 'text-indigo-700' : 'text-slate-800'}`}>{u.name}</p>
                                {u.department && <p className="text-[10px] text-slate-400 truncate">{u.department}</p>}
                              </div>
                              {selected && <span className="material-symbols-outlined text-indigo-500 text-[16px] flex-shrink-0">check_circle</span>}
                            </label>
                          );
                        })}
                      {users.filter((u: any) =>
                        !evalUserSearch || u.name?.includes(evalUserSearch) || (u.department || '').includes(evalUserSearch)
                      ).length === 0 && (
                        <div className="py-8 text-center text-slate-400 text-sm">未找到匹配的人员</div>
                      )}
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1.5">勾选即可多选。系统会自动分发给相应人员及其对应主管开展双评。</p>
                </div>
                <div className="pt-2 flex justify-end">
                   <button type="submit" disabled={!evalSelectedUsers.length || !evalModelId} className="bg-indigo-600 text-white font-bold px-6 py-2 rounded-lg text-sm hover:bg-indigo-700 w-full shadow-md shadow-indigo-600/20 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity">
                     {evalSelectedUsers.length > 0 ? `立即下发 ${evalSelectedUsers.length} 人` : '立即下发开始'}
                   </button>
                </div>
             </form>
          </div>
        </div>
      )}

      {/* Scoring Form Modal */}
      {showScoreModal && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center p-4">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowScoreModal(null)}/>
           
           <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-indigo-600 text-white">
                 <h3 className="font-black flex items-center gap-2">
                    <span className="material-symbols-outlined">psychology_alt</span>
                    {showScoreModal.user_name} 素质评估表
                 </h3>
                 <button onClick={() => setShowScoreModal(null)} className="text-indigo-200 hover:text-white"><span className="material-symbols-outlined">close</span></button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-50/30">
                 <p className="text-xs text-slate-500 mb-6 bg-slate-100 px-3 py-2 rounded-lg border border-slate-200">
                   当前阶段：{getStatusUI(showScoreModal.status)} | 基于 <span className="font-bold text-slate-700">{showScoreModal.model_name}</span> 模型。
                   {showScoreModal.status === 'completed' && ' 评估已闭环，以下为双方数据留底与雷达生成依据。'}
                   {showScoreModal.status === 'pending_manager' && ' 员工已自评完成，请主管客观公正复核打分。'}
                 </p>

                 {showScoreModal.status === 'completed' && renderSimpleRadar(showScoreModal.scores)}

                 <form id="scoreForm" onSubmit={submitScores} className="space-y-4 mt-6">
                    {showScoreModal.scores?.map((s: any, idx: number) => {
                      const amIUser = showScoreModal.user_id.toString() === currentUser?.id?.toString();
                      const amIManager = isManagerOrAdmin && !amIUser; // simplify logic for view
                      
                      const canEdit = (showScoreModal.status === 'pending_self' && amIUser) ||
                                      (showScoreModal.status === 'pending_manager' && amIManager);
                                      
                      // Initialize temporary form state on object for easy binding
                      if (s._inputScore === undefined) {
                         if (showScoreModal.status === 'pending_self') s._inputScore = s.self_score || s.max_score / 2;
                         else if (showScoreModal.status === 'pending_manager') s._inputScore = s.manager_score || s.self_score || s.max_score / 2;
                         else s._inputScore = s.manager_score; // readonly view
                      }
                      
                      return (
                        <div key={idx} className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
                           <div className="flex justify-between items-start mb-2">
                              <div>
                                <h4 className="font-bold text-sm text-slate-800">{s.name}</h4>
                                <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 rounded mt-1 inline-block">占比:{s.weight} 满分:{s.max_score}</span>
                              </div>
                              
                              {canEdit ? (
                                <div className="flex gap-2 items-center bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
                                  <span className="text-xs text-indigo-700 font-bold">打分:</span>
                                  <input 
                                    type="number" 
                                    value={s._inputScore} 
                                    max={s.max_score} min={0} step={0.5} 
                                    onChange={(e) => {
                                      const newModal = {...showScoreModal};
                                      newModal.scores[idx]._inputScore = e.target.value;
                                      setShowScoreModal(newModal);
                                    }}
                                    className="w-16 bg-white border border-indigo-200 rounded text-center text-sm font-bold text-indigo-700 outline-none p-1"
                                    required
                                  />
                                </div>
                              ) : (
                                <div className="text-right">
                                  <span className="block text-[10px] text-slate-400">自评分: <b className="text-slate-700 text-xs">{s.self_score || '-'}</b></span>
                                  <span className="block text-[10px] text-slate-400">主管评分: <b className="text-indigo-600 text-sm">{s.manager_score || '-'}</b></span>
                                </div>
                              )}
                           </div>
                           
                           {canEdit && (
                             <textarea 
                               placeholder="记录该维度表现的客观评价或典型事实依据..."
                               value={s._inputComment || ''}
                               onChange={e => {
                                  const newModal = {...showScoreModal};
                                  newModal.scores[idx]._inputComment = e.target.value;
                                  setShowScoreModal(newModal);
                               }}
                               className="w-full mt-2 text-xs p-2 bg-slate-50 border border-slate-100 rounded-lg outline-none focus:border-indigo-300 focus:bg-white resize-none h-16"
                             />
                           )}
                           
                           {/* Show prev comment if any */}
                           {!canEdit && s.comment && (
                             <div className="bg-slate-50 mt-2 p-2 rounded text-xs text-slate-500 border-l-2 border-slate-300">
                               {s.comment}
                             </div>
                           )}
                        </div>
                      );
                    })}
                 </form>
              </div>
              
              <div className="px-6 py-4 border-t border-slate-100 bg-white flex justify-end">
                {showScoreModal.status !== 'completed' && (
                  <button type="submit" form="scoreForm" className="bg-indigo-600 text-white font-bold px-6 py-2 rounded-lg text-sm shadow-md hover:bg-indigo-700">提交评分问卷</button>
                )}
                {showScoreModal.status === 'completed' && (
                  <button onClick={() => setShowScoreModal(null)} className="bg-slate-100 text-slate-700 font-bold px-6 py-2 rounded-lg text-sm hover:bg-slate-200">关闭查看</button>
                )}
              </div>
           </div>
        </div>
      )}

      {/* Library Edit Modal */}
      {showLibraryModal && editingLibrary && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowLibraryModal(false)}/>
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900">
              <h3 className="font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-500">category</span>
                {editingLibrary.id ? '编辑预设能力' : '录入新能力'}
              </h3>
              <button onClick={() => setShowLibraryModal(false)} className="text-slate-400 hover:text-slate-600"><span className="material-symbols-outlined">close</span></button>
            </div>
            <form onSubmit={saveLibraryItem} className="p-6 space-y-4">
              <div>
                 <label className="block text-xs font-bold text-slate-600 mb-2">类型 (类别)</label>
                 <select value={editingLibrary.category || '通用基石'} onChange={e => setEditingLibrary({...editingLibrary, category: e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500">
                   <option value="通用基石">通用基石</option>
                   <option value="核心基础">核心基础</option>
                   <option value="专业技能">专业技能</option>
                   <option value="管理领导">管理领导</option>
                   <option value="业务理解">业务理解</option>
                   <option value="其他拓展">其他拓展</option>
                 </select>
              </div>
              <div>
                 <label className="block text-xs font-bold text-slate-600 mb-2">能力名称 *</label>
                 <input autoFocus required type="text" value={editingLibrary.name || ''} onChange={e => setEditingLibrary({...editingLibrary, name: e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500" placeholder="例如：前端架构设计"/>
              </div>
              <div>
                 <label className="block text-xs font-bold text-slate-600 mb-2">能力满分基准</label>
                 <input type="number" step="0.5" value={editingLibrary.default_max_score || 5} onChange={e => setEditingLibrary({...editingLibrary, default_max_score: Number(e.target.value)})} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500" placeholder="5" />
              </div>
              <div>
                 <label className="block text-xs font-bold text-slate-600 mb-2">能力解读与评价标准</label>
                 <textarea rows={3} value={editingLibrary.description || ''} onChange={e => setEditingLibrary({...editingLibrary, description: e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 resize-none" placeholder="描述该能力达标所需的行为表现..." />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                 <button type="button" onClick={() => setShowLibraryModal(false)} className="px-4 py-2 font-bold text-sm text-slate-600 hover:bg-slate-100 rounded-lg">取消</button>
                 <button type="submit" className="bg-indigo-600 text-white font-bold px-6 py-2 rounded-lg text-sm shadow-md hover:bg-indigo-700">保存入库</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import to Model Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowImportModal(false)}/>
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-emerald-50 text-emerald-800">
               <h3 className="font-black flex items-center gap-2 text-lg">
                  <span className="material-symbols-outlined">library_add_check</span>
                  核心能力一键导入
               </h3>
               <button onClick={() => setShowImportModal(false)} className="text-emerald-500 hover:text-emerald-700"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar bg-slate-50/50">
               <p className="text-xs text-slate-500 mb-4">点击下列能力卡片快速导入当前模型。这有助于保持公司评级体系的一致性。</p>
               <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                 {libraryList.map(lib => (
                   <div key={lib.id} className="border border-slate-200 bg-white rounded-xl p-3 hover:border-emerald-300 hover:shadow-sm cursor-pointer transition-all group relative overflow-hidden flex flex-col"
                     onClick={() => {
                       const dim = {
                         name: lib.name,
                         library_id: lib.id,
                         category: lib.category,
                         description: lib.description,
                         max_score: lib.default_max_score || 5,
                         target_score: 3, // default target
                         weight: 1
                       };
                       setEditingModel({...editingModel, dimensions: [...(editingModel.dimensions || []), dim]});
                       setShowImportModal(false);
                     }}
                   >
                     <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 group-hover:-translate-x-1 group-hover:translate-y-1 transition-all">
                       <span className="material-symbols-outlined text-emerald-500 text-[20px]">add_circle</span>
                     </div>
                     <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded self-start font-bold mb-1">{lib.category}</span>
                     <h4 className="font-black text-slate-800 text-sm mb-1">{lib.name}</h4>
                     <p className="text-[10px] text-slate-500 line-clamp-2 mt-auto">{lib.description || '暂无说明'}</p>
                   </div>
                 ))}
               </div>
               {libraryList.length === 0 && (
                 <div className="text-center py-10">
                   <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">inventory_2</span>
                   <p className="text-sm text-slate-400">预设能力库为空，请先前往 [预设能力库] 配置</p>
                 </div>
               )}
            </div>
          </div>
        </div>
      )}

      {/* Taking Test Modal */}
      {takingTestId && (
        <div className="z-[100] relative">
          <TestTakingModal 
            assignmentId={takingTestId} 
            onClose={() => setTakingTestId(null)} 
            onComplete={() => {
              setTakingTestId(null);
              fetchMyTests();
              fetchEvaluations(); // Refresh evaluations to show updated scores
              setActiveTab('evaluations');
            }} 
          />
        </div>
      )}

    </div>
  );
}
