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
import PerfAccountingPage from './pages/PerfAccountingPage';
import CompetencyManager from './pages/CompetencyManager';
import TestBankManager from './pages/TestBankManager';
import MonthlyEvaluationPage from './pages/MonthlyEvaluationPage';
import DevRoleSwitcher from './components/DevRoleSwitcher';
import Watermark from './components/Watermark';
import FloatingAiChat from './components/FloatingAiChat';
import GlobalToast from './components/GlobalToast';
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

  // 若无用户身份：如果非微信环境，自动跳扫码登录。
  if (!currentUser) {
    const isWecom = navigator.userAgent.toLowerCase().includes('wxwork');
    const isDev = (import.meta as any).env?.DEV;

    // 只有在生产环境且非微信浏览器时，才自动跳转兜底
    if (!isDev && !isWecom) {
      setTimeout(() => {
        if (!localStorage.getItem('token')) {
          window.location.href = '/api/auth/wecom-qr-url';
        }
      }, 1500);
      return (
        <div className="flex h-screen flex-col items-center justify-center bg-surface">
          <div className="flex flex-col items-center mb-6">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-on-surface-variant font-bold mt-4">正在跳转扫码登录...</p>
          </div>
          <p className="text-on-surface-variant text-sm mb-6">请在企业微信客户端内打开，或浏览器刷新弹出登陆二维码。</p>
          <DevRoleSwitcher />
        </div>
      );
    }

    // 在企业微信内，但依旧没token或获取不到user（比如刚进入授权流程）
    return (
      <div className="flex h-screen items-center justify-center bg-surface text-on-surface flex-col">
        <div className="w-16 h-16 bg-surface-container rounded-full mb-4 flex items-center justify-center">
          <span className="material-symbols-outlined text-outline text-3xl">sentiment_dissatisfied</span>
        </div>
        <h2 className="text-xl font-bold mb-2">未检测到企业微信登录身份</h2>
        <p className="text-on-surface-variant text-sm mb-6">请在企业微信客户端内打开，或浏览器刷新弹出登陆二维码。</p>
        <button 
          onClick={() => window.location.href = '/api/auth/wecom-qr-url'}
          className="px-6 py-2 bg-primary text-on-primary rounded-full font-bold shadow-lg shadow-primary/30 hover:opacity-90 transition-opacity mb-4"
        >
          立即进行扫码登录
        </button>
        <DevRoleSwitcher />
      </div>
    );
  }

  const renderView = () => {
    if (currentView.startsWith('competency')) {
      let tid: number | undefined;
      let tab: string | undefined;
      if (currentView.includes('testId=')) tid = Number(currentView.split('testId=')[1].split('&')[0]);
      if (currentView.includes('tab=')) tab = currentView.split('tab=')[1].split('&')[0];
      return <CompetencyManager navigate={navigate} initialTestId={tid} initialTab={tab as any} />;
    }

    if (currentView.startsWith('workflows')) {
      let tab: string | undefined;
      if (currentView.includes('tab=')) tab = currentView.split('tab=')[1].split('&')[0];
      return <MyWorkflows navigate={navigate} initialTab={tab as any} />;
    }

    if (currentView.startsWith('admin')) {
      let mod: string | undefined;
      if (currentView.includes('module=')) mod = currentView.split('module=')[1].split('&')[0];
      return <AdminPanel navigate={navigate} initialModule={mod} />;
    }

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
      case 'org':
        return <OrgChart navigate={navigate} />;

      case 'perf-manage':
        return <PerformanceManager navigate={navigate} />;
      case 'perf-analytics':
        return <PerfAnalyticsPage navigate={navigate} />;
      case 'perf-accounting':
        return <PerfAccountingPage navigate={navigate} />;
      case 'test-bank':
        return <TestBankManager navigate={navigate} />;
      case 'monthly-eval':
        return <MonthlyEvaluationPage navigate={navigate} />;
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
      <GlobalToast />
    </>
  );
}
