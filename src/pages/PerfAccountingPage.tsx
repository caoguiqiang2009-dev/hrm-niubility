import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import * as XLSX from 'xlsx';

interface FieldSetting {
  key: string;
  label: string;
  category: string;
  checked: boolean;
}

interface PerfTaskDetail {
  id: string; // 'TASK-123'
  title: string;
  score: number;
  bonus: number;
}

interface UserPerfStats {
  user_id: string;
  user_name: string;
  department_name: string;
  total_score: number;
  total_bonus: number;
  tasks: PerfTaskDetail[];
}

export default function PerfAccountingPage({ navigate }: { navigate: (view: string) => void }) {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  
  const [stats, setStats] = useState<UserPerfStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  // === EXPORT/LEDGER STATES ===
  const [fields, setFields] = useState<FieldSetting[]>([]);
  const [showConfig, setShowConfig] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [newTplName, setNewTplName] = useState('');
  const [exporting, setExporting] = useState(false);

  const { hasPermission } = useAuth();

  const fetchStats = useCallback(async () => {
    if (!month) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/perf/stats/overview?month=${month}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.code === 0) {
        setStats(data.data);
      } else {
        alert(data.message || '获取数据失败');
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, [month]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetch('/api/payroll-export/fields')
      .then(res => res.json())
      .then(json => {
         if (json.code === 0) setFields(json.data);
      });
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/payroll-export/templates');
      const json = await res.json();
      if (json.code === 0) setTemplates(json.data || []);
    } catch {}
  };

  const saveTemplate = async () => {
    if (!newTplName) return alert('请输入模板名称');
    const activeKeys = fields.filter(f => f.checked).map(f => f.key);
    try {
      const res = await fetch('/api/payroll-export/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTplName, fields_json: JSON.stringify(activeKeys) })
      });
      const json = await res.json();
      if (json.code === 0) {
        setNewTplName('');
        fetchTemplates();
        alert('模板已保存');
      }
    } catch {}
  };

  const applyTemplate = (fieldsJsonStr: string) => {
    try {
      const keys = JSON.parse(fieldsJsonStr);
      setFields(prev => prev.map(f => ({ ...f, checked: keys.includes(f.key) })));
    } catch {}
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const activeFields = fields.filter(f => f.checked);
      if (activeFields.length === 0) {
        alert('请至少选择一个导出字段');
        setExporting(false);
        return;
      }
      const activeKeys = activeFields.map(f => f.key);
      const token = localStorage.getItem('token');
      const res = await fetch('/api/payroll-export/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ month, fields: activeKeys })
      });
      const json = await res.json();
      if (json.code === 0 && json.data && json.data.length > 0) {
        const dataList = json.data;
        const headerRow = activeFields.map(f => f.label);
        const rows = dataList.map((rowData: any) => {
          return activeFields.map(f => {
            let val = rowData[f.key];
            if (typeof val === 'number') return Number(val.toFixed(2));
            return val || '';
          });
        });
        const worksheet = XLSX.utils.aoa_to_sheet([headerRow, ...rows]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, '薪资台账');
        XLSX.writeFile(workbook, `发薪台账导出_${month}.xlsx`);
        setShowConfig(false);
      } else {
        alert('当前月份没查到任何人的发薪记录，无法导出');
      }
    } catch (e) {
      console.error(e);
      alert('导出失败');
    }
    setExporting(false);
  };

  const categories = Array.from(new Set(fields.map(f => f.category)));

  const toggleRow = (userId: string) => {
    setExpandedRows(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const handleExport = () => {
    setShowConfig(!showConfig);
  };

  // 汇总总计
  const sumScore = stats.reduce((acc, s) => acc + s.total_score, 0);
  const sumBonus = stats.reduce((acc, s) => acc + s.total_bonus, 0);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 antialiased font-sans">
      <Sidebar currentView="perf-accounting" navigate={navigate} />

      <main className="flex-1 h-[calc(100vh-4rem)] mt-16 overflow-y-auto relative p-4 lg:p-10 pb-20 lg:pb-10">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
              <span className="material-symbols-outlined text-4xl text-indigo-600 dark:text-indigo-400">payments</span>
              员工绩效统计台账
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm max-w-2xl leading-relaxed">
              抛弃繁琐的算薪公式，专注聚焦业务闭环。在这里可一览全员在选定月份内所累积的绩效考评分与奖金，并可穿透查询到每一笔奖惩的具体 <strong className="text-indigo-500">来源任务编号</strong>，确保发薪对账清晰无误。
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1 shadow-sm flex items-center">
              <span className="material-symbols-outlined text-slate-400 text-lg ml-2">calendar_month</span>
              <input 
                type="month" 
                value={month}
                onChange={e => setMonth(e.target.value)}
                className="bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none w-32 cursor-pointer"
              />
            </div>
            
            <button 
              onClick={handleExport}
              className="px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white font-bold rounded-xl text-sm shadow-md hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">tune</span>
              导出与模板配置
            </button>
          </div>
        </div>

        {/* Aggregate Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-center">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">本月涉及核算人数</span>
            <div className="text-3xl font-black text-slate-800 dark:text-white">{stats.length} <span className="text-base font-medium text-slate-400 ml-1">人</span></div>
          </div>
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-500/20 shadow-sm flex flex-col justify-center relative overflow-hidden group">
            <div className="absolute right-[-10px] bottom-[-20px] opacity-5 group-hover:scale-110 transition-transform duration-500">
              <span className="material-symbols-outlined text-8xl text-indigo-600">military_tech</span>
            </div>
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1">核定全员总绩效分</span>
            <div className="text-3xl font-black text-indigo-700 dark:text-indigo-300 relative z-10">{sumScore.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1})} <span className="text-base font-medium text-indigo-400 ml-1">分</span></div>
          </div>
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-emerald-100 dark:border-emerald-500/20 shadow-sm flex flex-col justify-center relative overflow-hidden group">
            <div className="absolute right-[-10px] bottom-[-20px] opacity-5 group-hover:scale-110 transition-transform duration-500">
              <span className="material-symbols-outlined text-8xl text-emerald-600">currency_yuan</span>
            </div>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">需拨款实得总奖金</span>
            <div className="text-3xl font-black text-emerald-700 dark:text-emerald-300 relative z-10"><span className="text-xl mr-1">¥</span>{sumBonus.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
          </div>
        </div>

        {/* Main Data Table */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          {loading ? (
            <div className="p-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
              <p className="text-sm font-medium animate-pulse">正在穿透业务数据汇算...</p>
            </div>
          ) : stats.length === 0 ? (
            <div className="p-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <span className="material-symbols-outlined text-6xl text-slate-200 dark:text-slate-700">receipt_long</span>
              <p className="text-base font-bold text-slate-500">所选月份暂无已完结兑现的绩效任务</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left bg-white dark:bg-slate-800 border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider w-16 text-center">明细</th>
                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">员工姓名</th>
                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">归属部门</th>
                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider text-right">核定绩效分</th>
                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider text-right">核定奖金额</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {stats.map(user => {
                    const isExpanded = !!expandedRows[user.user_id];
                    const hasTasks = user.tasks.length > 0;
                    
                    return (
                      <React.Fragment key={user.user_id}>
                        {/* Parent Row */}
                        <tr className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/80 transition-colors ${isExpanded ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}`}>
                          <td className="px-6 py-4 text-center">
                            <button 
                              onClick={() => hasTasks && toggleRow(user.user_id)}
                              disabled={!hasTasks}
                              className={`w-6 h-6 flex items-center justify-center rounded-md transition-all ${
                                !hasTasks ? 'opacity-20 cursor-not-allowed' : 'bg-slate-100 hover:bg-indigo-100 hover:text-indigo-600 dark:bg-slate-700 dark:hover:bg-indigo-500/30'
                              }`}
                            >
                              <span className={`material-symbols-outlined text-[16px] transition-transform duration-200 ${isExpanded ? 'rotate-90 text-indigo-500' : 'text-slate-400'}`}>
                                chevron_right
                              </span>
                            </button>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center text-xs">
                                {user.user_name.charAt(0)}
                              </div>
                              <span className="font-bold text-slate-800 dark:text-slate-200">{user.user_name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                            {user.department_name}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="font-bold text-indigo-600 dark:text-indigo-400">
                              {user.total_score.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1})}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="font-black text-emerald-600 dark:text-emerald-400 text-base">
                              ¥{user.total_bonus.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                            </span>
                          </td>
                        </tr>
                        
                        {/* Expanded Detail Row */}
                        {isExpanded && hasTasks && (
                          <tr className="bg-slate-50/80 dark:bg-slate-900/50 shadow-inner">
                            <td></td>
                            <td colSpan={4} className="p-0 border-l border-indigo-200 dark:border-indigo-500/30">
                              <div className="p-4 pl-0">
                                <h4 className="text-[11px] font-bold text-slate-500 mb-3 flex items-center gap-1.5 ml-4">
                                  <span className="material-symbols-outlined text-[14px]">subdirectory_arrow_right</span>
                                  【{user.user_name}】本期数据溯源明细
                                </h4>
                                <div className="ml-4 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-800">
                                  <table className="w-full text-left">
                                    <thead>
                                      <tr className="bg-slate-100/50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                                        <th className="px-4 py-2 text-[10px] font-black tracking-wider text-slate-400">来源任务编号</th>
                                        <th className="px-4 py-2 text-[10px] font-black tracking-wider text-slate-400 w-1/2">任务与指标标题</th>
                                        <th className="px-4 py-2 text-[10px] font-black tracking-wider text-slate-400 text-right">核算得分</th>
                                        <th className="px-4 py-2 text-[10px] font-black tracking-wider text-slate-400 text-right">拨付奖金</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                                      {user.tasks.map(task => (
                                        <tr key={task.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                          <td className="px-4 py-2 whitespace-nowrap">
                                            <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded block w-max">
                                              {task.id}
                                            </span>
                                          </td>
                                          <td className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 truncate max-w-xs" title={task.title}>
                                            {task.title}
                                          </td>
                                          <td className="px-4 py-2 text-xs text-right font-bold text-indigo-500">
                                            {task.score > 0 ? `+${task.score}` : task.score}
                                          </td>
                                          <td className="px-4 py-2 text-xs text-right font-black text-emerald-600 dark:text-emerald-400">
                                            {task.bonus > 0 ? `¥${task.bonus}` : '-'}
                                          </td>
                                        </tr>
                                      ))}
                                      {/* Subtotal row */}
                                      <tr className="bg-slate-50 dark:bg-slate-900/50">
                                        <td colSpan={2} className="px-4 py-2 text-right text-[10px] font-bold text-slate-500">源数据汇总结项 =</td>
                                        <td className="px-4 py-2 text-xs text-right font-black text-indigo-700 dark:text-indigo-400">{user.total_score}</td>
                                        <td className="px-4 py-2 text-xs text-right font-black text-emerald-700 dark:text-emerald-400">¥{user.total_bonus.toLocaleString()}</td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 侧边配置抽屉 (导出 Excel 模板选择) */}
        {showConfig && (
          <div className="absolute top-0 right-0 bottom-0 w-[420px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 flex flex-col pt-6 animate-in slide-in-from-right-8 duration-300">
            <div className="px-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center sticky top-0 z-10 bg-white dark:bg-slate-900">
              <h3 className="text-xl font-bold flex items-center gap-2 dark:text-white">
                 <span className="material-symbols-outlined text-indigo-500">settings_applications</span>
                 导出字段提取器
              </h3>
              <button onClick={() => setShowConfig(false)} className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
               <span className="text-sm font-bold text-slate-600 dark:text-slate-300">选中的汇总发薪月：<span className="text-indigo-600">{month}</span></span>
               <button 
                  onClick={handleExportExcel} 
                  disabled={exporting}
                  className="px-4 py-2 bg-emerald-600 text-white font-bold hover:bg-emerald-700 rounded-lg text-sm transition-all shadow-md active:scale-95 flex items-center gap-2 disabled:opacity-50"
               >
                 <span className="material-symbols-outlined text-[18px]">{exporting ? 'hourglass_empty' : 'download'}</span>
                 {exporting ? '提取中...' : '生成发薪表'}
               </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50 dark:bg-slate-900">
               {categories.map(cat => (
                 <div key={cat} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                   <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 mb-4 px-1">{cat}</h4>
                   <div className="space-y-3">
                     {fields.filter(f => f.category === cat).map(f => (
                       <label key={f.key} className="flex items-center gap-3 cursor-pointer group p-2 rounded-xl transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50">
                         <div className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${f.checked ? 'bg-indigo-500 border-indigo-500 text-white shadow-sm shadow-indigo-500/20' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'}`}>
                            {f.checked && <span className="material-symbols-outlined text-[14px] font-bold">check</span>}
                         </div>
                         <input 
                           type="checkbox" 
                           checked={f.checked} 
                           className="hidden"
                           onChange={(e) => {
                             setFields(prev => prev.map(item => item.key === f.key ? {...item, checked: e.target.checked} : item));
                           }}
                         />
                         <span className={`text-sm select-none ${f.checked ? 'font-bold text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}>{f.label}</span>
                       </label>
                     ))}
                   </div>
                 </div>
               ))}

               <div className="bg-indigo-50 dark:bg-indigo-900/20 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                 <h4 className="font-bold text-sm text-indigo-800 dark:text-indigo-300 mb-3 flex items-center gap-1.5"><span className="material-symbols-outlined text-base">save</span>保存为预设模板</h4>
                 <div className="flex gap-2">
                   <input 
                     value={newTplName}
                     onChange={e => setNewTplName(e.target.value)}
                     className="flex-1 px-3 py-2 text-sm border-indigo-200 dark:border-indigo-700 rounded-lg outline-none focus:ring-2 ring-indigo-500/30 font-bold text-indigo-900 dark:text-indigo-100 dark:bg-slate-800" 
                     placeholder="例如：开发部报盘底座" 
                   />
                   <button onClick={saveTemplate} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-sm shadow-indigo-600/30 hover:bg-indigo-700 active:scale-95">保存</button>
                 </div>
                 
                 {templates.length > 0 && (
                   <div className="mt-4 pt-4 border-t border-indigo-200/50 dark:border-indigo-800/50">
                     <p className="text-xs text-indigo-600 dark:text-indigo-400 mb-2 font-bold uppercase tracking-wider">已保存预设方案 (点击套用)</p>
                     <div className="flex flex-wrap gap-2">
                       {templates.map(tpl => (
                         <button 
                           key={tpl.id}
                           onClick={() => applyTemplate(tpl.fields_json)}
                           className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 text-xs font-bold rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all flex items-center gap-1 shadow-sm"
                         >
                           <span className="material-symbols-outlined text-[12px]">library_add_check</span>{tpl.name}
                         </button>
                       ))}
                     </div>
                   </div>
                 )}
               </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
