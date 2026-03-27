import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Paperclip, Upload, Trash2, Plus, ChevronDown, X } from 'lucide-react';
import MDEditor from '@uiw/react-md-editor';
import { useAuth } from '../context/AuthContext';
import { useRTASR } from '../hooks/useRTASR';

const SearchableUserDropdown = ({ 
  label, 
  value, 
  onChange, 
  users, 
  placeholder,
  readonly 
}: { 
  label: string, 
  value: string, 
  onChange: (v: string) => void, 
  users: {id: string, name: string}[], 
  placeholder: string,
  readonly?: boolean 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (panelRef.current?.contains(e.target as Node)) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const handleToggle = () => {
    if (readonly) return;
    if (!isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 6, left: rect.left });
    }
    setIsOpen(!isOpen);
  };

  const filteredUsers = users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()));
  const selectedUser = users.find(u => u.id === value);

  return (
    <>
      <div ref={triggerRef} className={`flex items-center bg-white/10 backdrop-blur-sm rounded-lg px-3.5 py-2 border border-white/20 ${readonly ? '' : 'hover:bg-white/20 hover:border-white/30 cursor-pointer'} transition-all duration-200`} onClick={handleToggle}>
        <span className="text-[11px] font-black text-white/70 mr-2 tracking-wider uppercase">{label}</span>
        <div className="flex items-center gap-1 select-none">
          <span className={`text-sm tracking-wide font-semibold ${selectedUser ? 'text-white' : 'text-white/50'}`}>
            {selectedUser ? selectedUser.name : placeholder.replace('选择', '')}
          </span>
          {!readonly && <ChevronDown size={13} className={`text-white/50 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />}
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            ref={panelRef}
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
            className="w-52 bg-[#1e2640]/98 backdrop-blur-xl rounded-xl shadow-2xl shadow-black/40 border border-white/15 overflow-hidden flex flex-col"
          >
            {/* Search Input */}
            <div className="p-2.5 border-b border-white/5">
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-2.5 text-slate-400 text-[14px]">search</span>
                <input 
                  type="text" 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="搜索人员..."
                  className="w-full bg-white/5 text-white text-xs py-2 pl-8 pr-3 rounded-lg outline-none border border-white/5 focus:border-blue-400/40 focus:bg-white/8 transition-all placeholder:text-slate-500"
                  autoFocus
                />
              </div>
            </div>
            
            {/* User List */}
            <div className="max-h-56 overflow-y-auto py-1">
              <button
                className={`w-full text-left px-4 py-2 text-xs flex items-center justify-between hover:bg-white/5 transition-colors ${!value ? 'text-blue-400 font-bold' : 'text-slate-400'}`}
                onClick={() => { onChange(''); setIsOpen(false); setSearch(''); }}
              >
                <span>{placeholder}</span>
                {!value && <Check size={13} className="text-blue-400" />}
              </button>
              {filteredUsers.map(u => {
                const isSelected = u.id === value;
                return (
                  <button
                    key={u.id}
                    className={`w-full text-left px-4 py-2 text-xs flex items-center justify-between hover:bg-white/5 transition-colors ${isSelected ? 'text-blue-400 font-bold bg-blue-500/5' : 'text-slate-300'}`}
                    onClick={() => { onChange(u.id); setIsOpen(false); setSearch(''); }}
                  >
                    <span>{u.name}</span>
                    {isSelected && <Check size={13} className="text-blue-400" />}
                  </button>
                )
              })}
              {filteredUsers.length === 0 && (
                <div className="px-4 py-3 text-xs text-slate-500 text-center">无匹配人员</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

/* ── 多选人员下拉 ── */
const MultiSelectUserDropdown = ({ 
  label, 
  value, 
  onChange, 
  users, 
  placeholder,
  readonly 
}: { 
  label: string, 
  value: string, // comma-separated IDs
  onChange: (v: string) => void, 
  users: {id: string, name: string}[], 
  placeholder: string,
  readonly?: boolean 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  const selectedIds = value ? value.split(',').filter(Boolean) : [];

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (panelRef.current?.contains(e.target as Node)) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const handleToggle = () => {
    if (readonly) return;
    if (!isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 6, left: rect.left });
    }
    setIsOpen(!isOpen);
  };

  const filteredUsers = users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()));
  const selectedNames = selectedIds.map(id => users.find(u => u.id === id)?.name).filter(Boolean);

  const toggleUser = (id: string) => {
    const newIds = selectedIds.includes(id)
      ? selectedIds.filter(x => x !== id)
      : [...selectedIds, id];
    onChange(newIds.join(','));
  };

  const displayText = selectedNames.length === 0
    ? placeholder.replace('选择', '')
    : selectedNames.length <= 2
      ? selectedNames.join('、')
      : `${selectedNames[0]} 等${selectedNames.length}人`;

  return (
    <>
      <div ref={triggerRef} className={`flex items-center bg-white/10 backdrop-blur-sm rounded-lg px-3.5 py-2 border border-white/20 ${readonly ? '' : 'hover:bg-white/20 hover:border-white/30 cursor-pointer'} transition-all duration-200`} onClick={handleToggle}>
        <span className="text-[11px] font-black text-white/70 mr-2 tracking-wider uppercase">{label}</span>
        <div className="flex items-center gap-1 select-none">
          <span className={`text-sm tracking-wide font-semibold ${selectedNames.length > 0 ? 'text-white' : 'text-white/50'}`}>
            {displayText}
          </span>
          {selectedNames.length > 0 && (
            <span className="ml-1 text-[10px] font-bold bg-white/20 text-white/80 rounded-full w-4 h-4 flex items-center justify-center">{selectedNames.length}</span>
          )}
          {!readonly && <ChevronDown size={13} className={`text-white/50 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />}
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            ref={panelRef}
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
            className="w-56 bg-[#1e2640]/98 backdrop-blur-xl rounded-xl shadow-2xl shadow-black/40 border border-white/15 overflow-hidden flex flex-col"
          >
            {/* Selected Tags */}
            {selectedNames.length > 0 && (
              <div className="px-3 pt-2.5 pb-1 flex flex-wrap gap-1.5 border-b border-white/5">
                {selectedIds.map(id => {
                  const name = users.find(u => u.id === id)?.name;
                  if (!name) return null;
                  return (
                    <span key={id} className="inline-flex items-center gap-1 bg-blue-500/20 text-blue-300 text-[10px] font-bold px-2 py-0.5 rounded-md">
                      {name}
                      {!readonly && <X size={10} className="cursor-pointer hover:text-white transition-colors" onClick={(e) => { e.stopPropagation(); toggleUser(id); }} />}
                    </span>
                  );
                })}
              </div>
            )}
            {/* Search Input */}
            <div className="p-2.5 border-b border-white/5">
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-2.5 text-slate-400 text-[14px]">search</span>
                <input 
                  type="text" 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="搜索人员..."
                  className="w-full bg-white/5 text-white text-xs py-2 pl-8 pr-3 rounded-lg outline-none border border-white/5 focus:border-blue-400/40 focus:bg-white/8 transition-all placeholder:text-slate-500"
                  autoFocus
                />
              </div>
            </div>
            
            {/* User List */}
            <div className="max-h-56 overflow-y-auto py-1">
              {filteredUsers.map(u => {
                const isSelected = selectedIds.includes(u.id);
                return (
                  <button
                    key={u.id}
                    className={`w-full text-left px-4 py-2 text-xs flex items-center justify-between hover:bg-white/5 transition-colors ${isSelected ? 'text-blue-400 font-bold bg-blue-500/5' : 'text-slate-300'}`}
                    onClick={(e) => { e.stopPropagation(); toggleUser(u.id); }}
                  >
                    <span>{u.name}</span>
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-500'}`}>
                      {isSelected && <Check size={10} className="text-white" />}
                    </div>
                  </button>
                )
              })}
              {filteredUsers.length === 0 && (
                <div className="px-4 py-3 text-xs text-slate-500 text-center">无匹配人员</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

/* ── 任务属性下拉 (fixed positioning to avoid overflow clip) ── */
const TASK_TYPE_OPTIONS = ['常规任务', '重点项目', '创新探索', '临时指派'];
const TaskTypeDropdown = ({ value, onChange, readonly }: { value: string; onChange: (v: string) => void; readonly?: boolean }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (panelRef.current?.contains(e.target as Node)) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const handleToggle = () => {
    if (readonly) return;
    if (!isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 6, left: rect.left });
    }
    setIsOpen(!isOpen);
  };

  return (
    <>
      <div ref={triggerRef} className={`flex items-center bg-white/10 backdrop-blur-sm rounded-lg px-3.5 py-2 border border-white/20 ${readonly ? '' : 'hover:bg-white/20 hover:border-white/30 cursor-pointer'} transition-all duration-200`} onClick={handleToggle}>
        <span className="text-[11px] font-black text-white/70 mr-2 tracking-wider uppercase">任务属性</span>
        <div className="flex items-center gap-1 select-none">
          <span className={`text-sm tracking-wide font-semibold ${value ? 'text-white' : 'text-white/50'}`}>{value || '选择属性'}</span>
          {!readonly && <ChevronDown size={13} className={`text-white/50 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />}
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
            className="w-44 bg-[#1e2640]/98 backdrop-blur-xl rounded-xl shadow-2xl shadow-black/40 border border-white/15 overflow-hidden py-1"
          >
            {TASK_TYPE_OPTIONS.map(opt => (
              <button
                key={opt}
                className={`w-full text-left px-4 py-2.5 text-xs flex items-center justify-between hover:bg-white/8 transition-colors ${value === opt ? 'text-blue-400 font-bold bg-blue-500/8' : 'text-slate-300'}`}
                onClick={() => { onChange(opt); setIsOpen(false); }}
              >
                <span>{opt}</span>
                {value === opt && <Check size={13} className="text-blue-400" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

type SectionId = 's' | 'm' | 'a_smart' | 'r_smart' | 't' | 'attachments' | null;

export interface SmartTaskData {
  r: string;
  a: string;
  c: string;
  e: string; // 验收人
  bonus: string;
  rewardType: 'money' | 'score';
  maxParticipants: string;
  taskType: string;
  summary: string;
  s: string;
  m: string;
  a_smart: string;
  r_smart: string;
  t: string;
  planTime?: string;
  doTime?: string;
  checkTime?: string;
  actTime?: string;
  attachments: { name: string; size: string }[];
  reject_reason?: string;
  id?: number;
  flow_type?: string;
  logs?: any[];
  status?: string;
  approver_name?: string;
}

export interface SmartTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: SmartTaskData) => void;
  title: string;
  type: 'personal' | 'team' | 'pool_propose' | 'pool_publish';
  users: { id: string, name: string }[];
  initialData?: Partial<SmartTaskData>;
  submitting?: boolean;
  readonly?: boolean;
  customFooter?: React.ReactNode;
  approverMode?: boolean;
  onApprove?: (comment: string, updatedData?: { bonus?: string; rewardType?: string; maxParticipants?: string }) => void;
  onReject?: (comment: string) => void;
  onDraft?: (data: SmartTaskData) => void;
}

export default function SmartTaskModal({ isOpen, onClose, onSubmit, title, type, users, initialData, submitting, readonly, customFooter, approverMode, onApprove, onReject, onDraft }: SmartTaskModalProps) {
  const [activeSection, setActiveSection] = useState<SectionId>(null);
  const [aiActivating, setAiActivating] = useState<'full' | null>(null);
  const [tempVoice, setTempVoice] = useState('');
  
  // Dynamically fetched logs for universal approval path display
  const [fetchedLogs, setFetchedLogs] = useState<any[]>([]);

  // Resolve flow type: determines code prefix (PL/PF) and log source
  const resolvedFlowType = initialData?.flow_type || (type.startsWith('pool') ? 'proposal' : 'perf_plan');
  const codePrefix = resolvedFlowType === 'proposal' ? 'PL' : 'PF';

  useEffect(() => {
    if (isOpen && initialData?.id) {
      if (resolvedFlowType === 'perf_plan') {
        // Perf plans: fetch from perf_logs table
        const token = localStorage.getItem('token');
        fetch(`/api/perf/plans/${initialData.id}/logs`, { headers: { Authorization: `Bearer ${token}` }})
          .then(r => r.json())
          .then(j => setFetchedLogs(j.data || []))
          .catch(() => setFetchedLogs([]));
      } else {
        // Proposals: synthesize two-step approval nodes (HR → Admin)
        const syntheticLogs: any[] = [];
        const d = initialData as any;
        const creator = d.creator_name || d.creator_id || d.proposer_name || '发起人';
        const hrReviewer = d.hr_reviewer_name || (d.hr_reviewer_id ? `审批人(${d.hr_reviewer_id})` : '人事审核');
        const adminReviewer = d.admin_reviewer_name || (d.admin_reviewer_id ? `审批人(${d.admin_reviewer_id})` : '总经理复核');
        const st = d.status || d.proposal_status;
        
        // Node 1: creator submitted
        syntheticLogs.push({ user_name: creator, user_id: creator, action: 'submit', new_value: 'pending_review' });
        
        // Node 2: HR reviewer
        if (['pending_admin', 'approved', 'open', 'in_progress', 'closed', 'completed'].includes(st)) {
          // HR已通过
          syntheticLogs.push({ user_name: hrReviewer, user_id: hrReviewer, action: 'approve', new_value: 'approved' });
        } else if (st === 'rejected' && d.hr_reviewer_id && !d.admin_reviewer_id) {
          // HR驳回
          syntheticLogs.push({ user_name: hrReviewer, user_id: hrReviewer, action: 'reject', new_value: 'rejected' });
        } else if (st === 'pending_hr') {
          // 等待HR审核
          syntheticLogs.push({ user_name: hrReviewer, user_id: hrReviewer, action: 'pending', new_value: 'pending' });
        }
        
        // Node 3: Admin reviewer (only if past HR stage)
        if (['approved', 'open', 'in_progress', 'closed', 'completed'].includes(st)) {
          // Admin已通过
          syntheticLogs.push({ user_name: adminReviewer, user_id: adminReviewer, action: 'approve', new_value: 'approved' });
        } else if (st === 'rejected' && d.admin_reviewer_id) {
          // Admin驳回
          syntheticLogs.push({ user_name: adminReviewer, user_id: adminReviewer, action: 'reject', new_value: 'rejected' });
        } else if (st === 'pending_admin') {
          // 等待Admin复核
          syntheticLogs.push({ user_name: adminReviewer, user_id: adminReviewer, action: 'pending', new_value: 'pending' });
        }
        
        setFetchedLogs(syntheticLogs);
      }
    } else {
      setFetchedLogs([]);
    }
  }, [isOpen, initialData?.id, type, resolvedFlowType]);
  
  // Parse existing reject_reason into comments if present
  const parseComments = (reason?: string) => {
    if (!reason) return {};
    const parsed: Record<string, string> = {};
    const lines = reason.split('\n\n');
    for (const chunk of lines) {
      if (chunk.includes('[S ')) parsed.s = chunk.split(']: ')[1] || chunk;
      else if (chunk.includes('[M ')) parsed.m = chunk.split(']: ')[1] || chunk;
      else if (chunk.includes('[A ')) parsed.a_smart = chunk.split(']: ')[1] || chunk;
      else if (chunk.includes('[R ')) parsed.r_smart = chunk.split(']: ')[1] || chunk;
      else if (chunk.includes('[T ')) parsed.t = chunk.split(']: ')[1] || chunk;
      else if (!parsed._general) parsed._general = chunk;
      else parsed._general += '\n' + chunk;
    }
    return parsed;
  };
  
  const [comments, setComments] = useState<Record<string, string>>(parseComments(initialData?.reject_reason));
  
  const { isRecording, startRecording, stopRecording, error: voiceError } = useRTASR({
    onResult: (text, isFinal) => {
      if (isFinal) {
        setFormData(prev => ({ ...prev, summary: prev.summary + text }));
        setTempVoice('');
      } else {
        setTempVoice(text);
      }
    }
  });

  useEffect(() => {
    if (voiceError) {
      alert(`语音识别失败: ${voiceError}`);
    }
  }, [voiceError]);

  const [headerSelections, setHeaderSelections] = useState({
    r: initialData?.r || '',
    a: initialData?.a || '',
    c: initialData?.c || '',
    e: initialData?.e || '',
    bonus: initialData?.bonus || '0',
    rewardType: initialData?.rewardType || 'money',
    taskType: initialData?.taskType || '常规任务',
    maxParticipants: initialData?.maxParticipants || '5'
  });

  const [formData, setFormData] = useState({
    summary: initialData?.summary || '',
    s: initialData?.s || '',
    m: initialData?.m || '',
    a_smart: initialData?.a_smart || '',
    r_smart: initialData?.r_smart || '',
    t: initialData?.t || '',
    planTime: initialData?.planTime || '',
    doTime: initialData?.doTime || '',
    checkTime: initialData?.checkTime || '',
    actTime: initialData?.actTime || '',
    attachments: initialData?.attachments || [] as { name: string; size: string }[]
  });

  useEffect(() => {
    if (isOpen) {
      setHeaderSelections({
        r: initialData?.r || '',
        a: initialData?.a || '',
        c: initialData?.c || '',
        e: initialData?.e || '',
        bonus: initialData?.bonus || '0',
        rewardType: initialData?.rewardType || 'money',
        taskType: initialData?.taskType || '常规任务',
        maxParticipants: initialData?.maxParticipants || '5'
      });
      setFormData({
        summary: initialData?.summary || '',
        s: initialData?.s || '',
        m: initialData?.m || '',
        a_smart: initialData?.a_smart || '',
        r_smart: initialData?.r_smart || '',
        t: initialData?.t || '',
        planTime: initialData?.planTime || '',
        doTime: initialData?.doTime || '',
        checkTime: initialData?.checkTime || '',
        actTime: initialData?.actTime || '',
        attachments: initialData?.attachments || []
      });
      setComments(parseComments(initialData?.reject_reason));
      setActiveSection(null);
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleUpdate = (field: keyof typeof formData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const sections = [
    {
      id: 's',
      letter: 'S',
      title: '明确目标',
      subtitle: 'SPECIFIC',
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      placeholder: '请描述具体目标：此阶段您想达成什么具体的成果？'
    },
    {
      id: 'm',
      letter: 'M',
      title: '量化指标',
      subtitle: 'MEASURABLE',
      color: 'text-green-600',
      bg: 'bg-green-50',
      border: 'border-green-200',
      placeholder: '请输入量化指标：如何衡量该目标的成功？（如数据提升、完成率等）'
    },
    {
      id: 'a_smart',
      letter: 'A',
      title: '可行方案',
      subtitle: 'ACHIEVABLE',
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      border: 'border-orange-200 ring-orange-200'
    },
    {
      id: 'r_smart',
      letter: 'R',
      title: '岗位相关性',
      subtitle: 'RELEVANT',
      color: 'text-indigo-500',
      bg: 'bg-indigo-50',
      placeholder: '该目标如何支持部门/公司的核心目标？',
      border: 'border-indigo-200 ring-indigo-200'
    },
    {
      id: 't',
      letter: 'T',
      title: '时限要求',
      subtitle: 'TIME-BOUND',
      color: 'text-red-500',
      bg: 'bg-red-50',
      placeholder: '预计何时完成？是否有里程碑节点？',
      border: 'border-red-200 ring-red-200'
    }
  ];

  const handleAIAssist = async () => {
    if (!formData.summary.trim()) {
      alert('请先填写目标简述，AI 才能为您生成具体的 SMART 详情！');
      return;
    }
    setAiActivating('full');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          data: { title: formData.summary },
          prompt: `作为专业HR业务顾问，请根据目标：“${formData.summary}”自动拆解为SMART原则的五项具体内容。请用精炼的语言，直接输出合法的严格JSON格式，不要任何前导解释，也不要包裹在 markdown 代码块中。格式如下：{"s":"[具体明确的目标内容]","m":"[客观可衡量的量化指标]","a_smart":"[实现该目标的具体可行方案]","r_smart":"[与岗位及公司战略的相关性]","t":"[明确的完成时限节点]"}`
        })
      });
      const json = await res.json();
      if (json.code === 0) {
        let text = json.data.analysis || json.data.result || json.data;
        
        // Attempt to extract purely the JSON object in case model wrapped it in chat
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          text = jsonMatch[0];
        } else {
          text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        }

        try {
          const parsed = JSON.parse(text);
          setFormData(prev => ({
            ...prev,
            s: parsed.s || parsed.S || prev.s,
            m: parsed.m || parsed.M || prev.m,
            a_smart: parsed.a_smart || parsed.A || parsed.a || prev.a_smart,
            r_smart: parsed.r_smart || parsed.R || parsed.r || prev.r_smart,
            t: parsed.t || parsed.T || prev.t
          }));
          setActiveSection('s');
        } catch (e) {
          console.error('JSON parse fail', e, text);
          alert('AI 生成格式不符合规范，请重新尝试');
        }
      } else {
        alert(json.message);
      }
    } catch {
      alert('AI 服务请求失败');
    }
    setAiActivating(null);
  };

  const handleSubmit = () => {
    if (type === 'pool_propose') {
      // 提案只需要议题和任务属性
      if (!formData.summary?.trim()) {
        alert('请填写提案议题！');
        return;
      }
      if (!headerSelections.taskType) {
        alert('请选择任务属性！');
        return;
      }
    } else if (type === 'personal' || type === 'team' || type === 'pool_publish') {
      const required = [
        { key: 'summary', label: '目标简述' },
        { key: 's', label: '明确目标 (S)' },
        { key: 'm', label: '量化指标 (M)' },
        { key: 'a_smart', label: '可行方案 (A)' },
        { key: 'r_smart', label: '岗位相关性 (R)' },
        { key: 't', label: '时限要求 (T)' }
      ];
      
      const missing = required.filter(r => !(formData as any)[r.key]?.trim());
      if (missing.length > 0) {
        alert(`请填写完整以下必填项才能提交：\n${missing.map(m => m.label).join('、')}`);
        return;
      }
      if (!headerSelections.r || !headerSelections.a || !headerSelections.c || !headerSelections.e || !headerSelections.taskType) {
        alert(`请在顶部完整选择配置：负责人、执行人、咨询人、验收人以及任务属性！`);
        return;
      }
    }

    onSubmit({
      ...headerSelections,
      ...formData
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 drop-shadow-2xl">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className={`bg-slate-50 rounded-2xl shadow-2xl w-full ${approverMode ? 'max-w-5xl' : 'max-w-4xl'} max-h-[90vh] flex flex-col relative z-10 overflow-hidden ring-1 ring-slate-900/5 transition-all duration-300`}>
        {/* Header */}
        <div className="px-6 py-4 bg-[#005ea4] text-white flex items-center justify-between shrink-0 shadow-md z-20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center backdrop-blur-sm border border-white/20">
              <span className="material-symbols-outlined text-[20px]">{approverMode ? 'rate_review' : 'task_alt'}</span>
            </div>
            <div>
              <h2 className="text-lg font-black tracking-wide flex items-center gap-2">
                {title || 'SMART 目标卡内容'}
                {initialData?.id && (
                  <span className="text-xs font-mono bg-white/20 px-2 py-0.5 rounded uppercase tracking-wider ml-2 border border-white/30 shadow-sm">
                    {codePrefix}-{String(initialData.id).padStart(6, '0')}
                  </span>
                )}
              </h2>
              <p className="text-[10px] text-blue-100/70 font-medium mt-0.5">使用完整的 SMART 原则与 PDCA 循环构建闭环计划</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/80 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Output layout wrap */}
        <div className="flex flex-1 overflow-hidden">
          
          <div className="flex-1 flex flex-col overflow-hidden relative border-r border-slate-200">
            {/* Split layout Content area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col items-stretch">
            
            {/* Dropdowns Row */}
            <div className="bg-[#005ea4] p-4 sm:px-6 text-white shrink-0">
              <div className="flex flex-wrap items-center gap-3">
                {type !== 'pool_propose' && (
                  <>
                <SearchableUserDropdown 
                  label="R" 
                  value={headerSelections.r} 
                  onChange={v => setHeaderSelections({...headerSelections, r: v})} 
                  users={users} 
                  placeholder="选择负责人"
                  readonly={readonly}
                />
                <MultiSelectUserDropdown 
                  label="A" 
                  value={headerSelections.a} 
                  onChange={v => setHeaderSelections({...headerSelections, a: v})} 
                  users={users} 
                  placeholder="选择执行人"
                  readonly={readonly}
                />
                <MultiSelectUserDropdown 
                  label="C" 
                  value={headerSelections.c} 
                  onChange={v => setHeaderSelections({...headerSelections, c: v})} 
                  users={users} 
                  placeholder="选择咨询人"
                  readonly={readonly}
                />
                <MultiSelectUserDropdown 
                  label="验收人" 
                  value={headerSelections.e} 
                  onChange={v => setHeaderSelections({...headerSelections, e: v})} 
                  users={users} 
                  placeholder="选择验收人"
                  readonly={readonly}
                />
                  </>
                )}

                {/* 奖励机制 (奖金/积分) Dropdown & Input */}
                {(type === 'pool_propose' || type === 'pool_publish' || type === 'team') && (
                  <div className="flex items-center bg-white/10 rounded-md px-3 py-1.5 border border-white/20 transition-colors">
                    <div className="relative flex items-center mr-2">
                      {(readonly && !approverMode) ? (
                        <span className="bg-transparent text-sm font-bold text-white/90 pr-2">
                          {headerSelections.rewardType === 'money' ? '专项奖金' : '绩效分数'}
                        </span>
                      ) : (
                        <>
                          <select
                            value={headerSelections.rewardType}
                            onChange={e => setHeaderSelections({...headerSelections, rewardType: e.target.value as 'money' | 'score'})}
                            className="bg-transparent text-sm font-bold text-white/90 outline-none cursor-pointer appearance-none pr-5 focus:text-white"
                          >
                            <option value="money" className="text-gray-900">专项奖金</option>
                            <option value="score" className="text-gray-900">绩效分数</option>
                          </select>
                          <ChevronDown size={14} className="text-white/70 absolute right-0 pointer-events-none" />
                        </>
                      )}
                    </div>
                    <div className="relative flex items-center">
                      <span className="text-white text-sm mr-1">{headerSelections.rewardType === 'money' ? '¥' : ''}</span>
                      {(readonly && !approverMode) ? (
                        <span className="bg-transparent text-sm text-white font-medium">{headerSelections.bonus || '0'}</span>
                      ) : (
                        <input 
                          type="number"
                          value={headerSelections.bonus}
                          onChange={e => setHeaderSelections({...headerSelections, bonus: e.target.value})}
                          className="bg-transparent text-sm text-center text-white outline-none w-16 border-b border-transparent focus:border-white/30 font-medium placeholder:text-white/50 transition-colors"
                          placeholder="0"
                        />
                      )}
                      {headerSelections.rewardType === 'score' && <span className="text-white text-sm ml-1">分</span>}
                    </div>
                  </div>
                )}

                {/* 参与人数上限 */}
                {(type === 'pool_propose' || type === 'pool_publish') && (
                  <div className="flex items-center bg-white/10 rounded-md px-3 py-1.5 border border-white/20 transition-colors">
                    <span className="text-[11px] font-black text-white/70 mr-2 tracking-wider uppercase">上限</span>
                    {(readonly && !approverMode) ? (
                      <span className="text-sm text-white font-medium">{headerSelections.maxParticipants || '5'}人</span>
                    ) : (
                      <div className="flex items-center">
                        <input 
                          type="number"
                          value={headerSelections.maxParticipants}
                          onChange={e => setHeaderSelections({...headerSelections, maxParticipants: e.target.value})}
                          className="bg-transparent text-sm text-center text-white outline-none w-10 border-b border-transparent focus:border-white/30 font-medium placeholder:text-white/50 transition-colors"
                          placeholder="5"
                          min="1"
                          max="50"
                        />
                        <span className="text-white text-sm ml-0.5">人</span>
                      </div>
                    )}
                  </div>
                )}

                {/* 任务属性 Dropdown (custom styled) */}
                <TaskTypeDropdown
                  value={headerSelections.taskType}
                  onChange={v => setHeaderSelections({...headerSelections, taskType: v})}
                  readonly={readonly}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-[#f8f9fb]">
              <div className={`w-full ${approverMode ? 'max-w-5xl' : 'max-w-4xl'} mx-auto space-y-3`}>
                
                {/* 目标简述 */}
                <div className={`mb-4 ${readonly ? '' : 'relative'}`}>
                  {readonly ? (
                    <div className="w-full px-4 py-3 text-base font-bold text-gray-900 bg-white border border-gray-200 rounded-lg shadow-sm">
                      {formData.summary}
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={formData.summary + (isRecording ? tempVoice : '')}
                        onChange={(e) => {
                          if (!isRecording) handleUpdate('summary', e.target.value);
                        }}
                        placeholder={type === 'pool_propose' ? '输入提案议题，例如：搭建全渠道客户反馈系统' : '完成人事务管理系统（HRM）性能优化与看板重构'}
                        className="w-full pl-4 pr-44 py-3 text-base font-bold text-gray-900 bg-white border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-[#1677ff] focus:border-[#1677ff] transition-all placeholder:font-normal placeholder:text-gray-400"
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <button
                          onClick={isRecording ? stopRecording : startRecording}
                          className={`flex items-center justify-center p-1.5 rounded-full transition-all ${
                            isRecording 
                              ? 'bg-red-100 text-red-600 hover:bg-red-200 animate-pulse' 
                              : 'bg-slate-100 text-slate-500 hover:bg-blue-100 hover:text-blue-600'
                          }`}
                          title={isRecording ? '点击停止录音' : '点击开始语音输入'}
                        >
                          <span className="material-symbols-outlined text-[20px]">mic</span>
                        </button>
                        <button 
                          onClick={handleAIAssist}
                          disabled={aiActivating === 'full' || isRecording}
                          className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 text-xs font-bold rounded shadow-sm transition-all disabled:opacity-50"
                        >
                          {aiActivating === 'full' ? <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span> : <span className="material-symbols-outlined text-[16px]">auto_awesome</span>}
                          AI 智能拆解
                        </button>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-3.5 bg-[#1677ff] rounded-full" />
                  <h3 className="font-bold text-gray-900 text-sm">SMART 详情说明</h3>
                  {type === 'pool_propose' && (
                    <span className="text-[11px] text-slate-400 font-normal ml-1">（不是必填，但尽可能给更多信息）</span>
                  )}
                </div>

                {/* SMART Sections */}
                <div className="space-y-2.5">
                  {sections.map((section) => {
                    const isActive = activeSection === section.id;
                    const value = formData[section.id as keyof typeof formData] as string;
                    
                    return (
                      <div key={section.id} className="flex gap-4 items-stretch w-full">
                        <motion.div 
                          layout
                          transition={{ duration: 0.2 }}
                          onClick={() => !isActive && setActiveSection(section.id as SectionId)}
                          className={`
                            flex-1 border rounded-lg overflow-hidden transition-colors duration-200
                            ${isActive ? `bg-white shadow-sm ring-1 ${section.border}` : 'bg-white border-gray-200 hover:border-gray-300 cursor-pointer'}
                          `}
                        >
                        <motion.div layout transition={{ duration: 0.2 }} className={`p-3 sm:px-4 sm:py-3 flex items-start gap-4`}>
                          <div className={`shrink-0 w-8 h-8 rounded mt-0.5 flex items-center justify-center font-bold ${section.color} ${section.bg}`}>
                            {section.letter}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-gray-900 text-sm">{section.title}</h4>
                                {isActive && (
                                  <span className={`text-[10px] font-bold tracking-wider uppercase ${section.color}`}>
                                    {section.subtitle}
                                  </span>
                                )}
                              </div>
                              {isActive && (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setActiveSection(null); }}
                                  className="text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-1 text-xs"
                                >
                                  <Check size={14} />
                                  <span>收起</span>
                                </button>
                              )}
                            </div>
                            
                            {!isActive && (
                              <div className="text-xs text-gray-500 truncate mt-1">
                                {value ? (
                                  <span>{value.replace(/<[^>]+>/g, '').substring(0, 100)}</span>
                                ) : (
                                  <span className="text-gray-400 italic">点击编辑详细内容...</span>
                                )}
                              </div>
                            )}
                          </div>
                        </motion.div>

                        <AnimatePresence>
                          {isActive && (
                            <motion.div 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                              className="px-4 pb-4"
                            >
                              <div data-color-mode="light" className="mt-1">
                                <MDEditor
                                  value={value}
                                  onChange={readonly ? undefined : (val) => handleUpdate(section.id as keyof typeof formData, val || '')}
                                  height={180}
                                  preview={readonly ? "preview" : "edit"}
                                  hideToolbar={readonly}
                                  textareaProps={{
                                    placeholder: section.placeholder
                                  }}
                                  className="border-none shadow-none !bg-transparent"
                                />
                              </div>

                              {section.id === 't' && (
                                <div className="mt-4 pt-4 border-t border-gray-100">
                                  <h5 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-[16px]">calendar_month</span>
                                    PDCA 时间节点规划
                                  </h5>
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {[
                                      { key: 'planTime', label: 'Plan (计划)', icon: 'edit_calendar', color: 'text-blue-600', bg: 'bg-blue-50' },
                                      { key: 'doTime', label: 'Do (执行)', icon: 'play_circle', color: 'text-orange-600', bg: 'bg-orange-50' },
                                      { key: 'checkTime', label: 'Check (检查)', icon: 'fact_check', color: 'text-emerald-600', bg: 'bg-emerald-50' },
                                      { key: 'actTime', label: 'Act (处理)', icon: 'published_with_changes', color: 'text-purple-600', bg: 'bg-purple-50' }
                                    ].map(item => (
                                      <div key={item.key} className="flex flex-col gap-1.5">
                                        <label className="text-xs font-bold text-gray-600 flex items-center gap-1">
                                          <div className={`p-1 rounded-md ${item.color} ${item.bg}`}>
                                            <span className="material-symbols-outlined text-[12px]">{item.icon}</span>
                                          </div>
                                          {item.label}
                                        </label>
                                        {readonly ? (
                                          <div className="text-sm text-gray-800 font-medium px-2 py-1.5 bg-gray-50 border border-gray-100 rounded-md">
                                            {(formData as any)[item.key] || '--'}
                                          </div>
                                        ) : (
                                          <input 
                                            type="date"
                                            value={(formData as any)[item.key]}
                                            onChange={e => handleUpdate(item.key as keyof typeof formData, e.target.value)}
                                            className="text-sm px-2.5 py-1.5 bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1677ff] focus:border-[#1677ff] transition-all"
                                          />
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                            </motion.div>
                          )}
                        </AnimatePresence>
                        
                        {/* Inline Reject Comment for Employee View (Not Approver Mode) */}
                        {!approverMode && comments[section.id] && (
                          <div className="mx-5 mb-5 mt-2 bg-rose-50/50 border border-rose-200 rounded-lg overflow-hidden flex flex-col">
                            <div className="bg-rose-100/50 px-3 py-1.5 border-b border-rose-200 flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-[14px] text-rose-600">error</span>
                              <span className="text-xs font-bold text-rose-700">审批驳回意见</span>
                            </div>
                            <div className="p-3 text-sm text-gray-800 break-words whitespace-pre-wrap">
                              {comments[section.id]}
                            </div>
                          </div>
                        )}
                        </motion.div>
                        
                        {/* Inline Approver Comment Section (Only for Approver) */}
                        {approverMode && (
                          <div className="w-[320px] shrink-0 bg-[#fffdf8] border border-amber-200 rounded-lg flex flex-col overflow-hidden shadow-sm">
                            <div className="bg-amber-100/50 px-3 py-2 border-b border-amber-200 flex items-center justify-between gap-1.5">
                              <div className="flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-[14px] text-amber-700">chat</span>
                                <span className="text-xs font-bold text-amber-800">审批批注</span>
                              </div>
                            </div>
                            <textarea
                              className="flex-1 w-full bg-transparent resize-none outline-none text-sm text-gray-700 placeholder:text-amber-700/40 p-3 min-h-[80px]"
                              placeholder="添加批注意见..."
                              value={comments[section.id] || ''}
                              onChange={e => setComments({...comments, [section.id]: e.target.value})}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2 mt-6 mb-3">
                  <div className="w-1 h-4 bg-gray-700 rounded-full" />
                  <h3 className="font-bold text-gray-900 text-base">附件与支持材料</h3>
                </div>

                {/* Attachments Section */}
                <motion.div 
                  layout
                  transition={{ duration: 0.2 }}
                  onClick={() => !activeSection || activeSection !== 'attachments' ? setActiveSection('attachments') : null}
                  className={`
                    border rounded-lg overflow-hidden transition-colors duration-200
                    ${activeSection === 'attachments' ? 'bg-white shadow-sm ring-1 ring-black/5 border-gray-300' : 'bg-white border-gray-200 hover:border-gray-300 cursor-pointer'}
                  `}
                >
                  <motion.div layout transition={{ duration: 0.2 }} className={`p-3 sm:px-4 sm:py-3 flex items-center gap-3 ${activeSection === 'attachments' ? 'bg-gray-50' : ''}`}>
                    <div className={`shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-gray-600 ${activeSection === 'attachments' ? 'bg-white' : 'bg-gray-100'}`}>
                      <Paperclip size={16} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-gray-900 text-sm">相关附件</h4>
                        {activeSection === 'attachments' && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setActiveSection(null); }}
                            className="p-1 hover:bg-black/5 rounded text-gray-600 transition-colors flex items-center gap-1 text-xs font-medium"
                          >
                            <Check size={14} />
                            <span>完成</span>
                          </button>
                        )}
                      </div>
                      
                      {!activeSection || activeSection !== 'attachments' ? (
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {formData.attachments.length > 0 
                            ? `已附 ${formData.attachments.length} 个材料` 
                            : <span className="text-gray-400 italic">点击展开上传支持材料...</span>}
                        </p>
                      ) : null}
                    </div>
                  </motion.div>

                  <AnimatePresence>
                    {activeSection === 'attachments' && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="px-4 pb-4"
                      >
                        {!readonly && (
                          <div className="border border-dashed border-gray-300 rounded-lg p-5 flex flex-col items-center justify-center text-center bg-[#f8f9fb] hover:bg-gray-50 transition-colors cursor-pointer group">
                            <div className="w-10 h-10 bg-blue-50 text-[#005ea4] rounded-full flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                              <Upload size={18} />
                            </div>
                            <p className="text-sm font-bold text-gray-900 mb-0.5">点击或拖拽文件到此处</p>
                            <p className="text-xs text-gray-500">支持 PDF, DOCX, XLSX 等，单文件最大 50MB</p>
                          </div>
                        )}

                        {formData.attachments.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {formData.attachments.map((file, idx) => (
                              <div key={idx} className="flex items-center justify-between p-2.5 bg-white border border-gray-200 rounded-md shadow-sm">
                                <div className="flex items-center gap-2.5">
                                  <div className="p-1.5 bg-gray-100 rounded text-gray-600">
                                    <Paperclip size={14} />
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold text-gray-900">{file.name}</p>
                                    <p className="text-[10px] text-gray-500">{file.size}</p>
                                  </div>
                                </div>
                                {!readonly && (
                                  <button 
                                    onClick={() => {
                                      const newAttachments = [...formData.attachments];
                                      newAttachments.splice(idx, 1);
                                      handleUpdate('attachments', newAttachments);
                                    }}
                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {!readonly && (
                          <div className="mt-4 flex justify-center">
                            <button 
                              onClick={() => {
                                handleUpdate('attachments', [
                                  ...formData.attachments, 
                                  { name: `支持附件_${formData.attachments.length + 1}.pdf`, size: '1.2 MB' }
                                ]);
                              }}
                              className="text-xs text-[#005ea4] hover:text-[#0077ce] font-bold flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-full transition-colors"
                            >
                              <Plus size={14} /> 模拟上传文件
                            </button>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </div>
            </div>
            
            {/* Detail Logs Approval Path */}
            {initialData?.id && (
              <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 shrink-0 mx-4 mb-4 rounded-xl border">
                <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-3">
                  <span className="material-symbols-outlined text-[14px]">route</span>
                  审批路径节点
                  <span className="text-[10px] font-mono text-slate-400 ml-1">
                    {codePrefix}-{String(initialData.id).padStart(6, '0')}
                  </span>
                </h4>
                <div className="flex flex-wrap items-center gap-2 text-[12px]">
                  {(() => {
                    const allLogs = initialData?.logs || fetchedLogs;
                    // Filter out progress updates from approval path - only show status changes
                    const statusLogs = allLogs.filter((log: any) => log.action !== 'progress_update');
                    // Get latest progress for summary
                    const progressLogs = allLogs.filter((log: any) => log.action === 'progress_update');
                    const latestProgress = progressLogs.length > 0 ? progressLogs[progressLogs.length - 1] : null;

                    return statusLogs.length > 0 ? (
                    <>
                    {statusLogs.map((log: any, i: number, arr: any[]) => {
                      const isReject = log.new_value === 'rejected' || log.action === 'reject';
                      const isApprove = log.new_value === 'approved' || log.action === 'approve';
                      const isWithdraw = log.action === 'withdraw';
                      return (
                        <React.Fragment key={i}>
                          <div className={`flex flex-col rounded-lg px-3 py-1.5 border ${
                            isReject ? 'bg-red-50 border-red-100 text-red-700' : 
                            isApprove ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
                            isWithdraw ? 'bg-amber-50 border-amber-100 text-amber-700' :
                            'bg-white border-slate-200 text-slate-700 shadow-sm'
                          }`}>
                            <span className="font-bold">{log.user_name || log.user_id}</span>
                            <span className="text-[10px] opacity-70">
                              {log.action === 'submit' ? '发起申请' : 
                               log.action === 'resubmit' ? '重新提交' :
                               isWithdraw ? '已撤回' :
                               isReject ? '已驳回' : 
                               isApprove ? '已通过' : log.action || '审阅中'}
                            </span>
                          </div>
                          {i < arr.length - 1 && (
                            <span className="material-symbols-outlined text-[16px] text-slate-300">arrow_right_alt</span>
                          )}
                        </React.Fragment>
                      );
                    })}
                    {/* Show latest progress as a single summary node */}
                    {latestProgress && (
                      <>
                        <span className="material-symbols-outlined text-[16px] text-slate-300">arrow_right_alt</span>
                        <div className="flex flex-col rounded-lg px-3 py-1.5 border bg-blue-50 border-blue-100 text-blue-700">
                          <span className="font-bold">{latestProgress.user_name || latestProgress.user_id}</span>
                          <span className="text-[10px] opacity-70">进度{latestProgress.new_value}% ({progressLogs.length}次更新)</span>
                        </div>
                      </>
                    )}
                    {initialData?.status && !['approved', 'rejected', 'completed', 'assessed'].includes(initialData.status) && (
                      <>
                        <span className="material-symbols-outlined text-[16px] text-slate-300">arrow_right_alt</span>
                        <div className="flex flex-col rounded-lg px-3 py-1.5 border border-dashed border-amber-300 bg-amber-50 text-amber-600">
                          <span className="font-bold">{initialData.approver_name || '审批人'}</span>
                          <span className="text-[10px] opacity-80">
                            {initialData.status === 'pending_review' ? '待审核' : 
                             initialData.status === 'in_progress' ? '进行中' :
                             initialData.status === 'draft' ? '待提交' : '待处理'}
                          </span>
                        </div>
                      </>
                    )}
                    </>
                  ) : (
                    <div className="flex flex-col rounded-lg px-3 py-1.5 border bg-slate-100 border-slate-200 text-slate-500">
                      <span className="font-bold">{initialData.status === 'draft' ? '草稿' : '已创建'}</span>
                      <span className="text-[10px] opacity-70">等待提交</span>
                    </div>
                  );
                  })()}
                </div>
              </div>
            )}

        {/* Original Footer */}
        {!approverMode && (
          <div className="p-4 sm:px-5 sm:py-3 bg-white border-t border-gray-200 flex items-center justify-end gap-2.5 shrink-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            {customFooter ? customFooter : readonly ? (
              <button onClick={onClose} className="px-6 py-2 text-sm font-bold text-white bg-[#005ea4] hover:bg-[#0077ce] rounded-xl transition-colors shadow-sm focus:outline-none">
                关闭
              </button>
            ) : (
              <>
                <button onClick={onClose} disabled={submitting} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50">
                  取消
                </button>
                <button onClick={() => { onDraft?.({...headerSelections, ...formData}); }} disabled={submitting} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-xl transition-colors shadow-sm disabled:opacity-50">
                  存为草稿
                </button>
                <button 
                  onClick={handleSubmit} 
                  disabled={submitting}
                  className="px-6 py-2 text-sm font-bold text-white bg-[#005ea4] hover:bg-[#0077ce] rounded-xl transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <span className="material-symbols-outlined text-[16px]">send</span>}
                  <span>提交申请</span>
                </button>
              </>
            )}
          </div>
        )}
          </div>

          {/* Inline Approver Footer */}
          {approverMode && (
            <div className="p-4 sm:px-6 sm:py-4 bg-white border-t border-gray-200 flex items-center justify-end gap-3 shrink-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
              <button
                onClick={() => onReject?.('驳回(终止流程)')}
                disabled={submitting}
                className="px-5 py-2 text-sm font-bold text-rose-500 hover:text-rose-600 transition-colors disabled:opacity-50"
              >
                驳回
              </button>
              <button
                onClick={() => {
                  const aggregated = sections.map(s => comments[s.id] ? `[${s.letter} ${s.title}]: ${comments[s.id]}` : '').filter(Boolean).join('\n\n');
                  onReject?.(aggregated || '退回修改');
                }}
                disabled={submitting}
                className="px-6 py-2 text-sm font-bold text-amber-600 bg-white border border-amber-300 hover:bg-amber-50 rounded-lg transition-colors shadow-sm disabled:opacity-50"
              >
                退回修改
              </button>
              <button
                onClick={() => {
                  const aggregated = sections.map(s => comments[s.id] ? `[${s.letter} ${s.title}]: ${comments[s.id]}` : '').filter(Boolean).join('\n\n');
                  onApprove?.(aggregated || '同意', { bonus: headerSelections.bonus, rewardType: headerSelections.rewardType, maxParticipants: headerSelections.maxParticipants });
                }}
                disabled={submitting}
                className="px-8 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
              >
                同意
              </button>
            </div>
          )}

        </div>
      </div>
      </div>
    </div>
  );
}
