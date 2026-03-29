import React, { useState, useEffect } from 'react';

interface Question {
  type: 'single' | 'multiple';
  question: string;
  options: string[];
  correct_answer: string;
  score: number;
}

interface TestBank {
  id?: number;
  title: string;
  description: string;
  mapped_library_id?: number | null;
  questions: Question[];
  competency_name?: string;
  question_count?: number;
  created_at?: string;
}

export default function TestBankManager({ navigate, isEmbedded }: { navigate?: (view: string) => void, isEmbedded?: boolean }) {
  const [banks, setBanks] = useState<TestBank[]>([]);
  const [library, setLibrary] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  
  const [editingBank, setEditingBank] = useState<TestBank>({ title: '', description: '', questions: [] });
  const [selectedBankId, setSelectedBankId] = useState<number | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  
  // AI Generation State
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiForm, setAiForm] = useState({ purpose: '', position: '', requirements: '', materials: '', count: 5 });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [extractUrl, setExtractUrl] = useState('');
  
  useEffect(() => {
    fetchBanks();
    fetchLibrary();
    fetchUsers();
  }, []);

  const fetchBanks = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/tests/bank', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.code === 0) setBanks(data.data);
    } catch(e) {}
  };

  const fetchLibrary = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/competency/library', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.code === 0) setLibrary(data.data);
    } catch(e) {}
  };

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/org/users', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.code === 0) setUsers(data.data);
    } catch(e) {}
  };

  const handleSaveBank = async () => {
    if (!editingBank.title) return alert('请输入题库名称');
    if (editingBank.questions.length === 0) return alert('请至少添加一道题');
    
    // Validate
    for (const q of editingBank.questions) {
      if (!q.question) return alert('题干不能为空');
      if (!q.correct_answer) return alert('必须设置正确答案');
      if (q.options.length < 2) return alert('至少提供2个选项');
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/tests/bank', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editingBank)
      });
      const data = await res.json();
      if (data.code === 0) {
        setShowEditModal(false);
        fetchBanks();
      } else {
        alert(data.message);
      }
    } catch(e) {
      alert('保存失败');
    }
  };

  const handleEditBank = async (bankId: number) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/tests/bank/${bankId}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.code === 0) {
        setEditingBank(data.data);
        setShowEditModal(true);
      } else {
        alert(data.message || '获取试卷详情失败');
      }
    } catch (e) {
      alert('网络请求异常');
    }
  };

  const handleAiGenerate = async () => {
    if (!aiForm.purpose && !aiForm.position) return alert('测试目的与关联岗位至少填写一项');
    setIsGenerating(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/tests/bank/generate-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(aiForm)
      });
      const data = await res.json();
      if (data.code === 0 && Array.isArray(data.data)) {
        setEditingBank(prev => ({
          ...prev,
          title: prev.title || `${aiForm.position || aiForm.purpose}能力测评试卷`,
          questions: [...prev.questions, ...data.data]
        }));
        setShowAiModal(false);
      } else {
        alert(data.message || '生成失败');
      }
    } catch (e) {
       alert('网络请求异常');
    }
    setIsGenerating(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsParsing(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = localStorage.getItem('token');
      const res = await fetch('/api/ai/extract-file', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (data.code === 0 && data.data?.text) {
        setAiForm((prev: any) => ({ ...prev, materials: (prev.materials + '\n\n【附件解析内容】:\n' + data.data.text).trim() }));
      } else {
        alert(data.message || '解析失败');
      }
    } catch (err) {
      alert('上传解析失败');
    }
    setIsParsing(false);
    e.target.value = ''; // Reset input
  };

  const handleUrlExtract = async () => {
    if (!extractUrl) return;
    setIsParsing(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/ai/extract-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ url: extractUrl })
      });
      const data = await res.json();
      if (data.code === 0 && data.data?.text) {
        setAiForm((prev: any) => ({ ...prev, materials: (prev.materials + '\n\n【网页抓取内容】:\n' + data.data.text).trim() }));
        setShowUrlInput(false);
        setExtractUrl('');
      } else {
        alert(data.message || '解析失败');
      }
    } catch (err) {
      alert('网页解析失败');
    }
    setIsParsing(false);
  };

  const handleAssign = async () => {
    if (!selectedBankId || selectedUserIds.length === 0) return alert('请选择试卷和派发人员');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/tests/bank/${selectedBankId}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ user_ids: selectedUserIds })
      });
      const data = await res.json();
      if (data.code === 0) {
        alert('派发成功！系统已向员工发送通知。');
        setShowAssignModal(false);
        setSelectedUserIds([]);
      } else {
        alert(data.message);
      }
    } catch(e) {
      alert('派发失败');
    }
  };

  return (
    <div className={`flex-1 flex flex-col h-full overflow-hidden ${isEmbedded ? '' : 'bg-surface-container-lowest'}`}>
      {!isEmbedded && (
        <div className="px-8 py-6 flex items-center justify-between border-b border-outline-variant/20 bg-surface z-10 sticky top-0">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate?.('admin')} className="p-2 hover:bg-surface-container rounded-full transition-colors">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <span className="material-symbols-outlined">quiz</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-on-surface">题库与测评</h1>
                <p className="text-sm text-on-surface-variant mt-0.5">创建能力测评试卷，并将其派发给指定人员</p>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => { setEditingBank({ title: '', description: '', questions: [] }); setShowEditModal(true); }}
              className="px-4 py-2 bg-primary text-on-primary rounded-xl font-medium shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">add</span>
              新建套卷
            </button>
          </div>
        </div>
      )}

      {isEmbedded && (
        <div className="flex justify-end mb-4 px-1">
          <button onClick={() => { setEditingBank({ title: '', description: '', questions: [] }); setShowEditModal(true); }}
            className="text-sm font-bold bg-white text-indigo-600 border border-indigo-200 px-4 py-1.5 rounded-lg shadow-sm hover:bg-indigo-50 transition-colors flex items-center gap-1">
            <span className="material-symbols-outlined text-[18px]">add</span> 新建套卷
          </button>
        </div>
      )}

      <div className={`${isEmbedded ? 'pb-8' : 'p-8'} overflow-y-auto`}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {banks.map((bank) => (
            <div key={bank.id} 
                 onClick={() => handleEditBank(bank.id!)}
                 className="bg-surface rounded-2xl border border-outline-variant/20 p-6 flex flex-col cursor-pointer hover:border-primary/40 hover:shadow-md transition-all group">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-bold text-lg text-on-surface line-clamp-1 group-hover:text-primary transition-colors">{bank.title}</h3>
                <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 ml-2">
                  {bank.question_count} 题
                </span>
              </div>
              <p className="text-sm text-on-surface-variant line-clamp-2 mb-4 h-10">{bank.description}</p>
              
              <div className="mt-auto pt-4 border-t border-outline-variant/20 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                  <span className="material-symbols-outlined text-[14px]">link</span>
                  关联维度: {bank.competency_name || '未关联'}
                </div>
                
                <div className="flex gap-2">
                  <button onClick={(e) => { e.stopPropagation(); setSelectedBankId(bank.id!); setShowAssignModal(true); }}
                    className="flex-1 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-sm font-bold transition-colors">
                    派发测试
                  </button>
                </div>
              </div>
            </div>
          ))}
          {banks.length === 0 && (
            <div className="col-span-full py-12 flex flex-col items-center justify-center text-on-surface-variant opacity-60">
              <span className="material-symbols-outlined text-4xl mb-4">inbox</span>
              <p>暂无测评题库，请点击右上角新建</p>
            </div>
          )}
        </div>
      </div>

      {showEditModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface w-full max-w-3xl h-[85vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-outline-variant/20 flex justify-between items-center bg-surface shrink-0">
              <h3 className="text-lg font-bold">新建/编辑试卷</h3>
              <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-surface-container rounded-full">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 bg-surface-container-lowest">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold mb-2">试卷名称</label>
                  <input type="text" value={editingBank.title} onChange={e => setEditingBank({...editingBank, title: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary outline-none" placeholder="如：前端高级工程师定级测试" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">试卷说明</label>
                  <textarea value={editingBank.description} onChange={e => setEditingBank({...editingBank, description: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary outline-none min-h-[80px]" placeholder="测试的目的、注意事项等"></textarea>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">自动评估关联维度</label>
                  <select value={editingBank.mapped_library_id || ''} onChange={e => setEditingBank({...editingBank, mapped_library_id: e.target.value ? Number(e.target.value) : undefined})} className="w-full px-4 py-2.5 rounded-xl border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary outline-none">
                    <option value="">-- 不自动覆盖能力模型分 --</option>
                    {library.map(lib => (
                      <option key={lib.id} value={lib.id}>{lib.category} - {lib.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-on-surface-variant mt-1">关联后，员工提交试卷会自动折算成分数写入个人的此项能力评估中。</p>
                </div>

                <div className="border-t border-outline-variant/20 pt-6">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-bold text-lg">题目列表 ({editingBank.questions.length})</h4>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setShowAiModal(true)}
                        className="px-3 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm font-bold rounded-lg flex items-center gap-1 shadow-sm hover:shadow-md transition-all active:scale-95">
                        <span className="material-symbols-outlined text-[16px]">smart_toy</span> AI一键出卷
                      </button>
                      <button onClick={() => setEditingBank({...editingBank, questions: [...editingBank.questions, { type: 'single', question: '', options: ['','','',''], correct_answer: 'A', score: 10 }]})}
                        className="px-3 py-1.5 bg-secondary-container text-on-secondary-container text-sm font-bold rounded-lg flex items-center gap-1 hover:brightness-95">
                        <span className="material-symbols-outlined text-[16px]">add</span> 手动加题
                      </button>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {editingBank.questions.map((q, idx) => (
                      <div key={idx} className="bg-surface p-5 rounded-2xl border border-outline-variant/20 shadow-sm relative">
                        <button onClick={() => {
                          const nq = [...editingBank.questions];
                          nq.splice(idx, 1);
                          setEditingBank({...editingBank, questions: nq});
                        }} className="absolute top-4 right-4 p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>

                        <div className="flex gap-4 mb-4">
                          <div className="w-32">
                            <label className="block text-xs font-bold mb-1">题型</label>
                            <select value={q.type} onChange={e => {
                              const nq = [...editingBank.questions];
                              nq[idx].type = e.target.value as any;
                              setEditingBank({...editingBank, questions: nq});
                            }} className="w-full p-2 rounded-lg border border-outline-variant text-sm bg-surface">
                              <option value="single">单选题</option>
                              <option value="multiple">多选题</option>
                            </select>
                          </div>
                          <div className="flex-1">
                            <label className="block text-xs font-bold mb-1">题干</label>
                            <input value={q.question} onChange={e => {
                              const nq = [...editingBank.questions];
                              nq[idx].question = e.target.value;
                              setEditingBank({...editingBank, questions: nq});
                            }} className="w-full p-2 rounded-lg border border-outline-variant text-sm" placeholder="请输入题目内容" />
                          </div>
                          <div className="w-24">
                            <label className="block text-xs font-bold mb-1">分值</label>
                            <input type="number" value={q.score} onChange={e => {
                              const nq = [...editingBank.questions];
                              nq[idx].score = Number(e.target.value);
                              setEditingBank({...editingBank, questions: nq});
                            }} className="w-full p-2 rounded-lg border border-outline-variant text-sm" />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold mb-2">选项及答案</label>
                          <div className="space-y-2 mb-3">
                            {q.options.map((opt, oIdx) => {
                              const letter = String.fromCharCode(65 + oIdx);
                              const isCorrect = q.correct_answer.split(',').includes(letter);
                              return (
                                <div key={oIdx} className="flex items-center gap-2">
                                  <button onClick={() => {
                                    const nq = [...editingBank.questions];
                                    if (q.type === 'single') {
                                      nq[idx].correct_answer = letter;
                                    } else {
                                      let ansArr = q.correct_answer.split(',').filter(Boolean);
                                      if (ansArr.includes(letter)) ansArr = ansArr.filter(a => a !== letter);
                                      else ansArr.push(letter);
                                      nq[idx].correct_answer = ansArr.sort().join(',');
                                    }
                                    setEditingBank({...editingBank, questions: nq});
                                  }} className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold shrink-0 transition-colors ${isCorrect ? 'bg-green-500 border-green-500 text-white' : 'border-outline-variant text-on-surface-variant hover:border-green-300'}`}>
                                    {letter}
                                  </button>
                                  <input value={opt} onChange={e => {
                                    const nq = [...editingBank.questions];
                                    nq[idx].options[oIdx] = e.target.value;
                                    setEditingBank({...editingBank, questions: nq});
                                  }} className="flex-1 p-2 rounded-lg border border-outline-variant text-sm bg-surface-container-lowest" placeholder={`选项内容`} />
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => {
                              const nq = [...editingBank.questions];
                              nq[idx].options.push('');
                              setEditingBank({...editingBank, questions: nq});
                            }} className="text-xs text-primary font-bold hover:underline">
                              + 添加选项
                            </button>
                            {q.options.length > 2 && (
                                <button onClick={() => {
                                  const nq = [...editingBank.questions];
                                  nq[idx].options.pop();
                                  setEditingBank({...editingBank, questions: nq});
                                }} className="text-xs text-red-500 font-bold hover:underline">
                                  - 移除选项
                                </button>
                            )}
                          </div>
                        </div>

                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
            <div className="px-6 py-4 border-t border-outline-variant/20 flex gap-3 justify-end bg-surface shrink-0">
              <button onClick={() => setShowEditModal(false)} className="px-5 py-2 rounded-xl text-on-surface font-medium hover:bg-surface-container transition-colors">取消</button>
              <button onClick={handleSaveBank} className="px-5 py-2 bg-primary text-on-primary rounded-xl font-bold shadow-sm hover:shadow-md transition-all">保存试卷</button>
            </div>
          </div>
        </div>
      )}

      {showAssignModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface w-[500px] rounded-3xl shadow-2xl flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-outline-variant/20 flex justify-between items-center bg-surface shrink-0">
              <h3 className="text-lg font-bold">派发测评</h3>
              <button onClick={() => setShowAssignModal(false)} className="p-2 hover:bg-surface-container rounded-full">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm font-bold mb-3">选择派发对象人员：</p>
              <div className="h-64 border border-outline-variant/20 rounded-xl overflow-y-auto w-full p-2 bg-surface">
                 {users.map(u => (
                   <label key={u.id} className="flex items-center gap-3 p-2 hover:bg-surface-container rounded-lg cursor-pointer transition-colors">
                     <input type="checkbox" checked={selectedUserIds.includes(u.id)} onChange={e => {
                       if(e.target.checked) setSelectedUserIds([...selectedUserIds, u.id]);
                       else setSelectedUserIds(selectedUserIds.filter(id => id !== u.id));
                     }} className="w-4 h-4 rounded text-primary focus:ring-primary border-outline" />
                     <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden shrink-0">
                       <img src={u.avatar_url || '/default-avatar.png'} alt="" className="w-full h-full object-cover" />
                     </div>
                     <div>
                       <div className="text-sm font-bold">{u.name}</div>
                       <div className="text-xs text-on-surface-variant">{u.department || '未分配部门'}</div>
                     </div>
                   </label>
                 ))}
                 {users.length === 0 && <p className="text-center text-sm text-on-surface-variant p-4">没有可用人员数据</p>}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-outline-variant/20 flex gap-3 justify-end bg-surface shrink-0">
              <button onClick={() => setShowAssignModal(false)} className="px-5 py-2 rounded-xl text-on-surface font-medium hover:bg-surface-container transition-colors">取消</button>
              <button onClick={handleAssign} className="px-5 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow-sm hover:bg-indigo-700 transition-all flex items-center gap-2">
                 <span className="material-symbols-outlined text-[18px]">send</span>确认派发 ({selectedUserIds.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Generate Modal */}
      {showAiModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4 text-slate-800">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-xl flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-indigo-50/50 dark:bg-slate-900">
              <h3 className="text-lg font-black text-indigo-700 dark:text-indigo-400 flex items-center gap-2">
                <span className="material-symbols-outlined animate-pulse">smart_toy</span> AI 智能命题助手
              </h3>
              <button disabled={isGenerating} onClick={() => setShowAiModal(false)} className="text-slate-400 hover:bg-slate-200 p-1.5 rounded-lg"><span className="material-symbols-outlined text-[20px]">close</span></button>
            </div>
            
            <div className="p-5 space-y-4 text-sm font-['Inter']">
              <div className="bg-blue-50 text-blue-700 p-3 rounded-xl border border-blue-100 flex items-start gap-2 text-xs mb-2">
                <span className="material-symbols-outlined text-[16px]">lightbulb</span>
                提供测试意图或应聘岗位信息，AI将为您量身定制专业测评考题并自动插入到试卷中。
              </div>
              
              <div className="space-y-1">
                 <label className="font-bold text-slate-700 dark:text-slate-300">测试目的</label>
                 <input type="text" value={aiForm.purpose} onChange={e => setAiForm({...aiForm, purpose: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-400 focus:bg-white" placeholder="如：评估候选人的系统架构设计能力..." />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                   <label className="font-bold text-slate-700 dark:text-slate-300">关联岗位</label>
                   <input type="text" value={aiForm.position} onChange={e => setAiForm({...aiForm, position: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-400 focus:bg-white" placeholder="如：高级Golang工程师" />
                </div>
                <div className="space-y-1">
                   <label className="font-bold text-slate-700 dark:text-slate-300">拟生成题数</label>
                   <input type="number" min={1} max={20} value={aiForm.count} onChange={e => setAiForm({...aiForm, count: Number(e.target.value)})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-400 focus:bg-white" />
                </div>
              </div>

              <div className="space-y-1">
                 <label className="font-bold text-slate-700 dark:text-slate-300">岗位职能要求</label>
                 <textarea rows={2} value={aiForm.requirements} onChange={e => setAiForm({...aiForm, requirements: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-400 focus:bg-white resize-none" placeholder="任职资格或软硬技能要求..."></textarea>
              </div>
              
              <div className="space-y-1 relative">
                 <div className="flex justify-between items-end mb-1">
                   <label className="font-bold text-slate-700 dark:text-slate-300">参考材料 (选填)</label>
                   <div className="flex gap-2">
                     <button onClick={() => setShowUrlInput(!showUrlInput)} className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-1 rounded">
                       <span className="material-symbols-outlined text-[14px]">link</span> 导入网页
                     </button>
                     <label className="text-xs flex items-center gap-1 text-slate-600 hover:text-slate-800 bg-slate-100 px-2 py-1 rounded cursor-pointer">
                       <span className="material-symbols-outlined text-[14px]">attach_file</span> 上传文档
                       <input type="file" className="hidden" accept=".pdf,.txt,.md,.csv" onChange={handleFileUpload} disabled={isParsing} />
                     </label>
                   </div>
                 </div>

                 {showUrlInput && (
                   <div className="flex gap-2 mb-2 p-2 bg-slate-100 rounded-lg border border-slate-200">
                     <input type="text" value={extractUrl} onChange={e => setExtractUrl(e.target.value)} placeholder="输入公众号文章或公开网页链接..." className="flex-1 px-2 py-1 text-sm bg-white border border-slate-200 rounded outline-none" />
                     <button onClick={handleUrlExtract} disabled={isParsing} className="px-3 py-1 bg-blue-600 text-white text-sm rounded shadow-sm disabled:opacity-50 whitespace-nowrap">
                       {isParsing ? '解析中...' : '提取'}
                     </button>
                   </div>
                 )}

                 <textarea rows={4} value={aiForm.materials} onChange={e => setAiForm({...aiForm, materials: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-400 focus:bg-white resize-y" placeholder={isParsing ? "正在努力解析资源中..." : "输入相关规范、面试提纲、SOP等，让生成的题目更具业务场景约束...\n也支持通过右上方按钮直接导入外部链接或文档。"}></textarea>
              </div>
            </div>
            
            <div className="px-5 py-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 flex justify-end gap-3">
              <button disabled={isGenerating} onClick={() => setShowAiModal(false)} className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-200 rounded-lg text-sm">取消</button>
              <button disabled={isGenerating} onClick={handleAiGenerate} className="px-5 py-2 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md flex items-center gap-2 text-sm transition-all disabled:opacity-70 disabled:cursor-not-allowed">
                {isGenerating ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> 解析生成中...</> : <><span className="material-symbols-outlined text-[18px]">auto_awesome</span> 一键生成</>}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
