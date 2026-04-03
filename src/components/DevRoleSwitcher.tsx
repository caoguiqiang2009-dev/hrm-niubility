import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useIsMobile } from '../hooks/useIsMobile';

const APP_VERSION = 'v2.5.1';

interface OrgUser {
  id: string;
  name: string;
  role: string;
  title?: string;
  department_name?: string;
}

const ROLE_META: Record<string, { icon: string; color: string; label: string }> = {
  admin:    { icon: 'shield_person', color: 'bg-red-600', label: '管理员' },
  hr:       { icon: 'group', color: 'bg-rose-500', label: 'HR' },
  manager:  { icon: 'manage_accounts', color: 'bg-blue-500', label: '主管' },
  employee: { icon: 'person', color: 'bg-slate-500', label: '员工' },
};

export default function DevRoleSwitcher() {
  const { currentUser, logout } = useAuth();

  const loginWithMock = async (userId: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'mock_code', userId })
      });
      const data = await res.json();
      if (data.code === 0) {
        localStorage.setItem('token', data.data.token);
        window.location.reload();
      }
    } catch (e) {
      console.error(e);
    }
  };
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [allUsers, setAllUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(false);
  const isMobile = useIsMobile();

  // 在开发模式或测试服务器 (端口 4001) 显示
  const isDev = (import.meta as any).env?.DEV || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.port === '3000';
  const isTestServer = window.location.port === '4001';
  const shouldShow = isDev || isTestServer;

  if (!shouldShow) return null;

  // 面板打开时拉取全员列表
  useEffect(() => {
    if (!isOpen || allUsers.length > 0) return;
    setLoading(true);
    const token = localStorage.getItem('token');
    
    // 如果没有 token，用 mock 登录先获取一个
    const fetchUsers = async () => {
      try {
        let authToken = token;
        if (!authToken) {
          // 先用默认管理员账号登录拿 token
          const loginRes = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: 'mock_code', userId: 'CaoGuiQiang' })
          });
          const loginData = await loginRes.json();
          if (loginData.code === 0) {
            authToken = loginData.data.token;
          }
        }

        if (!authToken) return;
        
        // 拉取用户列表
        const res = await fetch('/api/org/users', {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        const json = await res.json();
        if (json.code === 0 && Array.isArray(json.data)) {
          setAllUsers(json.data);
        }
      } catch (e) {
        console.error('Failed to fetch users:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [isOpen]);

  // 搜索筛选
  const filtered = useMemo(() => {
    if (!search.trim()) return allUsers;
    const q = search.toLowerCase();
    return allUsers.filter(u => 
      u.name.toLowerCase().includes(q) || 
      u.id.toLowerCase().includes(q) ||
      (u.role && u.role.toLowerCase().includes(q))
    );
  }, [allUsers, search]);

  // 按角色分组
  const grouped = useMemo(() => {
    const groups: Record<string, OrgUser[]> = { admin: [], hr: [], manager: [], employee: [] };
    for (const u of filtered) {
      const key = (['admin', 'hr', 'manager'].includes(u.role)) ? u.role : 'employee';
      groups[key].push(u);
    }
    return groups;
  }, [filtered]);

  const getRoleMeta = (role: string) => ROLE_META[role] || ROLE_META.employee;

  return (
    <div className={`fixed left-6 z-[9999] ${isMobile ? 'bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))]' : 'bottom-6'}`}>
      {/* 悬浮主按钮 */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 border-2 shadow-2xl rounded-full flex items-center justify-center text-white hover:scale-105 transition-transform group relative overflow-hidden ${
          isTestServer 
            ? 'bg-orange-600 border-orange-400' 
            : 'bg-slate-900 border-slate-700'
        }`}
        title={isTestServer ? '测试环境 · 账号切换器' : '开发测试 · 账号切换器'}
      >
        <span className="material-symbols-outlined text-[28px] group-hover:rotate-12 transition-transform">swap_horizontal_circle</span>
        {/* 版本号角标 */}
        <span className="absolute -bottom-1 -right-1 bg-slate-800 text-white text-[7px] font-black px-1 py-0.5 rounded-full border border-slate-600 leading-none">
          {APP_VERSION}
        </span>
      </button>

      {/* 侧边弹出菜单 */}
      {isOpen && (
        <div className="absolute bottom-16 left-0 bg-white dark:bg-slate-900 w-72 max-h-[70vh] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-200 origin-bottom-left flex flex-col">
          {/* Header */}
          <div className={`px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center rounded-t-2xl ${
            isTestServer ? 'bg-orange-50 dark:bg-orange-950/30' : 'bg-slate-50 dark:bg-slate-950/50'
          }`}>
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest flex items-center">
              <span className={`material-symbols-outlined text-[14px] mr-1 ${isTestServer ? 'text-orange-500' : 'text-primary'}`}>
                {isTestServer ? 'science' : 'bug_report'}
              </span> 
              {isTestServer ? '测试环境 · 切换身份' : '开发 · 账号切换'}
            </h4>
            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>

          {/* 当前用户 */}
          {currentUser && (
            <div className="px-4 py-2 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900/50 flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full text-white flex items-center justify-center text-[12px] ${getRoleMeta(currentUser.role).color}`}>
                <span className="material-symbols-outlined text-[14px]">{getRoleMeta(currentUser.role).icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-blue-800 dark:text-blue-200 truncate">当前: {currentUser.name}</p>
                <p className="text-[10px] text-blue-600 dark:text-blue-400">{currentUser.title || currentUser.role}</p>
              </div>
              <span className="material-symbols-outlined text-[14px] text-green-500">check_circle</span>
            </div>
          )}

          {/* 搜索框 */}
          <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
            <div className="relative">
              <span className="material-symbols-outlined text-[16px] text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2">search</span>
              <input 
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="搜索姓名、ID、角色..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 border-none rounded-lg focus:ring-1 focus:ring-blue-400 outline-none"
                autoFocus
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              )}
            </div>
          </div>

          {/* 用户列表 */}
          <div className="flex-1 overflow-y-auto overscroll-contain p-2 space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-slate-400 text-xs">
                <span className="material-symbols-outlined animate-spin mr-2 text-[18px]">progress_activity</span>
                加载人员列表...
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                {search ? `未找到 "${search}"` : '暂无人员数据'}
              </div>
            ) : (
              Object.entries(grouped).map(([role, users]) => {
                if (users.length === 0) return null;
                const meta = getRoleMeta(role);
                return (
                  <div key={role}>
                    <div className="flex items-center gap-1.5 px-2 py-1">
                      <div className={`w-4 h-4 rounded-full ${meta.color} flex items-center justify-center`}>
                        <span className="material-symbols-outlined text-white text-[10px]">{meta.icon}</span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{meta.label} ({users.length})</span>
                    </div>
                    {users.map(user => {
                      const isActive = currentUser?.id === user.id;
                      return (
                        <button 
                          key={user.id}
                          onClick={() => { setIsOpen(false); loginWithMock(user.id); }}
                          disabled={isActive}
                          className={`w-full flex items-center gap-2.5 p-2 rounded-xl transition-all text-left ${
                            isActive 
                              ? 'bg-blue-50 dark:bg-blue-900/30 cursor-default ring-1 ring-blue-200 dark:ring-blue-800' 
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:pl-3 cursor-pointer'
                          }`}
                        >
                          <div className={`w-7 h-7 rounded-full text-white flex items-center justify-center text-sm font-bold shrink-0 ${meta.color}`}>
                            {user.name.slice(-1)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-bold leading-tight flex items-center gap-1 truncate ${isActive ? 'text-blue-700 dark:text-blue-300' : 'text-slate-800 dark:text-slate-100'}`}>
                              {user.name}
                              {isActive && <span className="material-symbols-outlined text-[12px] text-green-500">check_circle</span>}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">{user.id}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>


          {/* 底部工具 */}
          <div className="p-2 border-t border-slate-100 dark:border-slate-800 flex gap-2">
            <button onClick={() => { setIsOpen(false); logout(); }} className="flex-1 py-2 text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg flex items-center justify-center gap-1">
              <span className="material-symbols-outlined text-[14px]">logout</span>
              退出登录
            </button>
            <button onClick={() => { setAllUsers([]); setSearch(''); }} className="py-2 px-3 text-xs font-bold text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg flex items-center justify-center gap-1">
              <span className="material-symbols-outlined text-[14px]">refresh</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
