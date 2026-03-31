import React, { useEffect, useState } from 'react';

interface AuditLog {
  id: number;
  business_type: string;
  business_id: number;
  actor_id: string;
  actor_name: string;
  action: string;
  from_status: string | null;
  to_status: string | null;
  comment: string | null;
  extra_json: string | null;
  created_at: string;
}

interface AuditTimelineProps {
  businessType: string;
  businessId: number | string;
  className?: string;
}

const ACTION_LABELS: Record<string, string> = {
  create: '创建',
  submit: '提交审批',
  resubmit: '重新提交',
  approve: '审批通过',
  reject: '驳回',
  withdraw: '撤回',
  status_change: '状态变更',
  progress_update: '进度更新',
  transfer: '转交',
  mark_paid: '标记发放',
  assess: '评级',
  dispatch: '下发任务',
  confirm_receipt: '签收确认',
  reject_receipt: '拒绝签收',
  start_task: '启动任务',
  publish: '发布',
  hr_approve: 'HR审核通过',
  admin_approve: '总经理审批通过',
};

const STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  pending_review: '待审批',
  pending_hr: '待HR审核',
  pending_admin: '待总经理审批',
  pending_dt: '待金主验收',
  pending_dept_review: '待部门审批',
  pending_receipt: '待签收',
  pending_assessment: '待评级',
  approved: '已通过',
  rejected: '已驳回',
  in_progress: '进行中',
  assessed: '已结案',
  completed: '已完成',
  paid: '已发放',
  published: '已发布',
  rewarded: '已发放奖励',
};

function getActionIcon(action: string): { icon: string; color: string } {
  switch (action) {
    case 'create': return { icon: 'add_circle', color: 'text-slate-400' };
    case 'submit': case 'resubmit': return { icon: 'send', color: 'text-blue-500' };
    case 'approve': case 'hr_approve': case 'admin_approve': return { icon: 'check_circle', color: 'text-emerald-500' };
    case 'reject': return { icon: 'cancel', color: 'text-red-500' };
    case 'withdraw': return { icon: 'undo', color: 'text-orange-500' };
    case 'status_change': return { icon: 'swap_horiz', color: 'text-indigo-500' };
    case 'progress_update': return { icon: 'trending_up', color: 'text-cyan-500' };
    case 'transfer': return { icon: 'swap_horizontal_circle', color: 'text-purple-500' };
    case 'mark_paid': return { icon: 'payments', color: 'text-emerald-600' };
    case 'assess': return { icon: 'grade', color: 'text-amber-500' };
    case 'confirm_receipt': return { icon: 'task_alt', color: 'text-emerald-500' };
    case 'reject_receipt': return { icon: 'block', color: 'text-red-400' };
    default: return { icon: 'circle', color: 'text-slate-400' };
  }
}

function formatTimestamp(ts: string): { date: string; time: string; relative: string } {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  let relative = '';
  if (diffMins < 1) relative = '刚刚';
  else if (diffMins < 60) relative = `${diffMins}分钟前`;
  else if (diffHrs < 24) relative = `${diffHrs}小时前`;
  else if (diffDays < 7) relative = `${diffDays}天前`;
  else relative = `${d.getMonth() + 1}/${d.getDate()}`;

  return {
    date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
    relative
  };
}

