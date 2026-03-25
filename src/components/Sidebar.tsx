import React, { useState, useEffect, useRef } from 'react';
import { changelogData, getLatestVersion } from '../data/changelog';

interface SidebarProps {
  currentView: string;
  navigate: (view: string) => void;
}

export default function Sidebar({ currentView, navigate }: SidebarProps) {
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const navItems = [
    { id: 'dashboard', icon: 'dashboard', label: '仪表盘' },
    { id: 'personal', icon: 'person', label: '个人管理' },
    { id: 'team', icon: 'groups', label: '团队管理' },
    { id: 'company', icon: 'analytics', label: '公司绩效池' },
    { id: 'hrmap', icon: 'map', label: '人力地图' },
    { id: 'panorama', icon: 'view_quilt', label: '全景仪表盘' },
  ];

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

  return (
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
        <button className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-[#0060a9] to-[#409eff] text-white font-bold text-xs shadow-md hover:shadow-lg hover:opacity-90 transition-all flex items-center justify-center gap-1 active:scale-95">
          <span className="material-symbols-outlined text-sm">add</span>
          新建任务/申请
        </button>
        
        {/* Notifications / Changelog Dropdown */}
        <div className="relative" ref={notifRef}>
          <button 
            onClick={handleNotifClick}
            className={`p-1.5 rounded-lg transition-colors relative ${isNotifOpen ? 'bg-slate-200 dark:bg-slate-800' : 'hover:bg-slate-200/50 dark:hover:bg-slate-800/50'}`}
          >
            <span className="material-symbols-outlined text-slate-500 text-[20px]">notifications</span>
            {hasUnread && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-950"></span>
            )}
          </button>
          
          {isNotifOpen && (
            <div className="absolute right-0 mt-3 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-[100] origin-top-right animate-in fade-in slide-in-from-top-4 duration-200">
              <div className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800 p-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center justify-between">
                  <span>版本更新日志</span>
                  <span className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary rounded-full">{getLatestVersion()}</span>
                </h3>
              </div>
              <div className="max-h-96 overflow-y-auto p-4 space-y-6">
                {changelogData.map((log, idx) => (
                  <div key={log.version} className="relative pl-4 before:content-[''] before:absolute before:left-0 before:top-1.5 before:w-1.5 before:h-1.5 before:bg-[#0060a9] before:rounded-full">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{log.version} - {log.title}</span>
                      <span className="text-[10px] text-slate-400">{log.date}</span>
                    </div>
                    {log.features.length > 0 && (
                      <ul className="mt-2 space-y-1.5">
                        {log.features.map((feat, fIdx) => (
                          <li key={fIdx} className="text-[11px] text-slate-600 dark:text-slate-400 flex items-start">
                            <span className="mr-1.5 mt-0.5 text-[#0060a9]">✨</span> {feat}
                          </li>
                        ))}
                      </ul>
                    )}
                    {log.fixes && log.fixes.length > 0 && (
                      <ul className="mt-2 space-y-1.5">
                        {log.fixes.map((fix, fxIdx) => (
                          <li key={fxIdx} className="text-[11px] text-slate-600 dark:text-slate-400 flex items-start">
                            <span className="mr-1.5 mt-0.5 text-orange-500">🔧</span> {fix}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <button className="p-1.5 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors">
          <span className="material-symbols-outlined text-slate-500 text-[20px]">help</span>
        </button>
        <button onClick={() => navigate('admin')} className="p-1.5 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors" title="管理后台">
          <span className="material-symbols-outlined text-slate-500 text-[20px]">admin_panel_settings</span>
        </button>
        <div className="h-6 w-px bg-slate-200/60 dark:bg-slate-800/60 mx-1"></div>
        <div className="flex items-center gap-2 cursor-pointer">
          <img alt="User avatar" className="w-8 h-8 rounded-full object-cover ring-2 ring-[#0060a9]/10" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDdrdTGDJYeBHfJTlatMpLqwsbtQ4gp5ZxDGcUSG1-JpEjvrW0oKbdaeF6RuWTWGt00FKgwLrZ8Nj2CxCxAFq3HGnlh1u_fIRvsrO5LlFbgpesyz0lGQFmHe_y4fVLCQBZA7qNoCR1qgHF6xlJIvVO1neRBE_gOglQFWToIPklhlTGSvOlJQrn3wmLzWS9y7Kuk5lIGSFLyjZHyXPnZxT7ESoReBjIp4QKWL5k3HAKXQeT03MJ17TReEVrjk22ijU6baqjCr2fFgE0" />
          <div className="hidden lg:block text-right">
            <p className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-tight">张伟</p>
            <p className="text-[10px] text-slate-500 font-medium">高级产品经理</p>
          </div>
        </div>
        <button className="flex items-center justify-center gap-1 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-all" title="退出登录">
          <span className="material-symbols-outlined text-[18px]">logout</span>
        </button>
      </div>
    </header>
  );
}
