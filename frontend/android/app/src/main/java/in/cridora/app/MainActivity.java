package in.cridora.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String CHANNEL_ID = "cridora-alerts";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        createAlertsChannel();
        super.onCreate(savedInstanceState);
    }

    private void createAlertsChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Cridora alerts",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Gold rate alerts, broadcasts, and account updates");
        channel.enableVibration(true);
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) {
            manager.createNotificationChannel(channel);
        }
    }
}
