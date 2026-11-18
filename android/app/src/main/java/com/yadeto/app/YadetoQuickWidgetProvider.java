package com.yadeto.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

public class YadetoQuickWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        updateWidgets(context, appWidgetManager, appWidgetIds);
    }

    public static void updateWidgets(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        SharedPreferences prefs = context.getSharedPreferences(YadetoStatusHelper.PREFS_NAME, Context.MODE_PRIVATE);
        String dateLabel = prefs.getString(YadetoStatusHelper.KEY_DATE, "Yadeto");
        String summaryLine = prefs.getString(YadetoStatusHelper.KEY_SUMMARY, "باز کردن برنامه");

        Intent intent = new Intent(context, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context,
            202,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        for (int appWidgetId : appWidgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_quick);
            views.setTextViewText(R.id.widget_quick_date, dateLabel);
            views.setTextViewText(R.id.widget_quick_summary, summaryLine);
            views.setOnClickPendingIntent(R.id.widget_quick_root, pendingIntent);
            manager.updateAppWidget(appWidgetId, views);
        }
    }
}
