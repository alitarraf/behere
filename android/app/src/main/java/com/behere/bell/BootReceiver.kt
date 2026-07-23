package com.behere.bell

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Alarms don't survive a reboot. Re-arm the stored bell (if still in the
 * future) and kick a fresh sync.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        val ts = Prefs.nextTs(ctx)
        if (ts > System.currentTimeMillis()) {
            AlarmScheduler.schedule(ctx, ts, Prefs.nextMode(ctx), Prefs.nextText(ctx))
        }
        SyncWorker.schedulePeriodic(ctx)
        SyncWorker.syncNow(ctx)
    }
}
