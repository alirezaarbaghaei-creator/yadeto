import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  StickyNote,
  Plus,
  Search,
  Pin,
  Trash2,
  Edit3,
  Tag,
  Sparkles,
  Palette,
  X,
  Check,
} from 'lucide-react';
import { useCalendarStore } from '@/store/calendarStore';
import type { Note } from '@/types/calendar';
import { toFaDigits } from '@/utils/jalaliDate';

const NOTE_COLORS = [
  { id: 'slate', bg: 'bg-white', border: 'border-slate-200', hex: '#ffffff' },
  { id: 'amber', bg: 'bg-amber-50/80', border: 'border-amber-200', hex: '#fef3c7' },
  { id: 'emerald', bg: 'bg-emerald-50/80', border: 'border-emerald-200', hex: '#d1fae5' },
  { id: 'sky', bg: 'bg-sky-50/80', border: 'border-sky-200', hex: '#e0f2fe' },
  { id: 'purple', bg: 'bg-purple-50/80', border: 'border-purple-200', hex: '#f3e8ff' },
  { id: 'rose', bg: 'bg-rose-50/80', border: 'border-rose-200', hex: '#ffe4e6' },
];

export function NotesPage() {
  const notes = useCalendarStore((s) => s.notes);
  const deleteNote = useCalendarStore((s) => s.deleteNote);
  const togglePinNote = useCalendarStore((s) => s.togglePinNote);
  const addNote = useCalendarStore((s) => s.addNote);
  const updateNote = useCalendarStore((s) => s.updateNote);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('همه');
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Collect unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    notes.forEach((n) => {
      if (n.category) set.add(n.category);
    });
    return ['همه', ...Array.from(set)];
  }, [notes]);

  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      const matchSearch =
        searchQuery.trim() === '' ||
        n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.content.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCat = selectedCategory === 'همه' || n.category === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [notes, searchQuery, selectedCategory]);

  const handleOpenNew = () => {
    setEditingNote(null);
    setIsModalOpen(true);
  };

  const handleEdit = (note: Note) => {
    setEditingNote(note);
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-full pb-28 pt-3 px-4 max-w-4xl mx-auto space-y-5" dir="rtl">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <StickyNote className="h-6 w-6 text-primary-600" />
            یادداشت‌ها
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            ایده‌ها، نکات و اطلاعات شخصی خود را ثبت کنید تا هوش مصنوعی هم آن‌ها را به خاطر بسپارد.
          </p>
        </div>
        <button
          onClick={handleOpenNew}
          className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-primary-600 to-primary-700 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-lg shadow-primary-700/25 transition-all hover:scale-105 active:scale-95"
        >
          <Plus className="h-4 w-4" />
          یادداشت جدید
        </button>
      </div>

      {/* Search & Categories Bar */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجو در عنوان یا متن یادداشت‌ها..."
            className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pr-10 pl-4 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>

        {categories.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-primary-700 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* AI Memory Badge Note */}
      <div className="flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-primary-50/80 to-accent-50/60 border border-primary-100/80 p-3.5 text-xs text-slate-700">
        <Sparkles className="h-5 w-5 text-primary-600 shrink-0" />
        <p className="leading-relaxed">
          <strong>دسترسی هوش مصنوعی:</strong> تمام یادداشت‌های شما به حافظه دستیار صوتی و متنی متصل هستند. هر زمان بپرسید، یادتو بر اساس این یادداشت‌ها پاسخ می‌دهد.
        </p>
      </div>

      {/* Notes Grid */}
      {filteredNotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-400 mb-3">
            <StickyNote className="h-8 w-8" />
          </div>
          <p className="text-sm font-bold text-slate-700">یادداشتی پیدا نشد</p>
          <p className="text-xs text-slate-400 mt-1 max-w-xs">
            {searchQuery
              ? 'نتیجه‌ای برای جستجوی شما وجود ندارد.'
              : 'اولین یادداشت خود را اضافه کنید تا در دسترس شما و هوش مصنوعی باشد.'}
          </p>
          {!searchQuery && (
            <button
              onClick={handleOpenNew}
              className="mt-4 rounded-xl border border-primary-200 bg-primary-50 px-4 py-2 text-xs font-semibold text-primary-700 hover:bg-primary-100 transition-colors"
            >
              ثبت اولین یادداشت
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {filteredNotes.map((note) => {
            const colorObj = NOTE_COLORS.find((c) => c.hex === note.color) || NOTE_COLORS[0];
            return (
              <motion.div
                key={note.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`relative flex flex-col justify-between rounded-3xl border p-4.5 shadow-sm transition-all hover:shadow-md ${colorObj.bg} ${colorObj.border}`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug line-clamp-1">
                      {note.title}
                    </h3>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => togglePinNote(note.id)}
                        className={`rounded-lg p-1.5 transition-colors ${
                          note.pinned
                            ? 'text-amber-500 bg-amber-100/60'
                            : 'text-slate-400 hover:bg-slate-200/50 hover:text-slate-600'
                        }`}
                        title={note.pinned ? 'برداشتن پین' : 'پین کردن در بالا'}
                      >
                        <Pin className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleEdit(note)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/50 hover:text-slate-700 transition-colors"
                        title="ویرایش"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => deleteNote(note.id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-100/60 hover:text-rose-600 transition-colors"
                        title="حذف"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-wrap line-clamp-5">
                    {note.content}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-400">
                  {note.category ? (
                    <span className="flex items-center gap-1 rounded-md bg-white/70 px-2 py-0.5 text-slate-600 font-medium border border-slate-200/50">
                      <Tag className="h-3 w-3 text-slate-400" />
                      {note.category}
                    </span>
                  ) : (
                    <span />
                  )}
                  <span>
                    {new Date(note.updatedAt).toLocaleDateString('fa-IR')}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Note Edit/Create Modal */}
      <NoteModal
        open={isModalOpen}
        note={editingNote}
        onClose={() => setIsModalOpen(false)}
        onSave={(data) => {
          if (editingNote) {
            updateNote(editingNote.id, data);
          } else {
            addNote(data);
          }
          setIsModalOpen(false);
        }}
      />
    </div>
  );
}

interface NoteModalProps {
  open: boolean;
  note: Note | null;
  onClose: () => void;
  onSave: (data: Partial<Note>) => void;
}

function NoteModal({ open, note, onClose, onSave }: NoteModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [color, setColor] = useState('#ffffff');
  const [pinned, setPinned] = useState(false);

  // Sync state when opened or note changed
  useState(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
      setCategory(note.category || 'عمومی');
      setColor(note.color || '#ffffff');
      setPinned(note.pinned || false);
    } else {
      setTitle('');
      setContent('');
      setCategory('عمومی');
      setColor('#ffffff');
      setPinned(false);
    }
  });

  // Re-sync on modal open
  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() && !content.trim()) return;
    onSave({
      title: title.trim() || 'یادداشت جدید',
      content: content.trim(),
      category: category.trim() || 'عمومی',
      color,
      pinned,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" dir="rtl">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <StickyNote className="h-5 w-5 text-primary-600" />
            {note ? 'ویرایش یادداشت' : 'یادداشت جدید'}
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">عنوان یادداشت</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثلاً: نکات جلسه، لیست خرید، ایده برای پروژه..."
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">متن یادداشت</label>
            <textarea
              rows={6}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="جزئیات و توضیحات را اینجا بنویسید..."
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">دسته‌بندی</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="عمومی، کاری، شخصی..."
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-800 focus:border-primary-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">رنگ پس‌زمینه</label>
              <div className="flex items-center gap-1.5 pt-1">
                {NOTE_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setColor(c.hex)}
                    className={`h-7 w-7 rounded-full border transition-all flex items-center justify-center ${c.bg} ${
                      color === c.hex ? 'ring-2 ring-primary-600 scale-110' : 'border-slate-300'
                    }`}
                  >
                    {color === c.hex && <Check className="h-3.5 w-3.5 text-primary-700" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              پین کردن در بالای لیست
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="rounded-xl bg-primary-700 px-5 py-2 text-xs font-bold text-white hover:bg-primary-800 shadow-md shadow-primary-700/20"
              >
                ذخیره
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
