import React, { useState, useEffect } from 'react';

interface DialogState {
  type: 'confirm' | 'error' | 'success';
  title: string;
  message: React.ReactNode;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
}

export default function TestTakingModal({ assignmentId, onClose, onComplete }: { assignmentId: number, onClose: () => void, onComplete: () => void }) {
  const [assignment, setAssignment] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  
  useEffect(() => {
    fetchTest();
  }, [assignmentId]);

  const fetchTest = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/tests/assignment/${assignmentId}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.code === 0) {
        setAssignment(data.data.assignment);
        setQuestions(data.data.questions);
      } else {
        setDialog({ type: 'error', title: '加载失败', message: data.message, onConfirm: onClose });
      }
    } catch(e) {
      setDialog({ type: 'error', title: '加载失败', message: '网络请求或服务器错误', onConfirm: onClose });
    }
    setLoading(false);
  };

  const toggleAnswer = (qId: number, type: string, value: string) => {
    if (assignment?.status === 'completed') return;

    setAnswers(prev => {
      const current = prev[qId] || '';
      if (type === 'single') {
        return { ...prev, [qId]: value };
      } else {
        let arr = current.split(',').filter(Boolean);
        if (arr.includes(value)) arr = arr.filter(a => a !== value);
        else arr.push(value);
        return { ...prev, [qId]: arr.sort().join(',') };
      }
    });
  };

  const handleSubmit = async () => {
    setDialog({
      type: 'confirm',
      title: '确认提交',
      message: '确定要交卷吗？交卷后将立即出分且无法修改。',
      confirmText: '确认交卷',
      onConfirm: async () => {
        setDialog(null);
        setSubmitting(true);
        try {
          const token = localStorage.getItem('token');
          const res = await fetch(`/api/tests/assignment/${assignmentId}/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ answers })
          });
          const data = await res.json();
          if (data.code === 0) {
            setDialog({
              type: 'success',
              title: '交卷成功！',
              message: (
                <div className="space-y-4 pt-2">
                  <div className="text-4xl text-emerald-500 font-bold text-center">得分：{data.data.final_score} 分</div>
                  <p className="text-sm text-slate-500 text-center dark:text-slate-400">如果该试卷关联了能力模型，您的能力评估已同步更新。</p>
                </div>
              ),
              confirmText: '完成',
              onConfirm: onComplete
            });
          } else {
            setDialog({ type: 'error', title: '交卷失败', message: data.message });
          }
        } catch(e) {
          setDialog({ type: 'error', title: '提交失败', message: '网络请求或服务器错误' });
        }
        setSubmitting(false);
      },
      onCancel: () => setDialog(null)
    });
  };

  if (loading) return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (!assignment) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface w-full max-w-3xl h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 flex justify-between items-center bg-indigo-600 text-white shrink-0">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2">
              <span className="material-symbols-outlined">description</span>
              {assignment.title}
            </h3>
            {assignment.status === 'completed' ? (
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-lg mt-1 inline-block">已完成 · 得分: {assignment.final_score}</span>
            ) : (
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-lg mt-1 inline-block">答题中</span>
            )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto bg-surface-container-lowest p-6 space-y-6">
           {assignment.description && (
             <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl text-sm text-indigo-900 leading-relaxed mb-6">
               <strong>考前须知：</strong> {assignment.description}
             </div>
           )}

           {questions.map((q, idx) => {
             const userAnsStr = answers[q.id] || '';
             const userAnsArr = userAnsStr.split(',').filter(Boolean);
             
             return (
               <div key={q.id} className="bg-surface p-6 rounded-2xl border border-outline-variant/30 shadow-sm">
                 <h4 className="text-base font-bold text-on-surface mb-4 leading-relaxed flex gap-2">
                   <span className="text-primary shrink-0">{idx + 1}.</span>
                   <span className="flex-1 pr-12 relative w-full block">
                      {q.question}
                      <span className="absolute right-0 -top-1 px-2 py-0.5 bg-surface-container rounded text-xs font-mono text-on-surface-variant shrink-0">{q.type === 'single' ? '单选' : '多选'} ({q.score}分)</span>
                   </span>
                 </h4>
                 <div className="space-y-3 pl-6">
                   {q.options.map((opt: string, oIdx: number) => {
                     const letter = String.fromCharCode(65 + oIdx);
                     const isSelected = userAnsArr.includes(letter);
                     
                     return (
                       <label key={oIdx} className={`flex items-start gap-4 p-3 rounded-xl border-2 transition-all cursor-pointer ${isSelected ? 'border-primary bg-primary/5' : 'border-outline-variant/30 hover:border-primary/40 bg-white'} ${assignment.status === 'completed' && 'cursor-default opacity-80'}`}>
                         <input 
                            type={q.type === 'single' ? "radio" : "checkbox"} 
                            name={`q_${q.id}`} 
                            className="hidden"
                            checked={isSelected}
                            disabled={assignment.status === 'completed'}
                            onChange={() => toggleAnswer(q.id, q.type, letter)}
                         />
                         <div className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center border font-bold text-xs mt-0.5 transition-colors ${isSelected ? 'bg-primary border-primary text-white' : 'border-outline text-on-surface-variant'}`}>
                           {letter}
                         </div>
                         <div className="text-sm text-on-surface mt-0.5 leading-relaxed">{opt}</div>
                       </label>
                     );
                   })}
                 </div>
               </div>
             )
           })}
        </div>
        
        <div className="px-6 py-4 border-t border-outline-variant/20 flex justify-between items-center bg-surface shrink-0">
          <div className="text-sm text-on-surface-variant font-medium">
            共 {questions.length} 题，已答 {Object.keys(answers).length} 题
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-5 py-2 rounded-xl text-on-surface font-medium hover:bg-surface-container transition-colors">取消/暂存</button>
            {assignment.status !== 'completed' && (
               <button onClick={handleSubmit} disabled={submitting} className="px-8 py-2 bg-primary text-on-primary rounded-xl font-bold shadow-sm hover:shadow-md transition-all flex items-center gap-2 disabled:opacity-50">
                 {submitting ? '交卷中...' : '提交答卷'}
                 <span className="material-symbols-outlined text-[18px]">publish</span>
               </button>
            )}
          </div>
        </div>
      </div>

      {/* 美化版的弹窗 */}
      {dialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] px-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-3xl shadow-2xl p-6 flex flex-col items-center animate-in zoom-in-95 duration-200">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 min-h-[4rem] min-w-[4rem]
              ${dialog.type === 'error' ? 'bg-red-100 text-red-500 dark:bg-red-900/40 dark:text-red-400' :
                dialog.type === 'success' ? 'bg-emerald-100 text-emerald-500 dark:bg-emerald-900/40 dark:text-emerald-400' :
                'bg-amber-100 text-amber-500 dark:bg-amber-900/40 dark:text-amber-400'}
            `}>
              <span className="material-symbols-outlined text-[32px]">
                {dialog.type === 'error' ? 'error' : dialog.type === 'success' ? 'check_circle' : 'help'}
              </span>
            </div>
            
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2 text-center">{dialog.title}</h3>
            
            <div className="text-sm text-slate-500 dark:text-slate-400 text-center mb-8 w-full">
              {dialog.message}
            </div>
            
            <div className="flex gap-3 w-full">
              {dialog.onCancel && (
                <button onClick={dialog.onCancel} className="flex-1 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 transition-colors">取消</button>
              )}
              <button 
                onClick={() => {
                  if (dialog.onConfirm) dialog.onConfirm();
                  else setDialog(null);
                }} 
                className={`flex-1 py-3 rounded-xl font-bold text-white shadow-md hover:shadow-lg transition-all
                  ${dialog.type === 'error' ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' : 
                    dialog.type === 'success' ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20' : 
                    'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'}
                `}
              >
                {dialog.confirmText || '确定'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
