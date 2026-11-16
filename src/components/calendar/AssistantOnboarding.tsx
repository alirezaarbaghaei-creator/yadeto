import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Send, Sparkles, Loader2 } from 'lucide-react';
import { apiCall } from '@/lib/api';
import type { AssistantProfile, UserPreferences } from '@/types/calendar';

/**
 * Conversational assistant onboarding — a free-flowing interview where the AI
 * generates BOTH the next question AND contextual default answer chips based
 * on every previous answer (no fixed step algorithm). Work hours are collected
 * as a 24h range. When the AI decides it knows enough, it returns done=true
 * with the extracted profile and the modal auto-closes.
 */

interface Turn {
  role: 'assistant' | 'user';
  content: string;
}

interface Props {
  userName?: string;
  onComplete: (result: { profile: AssistantProfile; preferences: Partial<UserPreferences>; summary: string }) => void;
  onSkip?: () => void;
}

const OPENING =
  'سلام! من مدیر برنامه‌ی تو هستم. قبل از شروع، چند سؤال کوتاه ازت می‌پرسم تا برنامه‌ریزیم دقیقاً برای «زندگی تو» باشه. هر جواب هم می‌تونی تایپ کنی هم از گزینه‌ها انتخاب کنی. آماده‌ای؟';

const ONBOARD_SYSTEM = `# System Prompt – هوش مصنوعی مدیر برنامه

## نقش تو

تو مدیر برنامه شخصی کاربر در اپلیکیشن یادتو هستی.

وظیفه تو شناخت سبک زندگی، برنامه‌های ثابت، مسئولیت‌ها، فعالیت‌ها و اهداف کاربر است تا بتوانی برای او یک برنامه زمانی کاربردی ایجاد کنی.

تو یک فرم نظرسنجی نیستی؛ یک مدیر برنامه حرفه‌ای هستی که می‌خواهد با یک گفتگوی کوتاه و دوستانه، شناخت مناسبی از کاربر به دست بیاورد.

## ساختار اپلیکیشن

در این اپلیکیشن فقط دو نوع داده اصلی وجود دارد:

### ۱. رویداد (Event)
هر رویداد دارای مشخصات زیر است: عنوان، تاریخ، ساعت مشخص، یادآوری.
نمونه‌ها: جلسه کاری، کلاس دانشگاه، قرار ملاقات، تولد، سفر، مراجعه به پزشک.

### ۲. کار (Task)
هر کار دارای مشخصات زیر است: عنوان، تاریخ، بازه زمانی، یادآوری، وضعیت انجام‌شدن (چک‌باکس).
نمونه‌ها: مطالعه یک فصل کتاب، خرید مایحتاج، انجام پروژه دانشگاهی، ورزش، تماس با یک شخص، پرداخت قبض.

تمام اطلاعاتی که از کاربر دریافت می‌کنی باید در نهایت به ایجاد یا پیشنهاد یکی از این دو نوع داده منجر شود.

## هدف مصاحبه

با حداکثر ۵ مرحله اصلی و در صورت نیاز چند سؤال تکمیلی، شناختی کاربردی از کاربر به دست بیاور.
مصاحبه باید کوتاه، طبیعی، هوشمند و غیرخسته‌کننده باشد.

## مراحل شناخت

### مرحله اول: شناخت سبک زندگی
متوجه شو کاربر در حال حاضر شاغل، دانشجو، خانه‌دار، فریلنسر یا دارای چند مسئولیت هم‌زمان است.
سؤال بعدی را بر اساس پاسخ او انتخاب کن.

### مرحله دوم: شناخت برنامه‌های ثابت
برنامه‌هایی را پیدا کن که کاربر در طول هفته به‌صورت منظم انجام می‌دهد (ساعات کاری، کلاس‌ها، جلسات، ورزش، مسئولیت‌های خانوادگی). در صورت نیاز روزهای هفته و ساعت دقیق آن‌ها را بپرس — فرمت ۲۴ ساعته. این اطلاعات معمولاً به رویدادهای تکرارشونده تبدیل می‌شوند.

### مرحله سوم: شناخت وظایف و مسئولیت‌ها
بفهم کاربر چه فعالیت‌هایی دارد که باید انجام شوند اما زمان ثابتی ندارند (کارهای شخصی، وظایف شغلی، امور تحصیلی، خرید، پیگیری اداری). این اطلاعات به کار تبدیل می‌شوند.

### مرحله چهارم: شناخت اهداف و عادت‌های موردنظر
بپرس کاربر دوست دارد چه فعالیت‌هایی را وارد زندگی روزانه یا هفتگی خود کند (ورزش، مطالعه، یادگیری، زبان انگلیسی، پیاده‌روی). اهداف را به فعالیت‌های قابل برنامه‌ریزی تبدیل کن، نه صرفاً جملات انگیزشی.

### مرحله پنجم: شناخت سبک برنامه‌ریزی
بفهم کاربر برنامه دقیق ساعتی می‌خواهد یا انعطاف‌پذیر؛ چه مقدار از روزش برنامه‌ریزی شود؛ چقدر استراحت نیاز دارد؛ چه زمانی تمرکز بیشتری دارد؛ چه میزان یادآوری مناسب است.

## قوانین مکالمه
۱. در هر پیام فقط یک سؤال اصلی بپرس.
۲. از سؤال‌های غیرضروری و شخصی خودداری کن.
۳. اگر پاسخ کاربر اطلاعات کافی دارد، بدون سؤال اضافه به مرحله بعد برو.
۴. اگر پاسخ کاربر مبهم است، فقط یک سؤال تکمیلی مطرح کن.
۵. از اطلاعاتی که کاربر قبلاً گفته مجدداً سؤال نکن.
۶. با مثال‌های ساده به کاربر کمک کن منظور سؤال را متوجه شود.
۷. اگر کاربر چند مسئولیت هم‌زمان دارد، هر کدام را جداگانه بررسی کن.
۸. به هیچ عنوان برای پر کردن تعداد مراحل، سؤال ساختگی مطرح نکن.
۹. کاربر باید بتواند هر زمان مصاحبه را متوقف کند.
۱۰. هیچ برنامه یا رویدادی را بدون تأیید کاربر به تقویم او اضافه نکن.

## تشخیص نوع اطلاعات
در تمام گفتگو تشخیص بده هر اطلاعات مربوط به کدام دسته است: رویداد با تاریخ و ساعت مشخص، کار با تاریخ و بازه زمانی، فعالیت تکرارشونده، ترجیح برنامه‌ریزی، یا اطلاعات نامشخص نیازمند سؤال تکمیلی.
اگر کاربر می‌گوید هر شنبه ساعت ۸ جلسه دارد → رویداد تکرارشونده. اگر می‌گوید باید هر روز ۳۰ دقیقه زبان بخواند → کار تکرارشونده. اگر زمان دقیق مشخص نیست، حدس نزن.

## پایان مصاحبه
در پایان یک خلاصه کوتاه و دوستانه ارائه بده شامل: ۱) برنامه‌های ثابت کاربر، ۲) مسئولیت‌ها و کارهای جاری، ۳) فعالیت‌های موردعلاقه و اهداف، ۴) ترجیحات زمانی و سبک برنامه‌ریزی. سپس از کاربر تأیید بگیر.
پس از تأیید، پیشنهاد بده که برنامه اولیه او را بر اساس اطلاعات به‌دست‌آمده تنظیم کنی.

## اصل مهم
هدف، جمع‌آوری بیشترین اطلاعات نیست؛ هدف، جمع‌آوری اطلاعاتی است که واقعاً به برنامه‌ریزی بهتر کمک می‌کند.
مثل یک مدیر برنامه واقعی رفتار کن؛ مختصر، دقیق، هوشمند و کاربردی.

## قالب پاسخ (فقط JSON)
{"stage":1,"stageTitle":"سبک زندگی","question":"متن پیام (در صورت نیاز با اعلان کوتاه مرحله)","chips":["گزینه۱","گزینه۲"],"isWorkHours":false,"awaitingConfirm":false,"done":false,"profile":null}

- stage: ۱ تا ۵
- stageTitle: عنوان فارسی مرحله فعلی
- question: متن پیام؛ فقط یک سؤال
- chips: ۳ تا ۵ پاسخ پیش‌فرض متناسب با جواب‌های قبلی؛ برای سؤال آزاد خالی
- isWorkHours: true فقط وقتی درباره بازه ساعات کار/مدرسه یا ساعت‌های ثابت می‌پرسی
- awaitingConfirm: true فقط در پیام خلاصه پایانی
- done + profile: فقط وقتی کاربر خلاصه را تأیید کرد (مثلاً گفت تأیید، درسته، اوکی). profile:
{"role":"...","jobTitle":"...","wakeTime":"07:00","sleepTime":"23:00","fixedEvents":"هر شنبه ساعت ۸ جلسه؛ ...","tasks":"خرید؛ پیگیری اداری؛ ...","goals":"۳۰ دقیقه زبان روزانه؛ ورزش هفتگی؛ ...","planningStyle":"برنامه نیمه‌ساعتی با استراحت بین کارها؛ تمرکز صبح‌ها؛ یادآوری ۱۵ دقیقه قبل"}

اکنون مصاحبه را با معرفی کوتاه خودت و سؤال مرحله اول آغاز کن.`;

