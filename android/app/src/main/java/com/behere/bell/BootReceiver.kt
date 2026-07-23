package com.behere.bell

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Alarms don't survive a reboot. Re-arm the whole buffered set from the last
 * synced list (works offline), then kick a fresh sync to top it up.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        val raw = Prefs.getBuffer(ctx)
        if (raw.isNotBlank()) {
            try { AlarmScheduler.armBuffer(ctx, AlarmScheduler.parse(raw)) }
            catch (e: Exception) { Log.w("behere", "boot re-arm failed: ${e.message}") }
        }
        SyncWorker.schedulePeriodic(ctx)
        SyncWorker.syncNow(ctx)
    }
}
