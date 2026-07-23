package com.behere.bell

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context

class BellApp : Application() {
    override fun onCreate() {
        super.onCreate()
        createChannel()
        SyncWorker.schedulePeriodic(this)   // backstop poll to stay one bell ahead
    }

    private fun createChannel() {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val ch = NotificationChannel(
            CHANNEL_ID, "The bell", NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "A few times a day, at moments no one chooses."
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 150, 80, 150)
            setBypassDnd(false)
        }
        nm.createNotificationChannel(ch)
    }

    companion object {
        const val CHANNEL_ID = "bell"
    }
}
