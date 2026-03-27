import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';

interface SmartSheetField {
  field_id: string;
  field_title: string;
  field_type: string;
}

export default function SalaryManager({ navigate }: { navigate: (v: string) => void }) {
  const [configStatus, setConfigStatus] = useState<{ configured: boolean; docid: string; sheetId: string } | null>(null);
  const [fields, setFields] = useState<SmartSheetField[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'smartsheet' | 'local'>('smartsheet');

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // Check config
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/salary/smartsheet/status', { headers });
        const data = await res.json();
        if (data.code === 0) {
          setConfigStatus(data.data);
          if (data.data.configured) {
            loadData();
          } else {
            setLoading(false);
          }
        }
      } catch (err) {
        setError('无法连接服务器');
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      // Load fields and records in parallel
      const [fieldsRes, recordsRes] = await Promise.all([
        fetch('/api/salary/smartsheet/fields', { headers }),
        fetch('/api/salary/smartsheet/records', { headers }),
      ]);
      const fieldsData = await fieldsRes.json();
      const recordsData = await recordsRes.json();

      if (fieldsData.code === 0) setFields(fieldsData.data || []);
      else setError(fieldsData.message || '获取字段失败');

      if (recordsData.code === 0) {
        setRecords(recordsData.data?.records || []);
        setTotal(recordsData.data?.total || 0);
      } else {
        setError(recordsData.message || '获取记录失败');
      }
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  // Extract cell value from WeCom Smart Sheet format
  const getCellValue = (record: any, fieldTitle: string): string => {
    const values = record?.values;
    if (!values) return '';
    const cell = values[fieldTitle];
    if (!cell) return '';
    // Smart Sheet returns typed cell values
    if (Array.isArray(cell)) {
      return cell.map((c: any) => {
        if (typeof c === 'object') return c.text || c.value || JSON.stringify(c);
        return String(c);
      }).join(', ');
    }
    if (typeof cell === 'object') return cell.text || cell.value || JSON.stringify(cell);
    return String(cell);
  };

  const openInWecom = () => {
    window.open('https://doc.weixin.qq.com/smartsheet/s3_AesA3AabAC0CNJegBzqPAQhKdcm9f?scode=AA4Adgf-AG80v0AqM7AesA3AabAC0&tab=q979lj&viewId=vukaF8', '_blank');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 font-['Inter'] antialiased">
      <Sidebar currentView="salary" navigate={navigate} />
      
      <main className="flex-1 h-screen flex flex-col relative animate-in fade-in duration-300">
        {/* Header */}
        <header className="h-16 flex items-center px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex-shrink-0 z-10">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                <span className="material-symbols-outlined text-white text-[20px]">payments</span>
              </div>
              <div>
                <h1 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  工资表管理
                  {configStatus?.configured && (
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-md border border-emerald-100 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                      已连接智能表格
                    </span>
                  )}
                </h1>
                <p className="text-[11px] text-slate-500 font-medium">
                  {configStatus?.configured ? '数据同步自企业微信智能表格' : '工资数据管理'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {configStatus?.configured && (
                <>
                  <button onClick={loadData}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg transition-colors">
                    <span className="material-symbols-outlined text-[14px]">refresh</span>
                    刷新数据
                  </button>
                  <button onClick={openInWecom}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#0060a9] hover:bg-[#004d8a] text-white text-xs font-bold rounded-lg transition-colors">
                    <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                    在企微中打开
                  </button>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Error */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <span className="material-symbols-outlined text-red-500 text-[18px] mt-0.5">error</span>
              <div>
                <p className="text-sm font-bold text-red-700">连接失败</p>
                <p className="text-xs text-red-600 mt-1">{error}</p>
                <p className="text-[10px] text-red-400 mt-2">请检查：1. 管理后台「协作→文档→API」已配置应用  2. .env 中的 WECOM_SALARY_DOC_ID 和 WECOM_SALARY_SHEET_ID 正确</p>
              </div>
            </div>
          )}

          {/* Not Configured State */}
          {!loading && configStatus && !configStatus.configured && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-20 h-20 bg-amber-50 rounded-2xl flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-amber-500 text-4xl">settings_suggest</span>
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-2">请先配置企微智能表格</h3>
              <p className="text-sm text-slate-500 max-w-md text-center mb-6">
                工资表模块需要连接企业微信智能表格。请在 <code className="px-1.5 py-0.5 bg-slate-100 rounded text-xs font-mono">.env</code> 文件中配置以下环境变量：
              </p>
              <div className="bg-slate-900 rounded-xl p-5 text-left font-mono text-xs text-emerald-400 max-w-lg w-full">
                <p className="text-slate-500"># 从智能表格URL中提取</p>
                <p>WECOM_SALARY_DOC_ID=<span className="text-amber-400">your_doc_id</span></p>
                <p>WECOM_SALARY_SHEET_ID=<span className="text-amber-400">your_sheet_id</span></p>
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-sm font-bold text-slate-600">正在连接企微智能表格...</p>
            </div>
          )}

          {/* Data Table */}
          {!loading && configStatus?.configured && !error && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              {/* Table Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-amber-500 text-[18px]">table_chart</span>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">工资数据</span>
                  <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full font-bold">{total} 条记录</span>
                  <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full font-bold">{fields.length} 个字段</span>
                </div>
              </div>

              {/* Table */}
              {fields.length > 0 && records.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50">
                        <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-10">#</th>
                        {fields.map(field => (
                          <th key={field.field_id} className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                            {field.field_title}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {records.map((record, idx) => (
                        <tr key={record.record_id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-3 text-xs text-slate-400 font-mono">{idx + 1}</td>
                          {fields.map(field => (
                            <td key={field.field_id} className="px-4 py-3 text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap max-w-[200px] truncate">
                              {getCellValue(record, field.field_title)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16">
                  <span className="material-symbols-outlined text-4xl text-slate-200 mb-3">table_rows</span>
                  <p className="text-sm font-bold text-slate-400">暂无数据</p>
                  <p className="text-xs text-slate-300 mt-1">请在企微智能表格中添加工资数据</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
