package com.yadeto.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class YadetoBootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent != null ? intent.getAction() : null;
        if (Intent.ACTION_BOOT_COMPLETED.equals(action)
                || Intent.ACTION_DATE_CHANGED.equals(action)
                || Intent.ACTION_TIMEZONE_CHANGED.equals(action)
                || Intent.ACTION_TIME_SET.equals(action)) {
            YadetoStatusHelper.showOrCancelOngoingNotification(context);
            YadetoStatusHelper.updateAllWidgets(context);
            if (Intent.ACTION_BOOT_COMPLETED.equals(action) || Intent.ACTION_TIME_SET.equals(action)) {
                YadetoStatusHelper.rescheduleAllPersistedAlarms(context);
            }
        }
    }
}
