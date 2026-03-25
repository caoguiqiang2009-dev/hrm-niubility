import React, { useState, useEffect, useRef } from 'react';
import { changelogData, getLatestVersion } from '../data/changelog';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  currentView: string;
  navigate: (view: string) => void;
}

export default function Sidebar({ currentView, navigate }: SidebarProps) {
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);
  const [payslipData, setPayslipData] = useState<any>(null);
  const [payslipLoading, setPayslipLoading] = useState(false);
  const [showPayslipModal, setShowPayslipModal] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLDivElement>(null);
  const { currentUser, logout, hasPermission } = useAuth();

  // permKey → 对应 /api/permissions/definitions 中的功能模块 key
  const navItems = [
    { id: 'dashboard', icon: 'dashboard', label: '仪表盘', permKey: 'view_dashboard' },
    { id: 'personal', icon: 'person', label: '个人管理', permKey: null },
    { id: 'team', icon: 'groups', label: '团队管理', permKey: 'view_team_perf' },
    { id: 'company', icon: 'analytics', label: '公司绩效池', permKey: 'view_company_pool' },
    { id: 'hrmap', icon: 'map', label: '人力地图', permKey: null },
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
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  return (
    <>
    <header className="h-16 w-full fixed top-0 left-0 right-0 flex items-center justify-between px-6 border-b border-slate-200/60 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-950 font-['Inter'] z-50 transition-all duration-200">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#0060a9] to-[#409eff] flex items-center justify-center text-white shadow-md shadow-primary/20">
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>corporate_fare</span>
          </div>
          <div>
            <h1 className="text-sm font-black text-[#0060a9] dark:text-[#409eff] tracking-tight leading-tight">You！Niubility！</h1>
            <p className="text-[8px] text-slate-500 uppercase tracking-widest font-bold">HRM System</p>
          </div>
        </div>

        <nav className="flex items-center gap-2">
          {navItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 group ${
                  isActive
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
      </div>

      <div className="flex items-center gap-3">
        <div className="relative group hidden md:block">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
          <input className="w-56 lg:w-72 pl-9 pr-4 py-1.5 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-lg focus:ring-2 focus:ring-[#0060a9]/20 text-xs placeholder:text-slate-400 outline-none transition-all focus:w-80" placeholder="搜索功能、员工或文档..." type="text" />
        </div>
        <div className="h-6 w-px bg-slate-200/60 dark:bg-slate-800/60 mx-1"></div>
        {/* Avatar Dropdown */}
        <div ref={avatarRef} className="relative">
          <div onClick={() => setIsAvatarMenuOpen(p => !p)}
            className="flex items-center gap-2 cursor-pointer px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <img alt="User avatar" className="w-8 h-8 rounded-full object-cover ring-2 ring-[#0060a9]/10" src={currentUser?.avatar_url || "https://lh3.googleusercontent.com/aida-public/AB6AXuDdrdTGDJYeBHfJTlatMpLqwsbtQ4gp5ZxDGcUSG1-JpEjvrW0oKbdaeF6RuWTWGt00FKgwLrZ8Nj2CxCxAFq3HGnlh1u_fIRvsrO5LlFbgpesyz0lGQFmHe_y4fVLCQBZA7qNoCR1qgHF6xlJIvVO1neRBE_gOglQFWToIPklhlTGSvOlJQrn3wmLzWS9y7Kuk5lIGSFLyjZHyXPnZxT7ESoReBjIp4QKWL5k3HAKXQeT03MJ17TReEVrjk22ijU6baqjCr2fFgE0"} />
            <div className="hidden lg:block text-right">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-tight">{currentUser?.name || "未知用户"}</p>
              <p className="text-[10px] text-slate-500 font-medium">{currentUser?.title || "员工"}</p>
            </div>
            <span className="material-symbols-outlined text-slate-400 text-[14px]">expand_more</span>
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
                {hasPermission('view_admin') && (
                  <button onClick={() => { setIsAvatarMenuOpen(false); navigate('admin'); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <span className="material-symbols-outlined text-[16px] text-violet-600">admin_panel_settings</span>
                    管理后台
                  </button>
                )}
                <button onClick={() => alert('帮助文档开发中')}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <span className="material-symbols-outlined text-[16px] text-slate-500">help</span>
                  帮助中心
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
                  {[
                    { label: '基本工资', value: payslipData.base_salary, neg: false },
                    { label: '绩效奖金', value: payslipData.perf_bonus, neg: false },
                    { label: '社保扣除', value: payslipData.social_insurance, neg: true },
                    { label: '个税扣除', value: payslipData.income_tax, neg: true },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between">
                      <span className="text-slate-500">{row.label}</span>
                      <span className={`font-semibold ${row.neg ? 'text-red-500' : 'text-slate-700 dark:text-slate-200'}`}>
                        {row.neg ? '-' : '+'}¥{Number(row.value).toFixed(2)}
                      </span>
                    </div>
                  ))}
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex justify-between font-bold text-slate-800 dark:text-slate-100">
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
    </>
  );
}

