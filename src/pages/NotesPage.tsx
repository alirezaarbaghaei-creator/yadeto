import { useState, useEffect, useMemo } from 'react';
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
  Copy,
  X,
  Check,
  Clock,
} from 'lucide-react';
import { useCalendarStore } from '@/store/calendarStore';
import type { Note } from '@/types/calendar';
import { toFaDigits } from '@/utils/jalaliDate';

const NOTE_COLORS = [
  { id: 'slate', bg: 'bg-white', border: 'border-slate-200/90', accent: 'bg-slate-300', hex: '#ffffff' },
  { id: 'amber', bg: 'bg-amber-50/85', border: 'border-amber-200/90', accent: 'bg-amber-400', hex: '#fef3c7' },
  { id: 'emerald', bg: 'bg-emerald-50/85', border: 'border-emerald-200/90', accent: 'bg-emerald-400', hex: '#d1fae5' },
  { id: 'sky', bg: 'bg-sky-50/85', border: 'border-sky-200/90', accent: 'bg-sky-400', hex: '#e0f2fe' },
  { id: 'purple', bg: 'bg-purple-50/85', border: 'border-purple-200/90', accent: 'bg-purple-400', hex: '#f3e8ff' },
  { id: 'rose', bg: 'bg-rose-50/85', border: 'border-rose-200/90', accent: 'bg-rose-400', hex: '#ffe4e6' },
];

