import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import SmartTaskModal from '../components/SmartTaskModal';

interface MyWorkflowsProps {
  navigate: (view: string) => void;
}

type TabKey = 'initiated' | 'pending' | 'reviewed' | 'cc';

const TABS: { key: TabKey; label: string; icon: string; emptyText: string }[] = [
  { key: 'initiated', label: '我发起的', icon: 'send', emptyText: '暂无发起的流程' },
  { key: 'pending',   label: '待我审核', icon: 'pending_actions', emptyText: '暂无待审核流程' },
  { key: 'reviewed',  label: '我已审核', icon: 'task_alt', emptyText: '暂无已审核流程' },
  { key: 'cc',        label: '抄送我的', icon: 'forward_to_inbox', emptyText: '暂无抄送消息' },
];

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  draft:         { label: '草稿',       color: 'text-slate-500', bg: 'bg-slate-100' },
  submitted:     { label: '审批中',     color: 'text-blue-600',  bg: 'bg-blue-50' },
  approved:      { label: '已通过',     color: 'text-emerald-600', bg: 'bg-emerald-50' },
  rejected:      { label: '已驳回',     color: 'text-red-500',   bg: 'bg-red-50' },
  assessed:      { label: '已评分',     color: 'text-purple-600', bg: 'bg-purple-50' },
  pending_review:{ label: '待审核',     color: 'text-amber-600',  bg: 'bg-amber-50' },
  pending_hr:    { label: '待人事审核', color: 'text-amber-600', bg: 'bg-amber-50' },
  pending_admin: { label: '待总经理复核', color: 'text-orange-600', bg: 'bg-orange-50' },
  open:          { label: '进行中',     color: 'text-blue-600',  bg: 'bg-blue-50' },
  completed:     { label: '已完成',     color: 'text-emerald-600', bg: 'bg-emerald-50' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] || { label: status, color: 'text-slate-500', bg: 'bg-slate-100' };
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.color} ${s.bg}`}>{s.label}</span>;
}

function FlowTypeTag({ type }: { type: string }) {
  if (type === 'perf_plan') return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-blue-600 bg-blue-50 border border-blue-100">绩效计划</span>;
  if (type === 'proposal') return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-purple-600 bg-purple-50 border border-purple-100">绩效提案</span>;
  if (type === 'pool_join') return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-emerald-600 bg-emerald-50 border border-emerald-100">加入申请</span>;
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-slate-500 bg-slate-100">{type}</span>;
}

function formatDate(d: string) {
  if (!d) return '';
  const date = new Date(d);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}小时前`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}天前`;
  return date.toLocaleDateString();
}

export default function MyWorkflows({ navigate }: MyWorkflowsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('initiated');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Record<TabKey, number>>({ initiated: 0, pending: 0, reviewed: 0, cc: 0 });
  const [users, setUsers] = useState<any[]>([]);
  const [selectedTask, setSelectedTask] = useState<{ type: string, data: any, isPending: boolean, originalStatus?: string } | null>(null);
  const [submittingApprovals, setSubmittingApprovals] = useState(false);
  const { currentUser } = useAuth();
  
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetch('/api/org/users', { headers }).then(r => r.json()).then(j => setUsers(j.data || []));
  }, []);

  const fetchTab = async (tab: TabKey) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/workflows/${tab}`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.code === 0) {
        setData(json.data || []);
      }
    } catch {}
    setLoading(false);
  };

  // Fetch counts for all tabs on mount
  useEffect(() => {
    const fetchCounts = async () => {
      const token = localStorage.getItem('token');
      const allTabs: TabKey[] = ['initiated', 'pending', 'reviewed', 'cc'];
      const results = await Promise.all(
        allTabs.map(t =>
          fetch(`/api/workflows/${t}`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json())
            .catch(() => ({ data: [] }))
        )
      );
      const newCounts: Record<string, number> = {};
      allTabs.forEach((t, i) => { newCounts[t] = results[i]?.data?.length || 0; });
      setCounts(newCounts as any);
    };
    fetchCounts();
  }, []);

  useEffect(() => { fetchTab(activeTab); }, [activeTab]);

  const handleApproveReject = async (id: number, flowType: string, action: 'approve'|'reject', comment: string, updatedData?: { bonus?: string; rewardType?: string; maxParticipants?: string }) => {
    setSubmittingApprovals(true);
    try {
      const isPerf = flowType === 'perf_plan';
      const isJoin = flowType === 'pool_join';
      // Map to correct API endpoints
      const realEndpoint = isPerf 
        ? `/api/perf/plans/${id}/${action}`
        : isJoin
        ? `/api/pool/join-requests/${id}/review`
        : `/api/pool/proposals/${id}/review`;
        
      const payload = isPerf 
        ? { reason: comment } 
        : isJoin
        ? { action, comment }
        : { 
            action, 
            reason: comment,
            ...(updatedData?.bonus !== undefined ? { bonus: updatedData.bonus } : {}),
            ...(updatedData?.rewardType ? { reward_type: updatedData.rewardType } : {}),
            ...(updatedData?.maxParticipants ? { max_participants: updatedData.maxParticipants } : {})
          };

      const res = await fetch(realEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.code === 0) {
        fetchTab(activeTab);
        setSelectedTask(null);
        const refreshCounts = await fetch(`/api/workflows/pending`, { headers }).then(r=>r.json()).catch(()=>null);
        if (refreshCounts) setCounts(prev => ({ ...prev, pending: refreshCounts.data?.length || 0 }));
      } else {
        alert(data.message || '操作失败');
      }
    } catch (e) {
      alert('网络错误');
    } finally {
      setSubmittingApprovals(false);
    }
  };

  const tabInfo = TABS.find(t => t.key === activeTab)!;

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-on-surface antialiased">
      <Sidebar currentView="workflows" navigate={navigate} />
      <main className="flex-1 h-[calc(100vh-4rem)] mt-16 overflow-y-auto relative">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-xl">account_tree</span>
            </div>
            我的流程
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 ml-[52px]">
            跟踪所有我发起、审核和参与的流程
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 bg-white dark:bg-slate-900 rounded-2xl p-1.5 shadow-sm border border-slate-200/60 dark:border-slate-800">
          {TABS.map(tab => (
            <button key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                activeTab === tab.key
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md shadow-blue-200/50'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}>
              <span className="material-symbols-outlined text-[18px]"
                style={activeTab === tab.key ? { fontVariationSettings: "'FILL' 1" } : {}}>{tab.icon}</span>
              {tab.label}
              {counts[tab.key] > 0 && (
                <span className={`text-[10px] min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1 font-black ${
                  activeTab === tab.key ? 'bg-white/20 text-white' :
                  tab.key === 'pending' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'
                }`}>{counts[tab.key]}</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <span className="material-symbols-outlined text-6xl mb-4 opacity-20">{tabInfo.icon}</span>
            <p className="text-sm">{tabInfo.emptyText}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.map((item: any, idx: number) => (
              <WorkflowCard key={`${item.flow_type || item.type}-${item.id}-${idx}`} item={item} tab={activeTab} 
                onClick={async () => {
                  const isPending = activeTab === 'pending';
                  const flowType = item.flow_type || 'unknown';
                  try {
                    let fullData = item;
                    let mappedData = { ...fullData };
                    if (flowType === 'pool_join') {
                      // Fetch pool task details for the join request
                      const r = await fetch(`/api/pool/tasks/${item.pool_task_id}`, { headers });
                      const j = await r.json();
                      if (j.code === 0) {
                        const task = j.data;
                        const desc = task.description || '';
                        mappedData = {
                          ...task,
                          ...item,
                          flow_type: 'pool_join',
                          status: item.status,
                          proposal_status: item.status,
                          summary: task.title,
                          s: desc,
                          join_applicant: item.creator_name || item.user_id,
                          join_role: item.role,
                          join_reason: item.reason,
                        };
                      }
                      setSelectedTask({
                        type: 'pool_propose',
                        data: mappedData,
                        isPending,
                        originalStatus: item.status,
                      });
                      return;
                    } else if (flowType === 'perf_plan') {
                      const r = await fetch(`/api/perf/plans/${item.id}`, { headers });
                      const j = await r.json();
                      if (j.code === 0) {
                        fullData = { ...j.data, logs: item.logs };
                        const tv = fullData.target_value || '';
                        const desc = fullData.description || '';
                        mappedData = {
                          ...fullData,
                          summary: fullData.title,
                          s: tv.match(/S:\s*(.*?)(?=\nM:|$)/s)?.[1] || '',
                          m: tv.match(/M:\s*(.*?)(?=\nT:|$)/s)?.[1] || '',
                          t: tv.match(/T:\s*(.*)/s)?.[1] || '',
                          a_smart: desc.match(/\[Resource\]:\s*(.*?)(?=\n\[Relevance\]:|$)/s)?.[1] || '',
                          r_smart: desc.match(/\[Relevance\]:\s*(.*?)(?=\n\[PDCA-Plan\]:|$)/s)?.[1] || '',
                          planTime: desc.match(/\[PDCA-Plan\]:\s*(.*?)(?=\n\[PDCA-Do\]:|$)/s)?.[1] || '',
                          doTime: desc.match(/\[PDCA-Do\]:\s*(.*?)(?=\n\[PDCA-Check\]:|$)/s)?.[1] || '',
                          checkTime: desc.match(/\[PDCA-Check\]:\s*(.*?)(?=\n\[PDCA-Act\]:|$)/s)?.[1] || '',
                          actTime: desc.match(/\[PDCA-Act\]:\s*(.*)/s)?.[1] || '',
                        };
                      }
                    } else if (flowType === 'proposal') {
                      const desc = fullData.description || fullData.content || '';
                      if (desc.includes('【目标 S】')) {
                        mappedData = {
                          ...fullData,
                          status: fullData.proposal_status,
                          summary: fullData.title,
                          s: desc.match(/【目标 S】(.*?)(\n【指标 M】|$)/s)?.[1] || '',
                          m: desc.match(/【指标 M】(.*?)(\n【方案 A】|$)/s)?.[1] || '',
                          a_smart: desc.match(/【方案 A】(.*?)(\n【相关 R】|$)/s)?.[1] || '',
                          r_smart: desc.match(/【相关 R】(.*?)(\n【时限 T】|$)/s)?.[1] || '',
                          t: desc.match(/【时限 T】(.*?)(\n【PDCA】|$)/s)?.[1] || '',
                        };
                        const pdca = desc.match(/【PDCA】\n(.*)/s)?.[1] || '';
                        if (pdca) {
                          mappedData.planTime = pdca.match(/Plan: (.*?)( \| |$)/)?.[1] || '';
                          mappedData.doTime = pdca.match(/Do: (.*?)( \| |$)/)?.[1] || '';
                          mappedData.checkTime = pdca.match(/Check: (.*?)( \| |$)/)?.[1] || '';
                          mappedData.actTime = pdca.match(/Act: (.*?)( \| |$)/)?.[1] || '';
                        }
                      } else {
                        mappedData = {
                          ...fullData,
                          status: fullData.proposal_status,
                          summary: fullData.title,
                          s: desc
                        };
                      }
                    }
                    
                    setSelectedTask({
                      type: flowType === 'perf_plan' ? (fullData.category || 'personal') : 'pool_propose',
                      data: mappedData,
                      isPending: isPending,
                      originalStatus: flowType === 'perf_plan' ? fullData.status : fullData.proposal_status
                    });
                  } catch (e) {
                    console.error("Failed to fetch task details", e);
                  }
                }} 
              />
            ))}
          </div>
        )}
      </div>
      </main>

      {/* Task Modal Integration */}
      {selectedTask && (() => {
        const isEditableByCreator = activeTab === 'initiated' && ['draft', 'rejected'].includes(selectedTask.originalStatus);
        const canWithdraw = activeTab === 'initiated' && ['pending_review', 'pending_hr', 'pending_admin', 'submitted'].includes(selectedTask.originalStatus);
        
        const handleWithdraw = async () => {
          if (!confirm('确定要撤回此申请吗？撤回后可重新编辑后再次提交。')) return;
          setSubmittingApprovals(true);
          try {
            const token = localStorage.getItem('token');
            const flowType = selectedTask.data.flow_type || (selectedTask.type === 'pool_propose' ? 'proposal' : 'perf_plan');
            const url = flowType === 'perf_plan' 
              ? `/api/perf/plans/${selectedTask.data.id}/withdraw` 
              : `/api/pool/proposals/${selectedTask.data.id}/withdraw`;
            const res = await fetch(url, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.code === 0) {
              setSelectedTask(null);
              fetchTab(activeTab);
            } else {
              alert(data.message || '撤回失败');
            }
          } catch (e) {
            console.error(e);
          } finally {
            setSubmittingApprovals(false);
          }
        };

        const handleEditSubmit = async (formData: any) => {
          setSubmittingApprovals(true);
          try {
            const token = localStorage.getItem('token');
            const flowType = selectedTask.data.flow_type || (selectedTask.type === 'pool_propose' ? 'proposal' : 'perf_plan');
            const url = flowType === 'perf_plan' ? `/api/perf/plans/${selectedTask.data.id}/resubmit` : `/api/pool/proposals/${selectedTask.data.id}/resubmit`;
            
            // Format payload based on type
            let payload = {};
            if (flowType === 'perf_plan') {
              payload = {
                title: formData.summary,
                category: formData.taskType,
                target_value: `S: ${formData.s}\nM: ${formData.m}\nT: ${formData.t}`,
                description: `[Resource]: ${formData.a_smart}\n[Relevance]: ${formData.r_smart}\n[PDCA-Plan]: ${formData.planTime || ''}\n[PDCA-Do]: ${formData.doTime || ''}\n[PDCA-Check]: ${formData.checkTime || ''}\n[PDCA-Act]: ${formData.actTime || ''}`,
                deadline: formData.t,
                collaborators: formData.c
              };
            } else {
              payload = {
                title: formData.summary,
                reward_type: formData.rewardType,
                bonus: formData.bonus,
                description: `【目标 S】\n${formData.s}\n【指标 M】\n${formData.m}\n【方案 A】\n${formData.a_smart}\n【相关 R】\n${formData.r_smart}\n【时限 T】\n${formData.t}\n【PDCA】\nPlan: ${formData.planTime || ''} | Do: ${formData.doTime || ''} | Check: ${formData.checkTime || ''} | Act: ${formData.actTime || ''}`
              };
            }

            const res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.code === 0) {
              setSelectedTask(null);
              fetchTab(activeTab);
            } else {
              alert(data.message || '提交失败');
            }
          } catch (e) {
            console.error(e);
          } finally {
            setSubmittingApprovals(false);
          }
        };

        // Custom footer for withdraw-able items
        const withdrawFooter = canWithdraw ? (
          <div className="flex items-center gap-3">
            <button
              onClick={handleWithdraw}
              disabled={submittingApprovals}
              className="px-5 py-2 text-sm font-bold text-amber-600 bg-white border border-amber-300 hover:bg-amber-50 rounded-xl transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">undo</span>
              撤回申请
            </button>
            <button onClick={() => setSelectedTask(null)} className="px-6 py-2 text-sm font-bold text-white bg-[#005ea4] hover:bg-[#0077ce] rounded-xl transition-colors shadow-sm focus:outline-none">
              关闭
            </button>
          </div>
        ) : undefined;

        return (
          <SmartTaskModal
            isOpen={true}
            title={selectedTask.isPending ? '流程审批' : isEditableByCreator ? '重新提交审批' : '流程详情'}
            type={selectedTask.type as any}
            initialData={selectedTask.data}
            readonly={!isEditableByCreator} // Editable if creator is revising draft/rejected
            approverMode={selectedTask.isPending}
            customFooter={withdrawFooter}
            onApprove={(comment, updatedData) => handleApproveReject(selectedTask.data.id, selectedTask.data.flow_type || (selectedTask.type === 'pool_propose' ? 'proposal' : 'perf_plan'), 'approve', comment, updatedData)}
            onReject={(comment) => handleApproveReject(selectedTask.data.id, selectedTask.data.flow_type || (selectedTask.type === 'pool_propose' ? 'proposal' : 'perf_plan'), 'reject', comment)}
            submitting={submittingApprovals}
            users={users}
            onClose={() => setSelectedTask(null)}
            onSubmit={handleEditSubmit}
          />
        );
      })()}
    </div>
  );
}

