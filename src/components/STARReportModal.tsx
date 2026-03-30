/**
 * STAR 报告填写弹窗
 * 适用于 R/A 角色在任务完成/提前完结后填写绩效报告
 */
import React, { useState, useEffect } from 'react';

interface STARReportModalProps {
  taskId: number;
  taskTitle: string;
  roleName: string; // 'R' | 'A'
  onClose: () => void;
  onSubmitted: () => void;
}

export default function STARReportModal({ taskId, taskTitle, roleName, onClose, onSubmitted }: STARReportModalProps) {
  const [form, setForm] = useState({ situation: '', task_desc: '', action: '', result: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    fetch(`/api/pool/star/${taskId}/mine`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(res => {
        if (res.code === 0 && res.data) {
          setForm({
            situation: res.data.situation || '',
            task_desc: res.data.task_desc || '',
            action: res.data.action || '',
            result: res.data.result || '',
          });
          setIsSubmitted(res.data.is_submitted === 1);
        }
      })
      .finally(() => setLoading(false));
  }, [taskId]);

  const handleSave = async (submit: boolean) => {
    if (submit) {
      const missing = [];
      if (!form.situation.trim()) missing.push('S-情境背景');
      if (!form.task_desc.trim()) missing.push('T-我的职责');
      if (!form.action.trim()) missing.push('A-我的行动');
      if (!form.result.trim()) missing.push('R-结果成效');
      if (missing.length > 0) {
        setMsg({ type: 'err', text: `请完整填写：${missing.join('、')}` });
        return;
      }
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/pool/star/${taskId}`, {
        method: 'POST', headers,
        body: JSON.stringify({ ...form, submit }),
      }).then(r => r.json());
      if (res.code === 0) {
        setMsg({ type: 'ok', text: res.message });
        if (submit) { setIsSubmitted(true); setTimeout(() => onSubmitted(), 1200); }
      } else {
        setMsg({ type: 'err', text: res.message });
      }
    } catch {
      setMsg({ type: 'err', text: '网络错误，请重试' });
    }
    setSaving(false);
  };

  const fields = [
    { key: 'situation', label: 'S — 情境背景', subtitle: '这个任务的背景和挑战是什么？', placeholder: '描述任务发生的背景、面临的挑战或问题...', icon: 'landscape', color: 'blue' },
    { key: 'task_desc', label: 'T — 我的职责', subtitle: '你在任务中负责什么？承担了哪些具体职责？', placeholder: '描述你在团队中承担的具体工作职责和目标...', icon: 'assignment_ind', color: 'purple' },
    { key: 'action', label: 'A — 我的行动', subtitle: '你具体做了什么？采取了哪些措施？', placeholder: '描述你采取的具体行动、方法和步骤...', icon: 'bolt', color: 'orange' },
    { key: 'result', label: 'R — 结果成效', subtitle: '产生了什么结果？尽量提供可量化的数据。', placeholder: '描述达成的结果、带来的价值，最好包含数字...', icon: 'emoji_events', color: 'emerald' },
  ] as const;

  const colorMap = {
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-500', label: 'text-blue-700', focus: 'focus:border-blue-400' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200', icon: 'text-purple-500', label: 'text-purple-700', focus: 'focus:border-purple-400' },
    orange: { bg: 'bg-orange-50', border: 'border-orange-200', icon: 'text-orange-500', label: 'text-orange-700', focus: 'focus:border-orange-400' },
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'text-emerald-600', label: 'text-emerald-700', focus: 'focus:border-emerald-400' },
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-[20px]">star</span>
            </div>
            <div>
              <h2 className="font-black text-slate-800 dark:text-white text-lg">STAR 绩效报告</h2>
              <p className="text-xs text-slate-400 truncate max-w-xs">{taskTitle} · {roleName === 'A' ? 'A·负责人' : 'R·执行人'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isSubmitted && (
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                ✅ 已提交
              </span>
            )}
            <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <>
              {msg && (
                <div className={`px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                  <span className="material-symbols-outlined text-[16px]">{msg.type === 'ok' ? 'check_circle' : 'error'}</span>
                  {msg.text}
                </div>
              )}
              {isSubmitted && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">lock</span>
                  STAR 报告已提交，无法再修改
                </div>
              )}
              {fields.map(f => {
                const c = colorMap[f.color];
                return (
                  <div key={f.key} className={`rounded-xl border ${c.border} overflow-hidden`}>
                    <div className={`px-4 py-2.5 ${c.bg} flex items-center gap-2`}>
                      <span className={`material-symbols-outlined text-[18px] ${c.icon}`}>{f.icon}</span>
                      <div>
                        <div className={`font-black text-sm ${c.label}`}>{f.label}</div>
                        <div className="text-[10px] text-slate-500">{f.subtitle}</div>
                      </div>
                    </div>
                    <textarea
                      value={(form as any)[f.key]}
                      onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                      disabled={isSubmitted}
                      placeholder={isSubmitted ? '' : f.placeholder}
                      rows={4}
                      className={`w-full px-4 py-3 text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 resize-none outline-none border-t ${c.border} ${c.focus} disabled:opacity-60 disabled:cursor-not-allowed`}
                    />
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Footer */}
        {!isSubmitted && !loading && (
          <div className="p-6 border-t border-slate-200/60 flex gap-3">
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              {saving ? '保存中...' : '💾 保存草稿'}
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="flex-2 px-6 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              {saving ? '提交中...' : '确认提交（不可撤回）'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
