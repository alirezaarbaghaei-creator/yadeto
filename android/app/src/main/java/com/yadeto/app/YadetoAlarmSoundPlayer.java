package com.yadeto.app;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioTrack;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;

/**
 * Reliable alarm sound + vibration player with AudioTrack synthesizer fallback
 * so alarms ring loudly even on emulators with no system ringtone files.
 */
public final class YadetoAlarmSoundPlayer {

    private static Ringtone activeRingtone;
    private static Vibrator activeVibrator;
    private static volatile boolean playingTone = false;
    private static Thread toneThread;

    private YadetoAlarmSoundPlayer() {}

    public static synchronized void start(Context context, boolean vibrate) {
        stop(context);

        boolean startedRingtone = false;
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
                    startedRingtone = true;
                }
            }
        } catch (Exception ignored) {}

        // Fallback synthesized alarm tone (works even on AOSP emulators without ringtones)
        if (!startedRingtone) {
            startSynthesizedAlarm();
        }

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

    private static void startSynthesizedAlarm() {
        playingTone = true;
        toneThread = new Thread(() -> {
            int sampleRate = 22050;
            int samplesPerHalfSec = sampleRate / 2;
            short[] buffer = new short[samplesPerHalfSec];
            for (int i = 0; i < samplesPerHalfSec; i++) {
                double freq = (i < samplesPerHalfSec / 2) ? 880.0 : 660.0;
                double angle = 2.0 * Math.PI * i * freq / sampleRate;
                buffer[i] = (short) (Math.sin(angle) * 20000);
            }

            AudioTrack track = null;
            try {
                track = new AudioTrack(
                    new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build(),
                    new AudioFormat.Builder()
                        .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                        .setSampleRate(sampleRate)
                        .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                        .build(),
                    buffer.length * 2,
                    AudioTrack.MODE_STREAM,
                    AudioManager.AUDIO_SESSION_ID_GENERATE
                );
                track.play();
                while (playingTone) {
                    track.write(buffer, 0, buffer.length);
                    Thread.sleep(250);
                }
            } catch (Exception ignored) {
            } finally {
                if (track != null) {
                    try {
                        track.stop();
                        track.release();
                    } catch (Exception ignored) {}
                }
            }
        });
        toneThread.start();
    }

    public static synchronized void stop(Context context) {
        playingTone = false;
        if (toneThread != null) {
            toneThread.interrupt();
            toneThread = null;
        }
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
