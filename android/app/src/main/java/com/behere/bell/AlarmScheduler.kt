package com.behere.bell

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import org.json.JSONArray

data class Bell(val ts: Long, val mode: String, val text: String?)

/**
 * Arms the buffered bells as doze-exempt exact alarms (setAlarmClock — the class
 * alarm clocks use). Each bell is an independent local alarm carrying its own
 * manifestation, so the whole buffer fires with no network — the phone stays
 * covered for the server's buffer window (~2 days) even fully offline.
 */
object AlarmScheduler {
    private const val REQ_TEST = 1001    // one-off debug/test bell
    private const val REQ_SHOW = 1002
    private const val BASE = 3000        // buffered bells occupy slots BASE..BASE+MAX-1
    private const val MAX = 48

    fun parse(json: String): List<Bell> {
        val arr = JSONArray(json)
        val out = ArrayList<Bell>(arr.length())
        for (i in 0 until arr.length()) {
            val o = arr.getJSONObject(i)
            out.add(Bell(o.getLong("ts"), o.optString("mode", "buzz"),
                if (o.has("text")) o.getString("text") else null))
        }
        return out
    }

    /** Re-arm the full buffer: cancel every slot, then arm each future bell. */
    fun armBuffer(ctx: Context, bells: List<Bell>) {
        val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
            Log.w("behere", "no exact-alarm permission; skipping arm")
            return
        }

        for (i in 0 until MAX) {
            PendingIntent.getBroadcast(
                ctx, BASE + i, Intent(ctx, BellAlarmReceiver::class.java),
                PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
            )?.let { am.cancel(it); it.cancel() }
        }

        val now = System.currentTimeMillis()
        val future = bells.filter { it.ts > now }.sortedBy { it.ts }.take(MAX)
        val showPi = PendingIntent.getActivity(
            ctx, REQ_SHOW, Intent(ctx, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        future.forEachIndexed { i, b ->
            val fire = Intent(ctx, BellAlarmReceiver::class.java).apply {
                putExtra("ts", b.ts)
                putExtra("mode", b.mode)
                putExtra("text", b.text ?: "")
            }
            val firePi = PendingIntent.getBroadcast(
                ctx, BASE + i, fire,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            am.setAlarmClock(AlarmManager.AlarmClockInfo(b.ts, showPi), firePi)
        }
        Log.i("behere", "armed ${future.size} bells (buffer)")
    }

    /** One-off bell (debug/test button) — kept out of the buffer's slot range. */
    fun schedule(ctx: Context, ts: Long, mode: String, text: String?) {
        val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) return
        val fire = Intent(ctx, BellAlarmReceiver::class.java).apply {
            putExtra("ts", ts); putExtra("mode", mode); putExtra("text", text ?: "")
        }
        val firePi = PendingIntent.getBroadcast(
            ctx, REQ_TEST, fire,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val showPi = PendingIntent.getActivity(
            ctx, REQ_SHOW, Intent(ctx, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        am.setAlarmClock(AlarmManager.AlarmClockInfo(ts, showPi), firePi)
        Log.i("behere", "test bell armed: $mode @ $ts")
    }
}