/** Normalizes Persian/Arabic digits to Latin */
function toLatinDigits(text: string): string {
  return text
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

/** Extracts a valid HH:mm from a free-form Persian/Latin answer */
function parseHour(text: string): string | null {
  const t = toLatinDigits(text.trim());
  const m = t.match(/(\d{1,2})[:،.٫]?(\d{2})?/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  if (h < 0 || h > 24) return null;
  const min = m[2] ? parseInt(m[2], 10) : 0;
  if (min < 0 || min > 59) return null;
  if (h === 24 && min === 0) return '24:00';
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** Applies Persian time-of-day words: ۱۱ شب → 23:00 */
function applyDayPart(text: string, hour: string, position: 'start' | 'end'): string {
  const [h, m] = hour.split(':').map(Number);
  const afterWord = position === 'start' ? /(\d{1,2})\s*(صبح|بامداد|روز)/ : /(\d{1,2})\s*(شب|عصر|شام)/;
  if (afterWord.test(text) && h < 12) {
    return `${String(h + 12).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  return hour;
}

/** Parses a «X تا Y» range; tolerant of صبح/شب words */
function parseRange(text: string): [string, string] | null {
  const t = toLatinDigits(text.trim());
  const m = t.match(/(\d{1,2}(?::\d{2})?)\s*([صبحبامزعشام]*)\s*(?:تا|until|to|-|–)\s*(\d{1,2}(?::\d{2})?)\s*([صبحبامزعشام]*)/);
  if (!m) return null;
  let start = parseHour(m[1]);
  let end = parseHour(m[3]);
  if (!start || !end) return null;
  const startWord = m[2] || '';
  const endWord = m[4] || '';
  start = applyDayPart(`${m[1]} ${startWord}`, start, 'start');
  end = applyDayPart(`${m[3]} ${endWord}`, end, 'end');
  if (end < start && /شب|عصر/.test(endWord)) {
    const [eh, em] = end.split(':').map(Number);
    if (eh + 12 < 24) end = `${String(eh + 12).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
  }
  return [start, end];
}

/** Fallback offline questions (used only when the AI is unreachable) */
const FALLBACK_QA: { q: string; chips: string[]; isWorkHours?: boolean }[] = [
  { q: 'نقش اصلیت تو زندگی چیه — شغل داری یا درس می‌خونی؟', chips: ['کارمندم', 'دانش‌آموزم', 'دانشجوم', 'معلمم', 'فریلنسرم', 'مدیر کسب‌وکارم'] },
  { q: 'کمی دقیق‌تر بگو: چه شغلی یا چه رشته‌ای؟', chips: ['بعداً می‌گویم'] },
  { q: 'بازه ساعات کار یا مدرسه‌ت چیه؟ (فرمت ۲۴ ساعته، مثل ۸ تا ۱۷)', chips: ['۸ تا ۱۷', '۷:۳۰ تا ۱۴', '۹ تا ۱۸', 'ساعت ثابتی ندارم'], isWorkHours: true },
  { q: 'معمولاً چه ساعتی بیدار می‌شی و چه ساعتی می‌خوابی؟', chips: ['۷ تا ۲۳', '۶:۳۰ تا ۲۲', '۸ تا ۲۴'], isWorkHours: true },
  { q: 'هر هفته چه کارهای حیاتی داری که حتماً باید تو برنامه باشه؟', chips: ['ورزش روزانه', 'مطالعه', 'جلسات هفتگی'] },
];

/** Tolerant JSON extraction from model output */
function extractJson(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```json|```/g, '').trim();
  const s = cleaned.indexOf('{');
  const e = cleaned.lastIndexOf('}');
  if (s === -1 || e <= s) return null;
  try {
    return JSON.parse(cleaned.slice(s, e + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function AssistantOnboarding({ userName, onComplete, onSkip }: Props) {
  /** full LLM conversation: assistant questions + user answers */
  const turnsRef = useRef<Turn[]>([{ role: 'assistant', content: OPENING }]);
  /** displayed QA history */
  const [history, setHistory] = useState<Turn[]>([{ role: 'assistant', content: OPENING }]);
  const [currentQuestion, setCurrentQuestion] = useState<string>(OPENING);
  const [chips, setChips] = useState<string[]>([]);
  const [isWorkHours, setIsWorkHours] = useState(false);
  const [stage, setStage] = useState<{ num: number; title: string } | null>(null);
  const [started, setStarted] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [fallbackStep, setFallbackStep] = useState(-1);
  const [error, setError] = useState(false);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const answersRef = useRef<Record<string, string>>({});
  const finishedRef = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [history, busy]);

  /** Client-side profile extraction (fallback + sanity net for AI output) */
  const buildProfile = useCallback((): AssistantProfile => {
    const a = answersRef.current;
    let workStart = parseHour(a.work_start ?? '') ?? '08:00';
    let workEnd = parseHour(a.work_end ?? '') ?? '17:00';
    if (!a.work_start && a.work_hours) {
      const r = parseRange(a.work_hours);
      if (r) { workStart = r[0]; workEnd = r[1]; }
    }
    let wake = parseHour(a.wake ?? '') ?? '07:00';
    let sleep = parseHour(a.sleep_hour ?? '') ?? '23:00';
    if (!a.sleep_hour && a.sleep) {
      const r = parseRange(a.sleep);
      if (r) { wake = r[0]; sleep = r[1]; }
    }
    return {
      role: a.identity ?? 'نامشخص',
      jobTitle: a.job_detail ?? a.identity ?? '',
      wakeTime: wake,
      sleepTime: sleep,
      fixedEvents: a.fixed_events ?? '',
      tasks: a.tasks ?? '',
      goals: a.goals ?? '',
      planningStyle: a.planning_style ?? '',
      completedAt: new Date().toISOString(),
    };
  }, []);

  const finishWithAIProfile = useCallback(
    (profile: Record<string, unknown> | null, summary: string) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      const fallback = buildProfile();
      const hhmm = (v: unknown, fb: string) => {
        const s = parseHour(String(v ?? ''));
        return s ?? fb;
      };
      const profileResult: AssistantProfile = {
        role: (profile?.role as string) || fallback.role,
        jobTitle: (profile?.jobTitle as string) || fallback.jobTitle,
        wakeTime: hhmm(profile?.wakeTime, fallback.wakeTime),
        sleepTime: hhmm(profile?.sleepTime, fallback.sleepTime),
        fixedEvents: (profile?.fixedEvents as string) || answersRef.current.fixed_events || '',
        tasks: (profile?.tasks as string) || answersRef.current.tasks || '',
        goals: (profile?.goals as string) || answersRef.current.goals || '',
        planningStyle: (profile?.planningStyle as string) || answersRef.current.planning_style || '',
        completedAt: new Date().toISOString(),
      };
      let workStart = hhmm(profile?.workStart, fallback.wakeTime === '07:00' ? '08:00' : fallback.wakeTime);
      let workEnd = hhmm(profile?.workEnd, '17:00');
      // AI sanity net: if the AI missed hours, use client-parsed values
      if (!profile?.workStart && answersRef.current.work_hours) {
        const r = parseRange(answersRef.current.work_hours);
        if (r) { workStart = r[0]; workEnd = r[1]; }
      }
      if (!profile?.wakeTime && answersRef.current.sleep) {
        const r = parseRange(answersRef.current.sleep);
        if (r) {
          profileResult.wakeTime = r[0];
          profileResult.sleepTime = r[1];
        }
      }
      onComplete({
        profile: profileResult,
        preferences: {
          workStart,
          workEnd,
          workDays: [0, 1, 2, 3, 4],
          defaultReminder: 15,
          notificationsEnabled: true,
        },
        summary,
      });
    },
    [buildProfile, onComplete],
  );

  interface AIStep {
    question: string;
    chips: string[];
    isWorkHours: boolean;
    done: boolean;
    awaitingConfirm: boolean;
    stage: { num: number; title: string } | null;
    profile: Record<string, unknown> | null;
  }

  /** Sends the whole conversation to the AI; returns next turn data */
  const askAI = useCallback(
    async (withAnswer?: string): Promise<AIStep> => {
      if (withAnswer) {
        turnsRef.current.push({ role: 'user', content: withAnswer });
      }
      const data = await apiCall('ai_proxy', {
        messages: [
          { role: 'system', content: `${ONBOARD_SYSTEM}\n\nنام کاربر: ${userName ?? 'نامشخص'}` },
          ...turnsRef.current.map((t) => ({ role: t.role, content: t.content })),
          { role: 'user', content: '[ادامه بده]' },
        ],
        temperature: 0.5,
        response_format_json: true,
        max_tokens: 400,
      });
      const content =
        (data?.choices?.[0]?.message?.content ??
          data?.content ??
          data?.data?.choices?.[0]?.message?.content ??
          data?.data?.content ??
          '') as string;
      const parsed = extractJson(content);
      if (!parsed) throw new Error('bad-json');
      const num = Number(parsed.stage);
      return {
        question: String(parsed.question ?? ''),
        chips: Array.isArray(parsed.chips) ? (parsed.chips as string[]).map(String).slice(0, 6) : [],
        isWorkHours: Boolean(parsed.isWorkHours),
        done: Boolean(parsed.done),
        awaitingConfirm: Boolean(parsed.awaitingConfirm),
        stage: Number.isFinite(num) && num > 0
          ? { num, title: String(parsed.stageTitle ?? '') }
          : null,
        profile: (parsed.profile as Record<string, unknown>) ?? null,
      };
    },
    [userName],
  );

  /** Records the answer (client-side parse as backup) and advances the conversation */
  const submit = useCallback(
    (raw: string) => {
      const answer = raw.trim();
      if (!answer || busy || finishedRef.current) return;

      // client-side backup parse so the profile survives even without AI
      const q = currentQuestion;
      if (isWorkHours || /تا\s|ساعت|بیدار|خواب/.test(q)) {
        const r = parseRange(answer);
        if (/بیدار|خواب/.test(q)) {
          if (r) { answersRef.current.wake = r[0]; answersRef.current.sleep_hour = r[1]; }
          else { const one = parseHour(answer); if (one) answersRef.current.wake = one; }
          answersRef.current.sleep = answer;
        } else if (/ندارم|منعطف/.test(answer)) {
          answersRef.current.work_start = answersRef.current.work_start ?? '09:00';
          answersRef.current.work_end = answersRef.current.work_end ?? '18:00';
          answersRef.current.work_hours = answer;
        } else if (r) {
          answersRef.current.work_start = r[0];
          answersRef.current.work_end = r[1];
          answersRef.current.work_hours = answer;
        } else {
          const one = parseHour(answer);
          if (one) { answersRef.current.work_start = one; answersRef.current.work_end = answersRef.current.work_end ?? '17:00'; }
          answersRef.current.work_hours = answer;
        }
      } else if (!answersRef.current.identity) {
        answersRef.current.identity = answer;
      } else if (/رویداد|جلسه|کلاس|ثابت|منظم|هفته/.test(q) || /هر\s|شنبه|یکشنبه|دوشنبه|سه‌شنبه|چهارشنبه|پنجشنبه|جمعه/.test(answer)) {
        // likely fixed weekly commitments (recurring events)
        answersRef.current.fixed_events = answersRef.current.fixed_events
          ? `${answersRef.current.fixed_events}؛ ${answer}`
          : answer;
      } else if (/هدف|عادت|دوست دارم|می‌خوام|ورزش|مطالعه|زبان|پیاده/.test(q) || /ورزش|مطالعه|زبان|پیاده/.test(answer)) {
        answersRef.current.goals = answersRef.current.goals
          ? `${answersRef.current.goals}؛ ${answer}`
          : answer;
      } else if (/سبک|انعطاف|یادآوری|تمرکز|استراحت|دقیق/.test(q)) {
        answersRef.current.planning_style = answersRef.current.planning_style
          ? `${answersRef.current.planning_style}؛ ${answer}`
          : answer;
      } else {
        answersRef.current.tasks = answersRef.current.tasks
          ? `${answersRef.current.tasks}؛ ${answer}`
          : answer;
      }

      turnsRef.current.push({ role: 'user', content: answer });
      setHistory((prev) => [...prev, { role: 'user', content: answer }]);

      if (fallbackStep >= 0 || error) {
        // offline fallback path: deterministic sequence
        const next = fallbackStep + 1;
        if (next < FALLBACK_QA.length) {
          setFallbackStep(next);
          setCurrentQuestion(FALLBACK_QA[next].q);
          setChips(FALLBACK_QA[next].chips);
          setIsWorkHours(Boolean(FALLBACK_QA[next].isWorkHours));
        } else {
          finishWithAIProfile(null, '');
        }
        return;
      }

      // اگر گزارش نهایی نمایش داده شده و کاربر تأیید کرد → بستن خودکار
      if (awaitingConfirm) {
        finishWithAIProfile(null, '');
        return;
      }

      void (async () => {
        setBusy(true);
        try {
          const next = await askAI(answer);
          if (next.done) {
            turnsRef.current.push({ role: 'assistant', content: next.question });
            setHistory((prev) => [...prev, { role: 'assistant', content: next.question }]);
            finishWithAIProfile(next.profile, next.question);
            return;
          }
          turnsRef.current.push({ role: 'assistant', content: next.question });
          setCurrentQuestion(next.question);
          setChips(next.chips);
          setIsWorkHours(next.isWorkHours);
          setStage(next.stage);
          setAwaitingConfirm(next.awaitingConfirm);
          setHistory((prev) => [...prev, { role: 'assistant', content: next.question }]);
          setError(false);
        } catch {
          setError(true);
          const next = fallbackStep + 1;
          setFallbackStep(next);
          setCurrentQuestion(FALLBACK_QA[Math.min(next, FALLBACK_QA.length - 1)].q);
          setChips(FALLBACK_QA[Math.min(next, FALLBACK_QA.length - 1)].chips);
          setIsWorkHours(Boolean(FALLBACK_QA[Math.min(next, FALLBACK_QA.length - 1)].isWorkHours));
        } finally {
          setBusy(false);
        }
      })();
    },
    [busy, currentQuestion, isWorkHours, awaitingConfirm, error, fallbackStep, askAI, finishWithAIProfile],
  );

  const start = useCallback(() => {
    setStarted(true);
    setBusy(true);
    void (async () => {
      try {
        const first = await askAI();
        setCurrentQuestion(first.question);
        setChips(first.chips);
        setIsWorkHours(first.isWorkHours);
        setStage(first.stage);
        setAwaitingConfirm(first.awaitingConfirm);
        turnsRef.current.push({ role: 'assistant', content: first.question });
        setHistory((prev) => [...prev, { role: 'assistant', content: first.question }]);
        setError(false);
      } catch {
        setError(true);
        setFallbackStep(0);
        setCurrentQuestion(FALLBACK_QA[0].q);
        setChips(FALLBACK_QA[0].chips);
        setIsWorkHours(false);
      } finally {
        setBusy(false);
      }
    })();
  }, [askAI]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center"
    >
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex h-[86vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:h-[76vh] sm:rounded-3xl"
      >
        {/* header */}
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-teal-500 text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-slate-900">آشنایی با مدیر برنامه</h3>
            <p className="text-[10px] text-slate-400">
              {busy
                ? 'در حال فکر کردن...'
                : stage
                  ? `مرحله ${stage.num.toLocaleString('fa-IR')} از ۵ — ${stage.title}`
                  : started
                    ? 'گفتگوی آشنایی'
                    : 'چند دقیقه وقت بگذار'}
            </p>
          </div>
          {onSkip && (
            <button type="button" onClick={onSkip} className="text-xs text-slate-400 hover:text-slate-600">
              بعداً
            </button>
          )}
        </div>

        {/* conversation */}
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {history.map((t, i) => (
            <div key={i} className={`flex ${t.role === 'user' ? 'justify-start' : 'justify-end'}`}>
              <div
                className={`max-w-[90%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm leading-7 ${
                  t.role === 'user'
                    ? 'rounded-bl-md bg-indigo-600 text-white'
                    : 'rounded-br-md bg-slate-100 text-slate-700'
                }`}
              >
                {t.content}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex justify-end">
              <div className="rounded-2xl rounded-br-md bg-slate-100 px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
              </div>
            </div>
          )}
        </div>

        {/* chips + input */}
        <div className="border-t border-slate-100 px-5 py-3">
          {!started ? (
            <button
              type="button"
              onClick={start}
              disabled={busy}
              className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-colors hover:bg-indigo-700 disabled:opacity-50"
            >
              شروع پرسش‌ها
            </button>
          ) : (
            <>
              {awaitingConfirm && !busy && (
                <div className="mb-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => finishWithAIProfile(null, '')}
                    className="rounded-full bg-green-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
                  >
                    ✓ تأیید می‌کنم
                  </button>
                  <button
                    type="button"
                    onClick={() => submit('می‌خوام یک چیز رو اصلاح کنم')}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:border-indigo-300"
                  >
                    می‌خوام اصلاح کنم
                  </button>
                </div>
              )}
              {!awaitingConfirm && chips.length > 0 && !busy && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {chips.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => submit(c)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition-colors hover:border-indigo-300 hover:text-indigo-600"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
              {isWorkHours && !busy && (
                <p className="mb-2 text-[10px] leading-5 text-slate-400">
                  فرمت ۲۴ ساعته — مثلاً بنویس «۸ تا ۱۷». جواب آزاد است و گزینه‌ها فقط پیشنهادند.
                </p>
              )}
              <div className="flex items-center gap-2 rounded-2xl bg-slate-50 p-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && input.trim() && !busy) {
                      submit(input);
                      setInput('');
                    }
                  }}
                  placeholder="پاسخ خودت را بنویس..."
                  className="flex-1 bg-transparent px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => { if (input.trim() && !busy) { submit(input); setInput(''); } }}
                  disabled={!input.trim() || busy}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white transition-colors hover:bg-indigo-700 disabled:opacity-40"
                  aria-label="ارسال پاسخ"
                >
                  <Send className="h-4 w-4 -scale-x-100" />
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
