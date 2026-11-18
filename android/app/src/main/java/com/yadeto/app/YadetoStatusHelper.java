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

import androidx.core.app.NotificationCompat;

public final class YadetoStatusHelper {

    public static final String PREFS_NAME = "yadeto_status";
    public static final String KEY_DATE = "dateLabel";
    public static final String KEY_SUMMARY = "summaryLine";
    public static final String KEY_DETAILS = "detailsText";
    public static final String KEY_STICKY = "stickyEnabled";
    public static final String KEY_ALARM_SOUND = "alarmSound";
    public static final String KEY_ALARM_VIBRATE = "alarmVibrate";

    private static final String CHANNEL_ID = "yadeto_daily_status";
    private static final int NOTIFICATION_ID = 90210;

    private YadetoStatusHelper() {}

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
            .apply();
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

        String dateLabel = prefs.getString(KEY_DATE, "Yadeto");
        String summaryLine = prefs.getString(KEY_SUMMARY, "برنامه امروز آماده است");
        String detailsText = prefs.getString(KEY_DETAILS, "");

        Intent openIntent = new Intent(context, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context,
            101,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        String bigText = detailsText != null && !detailsText.trim().isEmpty()
            ? summaryLine + "\n" + detailsText
            : summaryLine;

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(dateLabel)
            .setContentText(summaryLine)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(bigText))
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

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (am.canScheduleExactAlarms()) {
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pi);
                } else {
                    am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pi);
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pi);
            } else {
                am.setExact(AlarmManager.RTC_WAKEUP, triggerAtMillis, pi);
            }
        } catch (SecurityException ignored) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pi);
        }
    }

    public static void cancelScheduledAlarm(Context context, int alarmId) {
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
