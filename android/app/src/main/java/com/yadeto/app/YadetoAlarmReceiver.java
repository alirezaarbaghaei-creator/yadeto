package com.yadeto.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.PowerManager;

import androidx.core.app.NotificationCompat;

public class YadetoAlarmReceiver extends BroadcastReceiver {
    private static final String ALARM_CHANNEL_ID = "yadeto_alarm_alerts_v2";

    @Override
    public void onReceive(Context context, Intent intent) {
        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            @SuppressWarnings("deprecation")
            PowerManager.WakeLock wl = pm.newWakeLock(
                PowerManager.FULL_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP | PowerManager.ON_AFTER_RELEASE,
                "yadeto:alarm_receiver_wakelock"
            );
            wl.acquire(20_000L);
        }

        int alarmId = intent.getIntExtra("alarmId", 1001);
        String title = intent.getStringExtra("title");
        String body = intent.getStringExtra("body");
        String soundId = intent.getStringExtra("soundId");
        boolean vibrate = intent.getBooleanExtra("vibrate", true);
        String itemId = intent.getStringExtra("itemId");
        String kind = intent.getStringExtra("kind");

        // 1. Immediately play native looping alarm ringtone + vibration (no background ForegroundService restriction)
        YadetoAlarmSoundPlayer.start(context, vibrate);

        // 2. Post high-priority notification in notification shade with Stop & Complete Task buttons
        showAlarmNotification(context, alarmId, title, body, soundId, vibrate, itemId, kind);
    }

    private void showAlarmNotification(
        Context context,
        int alarmId,
        String title,
        String body,
        String soundId,
        boolean vibrate,
        String itemId,
        String kind
    ) {
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        int notifId = alarmId + 2000;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                ALARM_CHANNEL_ID,
                "زنگ و یادآوری برنامه",
                NotificationManager.IMPORTANCE_HIGH
            );
            ch.setDescription("هشدار و زنگ یادآوری کارها و رویدادها");
            ch.setSound(null, null); // Sound handled cleanly by YadetoAlarmSoundPlayer so Stop cancels it immediately
            ch.enableVibration(false);
            ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            nm.createNotificationChannel(ch);
        }

        Intent openIntent = new Intent(context, YadetoAlarmActivity.class);
        openIntent.putExtra("alarmId", alarmId);
        openIntent.putExtra("notifId", notifId);
        openIntent.putExtra("title", title);
        openIntent.putExtra("body", body);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openPending = PendingIntent.getActivity(
            context,
            alarmId + 1000,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent stopIntent = new Intent(context, YadetoAlarmActionReceiver.class);
        stopIntent.setAction(YadetoAlarmActionReceiver.ACTION_STOP_ALARM);
        stopIntent.putExtra("alarmId", alarmId);
        stopIntent.putExtra("notifId", notifId);
        PendingIntent stopPending = PendingIntent.getBroadcast(
            context,
            alarmId + 3000,
            stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent snoozeIntent = new Intent(context, YadetoAlarmActionReceiver.class);
        snoozeIntent.setAction(YadetoAlarmActionReceiver.ACTION_SNOOZE_ALARM);
        snoozeIntent.putExtra("alarmId", alarmId);
        snoozeIntent.putExtra("notifId", notifId);
        snoozeIntent.putExtra("title", title);
        snoozeIntent.putExtra("body", body);
        snoozeIntent.putExtra("soundId", soundId);
        snoozeIntent.putExtra("vibrate", vibrate);
        snoozeIntent.putExtra("itemId", itemId);
        snoozeIntent.putExtra("kind", kind);
        PendingIntent snoozePending = PendingIntent.getBroadcast(
            context,
            alarmId + 4000,
            snoozeIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        String safeTitle = (title != null && !title.trim().isEmpty()) ? title : "یادآوری یادتو";
        String safeBody = (body != null && !body.trim().isEmpty()) ? body : "زمان برنامه شما فرا رسیده است";

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, ALARM_CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setColor(0xFF4F46E5)
            .setContentTitle(safeTitle)
            .setContentText(safeBody)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(safeBody))
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setContentIntent(openPending)
            .setFullScreenIntent(openPending, true)
            .setDeleteIntent(stopPending)
            .addAction(0, "توقف زنگ", stopPending)
            .addAction(0, "تعویق ۱۰ دقیقه", snoozePending);

        if ("task".equals(kind) && itemId != null && !itemId.isEmpty()) {
            Intent completeIntent = new Intent(context, YadetoAlarmActionReceiver.class);
            completeIntent.setAction(YadetoAlarmActionReceiver.ACTION_COMPLETE_TASK);
            completeIntent.putExtra("alarmId", alarmId);
            completeIntent.putExtra("notifId", notifId);
            completeIntent.putExtra("itemId", itemId);
            PendingIntent completePending = PendingIntent.getBroadcast(
                context,
                alarmId + 5000,
                completeIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            builder.addAction(0, "انجام شد ✓", completePending);
        }

        try {
            nm.notify(notifId, builder.build());
        } catch (SecurityException ignored) {}
    }
}
