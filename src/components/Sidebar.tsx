import React, { useState, useEffect, useRef } from 'react';
import { changelogData, getLatestVersion } from '../data/changelog';
import { useAuth } from '../context/AuthContext';
import UserGuide from './UserGuide';
import { useIsMobile } from '../hooks/useIsMobile';

interface SidebarProps {
  currentView: string;
  navigate: (view: string) => void;
}

export default function Sidebar({ currentView, navigate }: SidebarProps) {
  const isMobile = useIsMobile();
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);
  const [payslipData, setPayslipData] = useState<any>(null);
  const [payslipLoading, setPayslipLoading] = useState(false);
  const [showPayslipModal, setShowPayslipModal] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLDivElement>(null);
  const { currentUser, logout, hasPermission } = useAuth();

  // 消息盒状态
  const [isInboxOpen, setIsInboxOpen] = useState(false);
  const [inboxMessages, setInboxMessages] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const inboxRef = useRef<HTMLDivElement>(null);

  // permKey → 对应 /api/permissions/definitions 中的功能模块 key
  const navItems = [
    { id: 'dashboard', icon: 'home', label: '我的主页', permKey: 'view_dashboard' },
    { id: 'team', icon: 'groups', label: '我的团队', permKey: 'view_team_perf' },
    { id: 'company', icon: 'local_fire_department', label: '赏金榜', permKey: 'view_company_pool', special: true },
    { id: 'hrmap', icon: 'map', label: '人力地图', permKey: 'view_hr_map' },
    { id: 'panorama', icon: 'view_quilt', label: '全景仪表盘', permKey: 'view_panorama' },
    { id: 'org', icon: 'account_tree', label: '组织关系', permKey: 'view_org_chart' },
  ].filter(item => !item.permKey || hasPermission(item.permKey));


  useEffect(() => {
    // Check if user has read the latest version changelog
    const lastSeenVersion = localStorage.getItem('hrm_last_seen_version');
    if (lastSeenVersion !== getLatestVersion()) {
      setHasUnread(true);
    }

    // Click outside to close generic handler
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
      if (avatarRef.current && !avatarRef.current.contains(event.target as Node)) {
        setIsAvatarMenuOpen(false);
      }
      if (inboxRef.current && !inboxRef.current.contains(event.target as Node)) {
        setIsInboxOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 获取通知列表和未读数
  const fetchInbox = async () => {
    try {
      const token = localStorage.getItem('token');
      const [msgRes, countRes] = await Promise.all([
        fetch('/api/notifications?limit=20', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/notifications/unread-count', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const msgJson = await msgRes.json();
      const countJson = await countRes.json();
      if (msgJson.code === 0) setInboxMessages(msgJson.data || []);
      if (countJson.code === 0) setUnreadCount(countJson.data?.count || 0);
    } catch {}
  };

  useEffect(() => {
    fetchInbox();
    const interval = setInterval(fetchInbox, 30000); // 每30秒刷新
    return () => clearInterval(interval);
  }, []);

  const markRead = async (id: number) => {
    const token = localStorage.getItem('token');
    await fetch(`/api/notifications/${id}/read`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    fetchInbox();
  };

  const markAllRead = async () => {
    const token = localStorage.getItem('token');
    await fetch('/api/notifications/read-all', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    fetchInbox();
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return '刚刚';
    if (diffMin < 60) return `${diffMin}分钟前`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}小时前`;
    return `${Math.floor(diffHr / 24)}天前`;
  };

  const NOTIF_ICON: Record<string, string> = {
    proposal: 'description',
    perf: 'trending_up',
    salary: 'payments',
    system: 'settings',
    role_claim: 'assignment_ind',
    pool_task: 'local_fire_department',
  };

  const handleNotifClick = () => {
    setIsNotifOpen(!isNotifOpen);
    if (hasUnread) {
      setHasUnread(false);
      localStorage.setItem('hrm_last_seen_version', getLatestVersion());
    }
  };

  const handleViewPayslip = async () => {
    setIsAvatarMenuOpen(false);
    setShowPayslipModal(true);
    setPayslipLoading(true);
    try {
      const token = localStorage.getItem('token');
      const month = new Date().toISOString().slice(0, 7);
      const res = await fetch(`/api/salary/payslip/${currentUser?.id}?month=${month}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setPayslipData(json.code === 0 ? json.data : null);
    } catch { setPayslipData(null); }
    setPayslipLoading(false);
  };

  // ── 移动端底部 Tab 配置 ──
  const mobileTabs = [
    { id: 'dashboard', icon: 'home', label: '首页' },
    { id: 'company', icon: 'local_fire_department', label: '赏金榜' },
    { id: 'workflows', icon: 'assignment', label: '流程' },
    { id: 'personal', icon: 'flag', label: '目标' },
    { id: '_me', icon: 'person', label: '我的' },
  ];
  const [showMePanel, setShowMePanel] = useState(false);

  return (
    <>
    {/* ── Desktop Header (unchanged) ── */}
    <header className={`h-16 w-full fixed top-0 left-0 right-0 flex items-center justify-between px-6 border-b border-slate-200/60 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-950 font-['Inter'] z-50 transition-all duration-200 ${isMobile ? 'px-4' : ''}`}>
      {/* Left Logo */}
      <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => navigate('dashboard')}>
        <h1 className="text-[17px] font-black bg-gradient-to-br from-[#0060a9] to-[#409eff] text-transparent bg-clip-text tracking-tighter">You!Niubility!</h1>
        <span className="text-[9px] bg-[#0060a9]/10 text-[#0060a9] px-1.5 py-0.5 rounded font-bold uppercase tracking-widest mt-0.5 border border-[#0060a9]/20">HRM</span>
      </div>

      {/* Center Navigation */}
      <nav className="absolute left-1/2 -translate-x-1/2 hidden lg:flex items-center gap-2">
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all duration-200 group ${
                item.special 
                  ? isActive 
                    ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold shadow-md shadow-orange-500/30'
                    : 'bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/40 font-bold border border-orange-200 dark:border-orange-800/50'
                  : isActive
                  ? 'bg-white dark:bg-slate-900 text-[#0060a9] dark:text-[#409eff] font-bold shadow-sm border border-slate-200/50 dark:border-slate-800/50'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-900/60 hover:text-slate-900 dark:hover:text-slate-100 font-medium'
              }`}
            >
              <span 
                className={`material-symbols-outlined text-sm ${isActive ? '' : 'group-hover:scale-110 transition-transform'}`} 
                style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
              >
                {item.icon}
              </span>
              <span className="text-xs tracking-wide">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Right Controls */}
      <div className="flex items-center gap-1">
        {/* 精简版搜索 */}
        <button className="p-2 mr-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors hidden md:block" title="搜索">
          <span className="material-symbols-outlined text-[20px]">search</span>
        </button>

        {/* 消息盒 Bell Icon */}
        <div ref={inboxRef} className="relative">
          <button onClick={() => { setIsInboxOpen(p => !p); if (!isInboxOpen) fetchInbox(); }}
            className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <span className="material-symbols-outlined text-slate-500 text-[20px]">mail</span>
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 animate-pulse">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {isInboxOpen && (
            isMobile ? (
              /* 移动端：底部全屏抽屉 */
              <div className="fixed inset-0 z-[60]">
                <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setIsInboxOpen(false)} />
                <div className="absolute bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] left-0 right-0 bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl mobile-drawer-enter overflow-hidden max-h-[70vh] flex flex-col">
                  <div className="flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 bg-slate-200 dark:bg-slate-700 rounded-full" />
                  </div>
                  <div className="px-5 pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <h3 className="font-bold text-base text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-blue-500">inbox</span>
                      消息盒
                      {unreadCount > 0 && <span className="text-[11px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold">{unreadCount}</span>}
                    </h3>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} className="text-xs text-blue-500 hover:text-blue-700 font-bold px-3 py-1.5 rounded-lg bg-blue-50">全部已读</button>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {inboxMessages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                        <span className="material-symbols-outlined text-5xl mb-3 opacity-20">notifications_off</span>
                        <p className="text-sm">暂无消息</p>
                      </div>
                    ) : inboxMessages.map((msg: any) => (
                      <div key={msg.id}
                        onClick={() => {
                          markRead(msg.id);
                          const view = msg.link ? msg.link.replace(/^\//, '').split('?')[0] : 'dashboard';
                          navigate(view || 'dashboard');
                          setIsInboxOpen(false);
                          setInboxMessages(prev => prev.filter(m => m.id !== msg.id));
                          setUnreadCount(prev => Math.max(0, prev - 1));
                        }}
                        className={`px-5 py-4 border-b border-slate-50 dark:border-slate-800/50 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors active:bg-slate-100 ${!msg.is_read ? 'bg-blue-50/40 dark:bg-blue-900/10' : ''}`}>
                        <div className="flex gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${!msg.is_read ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-slate-100 dark:bg-slate-800'}`}>
                            <span className={`material-symbols-outlined text-[18px] ${!msg.is_read ? 'text-blue-600' : 'text-slate-400'}`}>
                              {NOTIF_ICON[msg.type] || 'notifications'}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <p className={`text-sm font-bold truncate ${!msg.is_read ? 'text-slate-800 dark:text-slate-100' : 'text-slate-500'}`}>{msg.title}</p>
                              <span className="text-[11px] text-slate-400 flex-shrink-0 ml-2">{formatTime(msg.created_at)}</span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">{msg.content}</p>
                          </div>
                          {!msg.is_read && <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2" />}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* 桌面端：原有下拉 */
              <div className="absolute right-0 top-12 w-80 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200/60 dark:border-slate-800 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-blue-500">inbox</span>
                    消息盒
                    {unreadCount > 0 && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold">{unreadCount}</span>}
                  </h3>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="text-[10px] text-blue-500 hover:text-blue-700 font-bold">全部已读</button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {inboxMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                      <span className="material-symbols-outlined text-4xl mb-2 opacity-30">notifications_off</span>
                      <p className="text-xs">暂无消息</p>
                    </div>
                  ) : inboxMessages.map((msg: any) => (
                    <div key={msg.id}
                      onClick={() => {
                        markRead(msg.id);
                        const view = msg.link ? msg.link.replace(/^\//, '').split('?')[0] : 'dashboard';
                        navigate(view || 'dashboard');
                        setIsInboxOpen(false);
                        setInboxMessages(prev => prev.filter(m => m.id !== msg.id));
                        setUnreadCount(prev => Math.max(0, prev - 1));
                      }}
                      className="px-4 py-3 border-b border-slate-50 dark:border-slate-800/50 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors bg-blue-50/50 dark:bg-blue-900/10">
                      <div className="flex gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${!msg.is_read ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-slate-100 dark:bg-slate-800'}`}>
                          <span className={`material-symbols-outlined text-[16px] ${!msg.is_read ? 'text-blue-600' : 'text-slate-400'}`}>
                            {NOTIF_ICON[msg.type] || 'notifications'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <p className={`text-xs font-bold truncate ${!msg.is_read ? 'text-slate-800 dark:text-slate-100' : 'text-slate-500'}`}>{msg.title}</p>
                            <span className="text-[10px] text-slate-400 flex-shrink-0 ml-2">{formatTime(msg.created_at)}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">{msg.content}</p>
                        </div>
                        {!msg.is_read && <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5" />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
        <div className="h-6 w-px bg-slate-200/60 dark:bg-slate-800/60 mx-1"></div>
        {/* Avatar Dropdown */}
        <div ref={avatarRef} className="relative ml-2">
          <div onClick={() => setIsAvatarMenuOpen(p => !p)}
            className="flex items-center gap-2 cursor-pointer p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            {/* 首字母头像 */}
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-[#0060a9] to-[#3085d6] text-white font-bold text-[13px] shadow-sm ring-2 ring-white dark:ring-slate-900">
              {(currentUser?.name || "U").charAt(0).toUpperCase()}
            </div>
            <span className="material-symbols-outlined text-slate-400 text-[16px] hidden md:block">expand_more</span>
          </div>

          {isAvatarMenuOpen && (
            <div className="absolute right-0 top-12 w-52 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200/60 dark:border-slate-800 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{currentUser?.name}</p>
                <p className="text-[10px] text-slate-400">{currentUser?.role === 'admin' ? '系统管理员' : currentUser?.role === 'hr' ? 'HR总监' : currentUser?.role === 'manager' ? '主管' : '员工'}</p>
              </div>
            <div className="py-1">
                <button onClick={handleNotifClick}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <span className="relative">
                    <span className="material-symbols-outlined text-[16px] text-amber-500">notifications</span>
                    {hasUnread && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full"></span>}
                  </span>
                  更新通知{hasUnread && <span className="ml-1 text-[10px] text-red-500 font-bold">· 新</span>}
                </button>
                <button onClick={handleViewPayslip}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <span className="material-symbols-outlined text-[16px] text-emerald-600">payments</span>
                  我的工资单
                </button>
                <button onClick={() => { setIsAvatarMenuOpen(false); navigate('personal'); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <span className="material-symbols-outlined text-[16px] text-blue-500">manage_accounts</span>
                  个人设置
                </button>
                {(hasPermission('module_competency') || hasPermission('module_competency_eval') || currentUser?.is_super_admin) && (
                  <button onClick={() => { setIsAvatarMenuOpen(false); navigate('competency'); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <span className="material-symbols-outlined text-[16px] text-indigo-500">psychology</span>
                    能力大盘
                  </button>
                )}
                {hasPermission('view_admin') && (
                  <button onClick={() => { setIsAvatarMenuOpen(false); navigate('admin'); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <span className="material-symbols-outlined text-[16px] text-violet-600">admin_panel_settings</span>
                    管理后台
                  </button>
                )}
                <button onClick={() => { setIsAvatarMenuOpen(false); setShowGuide(true); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <span className="material-symbols-outlined text-[16px] text-blue-500">menu_book</span>
                  使用说明
                </button>
              </div>
              <div className="border-t border-slate-100 dark:border-slate-800 py-1">
                <button onClick={() => { setIsAvatarMenuOpen(false); logout(); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">
                  <span className="material-symbols-outlined text-[16px]">logout</span>
                  退出登录
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>

    {/* Payslip Modal */}
    {showPayslipModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowPayslipModal(false)}/>
        <div className="relative bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-6 fade-in duration-200">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-emerald-500">payments</span>
              我的工资单
            </h3>
            <button onClick={() => setShowPayslipModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
          <div className="p-6">
            {payslipLoading ? (
              <div className="text-center py-8 text-slate-400">加载中...</div>
            ) : payslipData ? (
              <div className="space-y-3">
                <div className="text-center mb-4">
                  <p className="text-xs text-slate-400 font-medium">{payslipData.month} 工资单</p>
                  <p className="text-3xl font-black text-slate-800 dark:text-slate-100 mt-1">¥{Number(payslipData.net_pay).toFixed(2)}</p>
                  <p className="text-xs text-emerald-600 font-medium mt-0.5">实发工资</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 space-y-2 text-sm">
                  {payslipData.items_json ? (
                    (() => {
                      try {
                        const parsed = JSON.parse(payslipData.items_json);
                        return parsed.items.map((row: any) => (
                          <div key={row.key} className="flex justify-between">
                            <span className="text-slate-500">{row.name}</span>
                            <span className={`font-semibold ${row.type === 'deduction' ? 'text-red-500' : 'text-slate-700 dark:text-slate-200'}`}>
                              {row.type === 'deduction' ? '-' : row.amount > 0 ? '+' : ''}¥{Number(row.amount).toFixed(2)}
                            </span>
                          </div>
                        ));
                      } catch (e) { return null; }
                    })()
                  ) : (
                    [
                      { label: '基本工资', value: payslipData.base_salary, neg: false },
                      { label: '绩效奖金', value: payslipData.perf_bonus, neg: false },
                      { label: '社保公积金', value: (payslipData.social_insurance || 0) + (payslipData.housing_fund || 0), neg: true },
                      { label: '个税', value: payslipData.tax, neg: true },
                    ].map(row => (
                      <div key={row.label} className="flex justify-between">
                        <span className="text-slate-500">{row.label}</span>
                        <span className={`font-semibold ${row.neg ? 'text-red-500' : 'text-slate-700 dark:text-slate-200'}`}>
                          {row.neg ? '-' : '+'}¥{Number(row.value).toFixed(2)}
                        </span>
                      </div>
                    ))
                  )}
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex justify-between font-bold text-slate-800 dark:text-slate-100 mt-2">
                    <span>实发合计</span>
                    <span>¥{Number(payslipData.net_pay).toFixed(2)}</span>
                  </div>
                </div>
                <p className="text-[10px] text-center text-slate-400">状态：{payslipData.status === 'paid' ? '✅ 已发放' : payslipData.status === 'approved' ? '⏳ 待发放' : '📝 审核中'}</p>
              </div>
            ) : (
              <div className="text-center py-8">
                <span className="material-symbols-outlined text-[40px] text-slate-200 mb-2 block">receipt_long</span>
                <p className="text-sm text-slate-500">本月工资单暂未生成</p>
                <p className="text-xs text-slate-400 mt-1">请联系 HR 生成工资表</p>
              </div>
            )}
          </div>
        </div>
      </div>
    )}

    {/* Changelog / Update Notification Modal */}
    {isNotifOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsNotifOpen(false)} />
        <div className="relative bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-6 fade-in duration-200 max-h-[85vh] flex flex-col">
          {/* Header */}
          <div className="shrink-0 px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0060a9] to-[#409eff] flex items-center justify-center text-white shadow-md">
                <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>campaign</span>
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">系统更新通知</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Release Changelog</p>
              </div>
            </div>
            <button onClick={() => setIsNotifOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Body — scrollable list of all versions */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {changelogData.map((item, idx) => (
              <div key={item.version} className={`relative pl-6 ${idx < changelogData.length - 1 ? 'pb-6 border-l-2 border-slate-200 dark:border-slate-700 ml-2' : 'ml-2'}`}>
                {/* Timeline dot */}
                <div className={`absolute -left-[9px] top-0 w-5 h-5 rounded-full border-2 border-white dark:border-slate-900 ${idx === 0 ? 'bg-[#0060a9] shadow-md shadow-primary/30' : 'bg-slate-300 dark:bg-slate-600'}`} />

                {/* Version header */}
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <span className={`text-sm font-black px-3 py-0.5 rounded-lg ${idx === 0 ? 'bg-[#0060a9] text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                    {item.version}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">{item.date}</span>
                  {item.isMajor && (
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">重大更新</span>
                  )}
                </div>

                {/* Title */}
                <h4 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-3">{item.title}</h4>

                {/* Features */}
                {item.features.length > 0 && (
                  <div className="mb-2">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">new_releases</span> 新功能
                    </p>
                    <ul className="space-y-1">
                      {item.features.map((f, fi) => (
                        <li key={fi} className="text-sm text-slate-600 dark:text-slate-300 flex items-start gap-2">
                          <span className="text-emerald-500 mt-1 shrink-0">•</span>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Fixes */}
                {item.fixes && item.fixes.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">build</span> 修复
                    </p>
                    <ul className="space-y-1">
                      {item.fixes.map((f, fi) => (
                        <li key={fi} className="text-sm text-slate-500 dark:text-slate-400 flex items-start gap-2">
                          <span className="text-blue-400 mt-1 shrink-0">•</span>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="shrink-0 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 flex justify-between items-center">
            <p className="text-[10px] text-slate-400">共 {changelogData.length} 个版本</p>
            <button onClick={() => setIsNotifOpen(false)} className="px-5 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-bold rounded-xl transition-colors">关闭</button>
          </div>
        </div>
      </div>
    )}

    <UserGuide isOpen={showGuide} onClose={() => setShowGuide(false)} />

    {/* ── Mobile Bottom Tab Bar ── */}
    {isMobile && (
      <nav className="fixed bottom-0 left-0 right-0 z-50 mobile-bottom-bar border-t border-slate-200/60 dark:border-slate-800/60 pb-safe">
        <div className="flex items-stretch justify-around h-14">
          {mobileTabs.map(tab => {
            const isMe = tab.id === '_me';
            const isActive = isMe ? showMePanel : currentView === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (isMe) {
                    setShowMePanel(p => !p);
                  } else {
                    setShowMePanel(false);
                    navigate(tab.id);
                  }
                }}
                className={`flex flex-col items-center justify-center flex-1 gap-0.5 transition-colors relative ${
                  isActive
                    ? 'text-[#0060a9] dark:text-[#409eff]'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                <span
                  className={`material-symbols-outlined text-[22px] transition-all ${
                    isActive ? 'scale-110' : ''
                  }`}
                  style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
                >
                  {tab.icon}
                </span>
                <span className={`text-[10px] font-bold leading-none ${isActive ? '' : 'font-medium'}`}>
                  {tab.label}
                </span>
                {/* Badge for 流程 */}
                {tab.id === 'workflows' && unreadCount > 0 && (
                  <span className="absolute top-1 right-1/2 translate-x-3 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    )}

    {/* ── Mobile "我的" Panel ── */}
    {isMobile && showMePanel && (
      <div className="fixed inset-0 z-[60]">
        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowMePanel(false)} />
        <div className="absolute bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] left-0 right-0 bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl mobile-drawer-enter overflow-hidden max-h-[70vh]">
          {/* User Info Header */}
          <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br from-[#0060a9] to-[#3085d6] text-white font-bold text-xl shadow-lg">
                {(currentUser?.name || 'U').charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-lg font-black text-slate-800 dark:text-slate-100">{currentUser?.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {currentUser?.role === 'admin' ? '系统管理员' : currentUser?.role === 'hr' ? 'HR总监' : currentUser?.role === 'manager' ? '主管' : '员工'}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-px bg-slate-100 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800">
            {[
              { label: '未读消息', value: unreadCount, icon: 'mail', color: 'text-blue-500' },
              { label: '我的团队', value: '—', icon: 'groups', color: 'text-emerald-500' },
              { label: '本月考勤', value: '—', icon: 'calendar_month', color: 'text-amber-500' },
            ].map(s => (
              <div key={s.label} className="bg-white dark:bg-slate-900 py-4 text-center">
                <span className={`material-symbols-outlined text-[18px] ${s.color} mb-1 block`}>{s.icon}</span>
                <p className="text-lg font-black text-slate-800 dark:text-slate-100">{s.value}</p>
                <p className="text-[10px] text-slate-400 font-medium">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Menu Items */}
          <div className="py-2">
            {[
              { icon: 'groups', label: '我的团队', color: 'text-indigo-500', view: 'team' },
              { icon: 'map', label: '人力地图', color: 'text-teal-500', view: 'hrmap' },
              { icon: 'view_quilt', label: '全景仪表盘', color: 'text-purple-500', view: 'panorama' },
              { icon: 'account_tree', label: '组织关系', color: 'text-cyan-500', view: 'org' },
              { icon: 'account_balance_wallet', label: '数字薪酬', color: 'text-amber-500', view: 'perf-accounting' },
            ].filter(item => {
              const permMap: Record<string, string> = { team: 'view_team_perf', hrmap: 'view_hr_map', panorama: 'view_panorama', org: 'view_org_chart' };
              return !permMap[item.view] || hasPermission(permMap[item.view]);
            }).map(item => (
              <button key={item.view}
                onClick={() => { setShowMePanel(false); navigate(item.view); }}
                className="w-full flex items-center gap-4 px-6 py-3.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors active:bg-slate-100 dark:active:bg-slate-700">
                <span className={`material-symbols-outlined text-[20px] ${item.color}`} style={{ fontVariationSettings: "'FILL' 1" }}>{item.icon}</span>
                {item.label}
                <span className="material-symbols-outlined text-[16px] text-slate-300 ml-auto">chevron_right</span>
              </button>
            ))}

            <div className="h-px bg-slate-100 dark:bg-slate-800 mx-4 my-1" />

            <button onClick={() => { setShowMePanel(false); handleNotifClick(); }}
              className="w-full flex items-center gap-4 px-6 py-3.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors active:bg-slate-100">
              <span className="material-symbols-outlined text-[20px] text-amber-500">notifications</span>
              更新通知
              {hasUnread && <span className="w-2 h-2 bg-red-500 rounded-full"></span>}
            </button>

            <button onClick={() => { setShowMePanel(false); handleViewPayslip(); }}
              className="w-full flex items-center gap-4 px-6 py-3.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors active:bg-slate-100">
              <span className="material-symbols-outlined text-[20px] text-emerald-500">payments</span>
              我的工资单
            </button>

            {hasPermission('view_admin') && (
              <button onClick={() => { setShowMePanel(false); navigate('admin'); }}
                className="w-full flex items-center gap-4 px-6 py-3.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors active:bg-slate-100">
                <span className="material-symbols-outlined text-[20px] text-violet-600">admin_panel_settings</span>
                管理后台
              </button>
            )}

            <button onClick={() => { setShowMePanel(false); setShowGuide(true); }}
              className="w-full flex items-center gap-4 px-6 py-3.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors active:bg-slate-100">
              <span className="material-symbols-outlined text-[20px] text-blue-500">menu_book</span>
              使用说明
            </button>

            <div className="h-px bg-slate-100 dark:bg-slate-800 mx-4 my-1" />

            <button onClick={() => { setShowMePanel(false); logout(); }}
              className="w-full flex items-center gap-4 px-6 py-3.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors active:bg-red-100">
              <span className="material-symbols-outlined text-[20px]">logout</span>
              退出登录
            </button>
          </div>
        </div>
      </div>
    )}

    </>
  );
}

