import React, { useState, useEffect } from 'react';

export default function GlobalToast() {
  const [toasts, setToasts] = useState<{id: number, msg: string, type: 'success'|'error'|'info'}[]>([]);

  useEffect(() => {
    // 保存原生的 alert 以防万一
    const originalAlert = window.alert;
    
    // 覆盖 window.alert，拦截所有的原生态弹窗并转为 Toast
    window.alert = (msg: any) => {
      const messageStr = String(msg);
      const id = Date.now() + Math.random();
      let type: 'success'|'error'|'info' = 'info';
      
      if (messageStr.includes('失败') || messageStr.includes('错误') || messageStr.includes('异常') || messageStr.includes('过期') || messageStr.includes('请') || messageStr.includes('不符合')) {
        type = 'error';
      } else if (messageStr.includes('成功') || messageStr.includes('已保存') || messageStr.includes('已提交') || messageStr.includes('完成') || messageStr.includes('草稿')) {
        type = 'success';
      }

      setToasts(prev => [...prev, {id, msg: messageStr, type}]);
      
      // 3.5秒后自动移除
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 3500);
    };

    return () => {
      // 在一些热更新环境下恢复 originalAlert
      window.alert = originalAlert;
    };
  }, []);

  return (
    <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[99999] flex flex-col gap-3 pointer-events-none">
      {toasts.map(t => {
        const bg = t.type === 'error' ? 'bg-red-500 text-white shadow-red-500/20' 
                 : t.type === 'success' ? 'bg-emerald-600 text-white shadow-emerald-500/20' 
                 : 'bg-slate-800 text-white shadow-slate-800/20';
        const icon = t.type === 'error' ? 'error' : t.type === 'success' ? 'check_circle' : 'info';
        return (
          <div key={t.id} className={`${bg} shadow-2xl px-5 py-3 rounded-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-4 duration-300`}>
             <span className="material-symbols-outlined text-[20px]">{icon}</span>
             <span className="font-bold text-sm tracking-wide">{t.msg}</span>
          </div>
        );
      })}
    </div>
  );
}