function formatDuration(ms: number): string {
  if (ms < 60000) return '< 1分钟';
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}分钟`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hrs < 24) return remMins > 0 ? `${hrs}h${remMins}m` : `${hrs}小时`;
  const days = Math.floor(hrs / 24);
  const remHrs = hrs % 24;
  return remHrs > 0 ? `${days}天${remHrs}h` : `${days}天`;
}

export default function AuditTimeline({ businessType, businessId, className = '' }: AuditTimelineProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    if (!businessId) return;
    setLoading(true);
    fetch(`/api/workflow/trajectory/audit-log/${businessType}/${businessId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
      .then(r => r.json())
      .then(res => {
        if (res.code === 0) setLogs(res.data || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [businessType, businessId]);

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-3 w-20 bg-slate-200 rounded mb-2"></div>
        <div className="h-8 w-full bg-slate-100 rounded-lg"></div>
      </div>
    );
  }

  if (logs.length === 0) return null;

  // Filter out progress_update noise when collapsed
  const significantLogs = logs.filter(l => l.action !== 'progress_update');
  const displayLogs = collapsed ? significantLogs.slice(-5) : logs;

  return (
    <div className={`${className}`}>
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-1.5 mb-3 group cursor-pointer w-full text-left"
      >
        <span className="material-symbols-outlined text-[13px] text-indigo-400">history</span>
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          审计轨迹
        </span>
        <span className="text-[9px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full font-bold">
          {logs.length}条
        </span>
        <span className="material-symbols-outlined text-[12px] text-slate-300 ml-auto transition-transform group-hover:text-slate-500" style={{ transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}>
          expand_more
        </span>
      </button>

      {/* Timeline */}
      <div className="relative pl-5">
        {/* Vertical line */}
        <div className="absolute left-[7px] top-1 bottom-1 w-[2px] bg-gradient-to-b from-indigo-200 via-slate-200 to-transparent rounded-full"></div>

        {displayLogs.map((log, idx) => {
          const { icon, color } = getActionIcon(log.action);
          const ts = formatTimestamp(log.created_at);
          const actionLabel = ACTION_LABELS[log.action] || log.action;

          // Compute duration to next step
          let duration = '';
          const nextLog = logs[logs.indexOf(log) + 1];
          if (nextLog) {
            const ms = new Date(nextLog.created_at).getTime() - new Date(log.created_at).getTime();
            if (ms > 60000) duration = formatDuration(ms);
          }

          // Status transition text
          let statusText = '';
          if (log.from_status && log.to_status) {
            statusText = `${STATUS_LABELS[log.from_status] || log.from_status} → ${STATUS_LABELS[log.to_status] || log.to_status}`;
          } else if (log.to_status) {
            statusText = STATUS_LABELS[log.to_status] || log.to_status;
          }

          // Extra info
          let extraInfo = '';
          if (log.extra_json) {
            try {
              const extra = JSON.parse(log.extra_json);
              if (extra.score != null) extraInfo = `评分: ${extra.score}`;
              if (extra.from != null && extra.to != null) extraInfo = `${extra.from}% → ${extra.to}%`;
              if (extra.payPeriod) extraInfo = `发放月份: ${extra.payPeriod}`;
            } catch {}
          }

          return (
            <div key={log.id || idx} className="relative mb-3 last:mb-0 group">
              {/* Dot */}
              <div className={`absolute -left-5 top-0.5 w-4 h-4 rounded-full bg-white border-2 flex items-center justify-center ${
                idx === displayLogs.length - 1 ? 'border-indigo-400 shadow-sm shadow-indigo-200' : 'border-slate-200'
              }`}>
                <span className={`material-symbols-outlined text-[10px] ${color}`}>{icon}</span>
              </div>

              {/* Content */}
              <div className="ml-1 pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold text-slate-700">{log.actor_name || log.actor_id}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    log.action === 'approve' || log.action === 'confirm_receipt' ? 'bg-emerald-50 text-emerald-600' :
                    log.action === 'reject' || log.action === 'reject_receipt' ? 'bg-red-50 text-red-500' :
                    'bg-slate-100 text-slate-500'
                  }`}>
                    {actionLabel}
                  </span>
                  {statusText && (
                    <span className="text-[9px] text-slate-400 font-medium font-mono">{statusText}</span>
                  )}
                </div>

                {/* Timestamp */}
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[9px] text-slate-400 font-mono tabular-nums">{ts.date} {ts.time}</span>
                  <span className="text-[9px] text-slate-300">({ts.relative})</span>
                </div>

                {/* Comment */}
                {log.comment && (
                  <div className="mt-1 text-[10px] text-slate-500 bg-slate-50 rounded px-2 py-1 border-l-2 border-slate-200">
                    {log.comment}
                  </div>
                )}

                {/* Extra */}
                {extraInfo && (
                  <span className="text-[9px] text-indigo-500 font-bold mt-0.5 inline-block">{extraInfo}</span>
                )}

                {/* Duration to next */}
                {duration && idx < displayLogs.length - 1 && (
                  <div className="mt-1 flex items-center gap-1 text-[9px] text-slate-300">
                    <span className="material-symbols-outlined text-[10px]">timer</span>
                    <span className="font-medium">{duration}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Show more toggle */}
      {collapsed && significantLogs.length > 5 && (
        <button
          onClick={() => setCollapsed(false)}
          className="text-[10px] text-indigo-500 font-bold mt-2 ml-5 hover:underline flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-[12px]">expand_more</span>
          展开全部 {logs.length} 条记录
        </button>
      )}
    </div>
  );
}

// Export utility for external use (card-level "停留时长" labels)
export function useLatestAuditInfo(businessType: string, businessId: number | string) {
  const [info, setInfo] = useState<{ lastAction: string; lastActorName: string; lastTime: string; dwellMs: number } | null>(null);

  useEffect(() => {
    if (!businessId) return;
    fetch(`/api/workflow/trajectory/audit-log/${businessType}/${businessId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
      .then(r => r.json())
      .then(res => {
        if (res.code === 0 && res.data?.length) {
          const last = res.data[res.data.length - 1];
          const dwellMs = Date.now() - new Date(last.created_at).getTime();
          setInfo({
            lastAction: ACTION_LABELS[last.action] || last.action,
            lastActorName: last.actor_name || last.actor_id,
            lastTime: last.created_at,
            dwellMs
          });
        }
      })
      .catch(() => {});
  }, [businessType, businessId]);

  return info;
}
