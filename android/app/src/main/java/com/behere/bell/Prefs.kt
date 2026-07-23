package com.behere.bell

import android.content.Context

/** Tiny persistent store: the one upcoming bell, plus whether we've registered. */
object Prefs {
    private fun p(ctx: Context) = ctx.getSharedPreferences("behere", Context.MODE_PRIVATE)

    fun saveNext(ctx: Context, ts: Long, mode: String, text: String?) {
        p(ctx).edit()
            .putLong("ts", ts)
            .putString("mode", mode)
            .putString("text", text ?: "")
            .apply()
    }

    fun nextTs(ctx: Context): Long = p(ctx).getLong("ts", 0L)
    fun nextMode(ctx: Context): String = p(ctx).getString("mode", "buzz") ?: "buzz"
    fun nextText(ctx: Context): String = p(ctx).getString("text", "") ?: ""

    fun isRegistered(ctx: Context) = p(ctx).getBoolean("registered", false)
    fun setRegistered(ctx: Context) = p(ctx).edit().putBoolean("registered", true).apply()
}