const QUICK_CATEGORIES = ['عمومی', 'کاری', 'شخصی', 'ایده', 'مالی', 'آموزشی'];

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
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    notes.forEach((n) => {
      if (n.category) set.add(n.category);
    });
    return ['همه', ...Array.from(set)];
  }, [notes]);

  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        q === '' ||
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q);
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

  const handleCopy = (e: React.MouseEvent, note: Note) => {
    e.stopPropagation();
    const text = note.title ? `${note.title}\n\n${note.content}` : note.content;
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(text);
      setCopiedId(note.id);
      setTimeout(() => setCopiedId((curr) => (curr === note.id ? null : curr)), 1800);
    }
  };

  return (
    <div className="min-h-full pb-28 pt-2 px-1 sm:px-2 max-w-4xl mx-auto space-y-5" dir="rtl">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md shadow-amber-500/25">
              <StickyNote className="h-5 w-5" />
            </span>
            <span>یادداشت‌ها</span>
            {notes.length > 0 && (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">
                {toFaDigits(String(notes.length))}
              </span>
            )}
          </h1>
          <p className="text-xs text-slate-500 mt-1.5">
            ایده‌ها و نکات شخصی خود را بنویسید؛ دستیار هوشمند هم آن‌ها را به خاطر می‌سپارد.
          </p>
        </div>
        <button
          onClick={handleOpenNew}
          className="flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-primary-600 to-primary-700 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-lg shadow-primary-700/25 transition-all hover:scale-105 active:scale-95 shrink-0"
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
            className="w-full rounded-2xl border border-slate-200/90 bg-white py-3 pr-10 pl-4 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>

        {categories.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all ${
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
      <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-l from-primary-50/90 via-white to-accent-50/70 border border-primary-100/90 p-3.5 text-xs text-slate-700 shadow-sm">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
          <Sparkles className="h-4 w-4" />
        </div>
        <p className="leading-relaxed">
          <strong className="text-primary-800">متصل به حافظه دستیار:</strong> هر وقت از دستیار صوتی یا متنی یادتو سوالی بپرسید، پاسخ را با توجه به این یادداشت‌ها می‌دهد.
        </p>
      </div>

      {/* Notes Grid */}
      {filteredNotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white/60 py-16 text-center px-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-50 text-amber-500 mb-3 shadow-inner">
            <StickyNote className="h-8 w-8" />
          </div>
          <p className="text-sm font-bold text-slate-800">یادداشتی پیدا نشد</p>
          <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
            {searchQuery
              ? 'نتیجه‌ای برای جستجوی شما وجود ندارد.'
              : 'اولین یادداشت خود را اضافه کنید تا همیشه در دسترس شما و هوش مصنوعی باشد.'}
          </p>
          {!searchQuery && (
            <button
              onClick={handleOpenNew}
              className="mt-4 rounded-xl bg-primary-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-primary-600/20 hover:bg-primary-700 transition-colors"
            >
              ثبت اولین یادداشت
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <AnimatePresence>
            {filteredNotes.map((note) => {
              const colorObj = NOTE_COLORS.find((c) => c.hex === note.color) || NOTE_COLORS[0];
              const isCopied = copiedId === note.id;
              return (
                <motion.div
                  key={note.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={() => handleEdit(note)}
                  className={`group relative cursor-pointer overflow-hidden flex flex-col justify-between rounded-3xl border p-5 shadow-sm transition-all hover:shadow-lg hover:-translate-y-0.5 ${colorObj.bg} ${colorObj.border}`}
                >
                  {/* Top subtle color accent bar */}
                  <div className={`absolute top-0 inset-x-0 h-1 ${colorObj.accent}`} />

                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {note.pinned && (
                          <Pin className="h-3.5 w-3.5 text-amber-500 shrink-0 fill-amber-400" />
                        )}
                        <h3 className="text-sm sm:text-base font-extrabold text-slate-900 leading-snug line-clamp-1">
                          {note.title}
                        </h3>
                      </div>

                      <div
                        className="flex items-center gap-0.5 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={(e) => handleCopy(e, note)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors"
                          title="کپی متن"
                        >
                          {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          onClick={() => togglePinNote(note.id)}
                          className={`rounded-lg p-1.5 transition-colors ${
                            note.pinned
                              ? 'text-amber-600 bg-amber-100/80'
                              : 'text-slate-400 hover:bg-slate-200/60 hover:text-slate-600'
                          }`}
                          title={note.pinned ? 'برداشتن پین' : 'پین کردن در بالا'}
                        >
                          <Pin className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleEdit(note)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-primary-700 transition-colors"
                          title="ویرایش"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => deleteNote(note.id)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-100/70 hover:text-rose-600 transition-colors"
                          title="حذف"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs sm:text-[13px] text-slate-600 leading-6 whitespace-pre-wrap line-clamp-5">
                      {note.content || 'بدون متن...'}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-400">
                    {note.category ? (
                      <span className="flex items-center gap-1 rounded-lg bg-white/80 px-2.5 py-0.5 text-slate-600 font-semibold border border-slate-200/60">
                        <Tag className="h-3 w-3 text-slate-400" />
                        {note.category}
                      </span>
                    ) : (
                      <span />
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(note.updatedAt).toLocaleDateString('fa-IR')}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
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
  const [category, setCategory] = useState('عمومی');
  const [color, setColor] = useState('#ffffff');
  const [pinned, setPinned] = useState(false);

  // Sync form state whenever the modal opens or the selected note changes
  useEffect(() => {
    if (!open) return;
    if (note) {
      setTitle(note.title ?? '');
      setContent(note.content ?? '');
      setCategory(note.category || 'عمومی');
      setColor(note.color || '#ffffff');
      setPinned(Boolean(note.pinned));
    } else {
      setTitle('');
      setContent('');
      setCategory('عمومی');
      setColor('#ffffff');
      setPinned(false);
    }
  }, [note, open]);

  if (!open) return null;

  const activeColorObj = NOTE_COLORS.find((c) => c.hex === color) || NOTE_COLORS[0];

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 backdrop-blur-sm p-4"
      dir="rtl"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-lg rounded-3xl border p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto transition-colors ${activeColorObj.bg} ${activeColorObj.border}`}
      >
        <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
          <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
            <StickyNote className="h-5 w-5 text-primary-600" />
            {note ? 'ویرایش یادداشت' : 'یادداشت جدید'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-200/60 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">عنوان یادداشت</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثلاً: نکات جلسه، لیست خرید، ایده برای پروژه..."
              className="w-full rounded-xl border border-slate-200 bg-white/90 p-3 text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">متن یادداشت</label>
            <textarea
              rows={7}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="جزئیات و توضیحات را اینجا بنویسید..."
              className="w-full rounded-xl border border-slate-200 bg-white/90 p-3 text-sm leading-6 text-slate-800 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">دسته‌بندی</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {QUICK_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all ${
                      category === cat
                        ? 'bg-primary-700 text-white shadow-sm'
                        : 'bg-white/80 text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="یا نام دسته‌بندی دلخواه بنویسید..."
                className="w-full rounded-xl border border-slate-200 bg-white/90 p-2.5 text-xs text-slate-800 focus:border-primary-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">رنگ کارت</label>
              <div className="flex items-center gap-2 pt-0.5">
                {NOTE_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setColor(c.hex)}
                    className={`h-8 w-8 rounded-full border transition-all flex items-center justify-center ${c.bg} ${
                      color === c.hex ? 'ring-2 ring-primary-600 scale-110 shadow-sm' : 'border-slate-300'
                    }`}
                  >
                    {color === c.hex && <Check className="h-4 w-4 text-primary-700" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-200/70">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
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
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="rounded-xl bg-primary-700 px-5 py-2.5 text-xs font-bold text-white hover:bg-primary-800 shadow-md shadow-primary-700/20"
              >
                {note ? 'ذخیره تغییرات' : 'ثبت یادداشت'}
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
