package com.behere.bell

import android.content.Context

/** Tiny persistent store: the last-synced bell buffer (raw JSON) + registration. */
object Prefs {
    private fun p(ctx: Context) = ctx.getSharedPreferences("behere", Context.MODE_PRIVATE)

    fun saveBuffer(ctx: Context, json: String) = p(ctx).edit().putString("buffer", json).apply()
    fun getBuffer(ctx: Context): String = p(ctx).getString("buffer", "") ?: ""

    fun isRegistered(ctx: Context) = p(ctx).getBoolean("registered", false)
    fun setRegistered(ctx: Context) = p(ctx).edit().putBoolean("registered", true).apply()
}
