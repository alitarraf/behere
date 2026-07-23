package com.behere.bell

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import android.view.Gravity
import android.view.ViewGroup
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity : ComponentActivity() {

    private val notifPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { /* best effort */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        showOverLockscreen()

        val url = intent?.getStringExtra("url")
        if (url != null) showBell(url) else showHome()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val url = intent.getStringExtra("url")
        if (url != null) showBell(url) else showHome()
    }

    // ---------- the bell ----------

    private fun showBell(url: String) {
        window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        immersive()

        val u = Uri.parse(url)
        val mode = u.getQueryParameter("mode") ?: "buzz"
        val text = u.getQueryParameter("t") ?: ""

        // Serve the web app from the APK's own assets over a real https origin, so
        // the takeover renders locally — no network needed at fire time. The remote
        // server is only ever used to sync the schedule, well ahead of time.
        val assetLoader = androidx.webkit.WebViewAssetLoader.Builder()
            .addPathHandler("/web/", androidx.webkit.WebViewAssetLoader.AssetsPathHandler(this))
            .build()
        val q = u.encodedQuery
        val localUrl = "https://appassets.androidplatform.net/web/index.html" +
            if (!q.isNullOrEmpty()) "?$q" else ""

        val web = WebView(this).apply {
            layoutParams = ViewGroup.LayoutParams(-1, -1)
            setBackgroundColor(Color.parseColor("#0d0d10"))
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(
                    view: WebView, request: android.webkit.WebResourceRequest
                ): android.webkit.WebResourceResponse? =
                    assetLoader.shouldInterceptRequest(request.url)

                override fun onReceivedError(
                    view: WebView, request: android.webkit.WebResourceRequest,
                    error: android.webkit.WebResourceError
                ) {
                    // Last-ditch: if even the bundled page can't load, show a bare face.
                    if (request.isForMainFrame) {
                        view.loadDataWithBaseURL(null, fallbackHtml(mode, text), "text/html", "utf-8", null)
                    }
                }
            }
        }
        setContentView(web)
        web.loadUrl(localUrl)

        // Ephemeral by design: the manifestation lives ~10s, then we step away.
        Handler(Looper.getMainLooper()).postDelayed({ finish() }, 14_000)
    }

    /** Offline face of the bell — never a broken Chrome error page over the lock screen. */
    private fun fallbackHtml(mode: String, text: String): String {
        val body = if (mode == "line" && text.isNotEmpty())
            """<div class="line">${text.replace("<", "&lt;")}</div>"""
        else
            """<div class="dot"></div>"""
        return """<!doctype html><meta name=viewport content="width=device-width,initial-scale=1">
            <style>html,body{margin:0;height:100%;background:#0d0d10}
            body{display:grid;place-items:center}
            .line{color:#d8c9a3;font:italic 1.5em/1.7 Georgia,serif;padding:1.4em;text-align:center;
              opacity:0;animation:in 1.2s forwards}
            .dot{width:14px;height:14px;border-radius:50%;border:1px solid #d8c9a366;
              animation:breathe 7s ease-in-out infinite}
            @keyframes in{to{opacity:1}}
            @keyframes breathe{0%,100%{transform:scale(1);opacity:.35}50%{transform:scale(2.2);opacity:.8}}
            </style>$body"""
    }

    // ---------- home / onboarding ----------

    private fun showHome() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.parseColor("#0d0d10"))
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(dp(28), dp(72), dp(28), dp(48))
        }
        root.addView(text("be here now", 22f, 0.9f).apply {
            letterSpacing = 0.18f
        })
        root.addView(space(dp(24)))

        val missing = missingPermissions()
        if (missing.isEmpty()) {
            val ts = Prefs.nextTs(this)
            val when_ = if (ts > System.currentTimeMillis())
                "the next bell is set for\n" + SimpleDateFormat("EEE h:mm a", Locale.getDefault()).format(Date(ts))
            else "listening for the next bell…"
            root.addView(text(when_, 15f, 0.7f))
        } else {
            root.addView(text("a few one-time permissions, so the bell can\ntake over the screen on its own:", 15f, 0.7f))
            root.addView(space(dp(20)))
            for (m in missing) root.addView(grantButton(m))
        }

        // Debug-only: arm a bell 60s out, locally — exercises receiver →
        // full-screen intent → WebView without the server or the 15-min poll.
        // This is the fast path for verifying the takeover (PRD N0).
        if (BuildConfig.DEBUG) {
            root.addView(space(dp(28)))
            root.addView(Button(this).apply {
                text = "Test bell in 60s (visual)"
                setTextColor(Color.parseColor("#d8c9a3"))
                setBackgroundColor(Color.parseColor("#1a1a1f"))
                typeface = android.graphics.Typeface.SERIF
                layoutParams = LinearLayout.LayoutParams(-1, -2)
                setOnClickListener {
                    AlarmScheduler.schedule(
                        this@MainActivity,
                        System.currentTimeMillis() + 60_000, "visual", null
                    )
                    text = "armed — lock the phone and wait"
                }
            })
        }

        val scroll = ScrollView(this).apply { addView(root); setBackgroundColor(Color.parseColor("#0d0d10")) }
        setContentView(scroll)

        // ask for notifications up front (dialog, not a settings trip)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            notifPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
        SyncWorker.syncNow(this)
    }

    override fun onResume() {
        super.onResume()
        // re-render home so granted permissions drop off the list
        if (intent?.getStringExtra("url") == null) showHome()
    }

    // ---------- permission model ----------

    private data class Perm(val label: String, val open: () -> Unit)

    private fun missingPermissions(): List<Perm> {
        val out = mutableListOf<Perm>()
        val pkgUri = Uri.parse("package:$packageName")

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val am = getSystemService(Context.ALARM_SERVICE) as AlarmManager
            if (!am.canScheduleExactAlarms()) out.add(Perm("Allow exact alarms") {
                safeStart(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, pkgUri))
            })
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (!nm.canUseFullScreenIntent()) out.add(Perm("Allow full-screen bell") {
                safeStart(Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, pkgUri))
            })
        }
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        if (!pm.isIgnoringBatteryOptimizations(packageName)) out.add(Perm("Keep running in the background") {
            safeStart(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, pkgUri))
        })
        return out
    }

    private fun safeStart(i: Intent) = try { startActivity(i) } catch (_: Exception) {}

    // ---------- little view helpers (no XML) ----------

    private fun showOverLockscreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        }
    }

    private fun immersive() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    private fun text(s: String, size: Float, alpha: Float) = TextView(this).apply {
        text = s
        textSize = size
        setTextColor(Color.parseColor("#d8c9a3"))
        this.alpha = alpha
        gravity = Gravity.CENTER
        typeface = android.graphics.Typeface.SERIF
    }

    private fun space(h: Int) = android.view.View(this).apply {
        layoutParams = LinearLayout.LayoutParams(1, h)
    }

    private fun grantButton(p: Perm) = Button(this).apply {
        text = p.label
        setTextColor(Color.parseColor("#d8c9a3"))
        setBackgroundColor(Color.parseColor("#1a1a1f"))
        typeface = android.graphics.Typeface.SERIF
        layoutParams = LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(10) }
        setOnClickListener { p.open() }
    }

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()
}
