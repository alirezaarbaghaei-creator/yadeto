package com.yadeto.app;

import android.app.KeyguardManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;

import java.util.Calendar;
import java.util.Locale;

public class YadetoAlarmActivity extends AppCompatActivity {

    public static final String ACTION_CLOSE_ALARM_UI = "com.yadeto.app.ACTION_CLOSE_ALARM_UI";

    private final BroadcastReceiver closeReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            finish();
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (km != null) {
                km.requestDismissKeyguard(this, null);
            }
        } else {
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                    | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                    | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
            );
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        setContentView(R.layout.activity_yadeto_alarm);

        IntentFilter filter = new IntentFilter(ACTION_CLOSE_ALARM_UI);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.registerReceiver(this, closeReceiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(closeReceiver, filter);
        }

        bindIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        bindIntent(intent);
    }

    private void bindIntent(Intent intent) {
        String title = intent != null ? intent.getStringExtra("title") : null;
        String body = intent != null ? intent.getStringExtra("body") : null;

        TextView timeView = findViewById(R.id.alarm_clock_time);
        TextView titleView = findViewById(R.id.alarm_title);
        TextView bodyView = findViewById(R.id.alarm_body);
        Button stopBtn = findViewById(R.id.btn_alarm_stop);
        Button snoozeBtn = findViewById(R.id.btn_alarm_snooze);

        Calendar cal = Calendar.getInstance();
        String hhmm = String.format(
            Locale.US,
            "%02d:%02d",
            cal.get(Calendar.HOUR_OF_DAY),
            cal.get(Calendar.MINUTE)
        );
        timeView.setText(YadetoStatusHelper.toFaDigits(hhmm));
        titleView.setText((title != null && !title.trim().isEmpty()) ? title : "یادآوری برنامه یادتو");
        bodyView.setText((body != null && !body.trim().isEmpty()) ? body : "زمان برنامه شما فرا رسیده است");

        int alarmId = intent != null ? intent.getIntExtra("alarmId", 1001) : 1001;
        int notifId = intent != null ? intent.getIntExtra("notifId", alarmId + 2000) : (alarmId + 2000);

        stopBtn.setOnClickListener(v -> {
            Intent stopIntent = new Intent(this, YadetoAlarmActionReceiver.class);
            stopIntent.setAction(YadetoAlarmActionReceiver.ACTION_STOP_ALARM);
            stopIntent.putExtra("alarmId", alarmId);
            stopIntent.putExtra("notifId", notifId);
            sendBroadcast(stopIntent);
            finish();
        });

        snoozeBtn.setOnClickListener(v -> {
            Intent snoozeIntent = new Intent(this, YadetoAlarmActionReceiver.class);
            snoozeIntent.setAction(YadetoAlarmActionReceiver.ACTION_SNOOZE_ALARM);
            snoozeIntent.putExtra("alarmId", alarmId);
            snoozeIntent.putExtra("notifId", notifId);
            snoozeIntent.putExtra("title", title);
            snoozeIntent.putExtra("body", body);
            sendBroadcast(snoozeIntent);
            finish();
        });
    }

    @Override
    protected void onDestroy() {
        try {
            unregisterReceiver(closeReceiver);
        } catch (Exception ignored) {}
        super.onDestroy();
    }
}
