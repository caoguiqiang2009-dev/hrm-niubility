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
    <div className={`px-4 py-3 bg-slate-50/80 border border-slate-200 shrink-0 rounded-xl mx-4 mb-4 ${className}`}>
      <div className="flex items-center gap-1.5 mb-2.5">
        <span className="material-symbols-outlined text-[13px] text-slate-400">route</span>
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">动态审批轨迹</span>
        {codePrefix && (
          <span className="text-[9px] font-mono text-slate-300 ml-0.5">
            {codePrefix}-{String(businessId).padStart(6, '0')}
          </span>
        )}
      </div>
      
      {/* Horizontal Scroll Area */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {steps.map((step, idx) => {
          
          let bg = 'bg-slate-100 border-slate-200 text-slate-500'; // future
          let icon = 'schedule';
          
          if (step.status === 'past') {
            bg = 'bg-emerald-50 border-emerald-200 text-emerald-700';
            icon = 'check_circle';
          } else if (step.status === 'current') {
            bg = 'bg-blue-50 border-blue-300 text-blue-700 shadow-sm animate-pulse';
            icon = 'hourglass_bottom';
          } else if (step.status === 'rejected') {
            bg = 'bg-red-50 border-red-200 text-red-600';
            icon = 'cancel';
          } else if (step.status === 'skipped') {
            bg = 'bg-slate-50 border-slate-200 border-dashed text-slate-400';
            icon = 'fast_forward';
          }

          // Format assignee string
          const userStr = step.assignees?.map(u => u.name).join(' / ') || '无';

          return (
            <React.Fragment key={idx}>
              <div className={`flex flex-col flex-shrink-0 min-w-[120px] max-w-[180px] p-2 rounded-lg border ${bg} transition-all`}>
                <div className="flex items-center gap-1 mb-1 relative">
                  <span className="material-symbols-outlined text-[12px]">{icon}</span>
                  <span className="text-[10px] font-bold truncate pr-4">{step.name}</span>
                  
                  {/* Tags */}
                  {step.is_auto_skipped && (
                     <span className="absolute top-0 right-0 text-[8px] bg-white rounded-sm px-1 border uppercase text-slate-400" title="防自审跳过">Skip</span>
                  )}
                  {step.is_escalated && (
                     <span className="absolute top-0 right-0 text-[8px] bg-red-100 text-red-600 rounded-sm px-1 border border-red-200 uppercase" title="代为审批">Auto向上提取</span>
                  )}
                </div>
                
                <div className="text-[10px] truncate opacity-90 mt-0.5">
                  {step.status === 'skipped' ? '防自审批跳过' : userStr}
                </div>

                {step.timestamp && (
                  <div className="text-[9px] mt-0.5 opacity-60 font-mono tracking-tighter">
                    {formatDate(step.timestamp)}
                  </div>
                )}
              </div>
              
              {/* Arrow + Duration */}
              {idx < steps.length - 1 && (() => {
                const nextStep = steps[idx + 1];
                let durationStr = '';
                if (step.timestamp && nextStep.timestamp) {
                  const ms = new Date(nextStep.timestamp).getTime() - new Date(step.timestamp).getTime();
                  if (ms > 0) {
                    const mins = Math.floor(ms / 60000);
                    if (mins < 60) durationStr = `${mins}m`;
                    else {
                      const hrs = Math.floor(mins / 60);
                      const rm = mins % 60;
                      if (hrs < 24) durationStr = rm > 0 ? `${hrs}h${rm}m` : `${hrs}h`;
                      else {
                        const days = Math.floor(hrs / 24);
                        const rh = hrs % 24;
                        durationStr = rh > 0 ? `${days}d${rh}h` : `${days}d`;
                      }
                    }
                  }
                }
                return (
                  <div className="flex-shrink-0 flex flex-col items-center gap-0">
                    <span className="text-slate-300 material-symbols-outlined text-[16px]">chevron_right</span>
                    {durationStr && (
                      <span className="text-[8px] text-slate-400 font-mono -mt-1">{durationStr}</span>
                    )}
                  </div>
                );
              })()}
            </React.Fragment>
          );
        })}
      </div>
      
      {/* Reject comment if any */}
      {steps.some(s => s.status === 'rejected' && s.comment) && (
        <div className="mt-2 p-2 rounded-lg bg-red-50/50 border border-red-100/50 text-red-600 text-[10px] flex items-start gap-1">
           <span className="material-symbols-outlined text-[12px] mt-0.5">info</span>
           <div>
             <span className="font-bold">驳回原因：</span>
             {steps.find(s => s.status === 'rejected')?.comment}
           </div>
        </div>
      )}
    </div>
  );
}
