package com.yadeto.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.PowerManager;

import androidx.core.content.ContextCompat;

public class YadetoAlarmReceiver extends BroadcastReceiver {
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

        Intent serviceIntent = new Intent(context, YadetoAlarmService.class);
        serviceIntent.setAction(YadetoAlarmService.ACTION_START);
        serviceIntent.putExtra("alarmId", intent.getIntExtra("alarmId", 1001));
        serviceIntent.putExtra("title", intent.getStringExtra("title"));
        serviceIntent.putExtra("body", intent.getStringExtra("body"));
        serviceIntent.putExtra("soundId", intent.getStringExtra("soundId"));
        serviceIntent.putExtra("vibrate", intent.getBooleanExtra("vibrate", true));
        ContextCompat.startForegroundService(context, serviceIntent);
    }
}
