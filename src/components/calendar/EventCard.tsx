import { Clock, MapPin, Trash2, Pencil } from 'lucide-react';
import type { CalendarEvent } from '@/types/calendar';
import { toFaDigits } from '@/utils/jalaliDate';

const CATEGORY_COLORS: Record<string, string> = {
  work: '#3157D5',
  personal: '#13A89E',
  health: '#22C55E',
  finance: '#F59E0B',
  education: '#8B5CF6',
  social: '#EC4899',
  other: '#7B8496',
};

interface EventCardProps {
  event: CalendarEvent;
  compact?: boolean;
  onDelete?: (id: string) => void;
  onEdit?: (event: CalendarEvent) => void;
}

export function EventCard({ event, compact, onDelete, onEdit }: EventCardProps) {
  const eventColor = event.color || CATEGORY_COLORS[event.category] || '#3157D5';

  return (
    <div
      className={`card-base group flex overflow-hidden rounded-2xl transition-all hover:shadow-card-hover hover:border-slate-300/70 ${
        compact ? 'py-2' : ''
      }`}
    >
      <div className="w-1.5 shrink-0" style={{ backgroundColor: eventColor }} />
      <div className={`flex flex-1 items-center gap-2 ${compact ? 'px-3 py-1.5' : 'p-3.5'}`}>
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="truncate text-right text-sm font-semibold text-slate-800">{event.title}</p>
          <div className="flex flex-wrap items-center justify-start gap-2.5 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
              <Clock className="h-3 w-3 text-slate-400" />
              {toFaDigits(event.startTime)}
              {event.endTime ? ` - ${toFaDigits(event.endTime)}` : ''}
            </span>
            {event.location && (
              <span className="inline-flex max-w-[160px] items-center gap-1 truncate text-slate-500">
                <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                <span className="truncate">{event.location}</span>
              </span>
            )}
          </div>
        </div>
        {onDelete && !compact && (
          <div className="flex shrink-0 items-center gap-1">
            {onEdit && (
              <button
                onClick={() => onEdit(event)}
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-primary-500"
                aria-label="ویرایش رویداد"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => onDelete(event.id)}
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
              aria-label="حذف رویداد"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
