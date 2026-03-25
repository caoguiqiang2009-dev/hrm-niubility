import { useState } from 'react';
import Sidebar from '../components/Sidebar';

export default function HRMap({ navigate }: { navigate: (view: string) => void }) {
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);

  return (
    <div className="bg-surface font-body text-on-surface antialiased min-h-screen flex overflow-hidden">
      <Sidebar currentView="hrmap" navigate={navigate} />

      {/* Main Content Canvas */}
      <main className="flex-1 mt-16 h-[calc(100vh-4rem)] overflow-y-auto relative bg-[#f8f9ff]">

        {/* Organization Map Section */}
        <section className="min-h-screen relative p-12">
          {/* Interactive Map Controls Overlay */}
          <div className="absolute top-6 left-8 z-30 flex flex-col gap-3">
            <div className="p-1 bg-surface-container-lowest rounded-xl flex gap-1 shadow-sm">
              <button onClick={() => alert("功能开发中")} className="px-4 py-1.5 rounded-lg bg-primary text-white text-xs font-medium">按业务线</button>
              <button onClick={() => alert("功能开发中")} className="px-4 py-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-low text-xs font-medium transition-colors">按地域</button>
              <button onClick={() => alert("功能开发中")} className="px-4 py-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-low text-xs font-medium transition-colors">按职能</button>
            </div>
            <div className="flex gap-2">
              <div className="px-3 py-1.5 bg-secondary-container/20 text-on-secondary-container rounded-full text-[10px] font-bold flex items-center gap-1 border border-secondary-container/50">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span> HiPo 聚集区
              </div>
              <div className="px-3 py-1.5 bg-error-container/20 text-on-error-container rounded-full text-[10px] font-bold flex items-center gap-1 border border-error-container/50">
                <span className="w-1.5 h-1.5 rounded-full bg-error"></span> 缺口预警
              </div>
            </div>
          </div>

          {/* Organizational Topology Layout */}
          <div className="flex flex-col items-center">
            {/* Root Level */}
            <div className="flex flex-col items-center relative">
              <div className="w-64 p-5 rounded-2xl bg-gradient-to-br from-primary to-primary-container text-white shadow-xl ring-4 ring-primary/10">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-label font-semibold opacity-80">集团总部</span>
                  <span className="material-symbols-outlined text-sm opacity-80">more_vert</span>
                </div>
                <h3 className="text-lg font-bold">数字化业务中心</h3>
                <div className="mt-4 pt-4 border-t border-white/20 grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] opacity-70">总人数</p>
                    <p className="text-sm font-bold">1,248</p>
                  </div>
                  <div>
                    <p className="text-[10px] opacity-70">平均绩效</p>
                    <p className="text-sm font-bold">4.2/5.0</p>
                  </div>
                </div>
              </div>

              {/* Vertical Connector */}
              <div className="org-line-v h-12"></div>

              {/* Horizontal Connector Line Wrapper */}
              <div className="relative w-full flex justify-center">
                <div className="org-line-h w-[1000px] absolute top-0"></div>
              </div>

              {/* Level 2 Children */}
              <div className="flex gap-16 mt-0">
                {/* Branch 1 */}
                <div className="flex flex-col items-center">
                  <div className="org-line-v h-12"></div>
                  <div 
                    className="w-56 p-4 rounded-xl bg-surface-container-lowest shadow-sm hover:shadow-md transition-shadow cursor-pointer group border border-transparent hover:border-primary/20"
                    onClick={() => setSelectedOrg('云基础设施部')}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined text-lg">cloud_queue</span>
                      </div>
                      <div>
                        <p className="text-xs font-bold">云基础设施部</p>
                        <p className="text-[10px] text-slate-400">华东/上海</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <span className="px-2 py-0.5 bg-secondary-container/20 text-on-secondary-container rounded text-[9px] font-bold">HiPo x12</span>
                      <span className="px-2 py-0.5 bg-surface-container-high text-on-surface-variant rounded text-[9px] font-bold">TL: 陈静</span>
                    </div>
                  </div>
                  <div className="org-line-v h-8"></div>
                  <div className="w-48 p-3 rounded-lg bg-surface-container-low border-dashed border border-outline-variant flex items-center justify-center gap-2 group hover:bg-surface-container-high transition-colors cursor-pointer">
                    <span className="material-symbols-outlined text-sm text-slate-400 group-hover:text-primary">add_circle</span>
                    <span className="text-xs text-slate-500 font-medium">展开子组织</span>
                  </div>
                </div>

                {/* Branch 2 (Selected State) */}
                <div className="flex flex-col items-center">
                  <div className="org-line-v h-12"></div>
                  <div 
                    className="w-56 p-4 rounded-xl bg-surface-container-lowest shadow-lg ring-2 ring-primary relative group cursor-pointer hover:shadow-xl transition-all"
                    onClick={() => setSelectedOrg('AI 实验室')}
                  >
                    <div className="absolute -top-2 -right-2 w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center shadow-md">
                      <span className="material-symbols-outlined text-[12px]">check</span>
                    </div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-primary-container/10 flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined text-lg">smart_toy</span>
                      </div>
                      <div>
                        <p className="text-xs font-bold">AI 实验室</p>
                        <p className="text-[10px] text-slate-400">华南/深圳</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <span className="px-2 py-0.5 bg-secondary-container/20 text-on-secondary-container rounded text-[9px] font-bold">HiPo x24</span>
                      <span className="px-2 py-0.5 bg-error-container text-error rounded text-[9px] font-bold">HC -5</span>
                    </div>
                  </div>
                  <div className="org-line-v h-12"></div>
                  <div className="relative w-full flex justify-center">
                    <div className="org-line-h w-80 absolute top-0"></div>
                  </div>
                  <div className="flex gap-8 mt-0">
                    <div className="flex flex-col items-center">
                      <div className="org-line-v h-8"></div>
                      <div 
                        className="w-44 p-3 rounded-lg bg-surface-container-lowest shadow-sm border border-outline-variant/30 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all"
                        onClick={() => setSelectedOrg('NLP 研究组')}
                      >
                        <p className="text-[11px] font-bold">NLP 研究组</p>
                        <p className="text-[9px] text-slate-400">12 成员</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="org-line-v h-8"></div>
                      <div 
                        className="w-44 p-3 rounded-lg bg-surface-container-lowest shadow-sm border border-outline-variant/30 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all"
                        onClick={() => setSelectedOrg('视觉计算组')}
                      >
                        <p className="text-[11px] font-bold">视觉计算组</p>
                        <p className="text-[9px] text-slate-400">18 成员</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Branch 3 */}
                <div className="flex flex-col items-center">
                  <div className="org-line-v h-12"></div>
                  <div 
                    className="w-56 p-4 rounded-xl bg-surface-container-lowest shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-transparent hover:border-primary/20"
                    onClick={() => setSelectedOrg('金融科技部')}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-secondary">
                        <span className="material-symbols-outlined text-lg">payments</span>
                      </div>
                      <div>
                        <p className="text-xs font-bold">金融科技部</p>
                        <p className="text-[10px] text-slate-400">华北/北京</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <span className="px-2 py-0.5 bg-surface-container-high text-on-surface-variant rounded text-[9px] font-bold">TL: 王志伟</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Map Zoom Controls */}
          <div className="absolute bottom-10 right-8 z-30 flex flex-col gap-2">
            <button onClick={() => alert("功能开发中")} className="w-10 h-10 bg-surface-container-lowest rounded-xl shadow-md flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors">
              <span className="material-symbols-outlined">add</span>
            </button>
            <button onClick={() => alert("功能开发中")} className="w-10 h-10 bg-surface-container-lowest rounded-xl shadow-md flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors">
              <span className="material-symbols-outlined">remove</span>
            </button>
            <button onClick={() => alert("功能开发中")} className="w-10 h-10 bg-surface-container-lowest rounded-xl shadow-md flex items-center justify-center text-primary hover:bg-surface-container-high transition-colors">
              <span className="material-symbols-outlined">filter_center_focus</span>
            </button>
          </div>
        </section>

        {/* Performance Progress Section */}
        <section className="p-12 pt-0 max-w-7xl mx-auto w-full">
          <div className="bg-surface-container-lowest rounded-3xl shadow-sm border border-outline-variant/10 overflow-hidden">
            <div className="p-6 border-b border-outline-variant/10 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-on-surface">所有档期具体绩效进度</h2>
                <p className="text-xs text-slate-400 mt-1">监控各周期、项目的人才评估与绩效达成实时状态</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => alert("功能开发中")} className="px-4 py-2 bg-surface-container-high text-on-surface-variant rounded-xl text-xs font-bold hover:bg-surface-container-highest transition-colors">导出数据</button>
                <button onClick={() => alert("功能开发中")} className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold shadow-md hover:opacity-90 transition-opacity flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">add</span>
                  新建档期
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-container-low/50">
                    <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">档期名称</th>
                    <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">负责人</th>
                    <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider w-64">当前进度</th>
                    <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">状态</th>
                    <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  <tr className="hover:bg-surface-container-low/30 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                          <span className="material-symbols-outlined text-lg">calendar_today</span>
                        </div>
                        <span className="text-sm font-semibold">2024 Q1 季度绩效评估</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <img alt="Owner" className="w-6 h-6 rounded-full" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAgAu7VBDPN_CM7-Ky64UwGaiz7TXqQYaq8vPS8e32HfCU97JzdS-I7YEMl0zhX5lUdPXzOFxkCGvz1hXiNzrhMT6I7QRAPaCd_N74S2zG9Wwajba9mtkmEbJo7y2dbgEGzrYxssVP6wf4_UxdcxdqNjNtByEF3F0cftNlHxp25ed2NoJPix3RDVpuCjh4Y0g3VP-ne8LhZ9b7aOq8_G5zWF74DhbgqCe3aORWtKRCYZPH52QtO5uX9NOqHcalEytWtoGfOerMaUFw" />
                        <span className="text-sm">张经理</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex justify-between items-center text-[10px] font-bold">
                          <span className="text-primary">92%</span>
                          <span className="text-slate-400">1248/1350 已完成</span>
                        </div>
                        <div className="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: '92%' }}></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="px-3 py-1 bg-secondary-container/20 text-on-secondary-container rounded-full text-[10px] font-bold">进行中</span>
                    </td>
                    <td className="px-6 py-5">
                      <button onClick={() => alert("功能开发中")} className="text-primary hover:underline text-xs font-bold">详情</button>
                    </td>
                  </tr>
                  <tr className="hover:bg-surface-container-low/30 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600">
                          <span className="material-symbols-outlined text-lg">rocket_launch</span>
                        </div>
                        <span className="text-sm font-semibold">专项项目：AI 实验室晋升盘点</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <img alt="Owner" className="w-6 h-6 rounded-full" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDwN-fY2eLgt3QsAn9XnmYHqO5hiTpE6OPUaf18HsPb3AreZ_Qr5xqWPkgEbc_Li2LOMLr9l6iYMBRgSmI_ypfh4GwTWv-VFm_tyQzsNXydVtHrv8wdytYtjOKzssrw9khuYcVaIKUssq716asnfkhBANsR0o7JroTATSAElrZYFgce_0QtGAEcEQetthy4qZ7MdGpJ58CJYomdpo9DH_CGqnkyDhBDNp2GDmF4Vvjh3vgc8tCoow7wQvdxjI4koqXe3ybLgmgeP34" />
                        <span className="text-sm">陆承风</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex justify-between items-center text-[10px] font-bold">
                          <span className="text-orange-500">45%</span>
                          <span className="text-slate-400">70/156 已完成</span>
                        </div>
                        <div className="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden">
                          <div className="h-full bg-orange-500 rounded-full" style={{ width: '45%' }}></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="px-3 py-1 bg-secondary-container/20 text-on-secondary-container rounded-full text-[10px] font-bold">进行中</span>
                    </td>
                    <td className="px-6 py-5">
                      <button onClick={() => alert("功能开发中")} className="text-primary hover:underline text-xs font-bold">详情</button>
                    </td>
                  </tr>
                  <tr className="hover:bg-surface-container-low/30 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                          <span className="material-symbols-outlined text-lg">history</span>
                        </div>
                        <span className="text-sm font-semibold">2023 年度绩效大考</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <img alt="Owner" className="w-6 h-6 rounded-full" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDxncfSAdhsmEsnUVnjeuKgskvZav4Yl9etPNHuH7xxB5lAIPh1PSgjYlEe1qzWKmX-LZ0U6yqMZv-jmnOTnCQGjaujz56cXzDHT8z1hLDaXu5b9dg4z31tUTWSMc2ABeAAg0xqPZp4DY0sdSyd94jcPdtMltP5M8l5p-A4NoJFge3IlgVANYnSxp9WJP_L9viwBFjplNBAulBAq_HzSMalmrObRnD6Q5q-iu0K36OOhrb4K8lXnav8TksKfRyA1bvarhu1aNq7P4U" />
                        <span className="text-sm">林晓云</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex justify-between items-center text-[10px] font-bold">
                          <span className="text-slate-500">100%</span>
                          <span className="text-slate-400">已存档</span>
                        </div>
                        <div className="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden">
                          <div className="h-full bg-slate-400 rounded-full" style={{ width: '100%' }}></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="px-3 py-1 bg-surface-container-high text-on-surface-variant rounded-full text-[10px] font-bold">已结束</span>
                    </td>
                    <td className="px-6 py-5">
                      <button onClick={() => alert("功能开发中")} className="text-primary hover:underline text-xs font-bold">查看报告</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="p-6 bg-surface-container-low/20 flex justify-center border-t border-outline-variant/10">
              <button onClick={() => alert("功能开发中")} className="text-xs font-bold text-primary flex items-center gap-1 hover:gap-2 transition-all">
                加载更多历史档期
                <span className="material-symbols-outlined text-sm">keyboard_arrow_down</span>
              </button>
            </div>
          </div>
        </section>

        {/* FAB for Quick Diagnosis */}
        <div className="fixed bottom-10 left-[280px] z-30">
          <button onClick={() => alert("功能开发中")} className="flex items-center gap-3 bg-inverse-surface text-inverse-on-surface px-6 py-4 rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all">
            <span className="material-symbols-outlined">health_and_safety</span>
            <span className="text-sm font-bold">实时组织诊断</span>
          </button>
        </div>

        {/* Drawer Backdrop */}
        {!!selectedOrg && (
          <div 
            className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-50 transition-opacity"
            onClick={() => setSelectedOrg(null)}
          />
        )}

        {/* Right Drawer */}
        <div 
          className={`fixed top-0 right-0 h-full w-[400px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out overflow-y-auto ${
            !!selectedOrg ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="p-8">
            {/* Header */}
            <div className="flex justify-between items-start mb-6">
              <div>
                <span className="inline-block px-2 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold uppercase tracking-widest rounded mb-3">
                  Organization Portrait
                </span>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">{selectedOrg || 'AI 实验室'}画像</h2>
              </div>
              <button 
                onClick={() => setSelectedOrg(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="col-span-2 bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex justify-between items-center">
                <div>
                  <p className="text-xs text-slate-500 mb-1">团队产出效率</p>
                  <p className="text-3xl font-black text-slate-900 mb-2">94.2%</p>
                  <p className="text-xs text-green-500 font-medium flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">trending_up</span>
                    较上周提升 4.5%
                  </p>
                </div>
                <div className="flex items-end gap-1 h-12">
                  <div className="w-3 bg-blue-100 rounded-t-sm h-1/2"></div>
                  <div className="w-3 bg-blue-200 rounded-t-sm h-2/3"></div>
                  <div className="w-3 bg-blue-300 rounded-t-sm h-3/4"></div>
                  <div className="w-3 bg-blue-600 rounded-t-sm h-full"></div>
                  <div className="w-3 bg-blue-700 rounded-t-sm h-[90%]"></div>
                </div>
              </div>
              
              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                <p className="text-xs text-slate-500 mb-1">平均工时</p>
                <p className="text-2xl font-black text-slate-900">
                  42.5h <span className="text-xs text-slate-400 font-normal">/周</span>
                </p>
              </div>

              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                <p className="text-xs text-slate-500 mb-1">协作活跃度</p>
                <p className="text-2xl font-black text-blue-600">极高</p>
              </div>
            </div>

            {/* Tasks */}
            <div className="mb-8">
              <div className="flex justify-between items-end mb-4">
                <h3 className="text-base font-bold text-slate-900">任务进度</h3>
                <span className="text-xs text-slate-400">本周更新</span>
              </div>
              <div className="space-y-3">
                <div className="bg-red-50/50 border border-red-100 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-red-500">warning</span>
                    <div>
                      <p className="text-sm font-bold text-slate-900">大模型微调实验</p>
                      <p className="text-xs text-red-500 mt-0.5">算力资源缺口</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-red-500 text-white text-[10px] font-bold rounded-full">At Risk</span>
                </div>

                <div className="bg-green-50/50 border border-green-100 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-green-500">check_circle</span>
                    <div>
                      <p className="text-sm font-bold text-slate-900">NLP 架构升级</p>
                      <p className="text-xs text-green-600 mt-0.5">按计划推进中</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-green-500 text-white text-[10px] font-bold rounded-full">On Track</span>
                </div>
              </div>
            </div>

            {/* Key Talent */}
            <div>
              <div className="flex justify-between items-end mb-4">
                <h3 className="text-base font-bold text-slate-900">关键人才 (HiPo)</h3>
                <button onClick={() => alert("功能开发中")} className="text-sm text-blue-600 font-medium hover:underline">查看全部</button>
              </div>
              <div className="space-y-0">
                <div className="flex items-center justify-between py-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuDxncfSAdhsmEsnUVnjeuKgskvZav4Yl9etPNHuH7xxB5lAIPh1PSgjYlEe1qzWKmX-LZ0U6yqMZv-jmnOTnCQGjaujz56cXzDHT8z1hLDaXu5b9dg4z31tUTWSMc2ABeAAg0xqPZp4DY0sdSyd94jcPdtMltP5M8l5p-A4NoJFge3IlgVANYnSxp9WJP_L9viwBFjplNBAulBAq_HzSMalmrObRnD6Q5q-iu0K36OOhrb4K8lXnav8TksKfRyA1bvarhu1aNq7P4U" alt="林晓云" className="w-10 h-10 rounded-full object-cover" />
                    <div>
                      <p className="text-sm font-bold text-slate-900">林晓云</p>
                      <p className="text-xs text-slate-500 mt-0.5">当前负荷: <span className="text-orange-500 font-medium">85%</span> (高)</p>
                    </div>
                  </div>
                  <span className="px-2 py-1 bg-green-50 text-green-600 text-[10px] font-bold rounded">潜力 A+</span>
                </div>

                <div className="flex items-center justify-between py-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuAgAu7VBDPN_CM7-Ky64UwGaiz7TXqQYaq8vPS8e32HfCU97JzdS-I7YEMl0zhX5lUdPXzOFxkCGvz1hXiNzrhMT6I7QRAPaCd_N74S2zG9Wwajba9mtkmEbJo7y2dbgEGzrYxssVP6wf4_UxdcxdqNjNtByEF3F0cftNlHxp25ed2NoJPix3RDVpuCjh4Y0g3VP-ne8LhZ9b7aOq8_G5zWF74DhbgqCe3aORWtKRCYZPH52QtO5uX9NOqHcalEytWtoGfOerMaUFw" alt="周子墨" className="w-10 h-10 rounded-full object-cover" />
                    <div>
                      <p className="text-sm font-bold text-slate-900">周子墨</p>
                      <p className="text-xs text-slate-500 mt-0.5">当前负荷: <span className="text-green-500 font-medium">60%</span> (中)</p>
                    </div>
                  </div>
                  <span className="px-2 py-1 bg-green-50 text-green-600 text-[10px] font-bold rounded">潜力 A</span>
                </div>

                <div className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuCk9pnfkA2FRIyLNp-GSAyBQLPDVq9z-8JkmutIlQghpprSkDIjcLzNru1EplyUap1ex7xy5f6xpNrsllSarNItpSPNwBXMSsDTiuXzka8_MO9RFOPW2hBxYeoJYuBuGaqXYxqORndVEirnBrwMhC_oxv0ckuSTw3GYpgiS0jHoPany0LqUdTdVUJVVyf1pceZM8ZLYF3MNEjP5V3sqzdtDcigjV2Z-anScCZkRZkfO5q3BxzA7DOKNuIH8Jnj4PmCengquxGdsQjI" alt="陆承风" className="w-10 h-10 rounded-full object-cover" />
                    <div>
                      <p className="text-sm font-bold text-slate-900">陆承风</p>
                      <p className="text-xs text-slate-500 mt-0.5">当前负荷: <span className="text-blue-500 font-medium">45%</span> (低)</p>
                    </div>
                  </div>
                  <span className="px-2 py-1 bg-green-50 text-green-600 text-[10px] font-bold rounded">潜力 B+</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
