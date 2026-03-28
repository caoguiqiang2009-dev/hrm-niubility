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
  canManage,
  onDeptAction,
}: {
  node: DeptNode;
  depth: number;
  selectedId: number | null;
  onSelect: (id: number) => void;
  expandedIds: Set<number>;
  onToggle: (id: number) => void;
  canManage?: boolean;
  onDeptAction?: (action: 'create' | 'rename' | 'move' | 'delete', deptId: number, deptName: string) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false); };
    if (showMenu) document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [showMenu]);

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

        {/* 管理菜单 */}
        {canManage && (
          <div ref={menuRef} className="relative shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
              className="w-6 h-6 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 opacity-0 group-hover:opacity-100 transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">more_vert</span>
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                {[
                  { action: 'create' as const, icon: 'create_new_folder', label: '新建子部门', color: 'text-blue-600' },
                  { action: 'rename' as const, icon: 'edit', label: '重命名', color: 'text-amber-600' },
                  { action: 'move' as const, icon: 'drive_file_move', label: '移动部门', color: 'text-emerald-600' },
                  { action: 'delete' as const, icon: 'delete', label: '删除部门', color: 'text-red-500' },
                ].map(item => (
                  <button
                    key={item.action}
                    onClick={(e) => { e.stopPropagation(); setShowMenu(false); onDeptAction?.(item.action, node.id, node.name); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${item.color}`}
                  >
                    <span className="material-symbols-outlined text-[15px]">{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
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
              canManage={canManage}
              onDeptAction={onDeptAction}
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
  canManage,
  onDelete,
  onMove,
}: {
  user: UserInfo;
  isLeader: boolean;
  canManage?: boolean;
  onDelete?: (userId: string, name: string) => void;
  onMove?: (userId: string, name: string) => void;
}) {
  const rc = roleConfig[user.role] || roleConfig.employee;
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-4 hover:shadow-lg hover:border-primary/30 transition-all duration-300 relative overflow-hidden">
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
        
          </div>
        </div>
      </div>

      {/* 管理操作栏 */}
      {canManage && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          {confirmingDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-red-500 font-bold flex-1">确定设为离职？</span>
              <button
                onClick={() => setConfirmingDelete(false)}
                className="px-3 py-1 text-[11px] font-medium text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => { onDelete?.(user.id, user.name); setConfirmingDelete(false); }}
                className="px-3 py-1 text-[11px] font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
              >
                确认离职
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onMove?.(user.id, user.name)}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">swap_horiz</span>
                调整部门
              </button>
              <button
                onClick={() => setConfirmingDelete(true)}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-bold text-red-500 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">person_remove</span>
                设为离职
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ──────────────────── 主组件 ────────────────────
export default function OrgChart({ navigate }: { navigate: (view: string) => void }) {
  const { currentUser, hasPermission } = useAuth();
  const canManage = hasPermission('edit_org_info');

  const [tree, setTree] = useState<DeptNode[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<number | null>(null);
  const [deptDetail, setDeptDetail] = useState<DeptDetail | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [moveTarget, setMoveTarget] = useState<{ userId: string; name: string } | null>(null);
  const [moveDeptId, setMoveDeptId] = useState<number | null>(null);

  // 部门管理状态
  const [deptAction, setDeptAction] = useState<{ action: 'create' | 'rename' | 'move' | 'delete'; deptId: number; deptName: string } | null>(null);
  const [deptInputName, setDeptInputName] = useState('');
  const [deptMoveTargetId, setDeptMoveTargetId] = useState<number | null>(null);

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

  // 拉取/刷新组织树
  const refreshTree = useCallback(async (keepSelection = true) => {
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
        setExpandedIds(new Set(collectAllIds(data.data)));
        if (!keepSelection && data.data.length > 0) {
          setSelectedDeptId(data.data[0].id);
        }
      }
    } catch (err) {
      console.error('获取组织树失败', err);
    } finally {
      setLoading(false);
    }
  }, [countTree, collectAllIds]);

  useEffect(() => {
    refreshTree(false);
  }, [refreshTree]);

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

  // 删除成员 (设为离职)
  const handleDeleteMember = async (userId: string, name: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/org/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.code === 0) {
        // 刷新部门详情
        if (selectedDeptId) {
          const dres = await fetch(`/api/org/departments/${selectedDeptId}`, { headers: { Authorization: `Bearer ${token}` } });
          const ddata = await dres.json();
          if (ddata.code === 0) setDeptDetail(ddata.data);
        }
      } else {
        alert(json.message || '操作失败');
      }
    } catch { alert('网络异常'); }
  };

  // 调整部门
  const handleMoveMember = async () => {
    if (!moveTarget || !moveDeptId) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/org/users/${moveTarget.userId}/department`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ department_id: moveDeptId }),
      });
      const json = await res.json();
      if (json.code === 0) {
        setMoveTarget(null);
        setMoveDeptId(null);
        // 刷新当前部门
        if (selectedDeptId) {
          const dres = await fetch(`/api/org/departments/${selectedDeptId}`, { headers: { Authorization: `Bearer ${token}` } });
          const ddata = await dres.json();
          if (ddata.code === 0) setDeptDetail(ddata.data);
        }
      } else {
        alert(json.message || '操作失败');
      }
    } catch { alert('网络异常'); }
  };

  // 扁平化部门树 (用于调整部门选择器)
  const flatDepts = React.useMemo(() => {
    const result: { id: number; name: string; depth: number }[] = [];
    const walk = (nodes: DeptNode[], depth: number) => {
      for (const n of nodes) {
        result.push({ id: n.id, name: n.name, depth });
        walk(n.children, depth + 1);
      }
    };
    walk(tree, 0);
    return result;
  }, [tree]);

  // ── 部门管理 CRUD 操作 ──
  const handleDeptAction = (action: 'create' | 'rename' | 'move' | 'delete', deptId: number, deptName: string) => {
    setDeptAction({ action, deptId, deptName });
    if (action === 'rename') setDeptInputName(deptName);
    else if (action === 'create') setDeptInputName('');
    else if (action === 'move') setDeptMoveTargetId(null);
  };

  const handleDeptCrud = async () => {
    if (!deptAction) return;
    const token = localStorage.getItem('token');
    const { action, deptId } = deptAction;
    let url = '';
    let method = 'POST';
    let body: any = {};

    if (action === 'create') {
      if (!deptInputName.trim()) return;
      url = '/api/org/departments';
      body = { name: deptInputName.trim(), parent_id: deptId };
    } else if (action === 'rename') {
      if (!deptInputName.trim()) return;
      url = `/api/org/departments/${deptId}`;
      method = 'PUT';
      body = { name: deptInputName.trim() };
    } else if (action === 'move') {
      if (deptMoveTargetId === null) return;
      url = `/api/org/departments/${deptId}/parent`;
      method = 'PUT';
      body = { parent_id: deptMoveTargetId };
    } else if (action === 'delete') {
      url = `/api/org/departments/${deptId}`;
      method = 'DELETE';
    }

    try {
      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        ...(method !== 'DELETE' ? { body: JSON.stringify(body) } : {}),
      });
      const json = await res.json();
      if (json.code === 0) {
        setDeptAction(null);
        await refreshTree();
        // 若删除了当前选中的部门,清除选择
        if (action === 'delete' && selectedDeptId === deptId) {
          setSelectedDeptId(null);
          setDeptDetail(null);
        }
      } else {
        alert(json.message || '操作失败');
      }
    } catch { alert('网络异常'); }
  };

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
                        canManage={canManage}
                        onDeptAction={handleDeptAction}
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
                            canManage={canManage}
                            onDelete={handleDeleteMember}
                            onMove={(userId, name) => { setMoveTarget({ userId, name }); setMoveDeptId(null); }}
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

      {/* 部门管理弹窗 (新建/重命名/移动/删除) */}
      {deptAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setDeptAction(null)} />
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 animate-in zoom-in-95 fade-in duration-200">
            <h3 className="text-lg font-black flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">
                {deptAction.action === 'create' ? 'create_new_folder' :
                 deptAction.action === 'rename' ? 'edit' :
                 deptAction.action === 'move' ? 'drive_file_move' : 'delete'}
              </span>
              {deptAction.action === 'create' ? `在「${deptAction.deptName}」下新建子部门` :
               deptAction.action === 'rename' ? `重命名「${deptAction.deptName}」` :
               deptAction.action === 'move' ? `移动「${deptAction.deptName}」` :
               `删除「${deptAction.deptName}」`}
            </h3>

            {/* 新建 / 重命名 → 输入框 */}
            {(deptAction.action === 'create' || deptAction.action === 'rename') && (
              <input
                autoFocus
                value={deptInputName}
                onChange={e => setDeptInputName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleDeptCrud()}
                placeholder={deptAction.action === 'create' ? '输入新部门名称' : '输入新名称'}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            )}

            {/* 移动 → 部门选择器 */}
            {deptAction.action === 'move' && (
              <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => setDeptMoveTargetId(0)}
                  className={`w-full text-left px-4 py-2.5 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${deptMoveTargetId === 0 ? 'bg-primary/10 text-primary' : 'text-slate-600'}`}
                >
                  📌 顶级（无上级）
                </button>
                {flatDepts
                  .filter(d => d.id !== deptAction.deptId)
                  .map(d => (
                    <button
                      key={d.id}
                      onClick={() => setDeptMoveTargetId(d.id)}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${deptMoveTargetId === d.id ? 'bg-primary/10 text-primary font-bold' : 'text-slate-600'}`}
                      style={{ paddingLeft: `${d.depth * 20 + 16}px` }}
                    >
                      {'└ '.repeat(d.depth > 0 ? 1 : 0)}{d.name}
                    </button>
                  ))}
              </div>
            )}

            {/* 删除 → 确认提示 */}
            {deptAction.action === 'delete' && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-800">
                <p className="text-sm text-red-600 font-medium">
                  确定要删除「{deptAction.deptName}」吗？此操作不可撤销。
                </p>
                <p className="text-xs text-red-400 mt-1">
                  注意：如果该部门下有子部门或成员，需先移走才能删除。
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setDeptAction(null)}
                className="px-5 py-2 text-sm font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleDeptCrud}
                className={`px-5 py-2 text-sm font-bold text-white rounded-xl transition-colors ${
                  deptAction.action === 'delete' ? 'bg-red-500 hover:bg-red-600' : 'bg-primary hover:bg-primary/90'
                }`}
              >
                {deptAction.action === 'create' ? '创建' :
                 deptAction.action === 'rename' ? '保存' :
                 deptAction.action === 'move' ? '确认移动' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 调整部门弹窗 */}
      {moveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setMoveTarget(null)} />
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 fade-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">调整部门</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">将 <b className="text-slate-600">{moveTarget.name}</b> 调至新部门</p>
              </div>
              <button onClick={() => setMoveTarget(null)} className="p-1 text-slate-400 hover:text-slate-700 transition-colors">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <div className="px-6 py-5 max-h-[50vh] overflow-y-auto space-y-1">
              {flatDepts.map(d => (
                <button
                  key={d.id}
                  onClick={() => setMoveDeptId(d.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-sm flex items-center gap-2 transition-all ${
                    moveDeptId === d.id
                      ? 'bg-primary/10 text-primary font-bold ring-1 ring-primary/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                  style={{ paddingLeft: `${12 + d.depth * 20}px` }}
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {d.depth === 0 ? 'apartment' : 'folder'}
                  </span>
                  {d.name}
                  {moveDeptId === d.id && (
                    <span className="ml-auto material-symbols-outlined text-[16px] text-primary">check_circle</span>
                  )}
                </button>
              ))}
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setMoveTarget(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
                取消
              </button>
              <button onClick={handleMoveMember} disabled={!moveDeptId}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-primary hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm">
                确认调整
              </button>
            </div>
          </div>
        </div>
      )}
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
