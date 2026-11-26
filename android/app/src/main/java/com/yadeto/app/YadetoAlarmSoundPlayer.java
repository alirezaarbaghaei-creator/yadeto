package com.yadeto.app;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;

/**
 * Reliable alarm sound + vibration player that works directly from BroadcastReceiver
 * without needing a background ForegroundService (which Android 12-15 can block).
 */
public final class YadetoAlarmSoundPlayer {

    private static Ringtone activeRingtone;
    private static Vibrator activeVibrator;

    private YadetoAlarmSoundPlayer() {}

    public static synchronized void start(Context context, boolean vibrate) {
        stop(context);

        try {
            Uri uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (uri == null) uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            if (uri == null) uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

            if (uri != null) {
                Ringtone rt = RingtoneManager.getRingtone(context.getApplicationContext(), uri);
                if (rt != null) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                        rt.setAudioAttributes(new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build());
                    } else {
                        rt.setStreamType(AudioManager.STREAM_ALARM);
                    }
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                        rt.setLooping(true);
                    }
                    rt.play();
                    activeRingtone = rt;
                }
            }
        } catch (Exception ignored) {}

        if (vibrate) {
            try {
                Vibrator v;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    VibratorManager vm = (VibratorManager) context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                    v = vm != null ? vm.getDefaultVibrator() : null;
                } else {
                    v = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
                }
                if (v != null && v.hasVibrator()) {
                    long[] pattern = new long[] { 0, 500, 350, 500, 350 };
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        v.vibrate(VibrationEffect.createWaveform(pattern, 0));
                    } else {
                        v.vibrate(pattern, 0);
                    }
                    activeVibrator = v;
                }
            } catch (Exception ignored) {}
        }
    }

    public static synchronized void stop(Context context) {
        if (activeRingtone != null) {
            try {
                if (activeRingtone.isPlaying()) activeRingtone.stop();
            } catch (Exception ignored) {}
            activeRingtone = null;
        }
        if (activeVibrator != null) {
            try {
                activeVibrator.cancel();
            } catch (Exception ignored) {}
            activeVibrator = null;
        }
        try {
            Vibrator v = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null) v.cancel();
        } catch (Exception ignored) {}
    }
}
