import React from 'react';
import { SmartData, decodeSmartDescription } from './SmartFormInputs';

interface Props {
  data: SmartData;
}

/**
 * A stunning, read-only display component for SMART goals.
 * Renders S, M, A, R, T as visually distinct, linear-style cards.
 */
export default function SmartGoalDisplay({ data }: Props) {
  return (
    <div className="space-y-4">
      {/* S - Specific */}
      <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl p-4 shadow-sm relative overflow-hidden transition-all">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500"></div>
        <div className="flex items-center mb-2 gap-2.5">
          <span className="flex-none w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 flex items-center justify-center font-black text-sm">S</span>
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
            明确目标 <span className="text-slate-400 font-normal normal-case">(Specific)</span>
          </label>
        </div>
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 leading-relaxed pl-9.5">
          {data.title || <span className="text-slate-400 italic">未定义目标</span>}
        </p>
      </div>

      {/* M - Measurable */}
      <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl p-4 shadow-sm relative overflow-hidden transition-all">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500"></div>
        <div className="flex items-center mb-2 gap-2.5">
          <span className="flex-none w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-black text-sm">M</span>
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
            量化指标 <span className="text-slate-400 font-normal normal-case">(Measurable)</span>
          </label>
        </div>
        <p className="text-sm text-slate-800 dark:text-slate-100 leading-relaxed pl-9.5 whitespace-pre-wrap">
          {data.target_value || <span className="text-slate-400 italic">未定义量化标准</span>}
        </p>
      </div>

      {/* A - Achievable */}
      <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl p-4 shadow-sm relative overflow-hidden transition-all">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500"></div>
        <div className="flex items-center mb-2 gap-2.5">
          <span className="flex-none w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 flex items-center justify-center font-black text-sm">A</span>
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
            可行方案 / 所需资源 <span className="text-slate-400 font-normal normal-case">(Achievable)</span>
          </label>
        </div>
        <p className="text-sm text-slate-800 dark:text-slate-100 leading-relaxed pl-9.5 whitespace-pre-wrap">
          {data.resource || <span className="text-slate-400 italic">暂无具体方案或资源说明</span>}
        </p>
      </div>

      {/* R - Relevant */}
      <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl p-4 shadow-sm relative overflow-hidden transition-all">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-purple-500"></div>
        <div className="flex items-center mb-2 gap-2.5">
          <span className="flex-none w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400 flex items-center justify-center font-black text-sm">R</span>
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
            岗位强相关 <span className="text-slate-400 font-normal normal-case">(Relevant)</span>
          </label>
        </div>
        <p className="text-sm text-slate-800 dark:text-slate-100 leading-relaxed pl-9.5 whitespace-pre-wrap">
          {data.relevance || <span className="text-slate-400 italic">暂无相关性说明</span>}
        </p>
      </div>

      {/* T - Time-bound & Category */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl p-4 shadow-sm relative overflow-hidden transition-all">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500"></div>
          <div className="flex items-center mb-1.5 gap-2.5">
            <span className="flex-none w-7 h-7 rounded-lg bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400 flex items-center justify-center font-black text-sm">T</span>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
              时限 <span className="text-slate-400 font-normal normal-case">(Time-bound)</span>
            </label>
          </div>
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100 pl-9.5">
            {data.deadline || '--'}
          </p>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl p-4 shadow-sm relative overflow-hidden transition-all">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-primary"></div>
          <div className="flex items-center mb-1.5 gap-2.5">
            <span className="flex-none w-7 h-7 rounded-lg bg-primary-container text-on-primary-container flex items-center justify-center font-black text-sm">
              <span className="material-symbols-outlined text-[16px]">category</span>
            </span>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">
              业务分类
            </label>
          </div>
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100 pl-9.5">
            {data.category || '--'}
          </p>
        </div>
      </div>

      {/* Collaborators */}
      {data.collaborators && (
        <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl p-4 shadow-sm relative overflow-hidden transition-all">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-sky-500"></div>
          <div className="flex items-center mb-2 gap-2.5">
            <span className="flex-none w-7 h-7 rounded-lg bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-[16px]">group_add</span>
            </span>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
              跨部门协同人员 <span className="text-slate-400 font-normal normal-case">(Collaborators)</span>
            </label>
          </div>
          <div className="flex flex-wrap gap-2 pl-9.5">
            {data.collaborators.split(/[,，]/).map((name, i) => name.trim() && (
              <span key={i} className="inline-flex items-center gap-1 bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 px-2.5 py-1 rounded-lg text-xs font-bold border border-sky-200/60 dark:border-sky-700/60">
                <span className="material-symbols-outlined text-[13px]">person</span>
                {name.trim()}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Helper to easily render SmartGoalDisplay from a standard Plan object 
 * that has an encoded `description` string.
 */
export function SmartGoalDisplayFromPlan({ 
  title, target_value, description, deadline, category, collaborators 
}: { 
  title: string, target_value: string, description: string, deadline: string, category: string, collaborators?: string 
}) {
  const { resource, relevance } = decodeSmartDescription(description || '');
  return (
    <SmartGoalDisplay
      data={{
        title,
        target_value,
        resource,
        relevance,
        deadline,
        category,
        collaborators: collaborators || ''
      }}
    />
  );
}
