import { useState } from 'react';
import EmployeeDashboard from './pages/EmployeeDashboard';
import PersonalGoals from './pages/PersonalGoals';
import TeamPerformance from './pages/TeamPerformance';
import CompanyPerformance from './pages/CompanyPerformance';
import HRMap from './pages/HRMap';
import PanoramaDashboard from './pages/PanoramaDashboard';
import AdminPanel from './pages/AdminPanel';
import OrgChart from './pages/OrgChart';
import MyWorkflows from './pages/MyWorkflows';
import PerformanceManager from './pages/PerformanceManager';
import PerfAnalyticsPage from './pages/PerfAnalyticsPage';
import SalaryManager from './pages/SalaryManager';
import DevRoleSwitcher from './components/DevRoleSwitcher';
import Watermark from './components/Watermark';
import FloatingAiChat from './components/FloatingAiChat';
import { useAuth } from './context/AuthContext';

export default function App() {
  const [currentView, setCurrentView] = useState(() => localStorage.getItem('hrm_current_view') || 'company');
  const { isAuthenticating, currentUser } = useAuth();

  const navigate = (view: string) => {
    setCurrentView(view);
    localStorage.setItem('hrm_current_view', view);
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

  // 若无用户身份：外部浏览器自动跳转扫码登录，开发模式显示测试账号切换器
  if (!currentUser) {
    const isWecom = navigator.userAgent.toLowerCase().includes('wxwork');
    const isDev = (import.meta as any).env?.DEV;

    // 生产模式下直接跳转扫码登录（不显示阻断提示）
    if (!isDev && !isWecom) {
      // 给 AuthContext 一点时间发起跳转，如果还没跳就这里兜底
      setTimeout(() => {
        if (!localStorage.getItem('token')) {
          window.location.href = '/api/auth/wecom-qr-url';
        }
      }, 1500);
      return (
        <div className="flex h-screen items-center justify-center bg-surface">
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-on-surface-variant font-bold mt-4">正在跳转企业微信扫码登录...</p>
          </div>
        </div>
      );
    }

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
      case 'workflows':
        return <MyWorkflows navigate={navigate} />;
      case 'perf-manage':
        return <PerformanceManager navigate={navigate} />;
      case 'perf-analytics':
        return <PerfAnalyticsPage navigate={navigate} />;
      case 'salary':
        return <SalaryManager navigate={navigate} />;
      default:
        return <EmployeeDashboard navigate={navigate} />;
    }
  };

  return (
    <>
      {renderView()}
      <DevRoleSwitcher />
      <Watermark text={currentUser.name} />
      <FloatingAiChat />
    </>
  );
}
