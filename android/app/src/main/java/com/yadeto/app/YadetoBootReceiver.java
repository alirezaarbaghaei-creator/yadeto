package com.yadeto.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class YadetoBootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            YadetoStatusHelper.showOrCancelOngoingNotification(context);
            YadetoStatusHelper.updateAllWidgets(context);
        }
    }
}
