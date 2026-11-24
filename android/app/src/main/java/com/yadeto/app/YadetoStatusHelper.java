package com.yadeto.app;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.widget.RemoteViews;

import androidx.core.app.NotificationCompat;

import org.json.JSONObject;

import java.util.Map;

public final class YadetoStatusHelper {

    public static final String PREFS_NAME = "yadeto_status";
    public static final String ALARMS_PREFS = "yadeto_alarms";
    public static final String KEY_DATE = "dateLabel";
    public static final String KEY_SUMMARY = "summaryLine";
    public static final String KEY_DETAILS = "detailsText";
    public static final String KEY_STICKY = "stickyEnabled";
    public static final String KEY_ALARM_SOUND = "alarmSound";
    public static final String KEY_ALARM_VIBRATE = "alarmVibrate";

    public static final String KEY_SAVED_DATE = "savedDateIso";

    private static final String CHANNEL_ID = "yadeto_daily_status";
    private static final int NOTIFICATION_ID = 90210;
    private static final int DAILY_ALARM_ID = 90211;

    private static final String[] JALALI_MONTHS = {
        "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
        "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"
    };

    private static final String[] JALALI_WEEKDAYS = {
        "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"
    };

    private YadetoStatusHelper() {}

    public static String toFaDigits(int num) {
        return toFaDigits(String.valueOf(num));
    }

    public static String toFaDigits(String input) {
        if (input == null) return "";
        char[] faDigits = {'۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'};
        StringBuilder sb = new StringBuilder(input.length());
        for (char c : input.toCharArray()) {
            if (c >= '0' && c <= '9') {
                sb.append(faDigits[c - '0']);
            } else {
                sb.append(c);
            }
        }
        return sb.toString();
    }

    public static String getTodayJalaliFull() {
        java.util.Calendar cal = java.util.Calendar.getInstance();
        int gy = cal.get(java.util.Calendar.YEAR);
        int gm = cal.get(java.util.Calendar.MONTH) + 1; // 1-12
        int gd = cal.get(java.util.Calendar.DAY_OF_MONTH);
        int dayOfWeek = cal.get(java.util.Calendar.DAY_OF_WEEK); // Sunday = 1 ... Saturday = 7

        int[] g_d_m = {0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334};
        int jy = (gy > 1600) ? 979 : 0;
        gy -= (gy > 1600) ? 1600 : 621;
        int gy2 = (gm > 2) ? (gy + 1) : gy;
        int days = 365 * gy + (gy2 + 3) / 4 - (gy2 + 99) / 100 + (gy2 + 399) / 400 - 80 + gd + g_d_m[gm - 1];
        jy += 33 * (days / 12053);
        days %= 12053;
        jy += 4 * (days / 1461);
        days %= 1461;
        jy += (days - 1) / 365;
        if (days > 0) {
            days = (days - 1) % 365;
        }
        int jm, jd;
        if (days < 186) {
            jm = 1 + (days / 31);
            jd = 1 + (days % 31);
        } else {
            jm = 7 + ((days - 186) / 30);
            jd = 1 + ((days - 186) % 30);
        }

        String weekday = JALALI_WEEKDAYS[dayOfWeek - 1];
        String monthName = (jm >= 1 && jm <= 12) ? JALALI_MONTHS[jm - 1] : "";
        return weekday + " " + toFaDigits(jd) + " " + monthName + " " + toFaDigits(jy);
    }

    public static String getTodayIso() {
        java.util.Calendar cal = java.util.Calendar.getInstance();
        return String.format(
            java.util.Locale.US,
            "%04d-%02d-%02d",
            cal.get(java.util.Calendar.YEAR),
            cal.get(java.util.Calendar.MONTH) + 1,
            cal.get(java.util.Calendar.DAY_OF_MONTH)
        );
    }

    public static void scheduleMidnightUpdate(Context context) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;

        java.util.Calendar nextMidnight = java.util.Calendar.getInstance();
        nextMidnight.add(java.util.Calendar.DAY_OF_YEAR, 1);
        nextMidnight.set(java.util.Calendar.HOUR_OF_DAY, 0);
        nextMidnight.set(java.util.Calendar.MINUTE, 0);
        nextMidnight.set(java.util.Calendar.SECOND, 5);
        nextMidnight.set(java.util.Calendar.MILLISECOND, 0);

