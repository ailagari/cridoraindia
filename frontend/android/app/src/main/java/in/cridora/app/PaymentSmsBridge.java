package in.cridora.app;

import android.util.Log;
import java.lang.ref.WeakReference;
import org.json.JSONObject;

/** Routes payment SMS to the active WebView while a fractional UPI order is open. */
public final class PaymentSmsBridge {
    private static final String TAG = "PaymentSmsBridge";

    private static int activeOrderId = -1;
    private static WeakReference<MainActivity> activityRef = new WeakReference<>(null);

    private PaymentSmsBridge() {}

    public static void attachActivity(MainActivity activity) {
        activityRef = new WeakReference<>(activity);
    }

    public static void detachActivity(MainActivity activity) {
        MainActivity current = activityRef.get();
        if (current == activity) {
            activityRef = new WeakReference<>(null);
        }
        if (activeOrderId >= 0) {
            stopListening();
        }
    }

    public static void startListening(int orderId) {
        activeOrderId = orderId;
        MainActivity activity = activityRef.get();
        if (activity != null) {
            activity.registerPaymentSmsReceiver();
        }
    }

    public static void stopListening() {
        activeOrderId = -1;
        MainActivity activity = activityRef.get();
        if (activity != null) {
            activity.unregisterPaymentSmsReceiver();
        }
    }

    public static int getActiveOrderId() {
        return activeOrderId;
    }

    public static boolean isListening() {
        return activeOrderId >= 0;
    }

    public static boolean isPaymentSms(String body) {
        if (body == null || body.isEmpty()) {
            return false;
        }
        String lower = body.toLowerCase();
        return lower.contains("upi")
            || lower.contains("debited")
            || lower.contains("credited")
            || lower.contains("rs.")
            || lower.contains("rs ")
            || lower.contains("inr")
            || lower.contains("ref no")
            || lower.contains("upi ref");
    }

    public static void deliverSms(String body) {
        if (!isListening() || body == null || body.isEmpty()) {
            return;
        }
        if (!isPaymentSms(body)) {
            return;
        }
        MainActivity activity = activityRef.get();
        if (activity == null) {
            Log.w(TAG, "SMS received but MainActivity not attached");
            return;
        }
        final int orderId = activeOrderId;
        final String text = body.trim();
        activity.runOnUiThread(() -> activity.dispatchPaymentSmsToWeb(orderId, text));
    }

    static String buildDispatchJs(int orderId, String smsText) {
        return "window.dispatchEvent(new CustomEvent('cridora-payment-sms',{detail:{orderId:"
            + orderId
            + ",smsText:"
            + JSONObject.quote(smsText)
            + "}}));";
    }
}
