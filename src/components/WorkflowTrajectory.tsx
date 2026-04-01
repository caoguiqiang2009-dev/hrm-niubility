import React, { useEffect, useState } from 'react';

interface TrajectoryStep {
  seq: number;
  name: string;
  status: 'past' | 'current' | 'future' | 'skipped' | 'rejected';
  assignees: { id: string; name: string }[];
  is_auto_skipped?: boolean;
  is_escalated?: boolean;
  actual_reviewer_id?: string;
  comment?: string;
  timestamp?: string;
}

interface WorkflowTrajectoryProps {
  businessType: 'perf_plan' | 'proposal' | 'reward_plan';
  businessId: number | string;
  codePrefix?: string; // e.g. 'PF', 'PL'
  className?: string;  // allows caller to layout it correctly (e.g. mb-4, px-4)
}

function formatDate(ds?: string) {
  if (!ds) return '';
  const d = new Date(ds);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

export default function WorkflowTrajectory({ businessType, businessId, codePrefix, className = '' }: WorkflowTrajectoryProps) {
  const [steps, setSteps] = useState<TrajectoryStep[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId) return;
    setLoading(true);
    fetch(`/api/workflow/trajectory/${businessType}/${businessId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
      .then(r => r.json())
      .then(res => {
        if (res.code === 0) setSteps(res.data || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [businessType, businessId]);

  if (loading) {
    return (
      <div className={`p-4 border-t border-slate-200 bg-slate-50/80 shrink-0 ${className} animate-pulse`}>
         <div className="h-4 w-24 bg-slate-200 rounded mb-2"></div>
         <div className="flex gap-2"><div className="h-6 w-20 bg-slate-200 rounded-full"></div></div>
      </div>
    );
  }

  if (steps.length === 0) return null;

  return (
    <div className={`px-4 py-1.5 bg-slate-50/80 border border-slate-200 shrink-0 rounded-lg mx-4 mb-3 ${className}`}>
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
        <span className="material-symbols-outlined text-[11px] text-slate-400 shrink-0">route</span>
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider shrink-0">动态审批轨迹</span>
        {codePrefix && (
          <span className="text-[8px] font-mono text-slate-300 shrink-0">
            {codePrefix}-{String(businessId).padStart(6, '0')}
          </span>
        )}
        <span className="text-slate-200 mx-0.5 shrink-0">|</span>
        {steps.map((step, idx) => {
          let dotColor = 'bg-slate-300'; // future
          if (step.status === 'past') dotColor = 'bg-emerald-400';
          else if (step.status === 'current') dotColor = 'bg-blue-500 animate-pulse';
          else if (step.status === 'rejected') dotColor = 'bg-red-400';
          else if (step.status === 'skipped') dotColor = 'bg-slate-300 opacity-40';

          const userStr = step.assignees?.map(u => u.name).join('/') || '无';

          return (
            <React.Fragment key={idx}>
              <div className="flex items-center gap-1 shrink-0">
                <span className={`w-1.5 h-1.5 rounded-full ${dotColor} shrink-0`} />
                <span className="text-[10px] font-bold text-slate-600 whitespace-nowrap">{step.name}</span>
                <span className="text-[9px] text-slate-400 whitespace-nowrap">{step.status === 'skipped' ? '跳过' : userStr}</span>
              </div>
              {idx < steps.length - 1 && (
                <span className="text-slate-300 text-[10px] shrink-0">›</span>
              )}
            </React.Fragment>
          );
        })}
      </div>
      {steps.some(s => s.status === 'rejected' && s.comment) && (
        <div className="text-[9px] text-red-500 mt-0.5 truncate">
          <span className="font-bold">驳回：</span>{steps.find(s => s.status === 'rejected')?.comment}
        </div>
      )}
    </div>
  );
}
