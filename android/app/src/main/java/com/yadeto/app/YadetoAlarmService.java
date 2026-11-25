package com.yadeto.app;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioTrack;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;

import androidx.core.app.NotificationCompat;

public class YadetoAlarmService extends Service {

    public static final String ACTION_START = "com.yadeto.app.ACTION_ALARM_START";
    public static final String ACTION_STOP = "com.yadeto.app.ACTION_ALARM_STOP";
    public static final String ACTION_SNOOZE = "com.yadeto.app.ACTION_ALARM_SNOOZE";

    private static final String CHANNEL_ID = "yadeto_alarm_channel";
    private static final int FOREGROUND_ID = 90999;

    private volatile boolean running = false;
    private Thread audioThread;
    private Vibrator vibrator;
    private PowerManager.WakeLock wakeLock;

    private int currentAlarmId = 1001;
    private String currentTitle = "آلارم یادتو";
    private String currentBody = "زمان برنامه شما رسید";
    private String currentSoundId = "classic";
    private boolean currentVibrate = true;

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : ACTION_START;

        if (ACTION_STOP.equals(action)) {
            stopAlarmPlayback();
            sendBroadcast(new Intent(YadetoAlarmActivity.ACTION_CLOSE_ALARM_UI).setPackage(getPackageName()));
            stopSelf();
            return START_NOT_STICKY;
        }

        if (ACTION_SNOOZE.equals(action)) {
            stopAlarmPlayback();
            sendBroadcast(new Intent(YadetoAlarmActivity.ACTION_CLOSE_ALARM_UI).setPackage(getPackageName()));
            scheduleSnooze(10);
            stopSelf();
            return START_NOT_STICKY;
        }

        SharedPreferences prefs = getSharedPreferences(YadetoStatusHelper.PREFS_NAME, MODE_PRIVATE);
        if (intent != null) {
            currentAlarmId = intent.getIntExtra("alarmId", 1001);
            String t = intent.getStringExtra("title");
            String b = intent.getStringExtra("body");
            String s = intent.getStringExtra("soundId");
            if (t != null && !t.isEmpty()) currentTitle = t;
            if (b != null && !b.isEmpty()) currentBody = b;
            currentSoundId = (s != null && !s.isEmpty())
                ? s
                : prefs.getString(YadetoStatusHelper.KEY_ALARM_SOUND, "classic");
            currentVibrate = intent.getBooleanExtra(
                "vibrate",
                prefs.getBoolean(YadetoStatusHelper.KEY_ALARM_VIBRATE, true)
            );
        }

        Notification notification = buildAlarmNotification();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(FOREGROUND_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(FOREGROUND_ID, notification);
        }

        startAlarmPlayback();

        try {
            Intent alarmUi = new Intent(this, YadetoAlarmActivity.class);
            alarmUi.putExtra("alarmId", currentAlarmId);
            alarmUi.putExtra("title", currentTitle);
            alarmUi.putExtra("body", currentBody);
            alarmUi.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            startActivity(alarmUi);
        } catch (Exception ignored) {
            // On locked screens / Android 10+ background restrictions, setFullScreenIntent handles launching YadetoAlarmActivity
        }

