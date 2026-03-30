/**
 * 奖励分配方案弹窗（A 角色专用）
 * 实时校验奖金总额，不超过奖金池
 */
import React, { useState, useEffect } from 'react';

interface Distribution {
  user_id: string;
  name: string;
  role_name: string;
  star_submitted: boolean;
  bonus_amount: number;
  perf_score: number;
}

interface RewardDistributionModalProps {
  taskId: number;
  taskTitle: string;
  totalBonus: number;
  rewardType: string;
  onClose: () => void;
  onSubmitted: () => void;
}

export default function RewardDistributionModal({
  taskId, taskTitle, totalBonus, rewardType, onClose, onSubmitted
}: RewardDistributionModalProps) {
  const [plan, setPlan] = useState<any>(null);
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    fetch(`/api/pool/rewards/initiate/${taskId}`, { method: 'POST', headers })
      .then(r => r.json())
      .then(res => {
        if (res.code === 0) {
          setPlan(res.data.plan);
          setMembers(res.data.members || []);
          const dists = (res.data.distributions || []).map((d: any) => ({
            user_id: d.user_id,
            name: d.name || d.user_id,
            role_name: d.role_name,
            star_submitted: (res.data.members || []).find((m: any) => m.user_id === d.user_id)?.star_submitted || false,
            bonus_amount: d.bonus_amount || 0,
            perf_score: d.perf_score || 0,
          }));
          setDistributions(dists);
          setAttachments(JSON.parse(res.data.plan?.attachments || '[]'));
        } else {
          setMsg({ type: 'err', text: res.message });
        }
      })
      .catch(() => setMsg({ type: 'err', text: '加载失败，请重试' }))
      .finally(() => setLoading(false));
  }, [taskId]);

  const totalAllocated = distributions.reduce((s, d) => s + (Number(d.bonus_amount) || 0), 0);
  const remaining = totalBonus - totalAllocated;
  const pct = totalBonus > 0 ? Math.min((totalAllocated / totalBonus) * 100, 100) : 0;
  const isOverBudget = remaining < 0;
  const allStarDone = members.every(m => m.star_submitted);

  const updateDist = (userId: string, field: 'bonus_amount' | 'perf_score', value: string) => {
    setDistributions(prev => prev.map(d => d.user_id === userId ? { ...d, [field]: parseFloat(value) || 0 } : d));
  };

  const handleSave = async () => {
    if (!plan) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/pool/rewards/${plan.id}`, {
        method: 'PUT', headers,
        body: JSON.stringify({ distributions, attachments }),
      }).then(r => r.json());
      setMsg(res.code === 0 ? { type: 'ok', text: '草稿已保存' } : { type: 'err', text: res.message });
    } catch { setMsg({ type: 'err', text: '网络错误' }); }
    setSaving(false);
  };

  const handleSubmit = async () => {
    if (!plan || isOverBudget) return;
    setSubmitting(true);
    // 先保存
    await fetch(`/api/pool/rewards/${plan.id}`, {
      method: 'PUT', headers,
      body: JSON.stringify({ distributions, attachments }),
    });
    // 再提交
    const res = await fetch(`/api/pool/rewards/${plan.id}/submit`, {
      method: 'POST', headers,
      body: JSON.stringify({}),
    }).then(r => r.json());
    if (res.code === 0) {
      setMsg({ type: 'ok', text: res.message });
      setTimeout(() => onSubmitted(), 1500);
    } else {
      setMsg({ type: 'err', text: res.message });
    }
    setSubmitting(false);
  };

  const handleRemind = async () => {
    const res = await fetch(`/api/pool/star/${taskId}/remind`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json());
    setMsg(res.code === 0 ? { type: 'ok', text: `已催办 ${res.data?.length || 0} 位成员` } : { type: 'err', text: res.message });
  };

  const barColor = isOverBudget ? 'bg-red-500' : pct === 100 ? 'bg-emerald-500' : 'bg-amber-400';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-[20px]">workspace_premium</span>
            </div>
            <div>
              <h2 className="font-black text-slate-800 dark:text-white text-lg">奖励分配方案</h2>
              <p className="text-xs text-slate-400 truncate max-w-xs">{taskTitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <>
              {msg && (
                <div className={`px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                  <span className="material-symbols-outlined text-[16px]">{msg.type === 'ok' ? 'check_circle' : 'error'}</span>
                  {msg.text}
                  <button onClick={() => setMsg(null)} className="ml-auto text-xs opacity-60">✕</button>
                </div>
              )}

              {/* 奖金池进度 */}
              {rewardType !== 'score' && (
                <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 border border-slate-200/60">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-slate-700 dark:text-white">任务奖金池</span>
                    <span className={`text-sm font-black ${isOverBudget ? 'text-red-600' : remaining === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {isOverBudget
                        ? `⚠️ 超出 ¥${Math.abs(remaining).toFixed(2)}`
                        : remaining === 0
                        ? `✅ 完整分配`
                        : `还剩 ¥${remaining.toFixed(2)}`}
                    </span>
                  </div>
                  <div className="relative h-3 bg-slate-200 rounded-full overflow-hidden mb-2">
                    <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>已分配：<strong className="text-slate-600">¥{totalAllocated.toFixed(2)}</strong></span>
                    <span>总奖金池：<strong className="text-slate-600">¥{totalBonus.toFixed(2)}</strong></span>
                  </div>
                  {remaining > 0 && (
                    <p className="text-[10px] text-amber-600 mt-1">💡 未分配部分将显示为「部分分配」状态，HR 审核时可调整</p>
                  )}
                </div>
              )}

              {/* STAR 状态总览 */}
              {!allStarDone && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-700 text-sm">
                    <span className="material-symbols-outlined text-[16px]">warning</span>
                    <span>还有成员未提交 STAR，提交分配方案前需全部完成</span>
                  </div>
                  <button onClick={handleRemind} className="text-xs px-3 py-1.5 bg-amber-500 text-white rounded-lg font-bold hover:bg-amber-600">
                    一键催办
                  </button>
                </div>
              )}

              {/* 参与人分配列表 */}
              <div className="space-y-2">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">参与人员分配</h3>
                {distributions.map(d => (
                  <div key={d.user_id} className={`rounded-xl border p-4 ${d.star_submitted ? 'border-slate-200/60' : 'border-amber-200 bg-amber-50/40'}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${d.role_name === 'A' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                        {d.role_name}
                      </div>
                      <div>
                        <span className="font-bold text-slate-800 dark:text-white text-sm">{d.name}</span>
                        <span className="text-[10px] text-slate-400 ml-1">{d.role_name === 'A' ? '负责人' : '执行人'}</span>
                      </div>
                      <div className="ml-auto">
                        {d.star_submitted
                          ? <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-bold">✅ STAR已提交</span>
                          : <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 font-bold">⏳ STAR未填写</span>}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {rewardType !== 'score' && (
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">奖金分配</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">¥</span>
                            <input
                              type="number" min="0" step="0.01"
                              value={d.bonus_amount || ''}
                              onChange={e => updateDist(d.user_id, 'bonus_amount', e.target.value)}
                              className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-amber-400"
                              placeholder="0.00"
                            />
                          </div>
                        </div>
                      )}
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">绩效加分</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">+</span>
                          <input
                            type="number" min="0" step="0.5"
                            value={d.perf_score || ''}
                            onChange={e => updateDist(d.user_id, 'perf_score', e.target.value)}
                            className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-violet-400"
                            placeholder="0"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 附件上传区 */}
              <div>
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2">验收附件 <span className="text-red-500">*</span></h3>
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center">
                  <span className="material-symbols-outlined text-slate-300 text-4xl block mb-2">upload_file</span>
                  <p className="text-sm text-slate-500">点击上传验收截图/报告（支持图片/PDF/文档）</p>
                  <p className="text-[10px] text-slate-400 mt-1">附件是奖励分配方案的必要凭证</p>
                  {/* 简化：实际接入 /api/uploads */}
                  <input type="text" placeholder="粘贴文件链接..." value={attachments[0] || ''}
                    onChange={e => setAttachments(e.target.value ? [e.target.value] : [])}
                    className="mt-3 w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-600 focus:outline-none focus:border-blue-300"
                  />
                  {attachments.length > 0 && attachments[0] && (
                    <p className="text-[10px] text-emerald-600 mt-1">✅ 已添加 {attachments.length} 个附件</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && (
          <div className="p-6 border-t border-slate-200/60 flex gap-3">
            <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
              {saving ? '保存中...' : '💾 保存草稿'}
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || isOverBudget || !allStarDone || attachments.length === 0 || !attachments[0]}
              className="flex-2 px-6 py-2.5 bg-gradient-to-r from-orange-400 to-amber-500 text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-40 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[16px]">send</span>
              {submitting ? '提交中...' : `提交 HR 审核 →`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
