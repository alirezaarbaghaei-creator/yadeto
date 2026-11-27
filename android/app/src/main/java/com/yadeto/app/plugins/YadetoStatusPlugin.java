package com.yadeto.app.plugins;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.yadeto.app.YadetoAlarmActionReceiver;
import com.yadeto.app.YadetoAlarmService;
import com.yadeto.app.YadetoAlarmSoundPlayer;
import com.yadeto.app.YadetoStatusHelper;

import org.json.JSONArray;

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
        String itemId = call.getString("itemId", "");
        String kind = call.getString("kind", "event");

        YadetoStatusHelper.scheduleExactAlarm(
            getContext(),
            alarmId,
            title,
            body,
            triggerAtMs,
            soundId,
            vibrate,
            itemId,
            kind
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
        YadetoAlarmSoundPlayer.stop(getContext());
        try {
            Intent stopIntent = new Intent(getContext(), YadetoAlarmService.class);
            stopIntent.setAction(YadetoAlarmService.ACTION_STOP);
            getContext().stopService(stopIntent);
        } catch (Exception ignored) {}
        call.resolve();
    }

    @PluginMethod
    public void consumeCompletedTasks(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(
            YadetoAlarmActionReceiver.COMPLETED_PREFS,
            Context.MODE_PRIVATE
        );
        String raw = prefs.getString(YadetoAlarmActionReceiver.KEY_COMPLETED_IDS, "[]");
        prefs.edit().putString(YadetoAlarmActionReceiver.KEY_COMPLETED_IDS, "[]").apply();

        JSObject ret = new JSObject();
        try {
            JSONArray parsed = new JSONArray(raw);
            JSArray out = new JSArray();
            for (int i = 0; i < parsed.length(); i++) {
                out.put(parsed.getString(i));
            }
            ret.put("ids", out);
        } catch (Exception e) {
            ret.put("ids", new JSArray());
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void checkAlarmPermissions(PluginCall call) {
        Context ctx = getContext();
        String pkg = ctx.getPackageName();

        boolean notifications = NotificationManagerCompat.from(ctx).areNotificationsEnabled();

        boolean exactAlarm = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            exactAlarm = am != null && am.canScheduleExactAlarms();
        }

        boolean batteryIgnored = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
            batteryIgnored = pm != null && pm.isIgnoringBatteryOptimizations(pkg);
        }

        boolean fullScreenIntent = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            fullScreenIntent = nm != null && nm.canUseFullScreenIntent();
        }

        JSObject ret = new JSObject();
        ret.put("notifications", notifications);
        ret.put("exactAlarm", exactAlarm);
        ret.put("batteryIgnored", batteryIgnored);
        ret.put("fullScreenIntent", fullScreenIntent);
        ret.put("allGranted", notifications && exactAlarm && batteryIgnored && fullScreenIntent);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestAlarmPermission(PluginCall call) {
        String type = call.getString("type", "battery");
        Context ctx = getContext();
        String pkg = ctx.getPackageName();
        Intent intent = null;

        try {
            if ("battery".equals(type) && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(Uri.parse("package:" + pkg));
            } else if ("exactAlarm".equals(type) && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                intent.setData(Uri.parse("package:" + pkg));
            } else if ("fullScreenIntent".equals(type) && Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                intent = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT);
                intent.setData(Uri.parse("package:" + pkg));
            } else if ("notifications".equals(type) && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                intent.putExtra(Settings.EXTRA_APP_PACKAGE, pkg);
            }

            if (intent == null) {
                intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.parse("package:" + pkg));
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            try {
                Intent fallback = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                fallback.setData(Uri.parse("package:" + pkg));
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(fallback);
                call.resolve();
            } catch (Exception e2) {
                call.reject("Cannot open permission settings", e2);
            }
        }
    }
}