        return START_STICKY;
    }

    private Notification buildAlarmNotification() {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                CHANNEL_ID,
                "آلارم‌های یادتو",
                NotificationManager.IMPORTANCE_HIGH
            );
            ch.setDescription("زنگ و هشدار آلارم کارها و رویدادها");
            ch.enableVibration(false); // Service handles continuous vibration
            ch.setSound(null, null);   // Service handles looping custom alarm sound
            ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            nm.createNotificationChannel(ch);
        }

        Intent openIntent = new Intent(this, YadetoAlarmActivity.class);
        openIntent.putExtra("alarmId", currentAlarmId);
        openIntent.putExtra("title", currentTitle);
        openIntent.putExtra("body", currentBody);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openPending = PendingIntent.getActivity(
            this,
            300,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent stopIntent = new Intent(this, YadetoAlarmService.class);
        stopIntent.setAction(ACTION_STOP);
        PendingIntent stopPending = PendingIntent.getService(
            this,
            301,
            stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent snoozeIntent = new Intent(this, YadetoAlarmService.class);
        snoozeIntent.setAction(ACTION_SNOOZE);
        PendingIntent snoozePending = PendingIntent.getService(
            this,
            302,
            snoozeIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(currentTitle)
            .setContentText(currentBody)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setContentIntent(openPending)
            .setFullScreenIntent(openPending, true)
            .addAction(0, "توقف آلارم", stopPending)
            .addAction(0, "تعویق ۱۰ دقیقه", snoozePending)
            .build();
    }

    private void startAlarmPlayback() {
        stopAlarmPlayback();
        running = true;

        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "yadeto:alarm_wakelock");
            wakeLock.acquire(10 * 60 * 1000L);
        }

        if (currentVibrate) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                VibratorManager vm = (VibratorManager) getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                if (vm != null) vibrator = vm.getDefaultVibrator();
            } else {
                vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            }
            if (vibrator != null && vibrator.hasVibrator()) {
                long[] pattern = new long[] { 0, 500, 300, 500, 500 };
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
                } else {
                    vibrator.vibrate(pattern, 0);
                }
            }
        }

        final String soundId = currentSoundId;
        audioThread = new Thread(() -> playLoop(soundId), "yadeto-alarm-audio");
        audioThread.start();
    }

    private void playLoop(String soundId) {
        final int sampleRate = 22050;
        final double[] freqs;
        final int noteMs;
        final int pauseMs;

        if ("digital".equals(soundId)) {
            freqs = new double[] { 1174.66, 0, 1174.66, 0, 1174.66 };
            noteMs = 110;
            pauseMs = 450;
        } else if ("marimba".equals(soundId)) {
            freqs = new double[] { 523.25, 659.25, 783.99, 1046.5 };
            noteMs = 170;
            pauseMs = 500;
        } else if ("chime".equals(soundId)) {
            freqs = new double[] { 587.33, 783.99, 987.77 };
            noteMs = 260;
            pauseMs = 600;
        } else {
            // classic
            freqs = new double[] { 880.0, 0, 880.0, 0, 880.0 };
            noteMs = 160;
            pauseMs = 550;
        }

        int noteSamples = (sampleRate * noteMs) / 1000;
        int pauseSamples = (sampleRate * pauseMs) / 1000;
        int totalSamples = freqs.length * noteSamples + pauseSamples;
        short[] pcm = new short[totalSamples];

        int idx = 0;
        for (double f : freqs) {
            for (int i = 0; i < noteSamples; i++) {
                if (f <= 0) {
                    pcm[idx++] = 0;
                } else {
                    double env = Math.min(1.0, i / 150.0) * Math.min(1.0, (noteSamples - i) / 250.0);
                    double sample = Math.sin(2.0 * Math.PI * f * i / sampleRate) * env;
                    pcm[idx++] = (short) (sample * 24000);
                }
            }
        }

        AudioTrack track = null;
        try {
            AudioAttributes attrs = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
            AudioFormat fmt = new AudioFormat.Builder()
                .setSampleRate(sampleRate)
                .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                .build();

            int minBuf = AudioTrack.getMinBufferSize(
                sampleRate,
                AudioFormat.CHANNEL_OUT_MONO,
                AudioFormat.ENCODING_PCM_16BIT
            );
            int bufBytes = Math.max(minBuf, pcm.length * 2);

            track = new AudioTrack(attrs, fmt, bufBytes, AudioTrack.MODE_STREAM, AudioManager.AUDIO_SESSION_ID_GENERATE);
            track.play();

            while (running) {
                track.write(pcm, 0, pcm.length);
            }
        } catch (Throwable ignored) {
            // Ignore audio hardware failures
        } finally {
            if (track != null) {
                try {
                    track.stop();
                    track.release();
                } catch (Throwable ignored) {}
            }
        }
    }

    private void stopAlarmPlayback() {
        running = false;
        if (audioThread != null) {
            audioThread.interrupt();
            audioThread = null;
        }
        if (vibrator != null) {
            try {
                vibrator.cancel();
            } catch (Throwable ignored) {}
        }
        if (wakeLock != null && wakeLock.isHeld()) {
            try {
                wakeLock.release();
            } catch (Throwable ignored) {}
        }
    }

    private void scheduleSnooze(int minutes) {
        long triggerAt = System.currentTimeMillis() + minutes * 60_000L;
        YadetoStatusHelper.scheduleExactAlarm(
            this,
            currentAlarmId + 1,
            currentTitle,
            currentBody + " (یادآوری مجدد)",
            triggerAt,
            currentSoundId,
            currentVibrate
        );
    }

    @Override
    public void onDestroy() {
        stopAlarmPlayback();
        super.onDestroy();
    }
}
