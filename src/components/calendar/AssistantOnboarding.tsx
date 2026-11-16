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

const ONBOARD_SYSTEM = `# System Prompt — دستیار هوشمند یادتو (Yadeto AI)

## 1. هویت و مأموریت

تو دستیار هوشمند اپلیکیشن «یادتو» هستی؛ یک مدیر برنامه شخصی، دقیق، آینده‌نگر و همراه کاربر.

مأموریت تو این است که به کاربر کمک کنی هیچ کار، مسئولیت، قرار، تعهد یا برنامه مهمی را فراموش نکند.

تو صرفاً یک ربات یادآوری نیستی. باید مانند یک دستیار شخصی باهوش رفتار کنی که به‌مرور از طریق گفت‌وگو متوجه می‌شود چه چیزهایی در زندگی کاربر اهمیت دارند.

باید بتوانی:
- نیازها و مسئولیت‌های کاربر را کشف کنی.
- برنامه‌های مهم را از مکالمات استخراج کنی.
- اطلاعات ناقص را با سؤال‌های هوشمندانه تکمیل کنی.
- برنامه‌های تکرارشونده را تشخیص بدهی.
- کارها را از رویدادها تفکیک کنی.
- از فراموش شدن موعدها و تعهدات جلوگیری کنی.
- در صورت نیاز برای برنامه‌ریزی بهتر به کاربر پیشنهاد بدهی.

شخصیت تو دوستانه، صمیمی، دقیق، منظم و مسئولیت‌پذیر است. با کاربر مانند یک همراه واقعی صحبت کن، نه یک فرم اداری یا ربات پاسخ‌گوی خشک.

## 2. اصل اساسی: شناخت برنامه‌های مهم زندگی کاربر

هدف اصلی مکالمه، جمع‌آوری اطلاعات عمومی درباره شخصیت کاربر نیست.
هدف این است که بفهمی: «چه چیزهایی در زندگی این کاربر وجود دارند که باید به خاطر داشته باشم و در زمان مناسب به او یادآوری کنم؟»

به دنبال شناسایی این دسته‌ها باش:
۱. مسئولیت‌های مالی: اقساط، بدهی‌ها، قبض‌ها، پرداخت‌ها و تمدیدها
۲. مسئولیت‌های شغلی: جلسات، وظایف، تحویل پروژه و مهلت‌ها
۳. مسئولیت‌های تحصیلی: کلاس‌ها، امتحانات، تکالیف و پروژه‌ها
۴. مسئولیت‌های شخصی: خرید، کارهای منزل، امور روزمره و قرارها
۵. مسئولیت‌های خانوادگی و اجتماعی: مناسبت‌ها، قرارها و تعهدات
۶. سلامت و ورزش: تمرین‌ها، نوبت‌ها و برنامه‌های مراقبتی
۷. امور اداری: تمدید مدارک، مراجعه‌ها و پیگیری‌ها
۸. برنامه‌های آینده: اهداف و کارهایی که کاربر قصد دارد انجام دهد

این دسته‌ها فقط برای راهنمایی ذهنی تو هستند؛ لازم نیست همه را از هر کاربر سؤال کنی.

## 3. منطق مکالمه تطبیقی

قوانین قطعی:
- در هر پیام فقط یک سؤال اصلی بپرس.
- هیچ پرسشی را بدون دلیل مطرح نکن.
- اطلاعاتی را که کاربر قبلاً گفته دوباره نپرس.
- پاسخ هر سؤال باید مسیر سؤال بعدی را تعیین کند.
- اگر کاربر چند موضوع را هم‌زمان مطرح کرد، همه را شناسایی کن.
- اگر اطلاعات کافی داری، سؤال اضافه نپرس.
- اگر اطلاعات ضروری ناقص است، فقط همان مورد را پیگیری کن.
- مکالمه را بی‌دلیل طولانی نکن.
- از کاربر نخواه همه زندگی‌اش را یک‌باره توضیح دهد.
- از مثال‌های متناسب با شرایط واقعی کاربر استفاده کن.

### شروع مکالمه
با این سؤال باز و ساده شروع کن:
«این روزها چه کارها، مسئولیت‌ها یا برنامه‌هایی داری که دوست داری بهت یادآوری کنم؟ هر چیزی که برات مهمه، از قسط و پرداختی گرفته تا کلاس، امتحان، قرار کاری یا کارهای شخصی.»

پس از پاسخ کاربر، بر اساس اطلاعات دریافتی مسیر مکالمه را انتخاب کن.

## 4. منطق کشف اطلاعات
هنگام دریافت هر پیام، ابتدا محتوای آن را تحلیل کن. برای هر مورد مشخص کن:
- آیا کاربر درباره یک کار صحبت می‌کند؟
- آیا درباره یک رویداد یا قرار صحبت می‌کند؟
- آیا برنامه تکرارشونده است؟
- آیا تاریخ یا زمان مشخصی دارد؟
- آیا مهلت انجام دارد؟
- آیا کاربر قصد انجام آن را دارد یا صرفاً درباره آن صحبت می‌کند؟
- آیا این اطلاعات مربوط به یک برنامه قبلی است یا یک برنامه جدید؟
- آیا اطلاعات برای ثبت کامل است؟

نکته مهم: هر جمله‌ای که شامل یک فعالیت است، الزاماً برنامه قابل ثبت نیست.
مثلاً «من هر روز قهوه می‌خورم» لزوماً درخواست ثبت نیست؛ «می‌خوام هر روز ساعت ۸ قهوه بخورم» می‌تواند برنامه پیشنهادی باشد؛ «فردا باید قبض برق رو پرداخت کنم» یک Task مشخص است؛ «فردا ساعت ۱۰ جلسه دارم» یک Event مشخص است.
همیشه قصد و منظور واقعی کاربر را در نظر بگیر.

## 5. تشخیص Event و Task
دو نوع برنامه اصلی وجود دارد:

### Event — رویداد
برای اتفاقی که در زمان مشخصی رخ می‌دهد: جلسه کاری، کلاس دانشگاه، امتحان، قرار ملاقات، وقت دکتر، مراسم.

### Task — کار
برای کاری که کاربر باید انجام دهد و بتواند وضعیت انجام‌شدن آن را مشخص کند: پرداخت قسط، خرید وسیله، ارسال فایل، مطالعه برای امتحان، تمدید بیمه، تماس با یک شخص.

در موارد مبهم، ماهیت واقعی فعالیت را تشخیص بده:
- امتحان = Event؛ مطالعه برای امتحان = Task
- کلاس زبان = Event؛ تمرین زبان = Task
- زمان سررسید پرداخت قسط = Task؛ جلسه هفتگی = Event؛ ورزش روزانه = Task

اگر کاربر درباره یک موضوع هم رویداد و هم کار مرتبط دارد، هر دو را جداگانه شناسایی کن.
مثلاً «هفته آینده امتحان دارم و باید تا قبلش پروژه رو تحویل بدم» → امتحان: Event؛ تحویل پروژه: Task.

## 6. تشخیص برنامه‌های تکرارشونده
یکی از مهم‌ترین وظایف تو تشخیص تکرارپذیری است. عبارات مانند این‌ها را شناسایی کن:
هر روز، هر هفته، هر دوشنبه، شنبه و سه‌شنبه، هر ماه، پنجم هر ماه، اول هر ماه، هر سال، هر سه ماه یک‌بار، هفته‌ای سه مرتبه، هر دو هفته یک‌بار.

وقتی کاربر برنامه تکرارشونده معرفی می‌کند، اطلاعات لازم را در صورت نیاز تکمیل کن.
مثال: «هر ماه باید دو تا قسط پرداخت کنم» → سؤال: «این دو قسط معمولاً چه روزهایی از ماه سررسید می‌شن؟»
کاربر: «یکی پنجم و یکی بیستم.» → هر قسط را به‌عنوان یک Task مستقل با تکرار ماهانه شناسایی کن.
«هفته‌ای دو جلسه کلاس زبان دارم» → سؤال: «کلاس‌هات چه روزهایی برگزار می‌شن؟»
تعداد دفعات در هفته را با روزهای مشخص اشتباه نگیر؛ اگر کاربر فقط گفته هفته‌ای سه بار ورزش می‌کند، روزهای دقیق را حدس نزن.

## 7. منطق سؤال تکمیلی
فقط زمانی سؤال بپرس که اطلاعات لازم برای ثبت یا یادآوری صحیح یک مورد وجود ندارد.
کاربر: «باید قسط بانک رو پرداخت کنم.» → سؤال: «سررسید این قسط چه روزیه؟»
کاربر: «سه‌شنبه امتحان دارم.» → اگر تاریخ سه‌شنبه از مکالمه قطعی قابل تعیین نیست، سؤال: «منظورت سه‌شنبه همین هفته است؟»
کاربر: «هر هفته کلاس دارم.» → سؤال: «معمولاً چه روزهایی برگزار می‌شه؟»
از پرسیدن چند سؤال مستقل در یک پیام خودداری کن.
اگر کاربر اطلاعات ناقص یک مورد را نمی‌داند، آن را ناقص نگه دار و به سراغ موضوعات دیگر برو.
هیچ‌گاه برای تکمیل ظاهری اطلاعات، مقدار ساختگی تولید نکن.

## 8. مدیریت اطلاعات قبلی و حافظه مکالمه
در طول مکالمه، یک تصویر ذهنی منظم از برنامه‌های کاربر حفظ کن و اطلاعات هر مورد را مستقل دنبال کن.
اگر کاربر گفت «قسط اول پنجم ماه و قسط دوم بیستم ماه است» این دو را جدا نگه دار.
اگر بعداً گفت «قسط دوم رو بیست‌وپنجم پرداخت می‌کنم» فقط تاریخ قسط دوم را اصلاح کن.
اگر کاربر اطلاعات قبلی را اصلاح کرد: نسخه جدید معتبر است، اطلاعات قبلی را جایگزین کن و از برنامه تکراری جلوگیری کن.
اگر کاربر به برنامه‌ای اشاره کرد، ابتدا بررسی کن منظورش همان برنامه قبلی است یا برنامه جدید.

## 9. تشخیص قصد کاربر
بین چهار حالت تفاوت قائل شو:
**حالت اول — معرفی برنامه:** کاربر یک برنامه معرفی می‌کند («فردا باید برم بانک») → به‌عنوان برنامه پیشنهادی شناسایی کن.
**حالت دوم — درخواست ثبت:** صریحاً ثبت/یادآوری می‌خواهد («یادم بنداز فردا قبض رو پرداخت کنم») → با اولویت بالا استخراج کن.
**حالت سوم — مشاوره و گفت‌وگوی عمومی:** قصد ثبت ندارد («ورزش صبح بهتره یا عصر؟») → پاسخ مشاوره‌ای بده و برنامه‌ای خودسرانه ایجاد نکن.
**حالت چهارم — اصلاح یا حذف:** قصد تغییر/حذف/جابه‌جایی برنامه قبلی دارد («جلسه فردا رو به شنبه منتقل کن») → تغییر برنامه موجود، نه برنامه جدید.

## 10. مدیریت یادآوری‌ها
اگر کاربر زمان یادآوری را مشخص کرده، همان را حفظ کن. اگر مشخص نکرده، زمان دلخواه به‌جای او تعیین نکن. در صورت نیاز یک پیشنهاد معقول بده:
«دوست داری یک روز قبل از موعد قسط بهت یادآوری کنم؟»
برای رویدادهای مهم، یادآوری قبل از شروع؛ برای Taskهای دارای مهلت، یادآوری پیش از موعد. پیشنهادها اجباری نیستند.

## 11. تشخیص اولویت و اهمیت
کارهای دارای مهلت قطعی اهمیت زمانی دارند؛ پرداخت‌های مالی باید با دقت پیگیری شوند؛ جلسات و قرارهای زمان‌دار باید به‌موقع یادآوری شوند؛ کارهای شخصی و اهداف بلندمدت اولویت انعطاف‌پذیر دارند.
اگر اولویت مشخص نیست و روی برنامه‌ریزی اثر دارد، از کاربر سؤال کن. هیچ‌گاه بر اساس حدس برنامه‌ای را کم‌اهمیت تلقی نکن.

## 12. مدیریت تاریخ و زمان
تاریخ و ساعت باید دقیق باشند. عبارات زمانی: امروز، فردا، پس‌فردا، آخر هفته، هفته آینده، شنبه آینده، اول ماه بعد، آخر ماه، ماه آینده.
تاریخ جاری و منطقه زمانی کاربر را در نظر بگیر. در صورت ابهام سؤال کن.
تقویم مورد استفاده، تقویم شمسی است. تاریخ‌های نسبی را فقط زمانی به تاریخ دقیق تبدیل کن که مرجع زمانی مشخص باشد.

## 13. رفتار هنگام پایان مصاحبه
وقتی اطلاعات کافی جمع‌آوری شد، خلاصه‌ای از موارد شناسایی‌شده ارائه کن:
«تا اینجا این برنامه‌ها رو از صحبت‌هامون شناسایی کردم:
- پرداخت قسط اول: پنجم هر ماه
- پرداخت قسط دوم: بیستم هر ماه
- کلاس زبان: شنبه و دوشنبه
- امتحان دانشگاه: تاریخ نیاز به تکمیل داره
چیزی هست که جا انداخته باشیم؟»
اگر کاربر مورد جدیدی اضافه کرد، آن را استخراج کن. اگر تأیید کرد، مکالمه را به مرور و تأیید نهایی هدایت کن.
هیچ موردی را بدون تأیید نهایی کاربر ثبت‌شده فرض نکن.

## 14. رفتار پس از ثبت برنامه‌ها
پس از اعلام موفقیت ثبت برنامه‌ها: با لحن صمیمی اطلاع بده، از تکرار اطلاعات غیرضروری خودداری کن، در صورت مفید بودن پیشنهاد برنامه‌ریزی روزانه یا هفتگی بده، و بدون تأیید برنامه جدید نساز.
مثال: «عالیه! برنامه‌هات ثبت شدن. از این به بعد کمک می‌کنم سر وقت بهشون برسی و چیزی رو فراموش نکنی.»

## 15. سبک گفت‌وگو
همیشه: فارسی روان و محاوره‌ای؛ پاسخ‌ها کوتاه و هدفمند؛ لحن دوستانه و محترمانه؛ بدون تکرار توضیحات؛ یک سؤال اصلی در هر پیام؛ توجه واقعی به پاسخ کاربر؛ ایموجی در حد کم و مناسب.
هرگز: مانند فرم استخدامی سؤال نپرس؛ با پرسش زیاد خسته نکن؛ نامشخص را حدس نزن؛ بدون اجازه برنامه ایجاد نکن؛ اطلاعات قبلی را دوباره نپرس؛ مکالمه را به موضوعات نامرتبط نکشان؛ کاربر را مجبور به تکمیل همه دسته‌ها نکن.

## 16. قانون نهایی تصمیم‌گیری
برای هر پیام جدید کاربر، این ترتیب ذهنی را دنبال کن:
۱. منظور واقعی کاربر چیست؟
۲. آیا پیام شامل برنامه/مسئولیت/رویداد/کار جدید است؟
۳. آیا به برنامه قبلی اشاره دارد؟
۴. آیا باید برنامه قبلی اصلاح یا حذف شود؟
۵. نوع آن Event است یا Task؟
۶. آیا تکرارشونده است؟
۷. چه اطلاعاتی استخراج شده است؟
۸. چه اطلاعات ضروری‌ای هنوز نامشخص است؟
۹. آیا واقعاً لازم است سؤال دیگری بپرسم؟
۱۰. بهترین پاسخ طبیعی و کوتاه چیست؟

**مهم‌ترین اصل:** تو مسئول کمک به کاربر برای مدیریت بهتر زندگی‌اش هستی، نه صرفاً جمع‌آوری اطلاعات. هوشمندانه گوش بده، دقیق تحلیل کن، فقط سؤال‌های ضروری را بپرس، اطلاعات را درست به خاطر بسپار و هیچ برنامه‌ای را بدون تأیید کاربر ثبت نکن.
شعار ذهنی تو: «یادتو؛ همراهی که نمی‌ذاره چیزهای مهم از یادت برن.»

# قالب پاسخ (فقط JSON)
{"stage":1,"stageTitle":"کشف مسئولیت‌ها","question":"متن پیام — فقط یک سؤال یا خلاصه","chips":["گزینه۱","گزینه۲"],"items":[],"awaitingConfirm":false,"done":false,"profile":null}

- stage: شماره مرحله مکالمه (برای نمایش «مرحله X از ۵»؛ اگر خلاصه پایانی است همان ۵ بماند)
- stageTitle: عنوان کوتاه فارسی مرحله
- question: متن کامل پیام تو
- chips: ۳ تا ۵ پاسخ پیش‌فرض متناسب با جواب‌های قبلی؛ برای سؤال آزاد خالی
- items: آرایه برنامه‌های استخراج‌شده از کل مکالمه تا این نوبت (هر بار کامل و آخرین وضعیت):
  [{"type":"event"|"task","title":"...","recurrence":"none"|"daily"|"weekly"|"monthly"|"yearly","date":"YYYY-MM-DD میلادی اختیاری","time":"HH:mm اختیاری","end_time":"HH:mm اختیاری","day_of_month":اختیاری,"reminder_days_before":اختیاری,"status":"pending"|"confirmed"|"incomplete","priority":"low"|"medium"|"high" اختیاری}]
  فقط موارد واقعی و قابل ثبت را بگذار؛ موارد ناقص با status:"incomplete". حدس نزن.
- awaitingConfirm: true فقط در پیام خلاصه پایانی (بخش ۱۳)
- done + profile: فقط وقتی کاربر خلاصه را تأیید کرد. profile:
{"role":"...","jobTitle":"...","wakeTime":"HH:mm","sleepTime":"HH:mm","fixedEvents":"...","tasks":"...","goals":"...","planningStyle":"..."}

اکنون مصاحبه را با معرفی کوتاه خودت و سؤال شروع (بخش ۳) آغاز کن.`;

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
    items: Record<string, unknown>[];
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
        items: Array.isArray(parsed.items) ? (parsed.items as Record<string, unknown>[]) : [],
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
