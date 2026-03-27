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

interface DeptDetail {
  id: number;
  name: string;
  parent_id: number;
  members: { id: string; name: string; title: string; avatar_url: string; role: string; status: string }[];
}

const deptIcons = ['apartment', 'business', 'domain', 'corporate_fare', 'store', 'hub', 'workspaces', 'folder', 'group_work'];
const deptColors = [
  { bg: 'bg-blue-50', text: 'text-blue-600', gradient: 'from-blue-500 to-cyan-500' },
  { bg: 'bg-emerald-50', text: 'text-emerald-600', gradient: 'from-emerald-500 to-teal-500' },
  { bg: 'bg-violet-50', text: 'text-violet-600', gradient: 'from-violet-500 to-purple-500' },
  { bg: 'bg-rose-50', text: 'text-rose-600', gradient: 'from-rose-500 to-pink-500' },
  { bg: 'bg-amber-50', text: 'text-amber-600', gradient: 'from-amber-500 to-orange-500' },
  { bg: 'bg-cyan-50', text: 'text-cyan-600', gradient: 'from-cyan-500 to-sky-500' },
];

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
  const [deptDetail, setDeptDetail] = useState<DeptDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

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

  useEffect(() => {
    if (!selectedDeptId) return;
    (async () => {
      setDetailLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/org/departments/${selectedDeptId}`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (data.code === 0) setDeptDetail(data.data);
      } catch (err) {
        console.error(err);
      } finally {
        setDetailLoading(false);
      }
    })();
  }, [selectedDeptId]);

  // Recursive rendering of org tree nodes
  const renderNode = useCallback((node: DeptNode, depth: number, idx: number) => {
    const color = deptColors[idx % deptColors.length];
    const icon = deptIcons[idx % deptIcons.length];
    const totalMembers = getTotalMembers(node);
    const isRoot = depth === 0;
    const isSelected = selectedDeptId === node.id;

    return (
      <div key={node.id} className="flex flex-col items-center">
        {/* Vertical connector from parent */}
        {depth > 0 && <div className="w-0.5 h-8 bg-slate-200"></div>}

        {/* Node card */}
        <div
          onClick={() => setSelectedDeptId(node.id)}
          className={`cursor-pointer transition-all duration-200 ${
            isRoot
              ? `w-64 p-5 rounded-2xl bg-gradient-to-br ${color.gradient} text-white shadow-xl ${isSelected ? 'ring-4 ring-primary/30 scale-105' : 'hover:scale-105'}`
              : `w-52 p-4 rounded-xl bg-white shadow-sm border ${isSelected ? 'ring-2 ring-primary border-primary/30 shadow-md' : 'border-slate-100 hover:shadow-md hover:border-primary/20'}`
          }`}
        >
          {isRoot ? (
            <>
              <span className="text-[10px] font-bold opacity-80 uppercase tracking-wider">总公司</span>
              <h3 className="text-lg font-black mt-1">{node.name}</h3>
              <div className="mt-4 pt-3 border-t border-white/20 grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] opacity-70">总人数</p>
                  <p className="text-base font-black">{totalMembers}</p>
                </div>
                <div>
                  <p className="text-[10px] opacity-70">直属部门</p>
                  <p className="text-base font-black">{node.children.length}</p>
                </div>
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
                <div className="flex gap-1.5 flex-wrap">
                  <span className={`px-2 py-0.5 ${color.bg} ${color.text} rounded text-[9px] font-bold`}>
                    子部门 ×{node.children.length}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Children */}
        {node.children.length > 0 && (
          <>
            <div className="w-0.5 h-8 bg-slate-200"></div>
            {/* Horizontal connector */}
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
          {/* Header */}
          <div className="mb-8">
            <h2 className="text-3xl font-black text-on-surface font-headline tracking-tight flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                account_tree
              </span>
              人力地图
            </h2>
            <p className="text-on-surface-variant font-label mt-1">
              可视化组织结构 · 实时人员分布
            </p>
          </div>

          {/* Organization Map */}
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
            ) : (
              tree.map((node, i) => renderNode(node, 0, i))
            )}
          </div>
        </section>
      </main>

      {/* Right Drawer - Department Detail */}
      {!!selectedDeptId && (
        <div
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-50"
          onClick={() => setSelectedDeptId(null)}
        />
      )}
      <div
        className={`fixed top-0 right-0 h-full w-[400px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out overflow-y-auto ${
          !!selectedDeptId ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <span className="inline-block px-2 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold uppercase tracking-widest rounded mb-3">
                部门画像
              </span>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">{deptDetail?.name || '加载中...'}</h2>
            </div>
            <button
              onClick={() => setSelectedDeptId(null)}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          {detailLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : deptDetail ? (
            <>
              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                  <p className="text-xs text-slate-500 mb-1">部门成员</p>
                  <p className="text-3xl font-black text-slate-900">{deptDetail.members?.length || 0}</p>
                </div>
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                  <p className="text-xs text-slate-500 mb-1">上级部门 ID</p>
                  <p className="text-3xl font-black text-blue-600">#{deptDetail.parent_id || 0}</p>
                </div>
              </div>

              {/* Members */}
              <div>
                <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-primary">group</span>
                  成员列表 ({deptDetail.members?.length || 0})
                </h3>
                <div className="space-y-0">
                  {deptDetail.members?.length ? (
                    deptDetail.members.map((m, i) => (
                      <div key={m.id} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
                        <div className="flex items-center gap-3">
                          {m.avatar_url ? (
                            <img src={m.avatar_url} alt={m.name} className="w-10 h-10 rounded-full object-cover" />
                          ) : (
                            <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${deptColors[i % deptColors.length].gradient} flex items-center justify-center text-white font-bold text-sm`}>
                              {m.name[0]}
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-bold text-slate-900">{m.name}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{m.title || '员工'}</p>
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                          m.role === 'manager' ? 'bg-amber-50 text-amber-600' :
                          m.role === 'hr' ? 'bg-purple-50 text-purple-600' :
                          m.role === 'admin' ? 'bg-red-50 text-red-600' :
                          'bg-slate-50 text-slate-500'
                        }`}>
                          {m.role === 'manager' ? '主管' :
                           m.role === 'hr' ? 'HR' :
                           m.role === 'admin' ? '管理员' : '员工'}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-slate-400 text-sm">暂无成员</div>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