function WorkflowCard({ item, tab, onClick }: { item: any; tab: TabKey; onClick: () => void }) {
  const isCC = tab === 'cc';

  if (isCC) {
    // Notification-style card
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 p-4 hover:shadow-md transition-all">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-blue-500 text-[20px]">forward_to_inbox</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-bold text-slate-800 dark:text-white truncate">
                <span className="font-mono text-xs text-slate-400 mr-2 bg-slate-100 dark:bg-slate-800 px-1 rounded">{item.flow_type === 'proposal' ? 'PL' : 'PF'}-{String(item.id).padStart(6, '0')}</span>
                {item.title}
              </p>
              <span className="text-[10px] text-slate-400 flex-shrink-0 ml-2">{formatDate(item.created_at)}</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{item.content}</p>
          </div>
          {!item.is_read && <div className="w-2.5 h-2.5 bg-blue-500 rounded-full flex-shrink-0 mt-1" />}
        </div>
      </div>
    );
  }

  const flowType = item.flow_type || 'unknown';
  const status = flowType === 'proposal' ? item.proposal_status : flowType === 'pool_join' ? item.status : item.status;
  const title = item.title;
  const creator = item.creator_name || item.created_by || item.user_id;
  const approver = item.approver_name || item.hr_reviewer_name || item.admin_reviewer_name;

  const iconBg = flowType === 'perf_plan' ? 'bg-blue-50 dark:bg-blue-900/30' 
    : flowType === 'pool_join' ? 'bg-emerald-50 dark:bg-emerald-900/30' 
    : 'bg-purple-50 dark:bg-purple-900/30';
  const iconColor = flowType === 'perf_plan' ? 'text-blue-500' 
    : flowType === 'pool_join' ? 'text-emerald-500' 
    : 'text-purple-500';
  const iconName = flowType === 'perf_plan' ? 'trending_up' 
    : flowType === 'pool_join' ? 'person_add'
    : 'lightbulb';
  const codePrefix = flowType === 'proposal' ? 'PL' : flowType === 'pool_join' ? 'JR' : 'PF';

  return (
    <div 
      onClick={onClick}
      className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 p-4 transition-all group hover:shadow-md hover:border-blue-300 cursor-pointer`}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          <span className={`material-symbols-outlined text-[20px] ${iconColor}`}>{iconName}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded shadow-sm">
              {codePrefix}-{String(item.id).padStart(6, '0')}
            </span>
            <FlowTypeTag type={flowType} />
            <StatusBadge status={status} />
          </div>
          <h3 className="font-bold text-slate-800 dark:text-white text-sm mb-1 truncate">{title}</h3>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            {tab === 'initiated' && approver && (
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">person</span>
                审批人: {approver}
              </span>
            )}
            {(tab === 'pending' || tab === 'reviewed') && creator && (
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">person</span>
                发起人: {creator}
              </span>
            )}
            {item.bonus > 0 && (
              <span className="flex items-center gap-1 text-rose-500 font-bold">
                <span className="material-symbols-outlined text-[12px]">payments</span>
                ¥{item.bonus?.toLocaleString()}
              </span>
            )}
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[12px]">schedule</span>
              {formatDate(item.created_at)}
            </span>
          </div>
          {item.reject_reason && (
            <p className="mt-2 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-1.5">
              驳回原因: {item.reject_reason}
            </p>
          )}
          {item.description && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{item.description}</p>
          )}
          {flowType === 'pool_join' && (
            <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
              {item.role && <span>期望角色：{item.role}</span>}
              {item.reason && <span>申请理由：{item.reason}</span>}
            </div>
          )}
        </div>

        {/* Progress (for perf plans) */}
        {flowType === 'perf_plan' && typeof item.progress === 'number' && (
          <div className="flex-shrink-0 text-center">
            <div className="relative w-12 h-12">
              <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="14" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                <circle cx="18" cy="18" r="14" fill="none" stroke={item.progress >= 80 ? '#22c55e' : item.progress >= 40 ? '#3b82f6' : '#f59e0b'}
                  strokeWidth="3" strokeDasharray={`${(item.progress / 100) * 88} 88`} strokeLinecap="round" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-slate-700 dark:text-slate-200">{item.progress}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Approval Path */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
          <span className="material-symbols-outlined text-[12px]">route</span>
          审批路径
        </h4>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          {item.logs && item.logs.length > 0 ? (
            <>
              {item.logs.map((log: any, i: number) => {
                const isReject = log.new_value === 'rejected' || log.action === 'reject';
                const isApprove = log.new_value === 'approved' || log.action === 'approve';
                return (
                  <React.Fragment key={i}>
                    <div className={`flex flex-col rounded-lg px-2 py-1 border ${
                      isReject ? 'bg-red-50 border-red-100 text-red-700' : 
                      isApprove ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 
                      'bg-slate-50 border-slate-200 text-slate-600'
                    }`}>
                      <span className="font-bold">{log.user_name || log.user_id}</span>
                      <span className="text-[9px] opacity-70">
                        {log.action === 'submit' ? '发起申请' : 
                         isReject ? '已驳回' : 
                         isApprove ? '已通过' : '审阅中'}
                      </span>
                    </div>
                    {i < item.logs.length - 1 && (
                      <span className="material-symbols-outlined text-[14px] text-slate-300">arrow_right_alt</span>
                    )}
                  </React.Fragment>
                );
              })}
              {/* If last log is not an end state, show pending text */}
              {!['approved', 'rejected', 'completed', 'assessed'].includes(status) && (
                <>
                  <span className="material-symbols-outlined text-[14px] text-slate-300">arrow_right_alt</span>
                  <div className="flex flex-col rounded-lg px-2 py-1 border border-dashed border-amber-300 bg-amber-50 text-amber-600">
                    <span className="font-bold">{approver || '审批人'}</span>
                    <span className="text-[9px] opacity-80">待审核</span>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <div className="flex flex-col rounded-lg px-2 py-1 border bg-slate-50 border-slate-200 text-slate-600">
                <span className="font-bold">{creator || '发起人'}</span>
                <span className="text-[9px] opacity-70">发起申请</span>
              </div>
              <span className="material-symbols-outlined text-[14px] text-slate-300">arrow_right_alt</span>
              <div className={`flex flex-col rounded-lg px-2 py-1 border ${
                status === 'rejected' ? 'bg-red-50 border-red-100 text-red-700' :
                status === 'approved' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
                'border-dashed border-amber-300 bg-amber-50 text-amber-600'
              }`}>
                <span className="font-bold">{item.pending_reviewer_name || approver || (flowType === 'pool_join' ? '管理员' : '审批人')}</span>
                <span className="text-[9px] opacity-80">
                  {status === 'rejected' ? '已驳回' : status === 'approved' ? '已完成' : '待处理'}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
