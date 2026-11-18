package com.yadeto.app.plugins;

import android.content.Intent;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.yadeto.app.YadetoAlarmService;
import com.yadeto.app.YadetoStatusHelper;

@CapacitorPlugin(name = "YadetoStatus")
public class YadetoStatusPlugin extends Plugin {

    @PluginMethod
    public void updateStatus(PluginCall call) {
        String dateLabel = call.getString("dateLabel", "Yadeto");
        String summaryLine = call.getString("summaryLine", "");
        String detailsText = call.getString("detailsText", "");
        boolean stickyEnabled = Boolean.TRUE.equals(call.getBoolean("stickyEnabled", true));

        YadetoStatusHelper.saveStatus(getContext(), dateLabel, summaryLine, detailsText, stickyEnabled);
        YadetoStatusHelper.showOrCancelOngoingNotification(getContext());
        YadetoStatusHelper.updateAllWidgets(getContext());

        call.resolve();
    }

    @PluginMethod
    public void saveAlarmPrefs(PluginCall call) {
        String soundId = call.getString("soundId", "classic");
        boolean vibrate = Boolean.TRUE.equals(call.getBoolean("vibrate", true));
        YadetoStatusHelper.saveAlarmPrefs(getContext(), soundId, vibrate);
        call.resolve();
    }

    @PluginMethod
    public void scheduleAlarm(PluginCall call) {
        int alarmId = call.getInt("alarmId", 1001);
        String title = call.getString("title", "آلارم یادتو");
        String body = call.getString("body", "زمان برنامه شما رسید");
        Double triggerDouble = call.getDouble("triggerAtMs");
        long triggerAtMs = triggerDouble != null ? triggerDouble.longValue() : 0L;
        String soundId = call.getString("soundId", "classic");
        boolean vibrate = Boolean.TRUE.equals(call.getBoolean("vibrate", true));

        YadetoStatusHelper.scheduleExactAlarm(
            getContext(),
            alarmId,
            title,
            body,
            triggerAtMs,
            soundId,
            vibrate
        );
        call.resolve();
    }

    @PluginMethod
    public void cancelAlarm(PluginCall call) {
        int alarmId = call.getInt("alarmId", 1001);
        YadetoStatusHelper.cancelScheduledAlarm(getContext(), alarmId);
        call.resolve();
    }

    @PluginMethod
    public void stopActiveAlarm(PluginCall call) {
        Intent stopIntent = new Intent(getContext(), YadetoAlarmService.class);
        stopIntent.setAction(YadetoAlarmService.ACTION_STOP);
        getContext().startService(stopIntent);
        call.resolve();
    }
}
