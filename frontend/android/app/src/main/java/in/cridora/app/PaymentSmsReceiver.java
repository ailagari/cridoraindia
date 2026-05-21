package in.cridora.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.provider.Telephony;
import android.telephony.SmsMessage;

/** Receives bank debit SMS while payment listening is active (registered dynamically). */
public class PaymentSmsReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (!PaymentSmsBridge.isListening() || intent == null) {
            return;
        }
        String action = intent.getAction();
        if (!Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(action)
            && !"android.provider.Telephony.SMS_RECEIVED".equals(action)) {
            return;
        }
        Bundle bundle = intent.getExtras();
        if (bundle == null) {
            return;
        }
        StringBuilder body = new StringBuilder();
        Object[] pdus = (Object[]) bundle.get("pdus");
        if (pdus == null) {
            return;
        }
        for (Object pdu : pdus) {
            SmsMessage msg;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                String format = bundle.getString("format");
                msg = SmsMessage.createFromPdu((byte[]) pdu, format);
            } else {
                msg = SmsMessage.createFromPdu((byte[]) pdu);
            }
            if (msg != null && msg.getMessageBody() != null) {
                body.append(msg.getMessageBody());
            }
        }
        PaymentSmsBridge.deliverSms(body.toString());
    }
}
