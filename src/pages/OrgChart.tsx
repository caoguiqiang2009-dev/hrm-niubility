import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';

interface DeptNode {
  id: number;
  name: string;
  parent_id: number;
  leader_user_id: string | null;
  region: string | null;
  member_count: number;
  children: DeptNode[];
}

interface UserInfo {
  id: string;
  name: string;
  title: string;
  avatar_url: string;
  role: string;
  status: string;
}

interface DeptDetail {
  id: number;
  name: string;
  parent_id: number;
  leader_user_id: string | null;
  region: string | null;
  members: UserInfo[];
}

// 角色中文标签 + 颜色
const roleConfig: Record<string, { label: string; color: string; bg: string }> = {
  admin: { label: '管理员', color: 'text-purple-700', bg: 'bg-purple-100' },
  hr: { label: 'HR', color: 'text-rose-700', bg: 'bg-rose-100' },
  manager: { label: '主管', color: 'text-blue-700', bg: 'bg-blue-100' },
  employee: { label: '员工', color: 'text-emerald-700', bg: 'bg-emerald-100' },
};

// ──────────────────── 单个树节点 ────────────────────
function TreeNode({
  node,
  depth,
  selectedId,
  onSelect,
  expandedIds,
  onToggle,
}: {
  node: DeptNode;
  depth: number;
  selectedId: number | null;
  onSelect: (id: number) => void;
  expandedIds: Set<number>;
  onToggle: (id: number) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;

  const depthColors = [
    'border-primary/40',
    'border-secondary/40',
    'border-tertiary/40',
    'border-outline/30',
  ];
  const borderColor = depthColors[Math.min(depth, depthColors.length - 1)];

  return (
    <div className="select-none">
      <div
        onClick={() => onSelect(node.id)}
        className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 border-l-[3px] ${borderColor} ${
          isSelected
            ? 'bg-primary/10 dark:bg-primary/20 shadow-sm'
            : 'hover:bg-slate-100 dark:hover:bg-slate-800/60'
        }`}
      >
        {/* 展开/折叠 */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.id);
            }}
            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0"
          >
            <span
              className={`material-symbols-outlined text-[16px] text-slate-500 transition-transform duration-200 ${
                isExpanded ? 'rotate-90' : ''
              }`}
            >
              chevron_right
            </span>
          </button>
        ) : (
          <span className="w-6 h-6 flex items-center justify-center shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
          </span>
        )}

        {/* 部门图标 */}
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
            isSelected
              ? 'bg-primary text-white shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 group-hover:bg-slate-200 dark:group-hover:bg-slate-700'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">
            {depth === 0 ? 'apartment' : hasChildren ? 'folder' : 'workspaces'}
          </span>
        </div>

        {/* 部门信息 */}
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-bold truncate ${
              isSelected ? 'text-primary' : 'text-slate-800 dark:text-slate-100'
            }`}
          >
            {node.name}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            {node.region && (
              <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                <span className="material-symbols-outlined text-[10px]">location_on</span>
                {node.region}
              </span>
            )}
          </div>
        </div>

        {/* 人数徽章 */}
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
            isSelected
              ? 'bg-primary/20 text-primary'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
          }`}
        >
          {node.member_count} 人
        </span>
      </div>

      {/* 子节点递归 */}
      {hasChildren && isExpanded && (
        <div className="ml-5 mt-1 space-y-0.5 animate-in slide-in-from-top-2 fade-in duration-200">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              expandedIds={expandedIds}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ──────────────────── 人员卡片 ────────────────────
function MemberCard({
  user,
  isLeader,
}: {
  user: UserInfo;
  isLeader: boolean;
}) {
  const rc = roleConfig[user.role] || roleConfig.employee;

  return (
    <div className="group bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-4 hover:shadow-lg hover:border-primary/30 transition-all duration-300 relative overflow-hidden">
      {isLeader && (
        <div className="absolute top-0 right-0">
          <div className="bg-amber-400 text-amber-900 text-[9px] font-black px-3 py-0.5 rounded-bl-xl flex items-center gap-0.5">
            <span className="material-symbols-outlined text-[10px]">star</span>
            负责人
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        {/* 头像 */}
        <div className="relative shrink-0">
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user.name}
              className="w-12 h-12 rounded-xl object-cover ring-2 ring-slate-200/50 dark:ring-slate-700/50"
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center ring-2 ring-slate-200/50">
              <span className="text-lg font-black text-primary">{user.name[0]}</span>
            </div>
          )}
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 ${
              user.status === 'active' ? 'bg-emerald-400' : 'bg-slate-300'
            }`}
          ></span>
        </div>

        {/* 信息 */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{user.name}</p>
          <p className="text-xs text-slate-500 mt-0.5 truncate">{user.title || '暂无职位'}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${rc.bg} ${rc.color}`}>
              {rc.label}
            </span>
            <span className="text-[10px] text-slate-400">ID: {user.id}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────── 主组件 ────────────────────
export default function OrgChart({ navigate }: { navigate: (view: string) => void }) {
  const { currentUser } = useAuth();

  const [tree, setTree] = useState<DeptNode[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<number | null>(null);
  const [deptDetail, setDeptDetail] = useState<DeptDetail | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  // 统计
  const [stats, setStats] = useState({ deptCount: 0, totalMembers: 0 });

  // 递归统计节点
  const countTree = useCallback((nodes: DeptNode[]): { depts: number; members: number } => {
    let depts = 0;
    let members = 0;
    for (const n of nodes) {
      depts += 1;
      members += n.member_count;
      const sub = countTree(n.children);
      depts += sub.depts;
      members += sub.members;
    }
    return { depts, members };
  }, []);

  // 递归展开所有节点 ID
  const collectAllIds = useCallback((nodes: DeptNode[]): number[] => {
    const ids: number[] = [];
    for (const n of nodes) {
      ids.push(n.id);
      ids.push(...collectAllIds(n.children));
    }
    return ids;
  }, []);

  // 拉取组织树
  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/org/tree', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.code === 0) {
          setTree(data.data);
          const c = countTree(data.data);
          setStats({ deptCount: c.depts, totalMembers: c.members });
          // 默认展开全部
          setExpandedIds(new Set(collectAllIds(data.data)));
          // 自动选中第一个
          if (data.data.length > 0) {
            setSelectedDeptId(data.data[0].id);
          }
        }
      } catch (err) {
        console.error('获取组织树失败', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [countTree, collectAllIds]);

  // 拉取部门详情
  useEffect(() => {
    if (selectedDeptId === null) return;
    (async () => {
      setDetailLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/org/departments/${selectedDeptId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.code === 0) setDeptDetail(data.data);
      } catch (err) {
        console.error('获取部门详情失败', err);
      } finally {
        setDetailLoading(false);
      }
    })();
  }, [selectedDeptId]);

  const handleToggle = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExpandAll = () => setExpandedIds(new Set(collectAllIds(tree)));
  const handleCollapseAll = () => setExpandedIds(new Set());

  return (
    <div className="flex h-screen overflow-hidden bg-background text-on-surface font-body selection:bg-primary-fixed">
      <Sidebar currentView="org" navigate={navigate} />

      <main className="flex-1 h-[calc(100vh-4rem)] mt-16 overflow-y-auto">
        <div className="pt-4 pb-12 px-8">
          {/* 标题区 */}
          <section className="mb-6 flex justify-between items-end">
            <div>
              <h2 className="text-3xl font-black text-on-surface font-headline tracking-tight flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                  account_tree
                </span>
                组织架构管理
              </h2>
              <p className="text-on-surface-variant font-label mt-1">
                当前登录：{currentUser?.name} · 可视化查看部门层级与成员详情
              </p>
            </div>
          </section>

          {/* 统计卡片 */}
          <section className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: 'apartment', label: '部门总数', value: stats.deptCount, color: 'from-blue-500 to-cyan-400' },
              { icon: 'group', label: '在册人员', value: stats.totalMembers, color: 'from-emerald-500 to-teal-400' },
              { icon: 'layers', label: '层级深度', value: tree.length > 0 ? getMaxDepth(tree) : 0, color: 'from-amber-500 to-orange-400' },
              { icon: 'share', label: '汇报关系', value: stats.totalMembers > 0 ? stats.totalMembers - 1 : 0, color: 'from-purple-500 to-pink-400' },
            ].map((s) => (
              <div
                key={s.label}
                className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-4 flex items-center gap-4 hover:shadow-md transition-all"
              >
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center text-white shadow-sm`}>
                  <span className="material-symbols-outlined text-lg">{s.icon}</span>
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-800 dark:text-slate-100 leading-tight">{s.value}</p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{s.label}</p>
                </div>
              </div>
            ))}
          </section>

          {/* 主体：左树 + 右详情 */}
          <section className="flex flex-col lg:flex-row gap-6">
            {/* 左侧：组织树 */}
            <div className="w-full lg:w-[380px] shrink-0">
              <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl overflow-hidden sticky top-4">
                {/* 头部 */}
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      lan
                    </span>
                    部门层级树
                  </h3>
                  <div className="flex items-center gap-1">
                    <button onClick={handleExpandAll} className="text-[10px] font-bold text-slate-500 hover:text-primary px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                      全部展开
                    </button>
                    <span className="text-slate-300">|</span>
                    <button onClick={handleCollapseAll} className="text-[10px] font-bold text-slate-500 hover:text-primary px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                      全部折叠
                    </button>
                  </div>
                </div>

                {/* 树 */}
                <div className="p-3 max-h-[60vh] overflow-y-auto space-y-0.5">
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : tree.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                      <span className="material-symbols-outlined text-4xl mb-2 block">folder_off</span>
                      <p className="text-sm font-bold">暂无组织数据</p>
                    </div>
                  ) : (
                    tree.map((node) => (
                      <TreeNode
                        key={node.id}
                        node={node}
                        depth={0}
                        selectedId={selectedDeptId}
                        onSelect={setSelectedDeptId}
                        expandedIds={expandedIds}
                        onToggle={handleToggle}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* 右侧：部门详情 */}
            <div className="flex-1 min-w-0">
              {detailLoading ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl flex items-center justify-center py-24">
                  <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : !deptDetail ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl flex flex-col items-center justify-center py-24 text-slate-400">
                  <span className="material-symbols-outlined text-5xl mb-3">touch_app</span>
                  <p className="text-sm font-bold">请从左侧选择一个部门查看详情</p>
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  {/* 部门信息头 */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl overflow-hidden">
                    <div className="bg-gradient-to-r from-primary/5 via-secondary/5 to-tertiary/5 p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white shadow-lg shadow-primary/20">
                            <span className="material-symbols-outlined text-2xl">corporate_fare</span>
                          </div>
                          <div>
                            <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">
                              {deptDetail.name}
                            </h3>
                            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                              <span className="flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-[12px]">tag</span>
                                ID: {deptDetail.id}
                              </span>
                              {deptDetail.region && (
                                <span className="flex items-center gap-0.5">
                                  <span className="material-symbols-outlined text-[12px]">location_on</span>
                                  {deptDetail.region}
                                </span>
                              )}
                              <span className="flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-[12px]">group</span>
                                {deptDetail.members.length} 人
                              </span>
                              {deptDetail.parent_id > 0 && (
                                <span className="flex items-center gap-0.5">
                                  <span className="material-symbols-outlined text-[12px]">subdirectory_arrow_left</span>
                                  上级部门 ID: {deptDetail.parent_id}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 成员列表 */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                          group
                        </span>
                        部门成员 ({deptDetail.members.length})
                      </h4>
                    </div>

                    {deptDetail.members.length === 0 ? (
                      <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-12 text-center text-slate-400">
                        <span className="material-symbols-outlined text-4xl mb-2 block">person_off</span>
                        <p className="text-sm font-bold">该部门暂无成员</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {/* 负责人优先排序 */}
                        {sortMembers(deptDetail.members, deptDetail.leader_user_id).map((user) => (
                          <MemberCard
                            key={user.id}
                            user={user}
                            isLeader={user.id === deptDetail.leader_user_id}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 汇报关系可视化 */}
                  {deptDetail.leader_user_id && deptDetail.members.length > 1 && (
                    <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-6">
                      <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-5">
                        <span className="material-symbols-outlined text-[16px] text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }}>
                          schema
                        </span>
                        汇报关系图
                      </h4>
                      <div className="flex flex-col items-center">
                        {/* 上级 */}
                        {(() => {
                          const leader = deptDetail.members.find((m) => m.id === deptDetail.leader_user_id);
                          if (!leader) return null;
                          return (
                            <div className="flex flex-col items-center">
                              <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 border-2 border-amber-300/60 rounded-2xl px-6 py-3 flex items-center gap-3 shadow-sm">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center text-white font-black text-sm shadow-sm">
                                  {leader.name[0]}
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{leader.name}</p>
                                  <p className="text-[10px] text-slate-500">{leader.title} · 部门负责人</p>
                                </div>
                              </div>

                              {/* 垂直连线 */}
                              <div className="w-px h-8 bg-gradient-to-b from-amber-300 to-slate-300"></div>
                              <div className="w-3 h-3 rounded-full border-2 border-slate-300 bg-white dark:bg-slate-900"></div>

                              {/* 横线 + 分支 */}
                              {deptDetail.members.filter((m) => m.id !== deptDetail.leader_user_id).length > 0 && (
                                <>
                                  <div className="w-px h-4 bg-slate-300"></div>
                                  <div className="flex flex-wrap items-start justify-center gap-4 relative">
                                    {/* 横线 */}
                                    <div className="absolute top-0 left-1/4 right-1/4 h-px bg-slate-200"></div>
                                    {deptDetail.members
                                      .filter((m) => m.id !== deptDetail.leader_user_id)
                                      .map((sub) => (
                                        <div key={sub.id} className="flex flex-col items-center">
                                          <div className="w-px h-4 bg-slate-300"></div>
                                          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 flex items-center gap-2.5 hover:shadow-md transition-all hover:border-primary/30">
                                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/15 to-secondary/15 flex items-center justify-center">
                                              <span className="text-xs font-black text-primary">{sub.name[0]}</span>
                                            </div>
                                            <div>
                                              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{sub.name}</p>
                                              <p className="text-[9px] text-slate-400">{sub.title}</p>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

// ──── 工具函数 ────
function getMaxDepth(nodes: DeptNode[]): number {
  if (nodes.length === 0) return 0;
  return 1 + Math.max(0, ...nodes.map((n) => getMaxDepth(n.children)));
}

function sortMembers(members: UserInfo[], leaderId: string | null): UserInfo[] {
  return [...members].sort((a, b) => {
    if (a.id === leaderId) return -1;
    if (b.id === leaderId) return 1;
    return 0;
  });
}
