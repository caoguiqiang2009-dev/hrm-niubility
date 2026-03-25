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
  loginWithMock: (userId: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  isAuthenticating: true,
  loginWithMock: async () => {},
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(true);

  const fetchCurrentUser = async (token: string) => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.code === 0 && data.data) {
          setCurrentUser(data.data);
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
        // 尝试用已有 token 恢复用户身份
        const success = await fetchCurrentUser(token);
        if (!success) {
          localStorage.removeItem('token');
          setCurrentUser(null);
        }
      } else if (isWecom) {
        // 在企微环境中，且没 token -> 执行 OAuth 流程
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
              window.history.replaceState({}, document.title, window.location.pathname);
            }
          } catch (err) {
            console.error('企微认证请求错误:', err);
          }
        } else {
          window.location.href = '/api/auth/wecom-url';
          return; // Redirecting, stay loading
        }
      } else {
        // 不是企微环境，也没有 token，为了能顺畅测试，我们在这里可以默认登录 admin，或者等 DevSwitcher 操作
        // 默认让它进页面，然后点击切换器再加载
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
        window.location.reload(); // Hard reload to clear all states cleanly
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

  return (
    <AuthContext.Provider value={{ currentUser, isAuthenticating, loginWithMock, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
