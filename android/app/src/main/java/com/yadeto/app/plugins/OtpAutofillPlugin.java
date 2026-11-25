package com.yadeto.app.plugins;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.phone.SmsRetriever;
import com.google.android.gms.common.api.CommonStatusCodes;
import com.google.android.gms.common.api.Status;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Exposes zero-permission OTP autofill to JS using Google's SMS User Consent API.
 * Works with any SMS format (no app hash required on the SMS server) and requires
 * zero runtime SMS or Notification permissions.
 */
@CapacitorPlugin(name = "SmsAutofill")
public class OtpAutofillPlugin extends Plugin {

    private static final String TAG = "yadetoSmsAutofill";
    private static final String EVENT_CODE = "code";
    private static final Pattern CODE_PATTERN = Pattern.compile("(?<!\\d)(\\d{4,8})(?!\\d)");

    private BroadcastReceiver smsReceiver;
    private ActivityResultLauncher<Intent> consentLauncher;
    private boolean active = false;

    @Override
    public void load() {
        super.load();
        consentLauncher = getActivity().registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            result -> {
                if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
                    String message = result.getData().getStringExtra(SmsRetriever.EXTRA_SMS_MESSAGE);
                    String code = extractCode(message);
                    if (code != null) {
                        JSObject data = new JSObject();
                        data.put("code", code);
                        notifyListeners(EVENT_CODE, data);
                    }
                }
            }
        );
    }

    @PluginMethod
    public void isEnabled(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("enabled", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        call.resolve();
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (active) {
            JSObject ret = new JSObject();
            ret.put("listening", true);
            ret.put("enabled", true);
            call.resolve(ret);
            return;
        }

        try {
            registerSmsReceiver();
            SmsRetriever.getClient(getContext())
                .startSmsUserConsent(null)
                .addOnSuccessListener(aVoid -> Log.d(TAG, "Google SMS User Consent started"))
                .addOnFailureListener(e -> Log.w(TAG, "Google SMS User Consent failed to start", e));

            active = true;

            JSObject ret = new JSObject();
            ret.put("listening", true);
            ret.put("enabled", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.w(TAG, "start error", e);
            JSObject ret = new JSObject();
            ret.put("listening", false);
            ret.put("enabled", true);
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        unregisterSmsReceiver();
        active = false;
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        unregisterSmsReceiver();
        active = false;
        super.handleOnDestroy();
    }

    private void registerSmsReceiver() {
        if (smsReceiver != null) return;
        smsReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (!SmsRetriever.SMS_RETRIEVED_ACTION.equals(intent.getAction())) return;
                Bundle extras = intent.getExtras();
                if (extras == null) return;
                Status status = (Status) extras.get(SmsRetriever.EXTRA_STATUS);
                if (status == null) return;

                if (status.getStatusCode() == CommonStatusCodes.SUCCESS) {
                    Intent consentIntent = extras.getParcelable(SmsRetriever.EXTRA_CONSENT_INTENT);
                    if (consentIntent != null && consentLauncher != null) {
                        try {
                            consentLauncher.launch(consentIntent);
                        } catch (Exception e) {
                            Log.w(TAG, "Failed to launch SMS consent dialog", e);
                        }
                    } else {
                        String message = extras.getString(SmsRetriever.EXTRA_SMS_MESSAGE);
                        String code = extractCode(message);
                        if (code != null) {
                            JSObject data = new JSObject();
                            data.put("code", code);
                            notifyListeners(EVENT_CODE, data);
                        }
                    }
                }
            }
        };

        IntentFilter filter = new IntentFilter(SmsRetriever.SMS_RETRIEVED_ACTION);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.registerReceiver(
                getContext(),
                smsReceiver,
                filter,
                SmsRetriever.SEND_PERMISSION,
                null,
                ContextCompat.RECEIVER_EXPORTED
            );
        } else {
            getContext().registerReceiver(smsReceiver, filter, SmsRetriever.SEND_PERMISSION, null);
        }
    }

    private void unregisterSmsReceiver() {
        if (smsReceiver != null) {
            try {
                getContext().unregisterReceiver(smsReceiver);
            } catch (Exception ignored) {}
            smsReceiver = null;
        }
    }

    private static String normalizeDigits(String input) {
        if (input == null) return "";
        StringBuilder sb = new StringBuilder(input.length());
        for (int i = 0; i < input.length(); i++) {
            char c = input.charAt(i);
            if (c >= '\u06F0' && c <= '\u06F9') {
                sb.append((char) ('0' + (c - '\u06F0')));
            } else if (c >= '\u0660' && c <= '\u0669') {
                sb.append((char) ('0' + (c - '\u0660')));
            } else {
                sb.append(c);
            }
        }
        return sb.toString();
    }

    private static String extractCode(String text) {
        if (text == null || text.isEmpty()) return null;
        String normalized = normalizeDigits(text);
        Matcher m = CODE_PATTERN.matcher(normalized);
        if (m.find()) {
            return m.group(1);
        }
        return null;
    }
}
