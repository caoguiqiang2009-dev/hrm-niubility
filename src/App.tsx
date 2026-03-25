import { useState } from 'react';
import EmployeeDashboard from './pages/EmployeeDashboard';
import PersonalGoals from './pages/PersonalGoals';
import TeamPerformance from './pages/TeamPerformance';
import CompanyPerformance from './pages/CompanyPerformance';
import HRMap from './pages/HRMap';
import PanoramaDashboard from './pages/PanoramaDashboard';
import AdminPanel from './pages/AdminPanel';
import OrgChart from './pages/OrgChart';
import DevRoleSwitcher from './components/DevRoleSwitcher';
import { useAuth } from './context/AuthContext';

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const { isAuthenticating, currentUser } = useAuth();

  const navigate = (view: string) => {
    setCurrentView(view);
  };

  if (isAuthenticating) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-on-surface-variant font-bold mt-4">正在通过企业微信安全登录...</p>
        </div>
      </div>
    );
  }

  // 若无用户身份，则渲染骨架屏并提示（通常只会出现在本地开发还没点击测试登录的时候）
  if (!currentUser) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface text-on-surface flex-col">
        <div className="w-16 h-16 bg-surface-container rounded-full mb-4 flex items-center justify-center">
          <span className="material-symbols-outlined text-outline text-3xl">sentiment_dissatisfied</span>
        </div>
        <h2 className="text-xl font-bold mb-2">未检测到企业微信登录身份</h2>
        <p className="text-on-surface-variant text-sm mb-6">请在企业微信客户端内打开，或使用左下角的测试账号选择器进行免密登录测试。</p>
        <DevRoleSwitcher />
      </div>
    );
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <EmployeeDashboard navigate={navigate} />;
      case 'personal':
        return <PersonalGoals navigate={navigate} />;
      case 'team':
        return <TeamPerformance navigate={navigate} />;
      case 'company':
        return <CompanyPerformance navigate={navigate} />;
      case 'hrmap':
        return <HRMap navigate={navigate} />;
      case 'panorama':
        return <PanoramaDashboard navigate={navigate} />;
      case 'admin':
        return <AdminPanel navigate={navigate} />;
      case 'org':
        return <OrgChart navigate={navigate} />;
      default:
        return <EmployeeDashboard navigate={navigate} />;
    }
  };

  return (
    <>
      {renderView()}
      <DevRoleSwitcher />
    </>
  );
}
