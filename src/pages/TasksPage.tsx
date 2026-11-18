import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckSquare, Plus, Search, Sparkles, AlertCircle } from 'lucide-react';
import { useCalendarStore } from '@/store/calendarStore';
import { useAppStore } from '@/store/appStore';
import { TaskCard } from '@/components/calendar/TaskCard';
import { TaskModal } from '@/components/calendar/TaskModal';
import { getTodayISO, dateToJalali, formatJalali, toFaDigits } from '@/utils/jalaliDate';
import { getVisibleTasksForDate } from '@/services/calendar/schedulingEngine';
import type { Priority, Task } from '@/types/calendar';

type TabKey = 'today' | 'upcoming' | 'overdue' | 'completed';
type PriorityFilter = 'all' | Priority;

export function TasksPage() {
  const tasks = useCalendarStore((s) => s.tasks);
  const addTask = useCalendarStore((s) => s.addTask);
  const updateTask = useCalendarStore((s) => s.updateTask);
  const toggleTask = useCalendarStore((s) => s.toggleTask);
  const deleteTask = useCalendarStore((s) => s.deleteTask);
  const skipTask = useCalendarStore((s) => s.skipTask);
  const launchAiPrompt = useAppStore((s) => s.launchAiPrompt);

  const [activeTab, setActiveTab] = useState<TabKey>('today');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const todayISO = getTodayISO();

  const todayCount = useMemo(
    () => getVisibleTasksForDate(tasks, todayISO).filter((t) => t.status === 'pending').length,
    [tasks, todayISO],
  );
  const upcomingCount = useMemo(
    () => tasks.filter((t) => t.dueDate > todayISO && t.status === 'pending').length,
    [tasks, todayISO],
  );
  const overdueCount = useMemo(
    () => tasks.filter((t) => t.dueDate < todayISO && t.status === 'pending').length,
    [tasks, todayISO],
  );
  const completedCount = useMemo(
    () => tasks.filter((t) => t.status === 'completed').length,
    [tasks],
  );

  const filteredTasks = useMemo(() => {
    let list: Task[] = [];
    if (activeTab === 'today') {
      list = getVisibleTasksForDate(tasks, todayISO).filter((t) => t.status === 'pending');
    } else if (activeTab === 'upcoming') {
      list = tasks
        .filter((t) => t.dueDate > todayISO && t.status === 'pending')
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    } else if (activeTab === 'overdue') {
      list = tasks
        .filter((t) => t.dueDate < todayISO && t.status === 'pending')
        .sort((a, b) => b.dueDate.localeCompare(a.dueDate));
    } else {
      list = tasks.filter((t) => t.status === 'completed');
    }

    if (priorityFilter !== 'all') {
      list = list.filter((t) => t.priority === priorityFilter);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description && t.description.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [tasks, activeTab, todayISO, priorityFilter, searchQuery]);

  const tabs: { key: TabKey; label: string; count: number; alert?: boolean }[] = [
    { key: 'today', label: 'امروز', count: todayCount },
    { key: 'upcoming', label: 'آینده', count: upcomingCount },
    ...(overdueCount > 0 ? [{ key: 'overdue' as const, label: 'عقب‌افتاده', count: overdueCount, alert: true }] : []),
    { key: 'completed', label: 'انجام‌شده', count: completedCount },
  ];

  const priorities: { key: PriorityFilter; label: string }[] = [
    { key: 'all', label: 'همه' },
    { key: 'high', label: 'مهم' },
    { key: 'medium', label: 'متوسط' },
    { key: 'low', label: 'کم' },
  ];

  const getTaskDateLabel = (task: Task): string => {
    if (task.dueDate === todayISO) return 'امروز';
    return formatJalali(dateToJalali(new Date(task.dueDate + 'T00:00:00')), 'long');
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">مدیریت کارها</h2>
          <p className="text-xs text-slate-500 mt-0.5">پیگیری، اولویت‌بندی و زمان‌بندی وظایف</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => launchAiPrompt('کارهای من رو بر اساس اهمیت و زمان خالی اولویت‌بندی کن')}
            className="flex items-center gap-1.5 rounded-xl border border-primary-200 bg-primary-50 px-3.5 py-2.5 text-xs font-semibold text-primary-700 hover:bg-primary-100 transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" />
            اولویت‌بندی با AI
          </button>
          <button
            onClick={() => { setEditingTask(null); setModalOpen(true); }}
            className="flex items-center gap-1.5 rounded-xl bg-primary-700 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-primary-700/25 transition-colors hover:bg-primary-800"
            aria-label="افزودن کار"
          >
            <Plus className="h-4 w-4" />
            کار جدید
          </button>
        </div>
      </div>

      {/* Tabs + Search + Priority Filter */}
      <div className="card-premium rounded-3xl p-4 space-y-3">
        <div className="flex gap-1 rounded-2xl bg-surface-2 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                activeTab === tab.key
                  ? 'bg-white text-primary-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.alert && <AlertCircle className="h-3.5 w-3.5 text-red-500" />}
              {tab.label}
              {tab.count > 0 && (
                <span
                  className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1.5 text-[10px] ${
                    activeTab === tab.key
                      ? tab.alert
                        ? 'bg-red-600 text-white'
                        : 'bg-primary-700 text-white'
                      : tab.alert
                        ? 'bg-red-100 text-red-600'
                        : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {toFaDigits(tab.count)}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجو در کارها..."
              className="w-full rounded-xl border border-slate-200 bg-surface/60 py-2 pr-10 pl-3 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus-ring"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {priorities.map((p) => (
              <button
                key={p.key}
                onClick={() => setPriorityFilter(p.key)}
                className={`shrink-0 rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
                  priorityFilter === p.key
                    ? 'bg-slate-900 text-white'
                    : 'bg-surface-2 text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* List */}
      <motion.div
        key={`${activeTab}-${priorityFilter}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2.5"
      >
        {filteredTasks.length === 0 ? (
          <div className="card-base rounded-3xl p-10 text-center">
            <CheckSquare className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">
              {searchQuery || priorityFilter !== 'all'
                ? 'کاری با این فیلتر پیدا نشد'
                : activeTab === 'today'
                  ? 'کاری برای امروز ثبت نشده'
                  : activeTab === 'upcoming'
                    ? 'کاری برای آینده ثبت نشده'
                    : activeTab === 'overdue'
                      ? 'کار عقب‌افتاده‌ای نداری!'
                      : 'هنوز کاری انجام نشده'}
            </p>
            <p className="mt-1 text-xs text-slate-400">با دکمه «کار جدید» یا از طریق دستیار هوشمند کار اضافه کن</p>
          </div>
        ) : (
          filteredTasks.map((task, i) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.25) }}
            >
              {(activeTab === 'upcoming' || activeTab === 'overdue') && (
                <p className="mb-1 mt-2 text-right text-[11px] font-medium text-slate-400 px-1">
                  {getTaskDateLabel(task)}
                </p>
              )}
              <TaskCard
                task={task}
                onToggle={(t) => toggleTask(t.id)}
                onDelete={deleteTask}
                onSkip={skipTask}
                onEdit={(t) => { setEditingTask(t); setModalOpen(true); }}
              />
            </motion.div>
          ))
        )}
      </motion.div>

      <TaskModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingTask(null); }}
        onSave={(t) => {
          if (editingTask) updateTask(editingTask.id, t);
          else addTask(t);
        }}
        task={editingTask}
        defaultDate={todayISO}
      />
    </div>
  );
}
