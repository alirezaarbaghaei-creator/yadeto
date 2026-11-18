package com.yadeto.app.plugins;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
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
}
