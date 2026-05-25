package in.cridora.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.provider.Telephony;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String CHANNEL_ID = "cridora-alerts";
    private static final String JS_BRIDGE_NAME = "CridoraPaymentSms";
    private static final String UPI_JS_BRIDGE_NAME = "CridoraUpiPay";

    private final PaymentSmsReceiver paymentSmsReceiver = new PaymentSmsReceiver();
    private boolean paymentSmsReceiverRegistered = false;
    private boolean jsBridgeRegistered = false;
    private int pendingSmsOrderId = -1;

    private final ActivityResultLauncher<String> smsPermissionLauncher =
        registerForActivityResult(
            new ActivityResultContracts.RequestPermission(),
            granted -> {
                if (granted && pendingSmsOrderId > 0) {
                    PaymentSmsBridge.startListening(pendingSmsOrderId);
                }
                pendingSmsOrderId = -1;
            }
        );

    @Override
    public void onCreate(Bundle savedInstanceState) {
        createAlertsChannel();
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onResume() {
        super.onResume();
        PaymentSmsBridge.attachActivity(this);
        registerJsBridgeWhenReady();
    }

    @Override
    public void onPause() {
        PaymentSmsBridge.detachActivity(this);
        unregisterPaymentSmsReceiver();
        super.onPause();
    }

    public boolean hasReceiveSmsPermission() {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.RECEIVE_SMS)
            == PackageManager.PERMISSION_GRANTED;
    }

    public void requestReceiveSmsPermission(int orderId) {
        pendingSmsOrderId = orderId;
        if (hasReceiveSmsPermission()) {
            PaymentSmsBridge.startListening(orderId);
            pendingSmsOrderId = -1;
            return;
        }
        smsPermissionLauncher.launch(Manifest.permission.RECEIVE_SMS);
    }

    public void registerPaymentSmsReceiver() {
        if (paymentSmsReceiverRegistered || !hasReceiveSmsPermission()) {
            return;
        }
        IntentFilter filter = new IntentFilter(Telephony.Sms.Intents.SMS_RECEIVED_ACTION);
        filter.setPriority(IntentFilter.SYSTEM_HIGH_PRIORITY);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                registerReceiver(
                    paymentSmsReceiver,
                    filter,
                    Manifest.permission.RECEIVE_SMS,
                    null,
                    RECEIVER_NOT_EXPORTED
                );
            } else {
                registerReceiver(paymentSmsReceiver, filter, Manifest.permission.RECEIVE_SMS, null);
            }
            paymentSmsReceiverRegistered = true;
        } catch (Exception ignored) {
            paymentSmsReceiverRegistered = false;
        }
    }

    public void unregisterPaymentSmsReceiver() {
        if (!paymentSmsReceiverRegistered) {
            return;
        }
        try {
            unregisterReceiver(paymentSmsReceiver);
        } catch (Exception ignored) {
            // already unregistered
        }
        paymentSmsReceiverRegistered = false;
    }

    public void dispatchPaymentSmsToWeb(int orderId, String smsText) {
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView == null) {
            return;
        }
        String js = PaymentSmsBridge.buildDispatchJs(orderId, smsText);
        webView.evaluateJavascript(js, null);
    }

    @SuppressLint("JavascriptInterface")
    private void registerJsBridgeWhenReady() {
        if (jsBridgeRegistered) {
            return;
        }
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView == null) {
            getWindow().getDecorView().postDelayed(this::registerJsBridgeWhenReady, 150);
            return;
        }
        webView.addJavascriptInterface(new PaymentSmsJsBridge(this), JS_BRIDGE_NAME);
        webView.addJavascriptInterface(new UpiPayJsBridge(this), UPI_JS_BRIDGE_NAME);
        jsBridgeRegistered = true;
    }

    private void createAlertsChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }
        NotificationChannel channel =
            new NotificationChannel(CHANNEL_ID, "Cridora alerts", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Gold rate alerts, broadcasts, and account updates");
        channel.enableVibration(true);
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) {
            manager.createNotificationChannel(channel);
        }
    }

    /** JS bridge: start/stop listening and request SMS permission. */
    public static final class PaymentSmsJsBridge {
        private final MainActivity activity;

        PaymentSmsJsBridge(MainActivity activity) {
            this.activity = activity;
        }

        @JavascriptInterface
        public boolean hasPermission() {
            return activity.hasReceiveSmsPermission();
        }

        @JavascriptInterface
        public void requestPermission(int orderId) {
            activity.runOnUiThread(() -> activity.requestReceiveSmsPermission(orderId));
        }

        @JavascriptInterface
        public void start(int orderId) {
            activity.runOnUiThread(() -> activity.requestReceiveSmsPermission(orderId));
        }

        @JavascriptInterface
        public void stop() {
            activity.runOnUiThread(PaymentSmsBridge::stopListening);
        }
    }

    /** JS bridge: open UPI pay URI in external PSP app via native Android intent. */
    public static final class UpiPayJsBridge {
        private final MainActivity activity;

        UpiPayJsBridge(MainActivity activity) {
            this.activity = activity;
        }

        @JavascriptInterface
        public boolean open(String uri) {
            final String payUri = uri != null ? uri.trim() : "";
            if (payUri.isEmpty()) {
                return false;
            }
            activity.runOnUiThread(() -> UpiPayBridge.launchUpiPay(activity, payUri));
            return true;
        }
    }
}
