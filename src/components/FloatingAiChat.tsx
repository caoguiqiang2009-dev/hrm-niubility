import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useIsMobile } from '../hooks/useIsMobile';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const SYSTEM_PROMPT = `你是 You!Niubility! HRM 系统的 AI 助手「小优」。你专注于帮助用户使用这套人力资源管理系统。
请用简洁友好的中文回答，适当使用 emoji。

系统包含以下模块：
- **我的主页** — 个人仪表盘、待办任务、绩效目标追踪
- **我的团队** — 团队成员绩效管理
- **赏金榜** — 公司级任务发布/认领，RACI 角色分配（R负责人单选，A/C/验收人多选），SMART 原则提案，HR→总经理两级审批
- **人力地图** — 公司人员分布可视化
- **全景仪表盘** — 数据分析，PDCA 监管
- **组织关系** — 部门架构树管理，支持企微通讯录同步
- **管理后台** — 权限矩阵、审批流模板、工资表管理（仅管理员/HR）

常见操作指引：
1. 提交绩效提案：赏金榜 → 申请绩效池提案 → 填写 SMART 目标 → 提交审批
2. 认领任务：赏金榜 → 点击任务卡片 → 立即加入
3. 企微通知：系统自动推送，点击通知可直接跳转对应页面
4. 回收站：赏金榜管理员可删除任务（进回收站）→ 可恢复或永久删除
5. 头像菜单：更新通知、工资单、个人设置、管理后台、使用说明`;

export default function FloatingAiChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { currentUser } = useAuth();
  const isMobile = useIsMobile();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMsg: Message = { role: 'user', content: trimmed };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...newMessages.map(m => ({ role: m.role, content: m.content })),
          ],
        }),
      });
      const json = await res.json();
      if (json.code === 0 && json.data?.content) {
        setMessages(prev => [...prev, { role: 'assistant', content: json.data.content }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: json.message || '抱歉，暂时无法响应。请稍后再试。' }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '网络异常，请检查网络连接后重试。' }]);
    }
    setIsLoading(false);
  };

  const quickQuestions = [
    '如何提交绩效提案？',
    '赏金榜怎么认领任务？',
    'RACI 角色是什么？',
    '如何查看工资单？',
  ];

  return (
    <>
      {/* Floating Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            onClick={() => setIsOpen(true)}
            className={`fixed right-6 z-[60] w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0060a9] to-[#409eff] text-white shadow-xl shadow-blue-500/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform group ${isMobile ? 'bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))]' : 'bottom-6'}`}
          >
            <span className="material-symbols-outlined text-[26px]" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
            {/* Pulse ring */}
            <span className="absolute inset-0 rounded-2xl bg-blue-400 animate-ping opacity-20" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className={`fixed z-[60] bg-white dark:bg-slate-900 shadow-2xl shadow-black/20 border border-slate-200/60 dark:border-slate-800 flex flex-col overflow-hidden ${
              isMobile 
                ? 'inset-0 rounded-none mobile-drawer-enter' 
                : 'bottom-6 right-6 w-[380px] h-[560px] rounded-2xl'
            }`}
          >
            {/* Header */}
            <div className="shrink-0 bg-gradient-to-r from-[#0060a9] to-[#409eff] px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <span className="material-symbols-outlined text-white text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
                </div>
                <div>
                  <h3 className="text-white font-bold text-sm">AI 助手 · 小优</h3>
                  <p className="text-white/60 text-[10px] font-medium">随时为您解答系统使用问题</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => { setMessages([]); }} className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors" title="清空对话">
                  <span className="material-symbols-outlined text-[18px]">refresh</span>
                </button>
                <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 flex items-center justify-center mb-4">
                    <span className="material-symbols-outlined text-blue-500 text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>waving_hand</span>
                  </div>
                  <h4 className="font-bold text-slate-700 dark:text-slate-200 text-sm mb-1">你好，{currentUser?.name || ''}！</h4>
                  <p className="text-xs text-slate-400 mb-5">有任何系统使用问题都可以问我 ~</p>
                  <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
                    {quickQuestions.map(q => (
                      <button key={q} onClick={() => { setInput(q); setTimeout(() => { setInput(q); sendMessage(); }, 50); }}
                        className="text-left text-[11px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors border border-blue-100 dark:border-blue-800/30">
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-[12px] font-bold ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-br from-[#0060a9] to-[#409eff] text-white'
                        : 'bg-gradient-to-br from-violet-100 to-blue-100 dark:from-violet-900/30 dark:to-blue-900/30 text-blue-600 dark:text-blue-400'
                    }`}>
                      {msg.role === 'user'
                        ? (currentUser?.name || 'U').charAt(0)
                        : <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
                      }
                    </div>
                    <div className={`max-w-[75%] px-3.5 py-2.5 rounded-xl text-[13px] leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-[#0060a9] text-white rounded-tr-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-tl-sm'
                    }`}>
                      {msg.content.split('\n').map((line, li) => (
                        <p key={li} className={li > 0 ? 'mt-1.5' : ''}>{line}</p>
                      ))}
                    </div>
                  </div>
                ))
              )}
              {isLoading && (
                <div className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-100 to-blue-100 dark:from-violet-900/30 dark:to-blue-900/30 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[14px] text-blue-600 dark:text-blue-400" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
                  </div>
                  <div className="bg-slate-100 dark:bg-slate-800 px-4 py-3 rounded-xl rounded-tl-sm">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="shrink-0 px-4 pb-4 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-end gap-2 bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2 border border-slate-200/60 dark:border-slate-700 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-400/10 transition-all">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="输入问题..."
                  rows={1}
                  className="flex-1 bg-transparent resize-none outline-none text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 max-h-24"
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || isLoading}
                  className={`p-1.5 rounded-lg transition-all ${
                    input.trim() && !isLoading
                      ? 'bg-[#0060a9] text-white hover:bg-[#004e8a] shadow-sm'
                      : 'text-slate-300 dark:text-slate-600'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">send</span>
                </button>
              </div>
              <p className="text-center text-[9px] text-slate-400 mt-2">AI 助手可能会产生不准确的回答</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