        Intent intent = new Intent(context, YadetoBootReceiver.class);
        intent.setAction(Intent.ACTION_DATE_CHANGED);
        PendingIntent pi = PendingIntent.getBroadcast(
            context,
            DAILY_ALARM_ID,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        long triggerAt = nextMidnight.getTimeInMillis();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC, triggerAt, pi);
        } else {
            am.setExact(AlarmManager.RTC, triggerAt, pi);
        }
    }

    public static void saveStatus(
        Context context,
        String dateLabel,
        String summaryLine,
        String detailsText,
        boolean stickyEnabled
    ) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
            .putString(KEY_DATE, dateLabel)
            .putString(KEY_SUMMARY, summaryLine)
            .putString(KEY_DETAILS, detailsText)
            .putBoolean(KEY_STICKY, stickyEnabled)
            .putString(KEY_SAVED_DATE, getTodayIso())
            .apply();
        scheduleMidnightUpdate(context);
    }

    public static void showOrCancelOngoingNotification(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        boolean sticky = prefs.getBoolean(KEY_STICKY, true);
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        if (!sticky) {
            nm.cancel(NOTIFICATION_ID);
            return;
        }

        // Always check if day has changed since last save and compute fresh date
        String todayIso = getTodayIso();
        String savedIso = prefs.getString(KEY_SAVED_DATE, "");
        String dateLabel = prefs.getString(KEY_DATE, "");
        String summaryLine = prefs.getString(KEY_SUMMARY, "برنامه امروز آماده است");
        String detailsText = prefs.getString(KEY_DETAILS, "");

        if (!todayIso.equals(savedIso) || dateLabel.isEmpty() || dateLabel.equals("تقویم یادتو")) {
            dateLabel = getTodayJalaliFull();
            summaryLine = "برای مشاهده و مدیریت برنامه روز لمس کنید";
            detailsText = "امروز برنامه‌ای ثبت نشده — برای ثبت کار یا رویداد ضربه بزنید";
            prefs.edit()
                .putString(KEY_DATE, dateLabel)
                .putString(KEY_SUMMARY, summaryLine)
                .putString(KEY_DETAILS, detailsText)
                .putString(KEY_SAVED_DATE, todayIso)
                .apply();
        }

        scheduleMidnightUpdate(context);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "وضعیت روزانه تقویم و کارها",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("نمایش تاریخ روز، کارها و رویدادها در نوار اعلان");
            channel.setShowBadge(false);
            nm.createNotificationChannel(channel);
        }

        String safeDetails = (detailsText != null && !detailsText.trim().isEmpty())
            ? detailsText
            : "امروز برنامه‌ای ثبت نشده — برای ثبت کار یا رویداد ضربه بزنید";

        Intent openIntent = new Intent(context, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context,
            101,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        RemoteViews compactView = new RemoteViews(context.getPackageName(), R.layout.notification_status);
        compactView.setTextViewText(R.id.notif_date, dateLabel);
        compactView.setTextViewText(R.id.notif_summary, summaryLine);

        RemoteViews expandedView = new RemoteViews(context.getPackageName(), R.layout.notification_status_expanded);
        expandedView.setTextViewText(R.id.notif_exp_date, dateLabel);
        expandedView.setTextViewText(R.id.notif_exp_summary, summaryLine);
        expandedView.setTextViewText(R.id.notif_exp_details, safeDetails);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setColor(0xFF6D28D9)
            .setContentTitle(dateLabel)
            .setContentText(summaryLine)
            .setCustomContentView(compactView)
            .setCustomBigContentView(expandedView)
            .setStyle(new NotificationCompat.DecoratedCustomViewStyle())
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(pendingIntent);

        try {
            nm.notify(NOTIFICATION_ID, builder.build());
        } catch (SecurityException ignored) {
            // POST_NOTIFICATIONS not granted yet on Android 13+
        }
    }

    public static void updateAllWidgets(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        if (manager == null) return;

        ComponentName todayComp = new ComponentName(context, YadetoTodayWidgetProvider.class);
        int[] todayIds = manager.getAppWidgetIds(todayComp);
        if (todayIds != null && todayIds.length > 0) {
            YadetoTodayWidgetProvider.updateWidgets(context, manager, todayIds);
        }

        ComponentName quickComp = new ComponentName(context, YadetoQuickWidgetProvider.class);
        int[] quickIds = manager.getAppWidgetIds(quickComp);
        if (quickIds != null && quickIds.length > 0) {
            YadetoQuickWidgetProvider.updateWidgets(context, manager, quickIds);
        }
    }

    public static void saveAlarmPrefs(Context context, String soundId, boolean vibrate) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
            .putString(KEY_ALARM_SOUND, soundId)
            .putBoolean(KEY_ALARM_VIBRATE, vibrate)
            .apply();
    }

    public static void scheduleExactAlarm(
        Context context,
        int alarmId,
        String title,
        String body,
        long triggerAtMillis,
        String soundId,
        boolean vibrate
    ) {
        if (triggerAtMillis <= System.currentTimeMillis()) return;
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;

        // Persist alarm so it survives device reboot
        try {
            JSONObject obj = new JSONObject();
            obj.put("alarmId", alarmId);
            obj.put("title", title);
            obj.put("body", body);
            obj.put("triggerAtMillis", triggerAtMillis);
            obj.put("soundId", soundId);
            obj.put("vibrate", vibrate);
            context.getSharedPreferences(ALARMS_PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(String.valueOf(alarmId), obj.toString())
                .apply();
        } catch (Exception ignored) {}

        Intent intent = new Intent(context, YadetoAlarmReceiver.class);
        intent.putExtra("alarmId", alarmId);
        intent.putExtra("title", title);
        intent.putExtra("body", body);
        intent.putExtra("soundId", soundId);
        intent.putExtra("vibrate", vibrate);

        PendingIntent pi = PendingIntent.getBroadcast(
            context,
            alarmId,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent openIntent = new Intent(context, MainActivity.class);
        PendingIntent showIntent = PendingIntent.getActivity(
            context,
            alarmId + 50000,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        try {
            // setAlarmClock is never deferred by Doze mode and works reliably even when app is closed
            AlarmManager.AlarmClockInfo clockInfo = new AlarmManager.AlarmClockInfo(triggerAtMillis, showIntent);
            am.setAlarmClock(clockInfo, pi);
        } catch (SecurityException ignored) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pi);
            } else {
                am.set(AlarmManager.RTC_WAKEUP, triggerAtMillis, pi);
            }
        }
    }

    public static void rescheduleAllPersistedAlarms(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(ALARMS_PREFS, Context.MODE_PRIVATE);
        Map<String, ?> all = prefs.getAll();
        long now = System.currentTimeMillis();
        for (Map.Entry<String, ?> entry : all.entrySet()) {
            try {
                JSONObject obj = new JSONObject(String.valueOf(entry.getValue()));
                long triggerAt = obj.getLong("triggerAtMillis");
                if (triggerAt <= now) {
                    prefs.edit().remove(entry.getKey()).apply();
                    continue;
                }
                scheduleExactAlarm(
                    context,
                    obj.getInt("alarmId"),
                    obj.optString("title", "آلارم یادتو"),
                    obj.optString("body", ""),
                    triggerAt,
                    obj.optString("soundId", "classic"),
                    obj.optBoolean("vibrate", true)
                );
            } catch (Exception ignored) {}
        }
    }

    public static void cancelScheduledAlarm(Context context, int alarmId) {
        context.getSharedPreferences(ALARMS_PREFS, Context.MODE_PRIVATE)
            .edit()
            .remove(String.valueOf(alarmId))
            .apply();

        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        Intent intent = new Intent(context, YadetoAlarmReceiver.class);
        PendingIntent pi = PendingIntent.getBroadcast(
            context,
            alarmId,
            intent,
            PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE
        );
        if (pi != null) {
            am.cancel(pi);
            pi.cancel();
        }
    }
}
