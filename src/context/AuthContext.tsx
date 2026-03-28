import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

export interface User {
  id: string;
  name: string;
  title: string;
  avatar_url: string | null;
  role: string;
  department_id: number;
  is_super_admin?: boolean;
}

interface AuthContextType {
  currentUser: User | null;
  isAuthenticating: boolean;
  userPerms: string[];          // ← 当前用户的有效权限 key 列表
  hasPermission: (key: string) => boolean;
  loginWithMock: (userId: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  isAuthenticating: true,
  userPerms: [],
  hasPermission: () => true,
  loginWithMock: async () => {},
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [userPerms, setUserPerms] = useState<string[]>([]);

  const fetchPerms = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/permissions/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.code === 0) setUserPerms(json.data);
    } catch {
      // 网络错误时沿用空权限列表
    }
  };


  const fetchCurrentUser = async (token: string) => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.code === 0 && data.data) {
          setCurrentUser(data.data);
          await fetchPerms();
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error('Failed to fetch user:', err);
      return false;
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      const isWecom = navigator.userAgent.toLowerCase().includes('wxwork');
      const token = localStorage.getItem('token');
      
      if (token) {
        const success = await fetchCurrentUser(token);
        if (!success) {
          localStorage.removeItem('token');
          setCurrentUser(null);
        }
      }
      
      // Check for OAuth callback code (both WeCom in-app and QR scan)
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      
      if (!token || !currentUser) {
        if (code) {
          // Got auth code from either WeCom OAuth or QR scan callback
          try {
            const res = await fetch('/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code })
            });
            const data = await res.json();
            if (data.code === 0 && data.data?.token) {
              localStorage.setItem('token', data.data.token);
              setCurrentUser(data.data.user);
              await fetchPerms();
              window.history.replaceState({}, document.title, window.location.pathname);
            }
          } catch (err) {
            console.error('认证请求错误:', err);
          }
        } else if (!token) {
          // No token and no code — need to login
          const isDev = (import.meta as any).env?.DEV;
          if (isDev) {
            setIsAuthenticating(false);
            return;
          }

          if (isWecom) {
            // Inside WeCom client → silent OAuth
            window.location.href = '/api/auth/wecom-url';
            return;
          } else {
            // External browser → redirect to QR scan page
            window.location.href = '/api/auth/wecom-qr-url';
            return;
          }
        }
      }
      
      setIsAuthenticating(false);
    };

    initializeAuth();
  }, []);

  // ── 外部浏览器 2 小时无操作自动登出 ──────────────────────────────
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const INACTIVITY_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours
  const WARNING_BEFORE = 5 * 60 * 1000; // warn 5 min before

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    // 提前 5 分钟弹出警告
    warningTimerRef.current = setTimeout(() => {
      alert('⚠️ 您已长时间未操作，5 分钟后将自动退出登录。请保存您的工作。');
    }, INACTIVITY_TIMEOUT - WARNING_BEFORE);
    inactivityTimerRef.current = setTimeout(() => {
      localStorage.removeItem('token');
      localStorage.setItem('hrm_session_expired', '1');
      setCurrentUser(null);
      window.location.href = '/api/auth/wecom-qr-url';
    }, INACTIVITY_TIMEOUT);
  }, [INACTIVITY_TIMEOUT]);

  useEffect(() => {
    const isWecom = navigator.userAgent.toLowerCase().includes('wxwork');
    // 仅对外部浏览器启用超时检测（企微内部浏览器免密，无需超时）
    if (isWecom || !currentUser) return;

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click', 'input', 'change'];
    events.forEach(ev => window.addEventListener(ev, resetInactivityTimer, { passive: true }));
    resetInactivityTimer(); // 初始启动计时器

    return () => {
      events.forEach(ev => window.removeEventListener(ev, resetInactivityTimer));
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    };
  }, [currentUser, resetInactivityTimer]);

  const loginWithMock = async (userId: string) => {
    setIsAuthenticating(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'mock_code', userId })
      });
      const data = await res.json();
      if (data.code === 0 && data.data?.token) {
        localStorage.setItem('token', data.data.token);
        setCurrentUser(data.data.user);
        window.location.reload();
      }
    } catch (err) {
      console.error('Mock login failed:', err);
      setIsAuthenticating(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setCurrentUser(null);
    window.location.reload();
  };

  const hasPermission = (key: string) => {
    // Super admin 拥有所有权限
    if (currentUser?.is_super_admin) return true;
    // 如果权限列表为空（未加载完成），暂时放行，避免闪烁
    if (userPerms.length === 0) return true;
    return userPerms.includes(key);
  };

  return (
    <AuthContext.Provider value={{ currentUser, isAuthenticating, userPerms, hasPermission, loginWithMock, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
