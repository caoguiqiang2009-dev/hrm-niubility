import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';

interface Task {
  id: number;
  title: string;
  description: string;
  due_date: string;
  priority: string;
  status: string;
}

export default function EmployeeDashboard({ navigate }: { navigate: (view: string) => void }) {
  const { currentUser } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', due_date: '', priority: 'normal' });

  // Fetch tasks
  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/tasks', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      }
    } catch (err) {
      console.error('Failed to fetch tasks', err);
    }
  };

  const handleToggleTaskStatus = async (task: Task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    // Optimistic update
    setTasks(tasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t));

    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}` 
        },
        body: JSON.stringify({ status: newStatus })
      });
      fetchTasks(); // Refresh to get sort order correct
    } catch (err) {
      console.error('Failed to update task', err);
      fetchTasks(); // Revert on failure
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}` 
        },
        body: JSON.stringify(newTask)
      });
      if (res.ok) {
        fetchTasks();
        setIsTaskModalOpen(false);
        setNewTask({ title: '', description: '', due_date: '', priority: 'normal' });
      }
    } catch (err) {
      console.error('Failed to create task', err);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-on-surface antialiased">
      <Sidebar currentView="dashboard" navigate={navigate} />

      {/* Main Canvas */}
      <main className="flex-1 h-[calc(100vh-4rem)] mt-16 overflow-y-auto relative">
        <div className="p-8 space-y-8">
          {/* Welcome Header & Quick Actions */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h2 className="text-4xl font-extrabold text-on-surface tracking-tight mb-2">欢迎回来, {currentUser?.name || '未知员工'}</h2>
              <p className="text-on-surface-variant max-w-lg">今天是 2024年5月22日 星期三。您本周已完成 85% 的既定任务，继续保持！</p>
            </div>
            <div className="flex items-center space-x-3">
              <button onClick={() => alert("功能开发中")} className="flex items-center px-6 py-3 bg-surface-container-highest text-on-primary-container font-bold rounded-xl hover:bg-surface-dim transition-colors active:scale-95">
                <span className="material-symbols-outlined mr-2 text-[20px]">payments</span>
                查看薪资单
              </button>
              <button onClick={() => alert("功能开发中")} className="flex items-center px-6 py-3 bg-gradient-to-br from-[#0060a9] to-[#409eff] text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl transition-all active:scale-95">
                <span className="material-symbols-outlined mr-2 text-[20px]">event_available</span>
                申请休假
              </button>
            </div>
          </div>

          {/* Dashboard Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Column 1: Performance & Goals */}
            <div className="lg:col-span-4 space-y-8">
              {/* Performance Metrics */}
              <section className="bg-surface-container-low rounded-xl p-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-[100px]">military_tech</span>
                </div>
                <h3 className="label-font text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-6 flex items-center">
                  <span className="material-symbols-outlined mr-2 text-sm">insights</span>
                  绩效指标
                </h3>
                <div className="flex items-baseline space-x-1 mb-2">
                  <span className="text-5xl font-black text-primary">4.8</span>
                  <span className="text-xl text-on-surface-variant">/ 5.0</span>
                </div>
                <div className="inline-flex items-center px-3 py-1 bg-secondary-container text-on-secondary-container rounded-full text-xs font-bold mb-6">
                  <span className="material-symbols-outlined text-[14px] mr-1">trending_up</span>
                  本季度表现优异
                </div>
                <div className="bg-surface-container-lowest p-4 rounded-lg">
                  <p className="text-sm text-on-surface leading-relaxed">
                    "张伟在项目交付和跨部门协作方面展现了卓越的能力。建议继续关注新入职成员的导师计划。"
                  </p>
                  <p className="text-[11px] text-outline mt-3 flex items-center">
                    <span className="material-symbols-outlined text-[12px] mr-1">person</span>
                    反馈人: 李芳 (部门总监)
                  </p>
                </div>
              </section>

              {/* Personal Goals Management */}
              <section className="bg-surface-container-low rounded-xl p-6">
                <h3 className="label-font text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-6 flex items-center justify-between">
                  <span className="flex items-center">
                    <span className="material-symbols-outlined mr-2 text-sm">track_changes</span>
                    个人目标管理
                  </span>
                  <span className="text-primary cursor-pointer hover:underline text-[11px] normal-case tracking-normal">管理所有</span>
                </h3>
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-bold">Q2 项目上线率</span>
                      <span className="text-primary font-bold">92%</span>
                    </div>
                    <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                      <div className="h-full bg-primary-container" style={{ width: '92%' }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-bold">团队技能内训</span>
                      <span className="text-primary font-bold">60%</span>
                    </div>
                    <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                      <div className="h-full bg-primary-container" style={{ width: '60%' }}></div>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* Column 2: Pending Tasks */}
            <div className="lg:col-span-4 space-y-8">
              <section className="bg-surface-container-low rounded-xl p-6 flex flex-col h-full">
                <h3 className="label-font text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-6 flex items-center">
                  <span className="material-symbols-outlined mr-2 text-sm">checklist</span>
                  待办事项
                </h3>
                <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar max-h-[500px]">
                  {tasks.length === 0 ? (
                    <div className="text-center py-8 text-on-surface-variant">暂无待办任务，真棒！</div>
                  ) : (
                    tasks.map(task => {
                      const isCompleted = task.status === 'completed';
                      return (
                        <div key={task.id} className={`group bg-surface-container-lowest p-4 rounded-xl flex items-start space-x-4 border-l-4 transition-all duration-300 ${isCompleted ? 'border-green-500 opacity-60' : task.priority === 'high' ? 'border-error shadow-sm' : 'border-primary'}`}>
                          <input 
                            className="mt-1 rounded border-outline-variant text-primary focus:ring-primary h-5 w-5 cursor-pointer peer transition-transform active:scale-90" 
                            type="checkbox" 
                            checked={isCompleted}
                            onChange={() => handleToggleTaskStatus(task)}
                          />
                          <div className={`flex-1 transition-all ${isCompleted ? 'line-through text-outline' : ''}`}>
                            <div className="flex items-center justify-between">
                              <p className="font-bold text-sm tracking-tight">{task.title}</p>
                              {!isCompleted && task.priority === 'high' && (
                                <span className="text-[10px] px-2 py-0.5 bg-error-container text-on-error-container rounded-full font-bold">紧急</span>
                              )}
                            </div>
                            {task.description && <p className="text-[11px] text-on-surface-variant mt-1.5 leading-relaxed">{task.description}</p>}
                            {task.due_date && <p className="text-[10px] font-medium text-outline mt-2 flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">schedule</span> {task.due_date}</p>}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
                <button 
                  onClick={() => setIsTaskModalOpen(true)}
                  className="w-full mt-6 py-3 border border-dashed border-outline-variant rounded-xl text-sm font-bold text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors flex items-center justify-center gap-2 group active:scale-[0.98]">
                  <span className="material-symbols-outlined group-hover:scale-110 transition-transform">add_task</span>
                  添加新任务
                </button>
              </section>
            </div>

            {/* Column 3: Team Communications */}
            <div className="lg:col-span-4 space-y-8">
              <section className="bg-surface-container-low rounded-xl p-6 h-full">
                <h3 className="label-font text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-6 flex items-center">
                  <span className="material-symbols-outlined mr-2 text-sm">forum</span>
                  团队动态
                </h3>
                <div className="relative space-y-8 before:content-[''] before:absolute before:left-[17px] before:top-2 before:bottom-2 before:w-[2px] before:bg-outline-variant/30">
                  <div className="relative pl-10">
                    <div className="absolute left-0 top-1 w-9 h-9 bg-primary-container rounded-full border-4 border-surface-container-low flex items-center justify-center text-white z-10">
                      <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>campaign</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-primary mb-1">系统公告</p>
                      <p className="text-sm font-bold text-on-surface">公司年会活动报名已开始</p>
                      <p className="text-[10px] text-outline mt-2">10 分钟前</p>
                    </div>
                  </div>
                  <div className="relative pl-10">
                    <div className="absolute left-0 top-1 w-9 h-9 bg-tertiary-container rounded-full border-4 border-surface-container-low flex items-center justify-center text-white z-10">
                      <span className="material-symbols-outlined text-sm">update</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-tertiary mb-1">进度更新</p>
                      <p className="text-sm font-bold text-on-surface">Azure Horizon 3.0 开发里程碑已达成</p>
                      <p className="text-[10px] text-outline mt-2">昨天 16:45</p>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>

      {/* Task Creation Modal */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center animate-in fade-in duration-200">
          <div className="bg-surface-container-lowest w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-surface-container flex justify-between items-center bg-surface-container-low">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">add_task</span>
                新建待办事项
              </h3>
              <button onClick={() => setIsTaskModalOpen(false)} className="text-outline hover:text-on-surface transition-colors p-1 rounded-full hover:bg-surface-container">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <form onSubmit={handleCreateTask} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">任务标题 *</label>
                <input 
                  required 
                  autoFocus
                  type="text" 
                  value={newTask.title} 
                  onChange={e => setNewTask({...newTask, title: e.target.value})}
                  className="w-full bg-surface-container-low border border-outline-variant/50 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all placeholder:text-outline/50"
                  placeholder="例如：准备项目季度汇报PPT"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">截止日期</label>
                <input 
                  type="date" 
                  value={newTask.due_date} 
                  onChange={e => setNewTask({...newTask, due_date: e.target.value})}
                  className="w-full bg-surface-container-low border border-outline-variant/50 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all text-on-surface"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">细节描述</label>
                <textarea 
                  rows={3}
                  value={newTask.description} 
                  onChange={e => setNewTask({...newTask, description: e.target.value})}
                  className="w-full bg-surface-container-low border border-outline-variant/50 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all resize-none placeholder:text-outline/50"
                  placeholder="补充说明任务的具体要求或备注..."
                ></textarea>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer group">
                  <input 
                    type="radio" 
                    name="priority" 
                    value="normal" 
                    checked={newTask.priority === 'normal'} 
                    onChange={() => setNewTask({...newTask, priority: 'normal'})}
                    className="accent-primary w-4 h-4 cursor-pointer"
                  />
                  <span className="group-hover:text-primary transition-colors">普通优先级</span>
                </label>
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer group">
                  <input 
                    type="radio" 
                    name="priority" 
                    value="high" 
                    checked={newTask.priority === 'high'} 
                    onChange={() => setNewTask({...newTask, priority: 'high'})}
                    className="accent-error w-4 h-4 cursor-pointer"
                  />
                  <span className="text-error font-bold">紧急优先高</span>
                </label>
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-surface-container mt-6">
                <button type="button" onClick={() => setIsTaskModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-on-surface-variant hover:bg-surface-container rounded-xl transition-colors">取消</button>
                <button type="submit" className="px-6 py-2.5 text-sm font-bold text-white bg-primary hover:opacity-90 active:scale-95 shadow-md rounded-xl transition-all">创建任务</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
