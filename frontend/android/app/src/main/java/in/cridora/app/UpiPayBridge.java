package in.cridora.app;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;

/** Launch external UPI apps via Android ACTION_VIEW (required for WebView handoff). */
public final class UpiPayBridge {
    private UpiPayBridge() {}

    public static boolean launchUpiPay(MainActivity activity, String uri) {
        if (activity == null || uri == null || uri.isEmpty() || !uri.startsWith("upi://")) {
            return false;
        }
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(uri));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            activity.startActivity(intent);
            return true;
        } catch (ActivityNotFoundException ignored) {
            return false;
        }
    }
}
