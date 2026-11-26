package com.yadeto.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

public class YadetoAlarmReceiver extends BroadcastReceiver {
    private static final String FALLBACK_CHANNEL_ID = "yadeto_alarm_fallback";

    @Override
    public void onReceive(Context context, Intent intent) {
        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            @SuppressWarnings("deprecation")
            PowerManager.WakeLock wl = pm.newWakeLock(
                PowerManager.FULL_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP | PowerManager.ON_AFTER_RELEASE,
                "yadeto:alarm_receiver_wakelock"
            );
            wl.acquire(15_000L);
        }

        int alarmId = intent.getIntExtra("alarmId", 1001);
        String title = intent.getStringExtra("title");
        String body = intent.getStringExtra("body");
        String soundId = intent.getStringExtra("soundId");
        boolean vibrate = intent.getBooleanExtra("vibrate", true);

        Intent serviceIntent = new Intent(context, YadetoAlarmService.class);
        serviceIntent.setAction(YadetoAlarmService.ACTION_START);
        serviceIntent.putExtra("alarmId", alarmId);
        serviceIntent.putExtra("title", title);
        serviceIntent.putExtra("body", body);
        serviceIntent.putExtra("soundId", soundId);
        serviceIntent.putExtra("vibrate", vibrate);

        try {
            ContextCompat.startForegroundService(context, serviceIntent);
        } catch (Exception e) {
            // Fallback if OEM/OS blocks background foreground-service launch
            showFallbackAlarmNotification(context, alarmId, title, body);
        }
    }

    private void showFallbackAlarmNotification(Context context, int alarmId, String title, String body) {
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        Uri alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (alarmUri == null) {
            alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                FALLBACK_CHANNEL_ID,
                "آلارم‌های یادتو",
                NotificationManager.IMPORTANCE_HIGH
            );
            AudioAttributes attrs = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
            ch.setSound(alarmUri, attrs);
            ch.enableVibration(true);
            ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            nm.createNotificationChannel(ch);
        }

        Intent openIntent = new Intent(context, YadetoAlarmActivity.class);
        openIntent.putExtra("alarmId", alarmId);
        openIntent.putExtra("title", title);
        openIntent.putExtra("body", body);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openPending = PendingIntent.getActivity(
            context,
            alarmId + 1000,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification notif = new NotificationCompat.Builder(context, FALLBACK_CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle((title != null && !title.isEmpty()) ? title : "آلارم یادتو")
            .setContentText((body != null && !body.isEmpty()) ? body : "زمان برنامه شما فرا رسیده است")
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setSound(alarmUri)
            .setAutoCancel(true)
            .setContentIntent(openPending)
            .setFullScreenIntent(openPending, true)
            .build();

        try {
            nm.notify(alarmId + 2000, notif);
        } catch (SecurityException ignored) {}
    }
}
