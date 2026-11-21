package com.yadeto.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class YadetoBootReceiver extends BroadcastReceiver {
    public static final String ACTION_TIME_SET_CUSTOM = "android.intent.action.TIME_SET";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent != null ? intent.getAction() : null;
        if (Intent.ACTION_BOOT_COMPLETED.equals(action)
                || Intent.ACTION_DATE_CHANGED.equals(action)
                || Intent.ACTION_TIMEZONE_CHANGED.equals(action)
                || ACTION_TIME_SET_CUSTOM.equals(action)) {
            YadetoStatusHelper.showOrCancelOngoingNotification(context);
            YadetoStatusHelper.updateAllWidgets(context);
            if (Intent.ACTION_BOOT_COMPLETED.equals(action) || ACTION_TIME_SET_CUSTOM.equals(action)) {
                YadetoStatusHelper.rescheduleAllPersistedAlarms(context);
            }
        }
    }
}
