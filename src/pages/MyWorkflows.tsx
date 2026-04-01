import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import SmartTaskModal from '../components/SmartTaskModal';
import WorkflowTrajectory from '../components/WorkflowTrajectory';
import { useIsMobile } from '../hooks/useIsMobile';
import { PoolModule } from './AdminPanel';
import AuditTimeline from '../components/AuditTimeline';

interface MyWorkflowsProps {
  navigate: (view: string) => void;
  initialTab?: TabKey;
}

type TabKey = 'initiated' | 'pending' | 'reviewed' | 'cc' | 'pool_mgmt' | 'exception_mgmt';

const BASE_TABS: { key: TabKey; label: string; icon: string; emptyText: string }[] = [
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
  assessed:      { label: '已结案',     color: 'text-purple-600', bg: 'bg-purple-50' },
  pending_review:{ label: '待审核',     color: 'text-amber-600',  bg: 'bg-amber-50' },
  pending_dept_review:{ label: '待部门审批', color: 'text-orange-600',  bg: 'bg-orange-50' },
  pending_hr:    { label: '待人事审核', color: 'text-amber-600', bg: 'bg-amber-50' },
  pending_dt:    { label: '待金主验收', color: 'text-purple-600', bg: 'bg-purple-50' },
  pending_admin: { label: '待总经理审批', color: 'text-orange-600', bg: 'bg-orange-50' },
  open:          { label: '进行中',     color: 'text-blue-600',  bg: 'bg-blue-50' },
  completed:     { label: '已完成',     color: 'text-emerald-600', bg: 'bg-emerald-50' },
  in_progress:   { label: '进行中',     color: 'text-blue-600',   bg: 'bg-blue-50' },
  returned:      { label: '已退回',     color: 'text-orange-600', bg: 'bg-orange-50' },
  pending_receipt:{ label: '待签收',    color: 'text-cyan-600',   bg: 'bg-cyan-50' },
  pending_assessment:{ label: '待评级', color: 'text-purple-600', bg: 'bg-purple-50' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] || { label: status, color: 'text-slate-500', bg: 'bg-slate-100' };
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.color} ${s.bg}`}>{s.label}</span>;
}

function FlowTypeTag({ type }: { type: string }) {
  if (type === 'perf_plan') return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-blue-600 bg-blue-50 border border-blue-100">绩效计划</span>;
  if (type === 'proposal') return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-purple-600 bg-purple-50 border border-purple-100">绩效提案</span>;
  if (type === 'pool_join') return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-emerald-600 bg-emerald-50 border border-emerald-100">加入申请</span>;
  if (type === 'test_assignment') return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-indigo-600 bg-indigo-50 border border-indigo-100">能力测评</span>;
  if (type === 'reward_plan') return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-amber-700 bg-amber-50 border border-amber-200">🎯 奖励分配</span>;
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

export default function MyWorkflows({ navigate, initialTab }: MyWorkflowsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab || 'initiated');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Record<TabKey, number>>({ initiated: 0, pending: 0, reviewed: 0, cc: 0, pool_mgmt: 0, exception_mgmt: 0 });
  const [users, setUsers] = useState<any[]>([]);
  const [selectedTask, setSelectedTask] = useState<{ type: string, data: any, isPending: boolean, originalStatus?: string } | null>(null);
  const [submittingApprovals, setSubmittingApprovals] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  // reward_plan modal local state (hoisted to avoid conditional hook rule)
  const [submittingReward, setSubmittingReward] = useState(false);
  const [rewardComment, setRewardComment] = useState('');
  const { currentUser } = useAuth();
  const isMobile = useIsMobile();

  const TABS = [
    ...BASE_TABS,
    ...( ['admin', 'hr', 'manager'].includes(currentUser?.role) ? [{ key: 'pool_mgmt' as TabKey, label: '绩效池管理', icon: 'pool', emptyText: '暂无绩效池任务' }] : [] ),
    ...( ['admin', 'hr'].includes(currentUser?.role) ? [{ key: 'exception_mgmt' as TabKey, label: '流程异常', icon: 'warning', emptyText: '' }] : [] ),
  ];
  
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetch('/api/org/users', { headers }).then(r => r.json()).then(j => setUsers(j.data || []));
  }, []);

  useEffect(() => {
    if (initialTab && ['initiated', 'pending', 'reviewed', 'cc'].includes(initialTab)) {
      setActiveTab(initialTab as TabKey);
    }
  }, [initialTab]);

  const fetchTab = async (tab: TabKey) => {
    if (tab === 'pool_mgmt') { setLoading(false); return; }
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/workflows/${tab}`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.code === 0) {
        let items = json.data || [];
        setData(items);
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
      allTabs.forEach((t, i) => {
        let items: any[] = results[i]?.data || [];
        newCounts[t] = items.length;
      });
      setCounts(newCounts as any);
    };
    fetchCounts();
  }, [currentUser?.id]);

  useEffect(() => { fetchTab(activeTab); }, [activeTab]);

  const handleApproveReject = async (id: number, flowType: string, action: 'approve'|'reject'|'transfer', comment: string, updatedData?: any, transfer_to?: string) => {
    setSubmittingApprovals(true);
    try {
      const isPerf = flowType === 'perf_plan';
      const isJoin = flowType === 'pool_join';
      const isRewardPlan = flowType === 'reward_plan';

      let realEndpoint: string;
      let payload: any;

      if (isPerf) {
        realEndpoint = action === 'transfer' ? `/api/perf/plans/${id}/review` : `/api/perf/plans/${id}/${action}`;
        payload = { action, reason: comment, transfer_to };
      } else if (isJoin) {
        realEndpoint = `/api/pool/role-claims/${id}/review`;
        payload = { action, comment };
      } else if (isRewardPlan) {
        // 根据当前状态判断审核端点
        const item = data.find((d: any) => d.id === id);
        const endpoint = item?.status === 'pending_admin' ? 'admin-confirm' : 
                         item?.status === 'pending_dt' ? 'dt-review' : 'hr-review';
        realEndpoint = `/api/pool/rewards/${id}/${endpoint}`;
        payload = { action, comment, transfer_to };
      } else {
        realEndpoint = `/api/pool/proposals/${id}/review`;
        payload = {
          action,
          reason: comment,
          transfer_to,
          ...(updatedData?.bonus !== undefined ? { bonus: updatedData.bonus } : {}),
          ...(updatedData?.rewardType ? { reward_type: updatedData.rewardType } : {}),
          ...(updatedData?.maxParticipants ? { max_participants: updatedData.maxParticipants } : {}),
          ...(updatedData?.taskType ? { department: updatedData.taskType } : {}),
          ...(updatedData?.attachments ? { attachments: updatedData.attachments } : {}),
          ...(updatedData?.a ? { a: updatedData.a } : {}),
          ...(updatedData?.s !== undefined ? { s: updatedData.s, m: updatedData.m, a_smart: updatedData.a_smart, r_smart: updatedData.r_smart, t: updatedData.t, summary: updatedData.summary } : {})
        };
      }

      const res = await fetch(realEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });
      const data2 = await res.json();
      if (data2.code === 0) {
        fetchTab(activeTab);
        setSelectedTask(null);
        const refreshCounts = await fetch(`/api/workflows/pending`, { headers }).then(r=>r.json()).catch(()=>null);
        if (refreshCounts) {
          const filtered = (refreshCounts.data || []).filter((item: any) => item.creator_id !== currentUser?.id && item.created_by !== currentUser?.id);
          setCounts(prev => ({ ...prev, pending: filtered.length }));
        }
      } else {
        setApprovalError(data2.message || '操作失败');
      }
    } catch (e) {
      setApprovalError('网络错误，请重试');
    } finally {
      setSubmittingApprovals(false);
    }
  };

  const tabInfo = TABS.find(t => t.key === activeTab)!;

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-on-surface antialiased">
      <Sidebar currentView="workflows" navigate={navigate} />
      <main className={`flex-1 h-[calc(100vh-4rem)] mt-16 overflow-y-auto relative ${isMobile ? 'pb-20' : ''}`}>
      <div className={`max-w-5xl mx-auto py-8 ${isMobile ? 'px-4' : 'px-4 sm:px-6 lg:px-8'}`}>
        {/* Header */}
        <div className="mb-6">
          <h1 className={`font-black text-slate-900 dark:text-white flex items-center gap-3 ${isMobile ? 'text-lg' : 'text-2xl'}`}>
            <div className={`bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center ${isMobile ? 'w-8 h-8' : 'w-10 h-10'}`}>
              <span className={`material-symbols-outlined text-white ${isMobile ? 'text-base' : 'text-xl'}`}>account_tree</span>
            </div>
            我的流程
          </h1>
          {!isMobile && (
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 ml-[52px]">
            跟踪所有我发起、审核和参与的流程
          </p>
          )}
        </div>

        {/* Tabs */}
        <div className={`flex gap-2 mb-6 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/60 dark:border-slate-800 ${isMobile ? 'p-1 overflow-x-auto scrollbar-hide' : 'p-1.5'}`}>
          {TABS.map(tab => (
            <button key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center justify-center gap-1.5 rounded-xl font-bold transition-all whitespace-nowrap ${
                isMobile ? 'flex-none px-3 py-2 text-xs' : 'flex-1 px-4 py-2.5 text-sm gap-2'
              } ${
                activeTab === tab.key
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md shadow-blue-200/50'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}>
              <span className={`material-symbols-outlined ${isMobile ? 'text-[14px]' : 'text-[18px]'}`}
                style={activeTab === tab.key ? { fontVariationSettings: "'FILL' 1" } : {}}>{tab.icon}</span>
              {isMobile ? tab.label.replace('我', '') : tab.label}
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
        {activeTab === 'pool_mgmt' ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 p-6">
            <PoolModule />
          </div>
        ) : activeTab === 'exception_mgmt' ? (
          <ExceptionMgmtPanel />
        ) : loading ? (
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
                  if (flowType === 'test_assignment') {
                    navigate('competency');
                    return;
                  }
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
                    } else if (flowType === 'reward_plan') {
                      // 奖励方案：直接用 item 数据展示，type=reward_plan
                      setSelectedTask({
                        type: 'reward_plan',
                        data: { ...item, flow_type: 'reward_plan' },
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
                        // Safely parse attachments
                        let parsedAttachments: any[] = [];
                        try {
                          if (Array.isArray(fullData.attachments)) {
                            parsedAttachments = fullData.attachments;
                          } else if (typeof fullData.attachments === 'string' && fullData.attachments) {
                            parsedAttachments = JSON.parse(fullData.attachments);
                          }
                        } catch { parsedAttachments = []; }
                        mappedData = {
                          ...fullData,
                          summary: fullData.title,
                          s: tv.match(/S:\s*(.*?)(?=\nM:|$)/s)?.[1] || '',
                          m: tv.match(/M:\s*(.*?)(?=\nT:|$)/s)?.[1] || '',
                          t: tv.match(/T:\s*(.*)/s)?.[1] || '',
                          // 兼容两种格式：英文 [Resource]: 和中文【所需资源】/「所需资源」
                          a_smart: desc.match(/\[Resource\]:\s*(.*?)(?=\n\[Relevance\]:|$)/s)?.[1]
                            || desc.match(/[【「]所需资源[】」]\n([\s\S]*?)(?=\n\n[【「]|$)/)?.[1]
                            || '',
                          r_smart: desc.match(/\[Relevance\]:\s*(.*?)(?=\n\[PDCA-Plan\]:|$)/s)?.[1]
                            || desc.match(/[【「]岗位关联[】」]\n([\s\S]*?)(?=\n\n[【「]|$)/)?.[1]
                            || '',
                          planTime: desc.match(/\[PDCA-Plan\]:\s*(.*?)(?=\n\[PDCA-Do\]:|$)/s)?.[1] || '',
                          doTime: desc.match(/\[PDCA-Do\]:\s*(.*?)(?=\n\[PDCA-Check\]:|$)/s)?.[1] || '',
                          checkTime: desc.match(/\[PDCA-Check\]:\s*(.*?)(?=\n\[PDCA-Act\]:|$)/s)?.[1] || '',
                          actTime: desc.match(/\[PDCA-Act\]:\s*(.*)/s)?.[1] || '',
                          attachments: parsedAttachments,
                        };
                      }
                    } else if (flowType === 'proposal') {
                      const desc = fullData.description || fullData.content || '';
                      if (desc.includes('【目标 S】')) {
                        // Safely parse attachments
                        let parsedAttachments: any[] = [];
                        try {
                          if (Array.isArray(fullData.attachments)) {
                            parsedAttachments = fullData.attachments;
                          } else if (typeof fullData.attachments === 'string' && fullData.attachments) {
                            parsedAttachments = JSON.parse(fullData.attachments);
                          }
                        } catch { parsedAttachments = []; }
                        mappedData = {
                          ...fullData,
                          status: fullData.proposal_status,
                          summary: fullData.title,
                          rewardType: fullData.reward_type || 'money',
                          maxParticipants: fullData.max_participants || 5,
                          s: desc.match(/【目标 S】(.*?)(\n【指标 M】|$)/s)?.[1] || '',
                          m: desc.match(/【指标 M】(.*?)(\n【方案 A】|$)/s)?.[1] || '',
                          a_smart: desc.match(/【方案 A】(.*?)(\n【相关 R】|$)/s)?.[1] || '',
                          r_smart: desc.match(/【相关 R】(.*?)(\n【时限 T】|$)/s)?.[1] || '',
                          t: desc.match(/【时限 T】(.*?)(\n【PDCA】|$)/s)?.[1] || '',
                          attachments: parsedAttachments,
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
                          rewardType: fullData.reward_type || 'money',
                          maxParticipants: fullData.max_participants || 5,
                          taskType: fullData.department,
                          attachments: fullData.attachments ? JSON.parse(fullData.attachments) : [],
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
        const canWithdraw = activeTab === 'initiated' && ['pending_review', 'pending_dept_review', 'pending_dt', 'pending_hr', 'pending_admin', 'submitted'].includes(selectedTask.originalStatus);
        
        const handleWithdraw = async (e: React.MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
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
                collaborators: formData.c,
                attachments: formData.attachments || []
              };
            } else {
              payload = {
                title: formData.summary,
                reward_type: formData.rewardType,
                bonus: formData.bonus,
                description: `【目标 S】\n${formData.s}\n【指标 M】\n${formData.m}\n【方案 A】\n${formData.a_smart}\n【相关 R】\n${formData.r_smart}\n【时限 T】\n${formData.t}\n【PDCA】\nPlan: ${formData.planTime || ''} | Do: ${formData.doTime || ''} | Check: ${formData.checkTime || ''} | Act: ${formData.actTime || ''}`,
                attachments: formData.attachments || []
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

        const handleDelete = async () => {
          if (submittingApprovals) return; // 防止双击
          const typePath = selectedTask.type === 'pool_propose' ? 'pool/tasks' : 'perf/plans';
          try {
            setSubmittingApprovals(true);
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/${typePath}/${selectedTask.data.id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success || data.code === 0) {
              // 先关 modal，再刷新列表，避免闪烁
              setSelectedTask(null);
              // 从本地列表中即时移除，避免重画闪烁
              setData(prev => prev.filter((item: any) => item.id !== selectedTask.data.id));
              // 后台静默刷新拿最新数据
              fetchTab(activeTab);
            } else {
              alert(data.message || '删除失败');
            }
          } catch (e) {
            console.error(e);
            alert('网络错误');
          } finally {
            setSubmittingApprovals(false);
          }
        };

        // Custom footer for withdraw-able items
        const withdrawFooter = canWithdraw ? (
          <div className="flex flex-col gap-2 w-full">
            {approvalError && (
              <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-600 text-sm font-bold w-full">
                <span className="material-symbols-outlined text-[16px]">error</span>
                {approvalError}
              </div>
            )}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleWithdraw}
                disabled={submittingApprovals}
                className="px-5 py-2 text-sm font-bold text-amber-600 bg-white border border-amber-300 hover:bg-amber-50 rounded-xl transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">undo</span>
                撤回申请
              </button>
              <button type="button" onClick={() => setSelectedTask(null)} className="px-6 py-2 text-sm font-bold text-white bg-[#005ea4] hover:bg-[#0077ce] rounded-xl transition-colors shadow-sm focus:outline-none">
                关闭
              </button>
            </div>
          </div>
        ) : approvalError ? (
          <div className="flex flex-col gap-2 w-full">
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-600 text-sm font-bold w-full">
              <span className="material-symbols-outlined text-[16px]">error</span>
              {approvalError}
            </div>
          </div>
        ) : undefined;

        // ── 奖励分配方案专用审批弹窗 ──
        if (selectedTask.type === 'reward_plan') {
          const plan = selectedTask.data;

          const doRewardAction = async (action: 'approve' | 'reject') => {
            setSubmittingReward(true);
            setApprovalError(null);
            await handleApproveReject(plan.id, 'reward_plan', action, rewardComment);
            setSubmittingReward(false);
          };

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 text-white flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-2xl">payments</span>
                    <div>
                      <p className="font-black text-lg">奖励分配方案审批</p>
                      <p className="text-amber-100 text-xs">{plan.task_title || `任务 #${plan.pool_task_id}`}</p>
                    </div>
                  </div>
                  <button onClick={() => { setSelectedTask(null); setApprovalError(null); }} className="text-white/60 hover:text-white">
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                  {/* Status */}
                  <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl px-4 py-3">
                    <span className="material-symbols-outlined text-amber-500">info</span>
                    <div>
                      <p className="text-xs font-bold text-amber-700 dark:text-amber-400">
                        {plan.status === 'pending_admin' ? '总经理最终确认' : plan.status === 'pending_dt' ? '金主验收确认中' : 'HR 审核中'}
                      </p>
                      <p className="text-xs text-amber-600/70">发起人：{plan.creator_name} · 发起时间：{plan.created_at?.slice(0, 10)}</p>
                    </div>
                  </div>

                  {/* 奖金总额 + DT */}
                  <div className={`grid gap-3 text-sm ${plan.delivery_target_name ? 'grid-cols-3' : 'grid-cols-2'}`}>
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                      <p className="text-xs text-slate-400 mb-1">奖金总额</p>
                      <p className="font-black text-rose-500 text-lg">¥{plan.total_bonus_awarded?.toLocaleString() || 0}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                      <p className="text-xs text-slate-400 mb-1">预计发放月</p>
                      <p className="font-black text-slate-700 dark:text-slate-200">{plan.pay_period || '待定'}</p>
                    </div>
                    {plan.delivery_target_name && (
                      <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3 border border-purple-100">
                        <p className="text-xs text-purple-400 mb-1">交付对象(金主)</p>
                        <p className="font-black text-purple-700 dark:text-purple-300 text-sm">{plan.delivery_target_name}</p>
                      </div>
                    )}
                  </div>

                  {/* STAR 材料附件提示 */}
                  {plan.star_report_id && (
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl px-4 py-3 text-xs text-indigo-700 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px]">description</span>
                      已附 STAR 汇报材料（#{plan.star_report_id}），请查阅后审批
                    </div>
                  )}

                  {/* 备注 */}
                  {plan.notes && (
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-sm text-slate-600 dark:text-slate-300">
                      <p className="text-xs font-bold text-slate-400 mb-1">备注</p>
                      {plan.notes}
                    </div>
                  )}

                  {/* 审批意见 */}
                  {selectedTask.isPending && (
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">审批意见（可选）</label>
                      <textarea
                        rows={2}
                        className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
                        placeholder="填写补充说明..."
                        value={rewardComment}
                        onChange={e => setRewardComment(e.target.value)}
                      />
                    </div>
                  )}

                  {approvalError && (
                    <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-600 text-sm font-bold">
                      <span className="material-symbols-outlined text-[16px]">error</span>
                      {approvalError}
                    </div>
                  )}

                  {/* 审计轨迹 */}
                  {plan.id && (
                    <AuditTimeline businessType="reward_plan" businessId={plan.id} className="mt-2 border-t border-slate-100 pt-3" />
                  )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-end gap-3">
                  <button onClick={() => { setSelectedTask(null); setApprovalError(null); }}
                    className="px-5 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-100 font-bold">
                    关闭
                  </button>
                  {selectedTask.isPending && (
                    <>
                      <button onClick={() => doRewardAction('reject')} disabled={submittingReward}
                        className="px-5 py-2 text-sm font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 disabled:opacity-50">
                        驳回
                      </button>
                      <button onClick={() => doRewardAction('approve')} disabled={submittingReward}
                        className="px-6 py-2 text-sm font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 shadow-sm">
                        {submittingReward ? '处理中...' : plan.status === 'pending_admin' ? '✅ 总经理确认' : plan.status === 'pending_dt' ? '✅ 金主验收通过' : '✅ HR 通过'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        }

        return (
          <SmartTaskModal
            isOpen={true}
            title={selectedTask.isPending ? '流程审批' : isEditableByCreator ? '重新提交审批' : '流程详情'}
            type={selectedTask.type as any}
            initialData={selectedTask.data}
            readonly={!isEditableByCreator}
            approverMode={selectedTask.isPending}
            customFooter={withdrawFooter}
            onApprove={(comment, updatedData, customAction, targetUser) => { setApprovalError(null); handleApproveReject(selectedTask.data.id, selectedTask.data.flow_type || (selectedTask.type === 'pool_propose' ? 'proposal' : 'perf_plan'), customAction || 'approve', comment, updatedData, targetUser); }}
            onReject={(comment) => { setApprovalError(null); handleApproveReject(selectedTask.data.id, selectedTask.data.flow_type || (selectedTask.type === 'pool_propose' ? 'proposal' : 'perf_plan'), 'reject', comment); }}
            onDelete={isEditableByCreator ? handleDelete : undefined}
            submitting={submittingApprovals}
            users={users}
            onClose={() => { setSelectedTask(null); setApprovalError(null); }}
            onSubmit={handleEditSubmit}
          />
        );
      })()}

    </div>
  );
}

function WorkflowCard({ item, tab, onClick }: { item: any; tab: TabKey; onClick: () => void }) {
  const isCC = tab === 'cc';
  const isMobile = useIsMobile();

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
  const title = flowType === 'test_assignment' ? item.test_bank_title : item.title;
  const creator = item.creator_name || item.created_by || item.user_id;
  const approver = item.approver_name || item.hr_reviewer_name || item.admin_reviewer_name;

  const iconBg = flowType === 'perf_plan' ? 'bg-blue-50 dark:bg-blue-900/30' 
    : flowType === 'pool_join' ? 'bg-emerald-50 dark:bg-emerald-900/30' 
    : flowType === 'test_assignment' ? 'bg-indigo-50 dark:bg-indigo-900/30'
    : 'bg-purple-50 dark:bg-purple-900/30';
  const iconColor = flowType === 'perf_plan' ? 'text-blue-500' 
    : flowType === 'pool_join' ? 'text-emerald-500' 
    : flowType === 'test_assignment' ? 'text-indigo-500'
    : 'text-purple-500';
  const iconName = flowType === 'perf_plan' ? 'trending_up' 
    : flowType === 'pool_join' ? 'person_add'
    : flowType === 'test_assignment' ? 'assignment'
    : 'lightbulb';
  const codePrefix = flowType === 'proposal' ? 'PL' : flowType === 'pool_join' ? 'JR' : flowType === 'test_assignment' ? 'TST' : 'PF';

  return (
    <div 
      onClick={onClick}
      className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 transition-all group hover:shadow-md hover:border-blue-300 cursor-pointer ${isMobile ? 'p-3' : 'p-4'}`}
    >
      <div className={`flex items-start ${isMobile ? 'gap-3' : 'gap-4'}`}>
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
            {/* 整改6: 分配给我的任务添加标识徽章 */}
            {tab === 'initiated' && item.source_type === 'assigned' && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 flex items-center gap-0.5">
                <span className="material-symbols-outlined text-[10px]">assignment_ind</span>
                分配给我
              </span>
            )}
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

      {/* Approval Path — hide on mobile */}
      {!isMobile && (
        ['perf_plan', 'proposal', 'reward_plan'].includes(flowType) ? (
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            <WorkflowTrajectory 
              businessType={flowType as any} 
              businessId={item.id} 
              codePrefix={codePrefix} 
              className="!mx-0 !mb-0 !border-none !bg-transparent !px-0" 
            />
          </div>
        ) : (
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
                  {!['approved', 'rejected', 'completed', 'assessed'].includes(status) && (
                    <>
                      <span className="material-symbols-outlined text-[14px] text-slate-300">arrow_right_alt</span>
                      <div className="flex flex-col rounded-lg px-2 py-1 border border-dashed border-amber-300 bg-amber-50 text-amber-600">
                        <span className="font-bold">{approver || '待指定'}</span>
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
                  <div className={`flex flex-col rounded-lg px-2 py-1 border border-dashed border-amber-300 bg-amber-50 text-amber-600`}>
                    <span className="font-bold">
                      {item.pending_reviewer_name || approver || '待指定'}
                    </span>
                    <span className="text-[9px] opacity-80">
                      待处理
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
}

// ─── 节点补录子面板 ────────────────────────────────────────────────
function NodeFixPanel() {
  const [broken, setBroken] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [users, setUsers] = React.useState<any[]>([]);
  const [fixing, setFixing] = React.useState<number | null>(null);
  const [fixForm, setFixForm] = React.useState<any>({});
  const [msg, setMsg] = React.useState('');
  const token = localStorage.getItem('token');

  const fetchBroken = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/workflow-fix/broken', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.code === 0) setBroken(json.data?.plans || []);
    } catch {}
    setLoading(false);
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/workflow-fix/users', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.code === 0) setUsers(json.data || []);
    } catch {}
  };

  React.useEffect(() => { fetchBroken(); fetchUsers(); }, []);

  const handleFix = async (planId: number) => {
    setMsg('');
    const res = await fetch(`/api/workflow-fix/fix/${planId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(fixForm),
    });
    const json = await res.json();
    if (json.code === 0) {
      setMsg('✅ ' + json.message);
      setFixing(null); setFixForm({}); fetchBroken();
    } else {
      setMsg('❌ ' + json.message);
    }
    setTimeout(() => setMsg(''), 3000);
  };

  const statusMap: Record<string, [string, string]> = {
    draft: ['草稿', 'bg-slate-100 text-slate-500'],
    pending_review: ['待一审', 'bg-amber-100 text-amber-700'],
    pending_dept_review: ['待二审', 'bg-orange-100 text-orange-700'],
    in_progress: ['进行中', 'bg-blue-100 text-blue-700'],
    pending_assessment: ['待评级', 'bg-purple-100 text-purple-700'],
    approved: ['已通过', 'bg-emerald-100 text-emerald-700'],
    assessed: ['已结案', 'bg-violet-100 text-violet-700'],
    completed: ['已完成', 'bg-blue-100 text-blue-700'],
    pending_receipt: ['待签收', 'bg-cyan-100 text-cyan-700'],
  };

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">检测到以下绩效计划的审批节点缺失人员，请手动指派修复。</p>
        <button onClick={fetchBroken} className="text-xs px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">refresh</span>刷新
        </button>
      </div>

      {msg && <div className="text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">{msg}</div>}

      {broken.length === 0 ? (
        <div className="py-12 text-center bg-emerald-50 rounded-2xl border border-emerald-100">
          <span className="material-symbols-outlined text-emerald-400 text-4xl mb-2 block">check_circle</span>
          <p className="text-sm text-emerald-600 font-bold">所有流程节点正常</p>
          <p className="text-xs text-emerald-500 mt-1">暂无需要修复的异常节点</p>
        </div>
      ) : (
        <div className="space-y-3">
          {broken.map((plan: any) => {
            const [statusLabel, statusCls] = statusMap[plan.status] || [plan.status, 'bg-slate-100 text-slate-500'];
            const isFixing = fixing === plan.id;
            return (
              <div key={plan.id} className={`rounded-xl border transition-all ${isFixing ? 'border-blue-300 bg-blue-50/30 shadow-md' : 'border-red-200/60 bg-white hover:shadow-sm'}`}>
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">PF-{String(plan.id).padStart(6, '0')}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusCls}`}>{statusLabel}</span>
                      </div>
                      <h5 className="font-bold text-sm text-slate-800">{plan.title}</h5>
                      <p className="text-[11px] text-slate-400 mt-0.5">发起人: {plan.creator_name || plan.creator_id} · 部门: {plan.dept_name || '未知'}</p>
                    </div>
                    <button
                      onClick={() => { setFixing(isFixing ? null : plan.id); setFixForm({}); }}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1 transition-colors ${isFixing ? 'bg-slate-200 text-slate-600' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                    >
                      <span className="material-symbols-outlined text-[14px]">{isFixing ? 'close' : 'build'}</span>
                      {isFixing ? '取消' : '修复'}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {plan.issues?.map((issue: string, i: number) => (
                      <span key={i} className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 text-[10px] font-bold rounded-lg border border-red-100">
                        <span className="material-symbols-outlined text-[12px]">error</span>{issue}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-4 text-[11px] text-slate-500">
                    <span>审批人: <b className={plan.approver_name ? 'text-emerald-600' : 'text-red-500'}>{plan.approver_name || '未指派'}</b></span>
                    <span>执行人: <b className={plan.assignee_name ? 'text-emerald-600' : 'text-red-500'}>{plan.assignee_name || '未指派'}</b></span>
                    <span>部门负责人: <b className={plan.dept_head_name ? 'text-emerald-600' : 'text-red-500'}>{plan.dept_head_name || '未指派'}</b></span>
                  </div>

                  {isFixing && (
                    <div className="mt-4 pt-4 border-t border-blue-200">
                      <h6 className="text-xs font-bold text-blue-700 mb-3 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">person_add</span>指派流程节点人员
                      </h6>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">直属上级(一审)</label>
                          <select className="w-full border border-blue-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none bg-white"
                            value={fixForm.approver_id || ''} onChange={e => setFixForm({ ...fixForm, approver_id: e.target.value || undefined })}>
                            <option value="">-- {plan.approver_name ? `当前: ${plan.approver_name}` : '请选择'} --</option>
                            {users.filter((u: any) => u.id !== plan.creator_id).map((u: any) => (
                              <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">执行人</label>
                          <select className="w-full border border-blue-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none bg-white"
                            value={fixForm.assignee_id || ''} onChange={e => setFixForm({ ...fixForm, assignee_id: e.target.value || undefined })}>
                            <option value="">-- {plan.assignee_name ? `当前: ${plan.assignee_name}` : '请选择'} --</option>
                            {users.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">部门负责人(二审)</label>
                          <select className="w-full border border-blue-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none bg-white"
                            value={fixForm.dept_head_id || ''} onChange={e => setFixForm({ ...fixForm, dept_head_id: e.target.value || undefined })}>
                            <option value="">-- {plan.dept_head_name ? `当前: ${plan.dept_head_name}` : '请选择'} --</option>
                            {users.filter((u: any) => ['admin', 'manager', 'hr'].includes(u.role)).map((u: any) => (
                              <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => handleFix(plan.id)}
                          disabled={!fixForm.approver_id && !fixForm.assignee_id && !fixForm.dept_head_id}
                          className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-40 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">check</span>确认修复
                        </button>
                        <button onClick={() => { setFixing(null); setFixForm({}); }}
                          className="px-4 py-1.5 bg-white text-slate-600 rounded-lg text-xs border border-slate-200 hover:bg-slate-50">取消</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── 流程异常管理面板 (HR/Admin 专用) ───────────────────────────
function ExceptionMgmtPanel() {
  const [subTab, setSubTab] = React.useState<'stuck' | 'fix'>('stuck');
  const [items, setItems] = React.useState<any[]>([]);
  const [summary, setSummary] = React.useState<any>({});
  const [loading, setLoading] = React.useState(true);
  const [users, setUsers] = React.useState<any[]>([]);
  const [days, setDays] = React.useState(3);
  const [selected, setSelected] = React.useState<any | null>(null);
  const [action, setAction] = React.useState<'reassign' | 'force' | null>(null);
  const [newApproverId, setNewApproverId] = React.useState('');
  const [forceAction, setForceAction] = React.useState<'approve' | 'reject'>('approve');
  const [reason, setReason] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [msg, setMsg] = React.useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const load = async () => {
    setLoading(true);
    try {
      const [excRes, usrRes] = await Promise.all([
        fetch(`/api/workflow-exceptions/stuck?days=${days}`, { headers }).then(r => r.json()),
        fetch('/api/org/users', { headers }).then(r => r.json()),
      ]);
      if (excRes.code === 0) { setItems(excRes.data.items); setSummary(excRes.data.summary); }
      if (usrRes.code === 0) setUsers(usrRes.data || []);
    } catch {}
    setLoading(false);
  };

  React.useEffect(() => { load(); }, [days]);

  const handleReassign = async () => {
    if (!selected || !newApproverId) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/workflow-exceptions/reassign', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ flowType: selected.flow_type, flowId: selected.id, newApproverId, reason }),
      }).then(r => r.json());
      setMsg(res.code === 0 ? { type: 'ok', text: res.message } : { type: 'err', text: res.message });
      if (res.code === 0) { setSelected(null); setAction(null); setReason(''); setNewApproverId(''); load(); }
    } catch { setMsg({ type: 'err', text: '网络错误' }); }
    setSubmitting(false);
  };

  const handleForce = async () => {
    if (!selected || !reason || reason.trim().length < 5) {
      setMsg({ type: 'err', text: '原因至少需要5个字' }); return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/workflow-exceptions/force-advance', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ flowType: selected.flow_type, flowId: selected.id, action: forceAction, reason }),
      }).then(r => r.json());
      setMsg(res.code === 0 ? { type: 'ok', text: res.message } : { type: 'err', text: res.message });
      if (res.code === 0) { setSelected(null); setAction(null); setReason(''); load(); }
    } catch { setMsg({ type: 'err', text: '网络错误' }); }
    setSubmitting(false);
  };

  const riskColors: Record<string, string> = {
    critical: 'bg-red-100 text-red-700 border-red-200',
    high: 'bg-orange-100 text-orange-700 border-orange-200',
    medium: 'bg-amber-50 text-amber-700 border-amber-200',
  };
  const riskLabels: Record<string, string> = { critical: '紧急', high: '高风险', medium: '待处理' };

  return (
    <div className="space-y-4">
      {/* 顶部标题 + 子标签 */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-red-500 text-[20px]">warning</span>
            </div>
            <div>
              <h2 className="font-black text-slate-800 dark:text-white">流程异常管理</h2>
              <p className="text-xs text-slate-400">检测卡点流程与节点缺失，一站式处理</p>
            </div>
          </div>
          {subTab === 'stuck' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">超过</span>
              <select value={days} onChange={e => setDays(Number(e.target.value))}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white">
                {[1,3,5,7,14].map(d => <option key={d} value={d}>{d}天</option>)}
              </select>
              <span className="text-xs text-slate-500">未推进</span>
              <button onClick={load} className="text-xs px-3 py-1.5 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600">刷新</button>
            </div>
          )}
        </div>

        {/* 子标签切换 */}
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
          <button onClick={() => setSubTab('stuck')}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${subTab === 'stuck' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px]">timer_off</span>
              卡住流程
              {summary.critical || summary.high ? (
                <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-black">
                  {(summary.critical || 0) + (summary.high || 0)}
                </span>
              ) : null}
            </span>
          </button>
          <button onClick={() => setSubTab('fix')}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${subTab === 'fix' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px]">healing</span>
              节点补录
            </span>
          </button>
        </div>

        {subTab === 'stuck' && !loading && (
          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              { label: '紧急', count: summary.critical || 0, color: 'text-red-600', bg: 'bg-red-50', icon: 'error' },
              { label: '高风险', count: summary.high || 0, color: 'text-orange-600', bg: 'bg-orange-50', icon: 'warning' },
              { label: '待处理', count: summary.medium || 0, color: 'text-amber-600', bg: 'bg-amber-50', icon: 'info' },
            ].map(s => (
              <div key={s.label} className={`rounded-xl p-3 ${s.bg} flex items-center gap-2`}>
                <span className={`material-symbols-outlined text-[18px] ${s.color}`}>{s.icon}</span>
                <div>
                  <div className={`text-xl font-black ${s.color}`}>{s.count}</div>
                  <div className="text-[10px] text-slate-500">{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {msg && (
        <div className={`px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
          <span className="material-symbols-outlined text-[16px]">{msg.type === 'ok' ? 'check_circle' : 'error'}</span>
          {msg.text}
          <button onClick={() => setMsg(null)} className="ml-auto opacity-60 hover:opacity-100 text-xs">✕</button>
        </div>
      )}

      {/* 子面板内容 */}
      {subTab === 'fix' ? (
        <NodeFixPanel />
      ) : loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 p-12 text-center">
          <span className="material-symbols-outlined text-6xl text-emerald-300 block mb-3">check_circle</span>
          <p className="text-slate-500 font-bold">暂无异常流程</p>
          <p className="text-xs text-slate-400 mt-1">所有流程均在正常推进中</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item: any, i: number) => (
            <div key={`${item.flow_type}-${item.id}-${i}`}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 p-4 hover:shadow-md transition-all">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${riskColors[item.risk]}`}>
                      {riskLabels[item.risk]}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                      {item.flow_type === 'perf_plan' ? '绩效计划' : item.flow_type === 'proposal' ? '绩效提案' : '加入申请'}
                    </span>
                    <span className="text-[10px] text-slate-400">卡住 <strong className="text-red-500">{item.stuck_days}</strong> 天</span>
                  </div>
                  <p className="font-bold text-slate-800 dark:text-white text-sm truncate">{item.title}</p>
                  <div className="flex items-center gap-4 mt-1 text-[11px] text-slate-400 flex-wrap">
                    <span>发起人：{item.creator_name || item.creator_id}</span>
                    <span>当前等待：{item.approver_name || '待指定'}</span>
                    {item.approver_status === 'resigned' && (
                      <span className="text-red-500 font-bold">⚠️ 审批人已离职</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => { setSelected(item); setAction('reassign'); setMsg(null); }}
                    className="text-xs px-3 py-1.5 border border-blue-300 text-blue-600 rounded-lg font-bold hover:bg-blue-50 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">swap_horiz</span>转派
                  </button>
                  <button onClick={() => { setSelected(item); setAction('force'); setMsg(null); }}
                    className="text-xs px-3 py-1.5 border border-orange-300 text-orange-600 rounded-lg font-bold hover:bg-orange-50 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">fast_forward</span>推进
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && action === 'reassign' && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setAction(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-black text-slate-800 text-lg mb-1">转派审批人</h3>
            <p className="text-sm text-slate-500 mb-4 truncate">「{selected.title}」</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">新审批人</label>
                <select value={newApproverId} onChange={e => setNewApproverId(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm">
                  <option value="">请选择</option>
                  {users.filter((u: any) => ['hr','admin','manager'].includes(u.role)).map((u: any) => (
                    <option key={u.id} value={u.id}>{u.name}（{u.role}）</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">转派原因（可选）</label>
                <textarea value={reason} onChange={e => setReason(e.target.value)}
                  placeholder="例：原审批人离职，转派给新负责人"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none h-20" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setAction(null)} className="flex-1 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-500">取消</button>
              <button onClick={handleReassign} disabled={!newApproverId || submitting}
                className="flex-1 py-2 bg-blue-500 text-white rounded-xl text-sm font-bold disabled:opacity-50">
                {submitting ? '处理中...' : '确认转派'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selected && action === 'force' && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setAction(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-black text-slate-800 text-lg mb-1">强制推进流程</h3>
            <p className="text-sm text-slate-500 mb-1 truncate">「{selected.title}」</p>
            <p className="text-xs text-red-500 mb-4">⚠️ 此操作不可撤销，将记入审计日志</p>
            <div className="space-y-3">
              <div className="flex gap-2">
                <button onClick={() => setForceAction('approve')}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold border-2 transition-all ${forceAction === 'approve' ? 'bg-emerald-500 text-white border-emerald-500' : 'border-slate-200 text-slate-500'}`}>
                  ✅ 强制通过
                </button>
                <button onClick={() => setForceAction('reject')}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold border-2 transition-all ${forceAction === 'reject' ? 'bg-red-500 text-white border-red-500' : 'border-slate-200 text-slate-500'}`}>
                  ❌ 强制驳回
                </button>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">操作原因 <span className="text-red-500">*（至少5个字）</span></label>
                <textarea value={reason} onChange={e => setReason(e.target.value)}
                  placeholder="请详细说明原因，将记入审计日志"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none h-24" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setAction(null)} className="flex-1 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-500">取消</button>
              <button onClick={handleForce} disabled={reason.trim().length < 5 || submitting}
                className={`flex-1 py-2 text-white rounded-xl text-sm font-bold disabled:opacity-50 ${forceAction === 'approve' ? 'bg-emerald-500' : 'bg-red-500'}`}>
                {submitting ? '处理中...' : `确认${forceAction === 'approve' ? '通过' : '驳回'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
