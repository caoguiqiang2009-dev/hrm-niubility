import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useIsMobile } from '../hooks/useIsMobile';

export default function DevRoleSwitcher() {
  const { currentUser, loginWithMock, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useIsMobile();

  // 生产环境隐藏测试账号切换器
  const isDev = (import.meta as any).env?.DEV;
  if (!isDev) return null;

  const roles = [
    { id: 'admin', name: '管理员', roleLabel: '系统管理员 (Admin)', icon: 'shield_person', color: 'bg-slate-700' },
    { id: 'lifang', name: '李芳', roleLabel: 'HR总监 (HR)', icon: 'group', color: 'bg-rose-500' },
    { id: 'zhangwei', name: '张伟', roleLabel: '高级产品经理 (主管)', icon: 'manage_accounts', color: 'bg-blue-500' },
    { id: 'wangming', name: '王明', roleLabel: '技术总监 (主管)', icon: 'code_blocks', color: 'bg-indigo-500' },
    { id: 'huangli', name: '黄丽', roleLabel: '市场经理 (主管)', icon: 'campaign', color: 'bg-amber-500' },
    { id: 'zhaoming', name: '赵敏', roleLabel: '交互设计 (员工)', icon: 'brush', color: 'bg-emerald-500' },
    { id: 'liuqiang', name: '刘强', roleLabel: '前端工程师 (员工)', icon: 'terminal', color: 'bg-teal-500' },
    { id: 'chenxia', name: '陈夏', roleLabel: '后端工程师 (员工)', icon: 'dns', color: 'bg-cyan-500' },
  ];

  return (
    <div className={`fixed left-6 z-[9999] ${isMobile ? 'bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))]' : 'bottom-6'}`}>
      {/* 悬浮主按钮 */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-slate-900 border-2 border-slate-700 shadow-2xl rounded-full flex items-center justify-center text-white hover:scale-105 transition-transform group relative overflow-hidden"
        title="账号快捷切换器 (开发测试用)"
      >
        <span className="material-symbols-outlined text-[28px] group-hover:rotate-12 transition-transform">swap_horizontal_circle</span>
      </button>

      {/* 侧边弹出菜单 */}
      {isOpen && (
        <div className="absolute bottom-16 left-0 bg-white dark:bg-slate-900 w-64 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-2 overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-200 origin-bottom-left">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/50 rounded-t-2xl">
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest flex items-center">
              <span className="material-symbols-outlined text-[14px] mr-1 text-primary">bug_report</span> 
              测试账号切换
            </h4>
            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
          
          <div className="p-2 space-y-1">
            {roles.map(role => {
              const isActive = currentUser?.id === role.id;
              return (
                <button 
                  key={role.id}
                  onClick={() => { setIsOpen(false); loginWithMock(role.id); }}
                  disabled={isActive}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-left ${
                    isActive 
                      ? 'bg-slate-100 dark:bg-slate-800 cursor-default opacity-80' 
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:pl-4 cursor-pointer'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full text-white flex items-center justify-center shadow-sm ${role.color}`}>
                    <span className="material-symbols-outlined text-[16px]">{role.icon}</span>
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-bold leading-tight flex items-center gap-1 ${isActive ? 'text-slate-600 dark:text-slate-300' : 'text-slate-800 dark:text-slate-100'}`}>
                      {role.name}
                      {isActive && <span className="material-symbols-outlined text-[14px] text-green-500">check_circle</span>}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{role.roleLabel}</p>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="p-2 border-t border-slate-100 dark:border-slate-800 mt-1">
            <button onClick={() => { setIsOpen(false); logout(); }} className="w-full py-2 text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg flex items-center justify-center gap-1">
              <span className="material-symbols-outlined text-[14px]">logout</span>
              清除 Token 退出
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
