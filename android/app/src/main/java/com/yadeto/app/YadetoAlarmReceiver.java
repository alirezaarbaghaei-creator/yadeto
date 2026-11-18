package com.yadeto.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import androidx.core.content.ContextCompat;

public class YadetoAlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
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
