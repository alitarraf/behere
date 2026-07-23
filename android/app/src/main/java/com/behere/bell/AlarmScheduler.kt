package com.behere.bell

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

/**
 * Schedules the single upcoming bell as a doze-exempt exact alarm
 * (setAlarmClock — the same class alarm clocks use). No push is involved at
 * fire time; the manifestation was handed to us ahead of time and travels in
 * the alarm's PendingIntent.
 */
object AlarmScheduler {
    private const val REQ_ALARM = 1001
    private const val REQ_SHOW = 1002

    fun schedule(ctx: Context, ts: Long, mode: String, text: String?) {
        val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
            Log.w("behere", "no exact-alarm permission; skipping schedule")
            return
        }

        val fire = Intent(ctx, BellAlarmReceiver::class.java).apply {
            putExtra("ts", ts)
            putExtra("mode", mode)
            putExtra("text", text ?: "")
        }
        val firePi = PendingIntent.getBroadcast(
            ctx, REQ_ALARM, fire,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Tapping the pending-alarm chip just opens the app.
        val showPi = PendingIntent.getActivity(
            ctx, REQ_SHOW, Intent(ctx, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        am.setAlarmClock(AlarmManager.AlarmClockInfo(ts, showPi), firePi)
        Log.i("behere", "bell armed: $mode @ $ts")
    }
}
