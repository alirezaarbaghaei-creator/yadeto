import { Check, Clock, Trash2, SkipForward, Repeat, Pencil } from 'lucide-react';
import type { Task } from '@/types/calendar';
import { toFaDigits } from '@/utils/jalaliDate';

const PRIORITY_STYLES: Record<Task['priority'], { dot: string; chip: string; label: string }> = {
  high: { dot: 'bg-red-500', chip: 'bg-red-50 text-red-600', label: 'مهم' },
  medium: { dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-600', label: 'متوسط' },
  low: { dot: 'bg-green-500', chip: 'bg-green-50 text-green-600', label: 'کم' },
};

const RECURRENCE_LABELS: Record<string, string> = {
  daily: 'روزانه',
  weekly: 'هفتگی',
  monthly: 'ماهانه',
  yearly: 'سالانه',
};

interface TaskCardProps {
  task: Task;
  onToggle: (task: Task) => void;
  onDelete: (id: string) => void;
  onSkip?: (id: string) => void;
  onEdit?: (task: Task) => void;
}

export function TaskCard({ task, onToggle, onDelete, onSkip, onEdit }: TaskCardProps) {
  const isCompleted = task.status === 'completed';
  const priority = PRIORITY_STYLES[task.priority];

  return (
    <div className="card-base group flex items-center gap-3 rounded-2xl p-3.5 transition-all hover:shadow-card-hover hover:border-slate-300/70">
      <button
        onClick={() => onToggle(task)}
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition-all ${
          isCompleted
            ? 'border-success-500 bg-success-500 text-white shadow-sm shadow-success-500/20'
            : 'border-slate-300 hover:border-primary-500 hover:bg-primary-50/50'
        }`}
        aria-label={isCompleted ? 'انجام نشده' : 'انجام شد'}
      >
        {isCompleted && <Check className="h-4 w-4" strokeWidth={3} />}
      </button>

      <div className="min-w-0 flex-1 space-y-1.5">
        <p
          className={`truncate text-right text-sm font-semibold ${
            isCompleted ? 'text-slate-400 line-through' : 'text-slate-800'
          }`}
        >
          {task.title}
        </p>
        <div className="flex flex-wrap items-center justify-start gap-2">
          {task.dueTime && (
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              <Clock className="h-3 w-3 text-slate-400" />
              {toFaDigits(task.dueTime)}
            </span>
          )}
          {task.duration && (
            <span className="text-[11px] text-slate-400">
              {toFaDigits(task.duration)} دقیقه
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${priority.chip}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${priority.dot}`} />
            {priority.label}
          </span>
          {task.recurrence !== 'none' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-50 px-2 py-0.5 text-[10px] font-medium text-accent-700">
              <Repeat className="h-3 w-3" />
              {RECURRENCE_LABELS[task.recurrence]}
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {onEdit && (
          <button
            onClick={() => onEdit(task)}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-primary-500"
            aria-label="ویرایش کار"
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
        {onSkip && task.status === 'pending' && (
          <button
            onClick={() => onSkip(task.id)}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="پرش از کار"
          >
            <SkipForward className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={() => onDelete(task.id)}
          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
          aria-label="حذف"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
