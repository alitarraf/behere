package com.behere.bell

import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log

/**
 * The fire-time trigger. When the exact alarm goes off, raise a full-screen
 * notification that launches MainActivity over the lock screen — the takeover —
 * and kick a sync to line up the following bell.
 */
class BellAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        val ts = intent.getLongExtra("ts", System.currentTimeMillis())
        val mode = intent.getStringExtra("mode") ?: "buzz"
        val text = intent.getStringExtra("text") ?: ""
        Log.i("behere", "bell fired: $mode")

        val bellUri = Uri.parse(BuildConfig.BELL_BASE_URL).buildUpon()
            .appendQueryParameter("bell", ts.toString())
            .appendQueryParameter("mode", mode)
            .apply { if (text.isNotEmpty()) appendQueryParameter("t", text) }
            .build()

        val open = Intent(ctx, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("url", bellUri.toString())
        }
        val fullScreenPi = PendingIntent.getActivity(
            ctx, 2001, open,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val n = Notification.Builder(ctx, BellApp.CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_bell)
            .setContentTitle("be here now")
            .apply { if (mode == "line" && text.isNotEmpty()) setContentText(text) }
            .setCategory(Notification.CATEGORY_ALARM)
            .setPriority(Notification.PRIORITY_MAX)
            .setAutoCancel(true)
            .setOngoing(false)
            .setFullScreenIntent(fullScreenPi, true)
            .setContentIntent(fullScreenPi)
            .setVibrate(longArrayOf(0, 150, 80, 150))
            .build()

        val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(1, n)

        vibrate(ctx)

        // Line up the bell after this one.
        SyncWorker.syncNow(ctx)
    }

    private fun vibrate(ctx: Context) {
        val vib = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            (ctx.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            ctx.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }
        val pattern = longArrayOf(0, 150, 80, 150)
        vib.vibrate(VibrationEffect.createWaveform(pattern, -1))
    }
}
