package com.behere.bell

import android.content.Context
import android.util.Log
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.TimeUnit

/**
 * Fetches the buffered bells from the server (GET /next → a list covering ~2
 * days) and arms a local exact alarm for each. Runs periodically as a backstop
 * and on demand (app open, after a bell fires, on boot). The poll timing is
 * non-critical — the alarms, not the poll, fire the bells — so a missed poll
 * just means the buffer drains a little before the next top-up.
 */
class SyncWorker(ctx: Context, params: WorkerParameters) : Worker(ctx, params) {

    override fun doWork(): Result {
        return try {
            registerOnce()
            val body = httpGet("/next") ?: return Result.retry()
            if (body.isBlank() || body == "null") {
                Log.i("behere", "sync: no bells scheduled")
                return Result.success()
            }
            val bells = AlarmScheduler.parse(body)
            Prefs.saveBuffer(applicationContext, body)   // for boot re-arm
            AlarmScheduler.armBuffer(applicationContext, bells)
            Result.success()
        } catch (e: Exception) {
            Log.w("behere", "sync failed: ${e.message}")
            Result.retry()
        }
    }

    private fun registerOnce() {
        if (Prefs.isRegistered(applicationContext)) return
        try {
            httpPost("/register", """{"kind":"native"}""")
            Prefs.setRegistered(applicationContext)
        } catch (e: Exception) {
            Log.w("behere", "register failed (will retry): ${e.message}")
        }
    }

    private fun httpGet(path: String): String? {
        val c = (URL(BuildConfig.BELL_BASE_URL + path).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 15000
            readTimeout = 15000
        }
        return try {
            if (c.responseCode in 200..299) c.inputStream.bufferedReader().readText().trim() else null
        } finally { c.disconnect() }
    }

    private fun httpPost(path: String, json: String) {
        val c = (URL(BuildConfig.BELL_BASE_URL + path).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            doOutput = true
            setRequestProperty("content-type", "application/json")
            connectTimeout = 15000
            readTimeout = 15000
        }
        try {
            c.outputStream.use { it.write(json.toByteArray()) }
            c.responseCode  // force the request
        } finally { c.disconnect() }
    }

    companion object {
        private const val PERIODIC = "bell-sync-periodic"
        private const val ONESHOT = "bell-sync-now"

        fun schedulePeriodic(ctx: Context) {
            val req = PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build()
            WorkManager.getInstance(ctx)
                .enqueueUniquePeriodicWork(PERIODIC, ExistingPeriodicWorkPolicy.KEEP, req)
        }

        fun syncNow(ctx: Context) {
            val req = OneTimeWorkRequestBuilder<SyncWorker>()
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build()
            WorkManager.getInstance(ctx)
                .enqueueUniqueWork(ONESHOT, ExistingWorkPolicy.REPLACE, req)
        }
    }
}
