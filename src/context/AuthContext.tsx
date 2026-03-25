import React, { createContext, useContext, useState, useEffect } from 'react';

export interface User {
  id: string;
  name: string;
  title: string;
  avatar_url: string | null;
  role: string;
  department_id: number;
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

  const fetchPerms = async (userId: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/permissions/user/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.code === 0) setUserPerms(json.data);
    } catch {
      // 网络错误时沿用空权限列表（不影响正常使用）
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
          await fetchPerms(data.data.id);
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
      } else if (isWecom) {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        
        if (code) {
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
              await fetchPerms(data.data.user.id);
              window.history.replaceState({}, document.title, window.location.pathname);
            }
          } catch (err) {
            console.error('企微认证请求错误:', err);
          }
        } else {
          window.location.href = '/api/auth/wecom-url';
          return;
        }
      }
      
      setIsAuthenticating(false);
    };

    initializeAuth();
  }, []);

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
