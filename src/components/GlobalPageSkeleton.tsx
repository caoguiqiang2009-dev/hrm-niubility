import React from 'react';

export default function GlobalPageSkeleton() {
  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 space-y-6 animate-pulse w-full">
      {/* 头部标题区骨架 */}
      <div className="flex items-start justify-between">
        <div className="space-y-4 w-1/3 min-w-[200px]">
          <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-lg w-3/4"></div>
          <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-md w-1/2"></div>
        </div>
        <div className="flex gap-3">
          <div className="h-10 w-24 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
          <div className="h-10 w-24 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
        </div>
      </div>

      {/* 核心指标统计区骨架 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-slate-100 dark:bg-slate-800/50 rounded-2xl h-32 border border-slate-200/50 dark:border-slate-700/50 p-5 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-16"></div>
              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700"></div>
            </div>
            <div className="space-y-2 mt-4">
              <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>

      {/* 主体内容区骨架 */}
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 space-y-4">
          <div className="bg-slate-100 dark:bg-slate-800/50 rounded-2xl h-[400px] border border-slate-200/50 dark:border-slate-700/50 p-6 flex flex-col">
            <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-48 mb-6"></div>
            <div className="flex-1 bg-slate-200/50 dark:bg-slate-700/30 rounded-xl w-full"></div>
          </div>
        </div>
        <div className="w-full lg:w-96 shrink-0 space-y-4">
          <div className="bg-slate-100 dark:bg-slate-800/50 rounded-2xl h-[280px] border border-slate-200/50 dark:border-slate-700/50 p-6">
             <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-32 mb-6"></div>
             <div className="space-y-4">
               <div className="flex items-center gap-4"><div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0"/><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full"/></div>
               <div className="flex items-center gap-4"><div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0"/><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full"/></div>
               <div className="flex items-center gap-4"><div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0"/><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"/></div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
