import { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';

interface DeptNode {
  id: number;
  name: string;
  parent_id: number;
  member_count: number;
  children: DeptNode[];
}

interface DeptStats {
  memberCount: number;
  directMemberCount: number;
  totalTasks: number;
  completed: number;
  inProgress: number;
  pending: number;
  completionRate: number;
  avgProgress: number;
  recentTasks: { id: number; title: string; status: string; progress: number; deadline: string; assignee_name: string }[];
}

const deptIcons = ['apartment', 'business', 'domain', 'corporate_fare', 'store', 'hub', 'workspaces', 'folder', 'group_work'];
const deptColors = [
  { bg: 'bg-blue-50', text: 'text-blue-600', gradient: 'from-blue-500 to-cyan-500', ring: 'ring-blue-200' },
  { bg: 'bg-emerald-50', text: 'text-emerald-600', gradient: 'from-emerald-500 to-teal-500', ring: 'ring-emerald-200' },
  { bg: 'bg-violet-50', text: 'text-violet-600', gradient: 'from-violet-500 to-purple-500', ring: 'ring-violet-200' },
  { bg: 'bg-rose-50', text: 'text-rose-600', gradient: 'from-rose-500 to-pink-500', ring: 'ring-rose-200' },
  { bg: 'bg-amber-50', text: 'text-amber-600', gradient: 'from-amber-500 to-orange-500', ring: 'ring-amber-200' },
  { bg: 'bg-cyan-50', text: 'text-cyan-600', gradient: 'from-cyan-500 to-sky-500', ring: 'ring-cyan-200' },
];

const statusLabels: Record<string, { label: string; color: string }> = {
  completed: { label: '已完成', color: 'bg-green-100 text-green-700' },
  assessed: { label: '已结案', color: 'bg-purple-100 text-purple-700' },
  in_progress: { label: '进行中', color: 'bg-blue-100 text-blue-700' },
  pending_review: { label: '待审批', color: 'bg-amber-100 text-amber-700' },
  draft: { label: '草稿', color: 'bg-slate-100 text-slate-600' },
  rejected: { label: '已驳回', color: 'bg-red-100 text-red-700' },
};

function getTotalMembers(node: DeptNode): number {
  let total = node.member_count;
  for (const child of node.children) total += getTotalMembers(child);
  return total;
}

export default function HRMap({ navigate }: { navigate: (view: string) => void }) {
  const { currentUser } = useAuth();
  const [tree, setTree] = useState<DeptNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeptId, setSelectedDeptId] = useState<number | null>(null);
  const [selectedDeptName, setSelectedDeptName] = useState('');
  const [deptStats, setDeptStats] = useState<DeptStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/org/tree', { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (data.code === 0) setTree(data.data);
      } catch (err) {
        console.error('获取组织树失败', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const selectDept = (id: number, name: string) => {
    setSelectedDeptId(id);
    setSelectedDeptName(name);
  };

  useEffect(() => {
    if (!selectedDeptId) return;
    (async () => {
      setStatsLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/org/departments/${selectedDeptId}/stats`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (data.code === 0) setDeptStats(data.data);
      } catch (err) {
        console.error(err);
      } finally {
        setStatsLoading(false);
      }
    })();
  }, [selectedDeptId]);

  const renderNode = useCallback((node: DeptNode, depth: number, idx: number) => {
    const color = deptColors[idx % deptColors.length];
    const icon = deptIcons[idx % deptIcons.length];
    const totalMembers = getTotalMembers(node);
    const isRoot = depth === 0;
    const isSelected = selectedDeptId === node.id;

    return (
      <div key={node.id} className="flex flex-col items-center">
        {depth > 0 && <div className="w-0.5 h-8 bg-slate-200"></div>}
        <div
          onClick={() => selectDept(node.id, node.name)}
          className={`cursor-pointer transition-all duration-200 ${
            isRoot
              ? `w-64 p-5 rounded-2xl bg-gradient-to-br ${color.gradient} text-white shadow-xl ${isSelected ? 'ring-4 ring-white/50 scale-105' : 'hover:scale-105'}`
              : `w-52 p-4 rounded-xl bg-white shadow-sm border ${isSelected ? 'ring-2 ring-primary border-primary/30 shadow-md' : 'border-slate-100 hover:shadow-md hover:border-primary/20'}`
          }`}
        >
          {isRoot ? (
            <>
              <span className="text-[10px] font-bold opacity-80 uppercase tracking-wider">总公司</span>
              <h3 className="text-lg font-black mt-1">{node.name}</h3>
              <div className="mt-4 pt-3 border-t border-white/20 grid grid-cols-2 gap-2">
                <div><p className="text-[10px] opacity-70">总人数</p><p className="text-base font-black">{totalMembers}</p></div>
                <div><p className="text-[10px] opacity-70">直属部门</p><p className="text-base font-black">{node.children.length}</p></div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-8 h-8 rounded-lg ${color.bg} flex items-center justify-center ${color.text}`}>
                  <span className="material-symbols-outlined text-[16px]">{icon}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 truncate">{node.name}</p>
                  <p className="text-[10px] text-slate-400">{totalMembers} 人</p>
                </div>
              </div>
              {node.children.length > 0 && (
                <span className={`px-2 py-0.5 ${color.bg} ${color.text} rounded text-[9px] font-bold`}>
                  子部门 ×{node.children.length}
                </span>
              )}
            </>
          )}
        </div>
        {node.children.length > 0 && (
          <>
            <div className="w-0.5 h-8 bg-slate-200"></div>
            {node.children.length > 1 && (
              <div className="relative w-full flex justify-center">
                <div className="h-0.5 bg-slate-200 absolute top-0" style={{ width: `${Math.min(node.children.length * 240, 900)}px` }}></div>
              </div>
            )}
            <div className="flex gap-8 flex-wrap justify-center">
              {node.children.map((child, ci) => renderNode(child, depth + 1, ci))}
            </div>
          </>
        )}
      </div>
    );
  }, [selectedDeptId]);

  return (
    <div className="bg-surface font-body text-on-surface antialiased min-h-screen flex overflow-hidden">
      <Sidebar currentView="hrmap" navigate={navigate} />
      <main className="flex-1 mt-16 h-[calc(100vh-4rem)] overflow-auto relative bg-[#f8f9ff]">
        <section className="min-h-screen relative p-12">
          <div className="mb-8">
            <h2 className="text-3xl font-black text-on-surface font-headline tracking-tight flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>account_tree</span>
              人力地图
            </h2>
            <p className="text-on-surface-variant font-label mt-1">可视化组织结构 · 部门绩效一览</p>
          </div>
          <div className="flex flex-col items-center overflow-x-auto pb-20">
            {loading ? (
              <div className="flex items-center justify-center py-32">
                <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : tree.length === 0 ? (
              <div className="text-center py-32 text-slate-400">
                <span className="material-symbols-outlined text-5xl mb-3 block">folder_off</span>
                <p className="text-sm font-bold">暂无组织数据</p>
              </div>
            ) : tree.map((node, i) => renderNode(node, 0, i))}
          </div>
        </section>
      </main>

      {/* Backdrop */}
      {!!selectedDeptId && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-50" onClick={() => setSelectedDeptId(null)} />
      )}

      {/* Right Drawer — Department Performance Overview */}
      <div className={`fixed top-0 right-0 h-full w-[400px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out overflow-y-auto ${
        !!selectedDeptId ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <div className="p-8">
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <span className="inline-block px-2 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold uppercase tracking-widest rounded mb-3">部门绩效概览</span>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">{selectedDeptName}</h2>
            </div>
            <button onClick={() => setSelectedDeptId(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          {statsLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : deptStats ? (
            <>
              {/* Key Metrics Grid */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-100 rounded-2xl p-4">
                  <p className="text-[10px] text-blue-500 font-bold uppercase">部门成员</p>
                  <p className="text-3xl font-black text-blue-700 mt-1">{deptStats.memberCount}</p>
                  {deptStats.directMemberCount !== deptStats.memberCount && (
                    <p className="text-[9px] text-blue-400 mt-1">
                      直属 {deptStats.directMemberCount} 人 · 含子部门
                    </p>
                  )}
                </div>
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl p-4">
                  <p className="text-[10px] text-emerald-500 font-bold uppercase">完成率</p>
                  <p className="text-3xl font-black text-emerald-700 mt-1">{deptStats.completionRate}%</p>
                </div>
                <div className="bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-100 rounded-2xl p-4">
                  <p className="text-[10px] text-violet-500 font-bold uppercase">总任务</p>
                  <p className="text-3xl font-black text-violet-700 mt-1">{deptStats.totalTasks}</p>
                </div>
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 rounded-2xl p-4">
                  <p className="text-[10px] text-amber-500 font-bold uppercase">平均进度</p>
                  <p className="text-3xl font-black text-amber-700 mt-1">{deptStats.avgProgress}%</p>
                </div>
              </div>

              {/* Task Status Breakdown */}
              <div className="mb-6">
                <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-primary">pie_chart</span>
                  任务状态分布
                </h3>
                <div className="space-y-2.5">
                  {[
                    { label: '已完成/已评分', count: deptStats.completed, color: 'bg-emerald-500', pct: deptStats.totalTasks > 0 ? Math.round(deptStats.completed / deptStats.totalTasks * 100) : 0 },
                    { label: '进行中', count: deptStats.inProgress, color: 'bg-blue-500', pct: deptStats.totalTasks > 0 ? Math.round(deptStats.inProgress / deptStats.totalTasks * 100) : 0 },
                    { label: '待审批/草稿', count: deptStats.pending, color: 'bg-amber-400', pct: deptStats.totalTasks > 0 ? Math.round(deptStats.pending / deptStats.totalTasks * 100) : 0 },
                  ].map(s => (
                    <div key={s.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-600 font-medium">{s.label}</span>
                        <span className="text-slate-400 font-bold">{s.count} ({s.pct}%)</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full ${s.color} rounded-full transition-all duration-500`} style={{ width: `${s.pct}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Tasks */}
              {deptStats.recentTasks.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-primary">task</span>
                    最近任务
                  </h3>
                  <div className="space-y-2">
                    {deptStats.recentTasks.map(task => {
                      const st = statusLabels[task.status] || { label: task.status, color: 'bg-slate-100 text-slate-600' };
                      return (
                        <div key={task.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <span className="text-xs font-bold text-slate-800 line-clamp-2 leading-snug">{task.title}</span>
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap shrink-0 ${st.color}`}>{st.label}</span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span>{task.assignee_name || '未分配'}</span>
                            <span className="font-bold text-primary">{task.progress || 0}%</span>
                          </div>
                          <div className="h-1 bg-slate-200 rounded-full mt-1.5 overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${task.progress || 0}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {deptStats.totalTasks === 0 && (
                <div className="text-center py-8 text-slate-400">
                  <span className="material-symbols-outlined text-4xl mb-2 block">assignment</span>
                  <p className="text-sm font-medium">该部门暂无绩效任务</p>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
