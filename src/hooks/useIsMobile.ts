import { useState, useEffect } from 'react';

/**
 * 检测当前视口是否为移动端（<= 768px）
 * 使用 matchMedia 监听，窗口变化时自动更新
 */
export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= breakpoint;
  });

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    
    // 初始化同步
    setIsMobile(mql.matches);
    
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [breakpoint]);

  return isMobile;
}

/**
 * 检测是否为平板设备 (769px - 1024px)
 */
export function useIsTablet(): boolean {
  const [isTablet, setIsTablet] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth > 768 && window.innerWidth <= 1024;
  });

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 769px) and (max-width: 1024px)');
    const handler = (e: MediaQueryListEvent) => setIsTablet(e.matches);
    setIsTablet(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isTablet;
}

export default useIsMobile;
