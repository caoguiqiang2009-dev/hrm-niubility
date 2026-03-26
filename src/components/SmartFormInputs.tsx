import React from 'react';

export interface SmartData {
  title: string;          // S Specific
  target_value: string;   // M Measurable
  resource: string;       // A Achievable
  relevance: string;      // R Relevant
  deadline: string;       // T Time-bound
  category: string;
  collaborators: string;  // 跨部门协同人员
}

export function encodeSmartDescription(resource: string, relevance: string) {
  return `【所需资源】\n${resource.trim()}\n\n【岗位关联】\n${relevance.trim()}`;
}

export function decodeSmartDescription(description: string) {
  const resourceMatch = description.match(/【所需资源】\n([\s\S]*?)(?:\n\n【岗位关联】|$)/);
  const relevanceMatch = description.match(/【岗位关联】\n([\s\S]*)$/);
  
  return {
    resource: resourceMatch ? resourceMatch[1].trim() : description,
    relevance: relevanceMatch ? relevanceMatch[1].trim() : ''
  };
}

interface Props {
  data: SmartData;
  onChange: (data: Partial<SmartData>) => void;
  hideCategory?: boolean;
}

export default function SmartFormInputs({ data, onChange, hideCategory }: Props) {
  return (
    <div className="space-y-4">
      {/* S - Specific */}
      <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl p-4 shadow-sm relative overflow-hidden focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-400/20 transition-all">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500"></div>
        <div className="flex items-center mb-3 gap-2.5">
          <span className="flex-none w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 flex items-center justify-center font-black text-sm">S</span>
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
            明确目标 <span className="text-slate-400 font-normal normal-case">(Specific)</span>
          </label>
        </div>
        <input required value={data.title} onChange={e => onChange({ title: e.target.value })} 
          className="w-full bg-transparent text-sm font-medium text-slate-800 dark:text-slate-100 focus:outline-none placeholder-slate-400 dark:placeholder-slate-500" 
          placeholder="目标名称需具体明确，比如：完成 Q3 北区新客户拓展" />
      </div>

      {/* M - Measurable */}
      <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl p-4 shadow-sm relative overflow-hidden focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-400/20 transition-all">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500"></div>
        <div className="flex items-center mb-3 gap-2.5">
          <span className="flex-none w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-black text-sm">M</span>
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
            量化指标 <span className="text-slate-400 font-normal normal-case">(Measurable)</span>
          </label>
        </div>
        <textarea required value={data.target_value} onChange={e => onChange({ target_value: e.target.value })} 
          className="w-full bg-transparent text-sm text-slate-800 dark:text-slate-100 focus:outline-none resize-none h-12 leading-relaxed placeholder-slate-400 dark:placeholder-slate-500" 
          placeholder="如何衡量？（明确的数值、完成率或交付物标准，例如：营收 > 1000万）" />
      </div>

      {/* A - Achievable */}
      <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl p-4 shadow-sm relative overflow-hidden focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-400/20 transition-all">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500"></div>
        <div className="flex items-center mb-3 gap-2.5">
          <span className="flex-none w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 flex items-center justify-center font-black text-sm">A</span>
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
            可行方案 / 所需资源 <span className="text-slate-400 font-normal normal-case">(Achievable)</span>
          </label>
        </div>
        <textarea required value={data.resource} onChange={e => onChange({ resource: e.target.value })} 
          className="w-full bg-transparent text-sm text-slate-800 dark:text-slate-100 focus:outline-none resize-none h-16 leading-relaxed placeholder-slate-400 dark:placeholder-slate-500" 
          placeholder="保障目标达成的资源、预算或支持是什么？证明其具备可行性..." />
      </div>

      {/* R - Relevant */}
      <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl p-4 shadow-sm relative overflow-hidden focus-within:border-purple-400 focus-within:ring-2 focus-within:ring-purple-400/20 transition-all">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-purple-500"></div>
        <div className="flex items-center mb-3 gap-2.5">
          <span className="flex-none w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400 flex items-center justify-center font-black text-sm">R</span>
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
            岗位强相关 <span className="text-slate-400 font-normal normal-case">(Relevant)</span>
          </label>
        </div>
        <textarea required value={data.relevance} onChange={e => onChange({ relevance: e.target.value })} 
          className="w-full bg-transparent text-sm text-slate-800 dark:text-slate-100 focus:outline-none resize-none h-16 leading-relaxed placeholder-slate-400 dark:placeholder-slate-500" 
          placeholder="此目标如何对齐公司核心战略或您的关键职责？" />
      </div>

      {/* T - Time-bound & Category Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl p-4 shadow-sm relative overflow-hidden focus-within:border-rose-400 focus-within:ring-2 focus-within:ring-rose-400/20 transition-all">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500"></div>
          <div className="flex items-center mb-3 gap-2.5">
            <span className="flex-none w-7 h-7 rounded-lg bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400 flex items-center justify-center font-black text-sm">T</span>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
              时限 <span className="text-slate-400 font-normal normal-case">(Time-bound)</span>
            </label>
          </div>
          <input required type="date" value={data.deadline} onChange={e => onChange({ deadline: e.target.value })} 
            className="w-full bg-transparent text-sm font-medium text-slate-800 dark:text-slate-100 focus:outline-none" />
        </div>
        
        {!hideCategory && (
          <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl p-4 shadow-sm outline-none focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-3 uppercase tracking-widest border-b border-transparent">业务分类</label>
            <select value={data.category} onChange={e => onChange({ category: e.target.value })} 
              className="w-full bg-transparent font-medium text-slate-800 dark:text-slate-100 focus:outline-none text-sm cursor-pointer mt-1">
              <option>业务</option>
              <option>技术</option>
              <option>团队</option>
              <option>其他</option>
            </select>
          </div>
        )}
      </div>

      {/* Cross-department Collaborators */}
      <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl p-4 shadow-sm relative overflow-hidden focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-400/20 transition-all">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-sky-500"></div>
        <div className="flex items-center mb-3 gap-2.5">
          <span className="flex-none w-7 h-7 rounded-lg bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-400 flex items-center justify-center">
            <span className="material-symbols-outlined text-[16px]">group_add</span>
          </span>
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
            跨部门协同人员 <span className="text-slate-400 font-normal normal-case">(Collaborators)</span>
          </label>
        </div>
        <input value={data.collaborators || ''} onChange={e => onChange({ collaborators: e.target.value })} 
          className="w-full bg-transparent text-sm font-medium text-slate-800 dark:text-slate-100 focus:outline-none placeholder-slate-400 dark:placeholder-slate-500" 
          placeholder="输入协同人员姓名，多人用逗号分隔，如：李芳, 王明" />
      </div>
    </div>
  );
}
