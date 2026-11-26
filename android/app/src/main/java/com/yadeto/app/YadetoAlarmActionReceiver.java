package com.yadeto.app;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import org.json.JSONArray;

public class YadetoAlarmActionReceiver extends BroadcastReceiver {

    public static final String ACTION_STOP_ALARM = "com.yadeto.app.ACTION_NOTIF_STOP_ALARM";
    public static final String ACTION_COMPLETE_TASK = "com.yadeto.app.ACTION_NOTIF_COMPLETE_TASK";
    public static final String ACTION_SNOOZE_ALARM = "com.yadeto.app.ACTION_NOTIF_SNOOZE_ALARM";
    public static final String COMPLETED_PREFS = "yadeto_completed_tasks";
    public static final String KEY_COMPLETED_IDS = "ids";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        int alarmId = intent.getIntExtra("alarmId", 1001);
        int notifId = intent.getIntExtra("notifId", alarmId + 2000);

        // Stop native ringtone, vibration, and any foreground service
        YadetoAlarmSoundPlayer.stop(context);
        try {
            Intent stopSvc = new Intent(context, YadetoAlarmService.class);
            stopSvc.setAction(YadetoAlarmService.ACTION_STOP);
            context.stopService(stopSvc);
        } catch (Exception ignored) {}

        // Close full-screen alarm UI if open
        context.sendBroadcast(new Intent(YadetoAlarmActivity.ACTION_CLOSE_ALARM_UI).setPackage(context.getPackageName()));

        // Dismiss notification
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.cancel(notifId);
        }

        if (ACTION_COMPLETE_TASK.equals(action)) {
            String itemId = intent.getStringExtra("itemId");
            if (itemId != null && !itemId.isEmpty()) {
                SharedPreferences prefs = context.getSharedPreferences(COMPLETED_PREFS, Context.MODE_PRIVATE);
                try {
                    JSONArray arr = new JSONArray(prefs.getString(KEY_COMPLETED_IDS, "[]"));
                    arr.put(itemId);
                    prefs.edit().putString(KEY_COMPLETED_IDS, arr.toString()).apply();
                } catch (Exception ignored) {}
            }
        } else if (ACTION_SNOOZE_ALARM.equals(action)) {
            String title = intent.getStringExtra("title");
            String body = intent.getStringExtra("body");
            String soundId = intent.getStringExtra("soundId");
            boolean vibrate = intent.getBooleanExtra("vibrate", true);
            String itemId = intent.getStringExtra("itemId");
            String kind = intent.getStringExtra("kind");
            long triggerAt = System.currentTimeMillis() + 10 * 60_000L;
            YadetoStatusHelper.scheduleExactAlarm(
                context,
                alarmId,
                title != null ? title : "آلارم یادتو",
                body != null ? body : "زمان برنامه شما رسید",
                triggerAt,
                soundId != null ? soundId : "classic",
                vibrate,
                itemId != null ? itemId : "",
                kind != null ? kind : "event"
            );
        }
    }
}
