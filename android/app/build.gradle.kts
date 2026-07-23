plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.behere.bell"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.behere.bell"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "0.1"

        // Where the bell-server lives. Override at build time with
        // -PbellBaseUrl=... if the tailnet name ever changes.
        val bellBaseUrl = (project.findProperty("bellBaseUrl") as String?)
            ?: "https://alipc-1.tailb5ecd6.ts.net:8444"
        buildConfigField("String", "BELL_BASE_URL", "\"$bellBaseUrl\"")
    }

    buildFeatures {
        buildConfig = true
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-ktx:1.9.1")
    implementation("androidx.work:work-runtime-ktx:2.9.1")
    implementation("androidx.webkit:webkit:1.11.0")
}

// Bundle the web app (../../app) into the APK so the manifestation renders
// locally at fire time — the takeover never depends on reaching the server.
// Served via WebViewAssetLoader, so the ES-module imports get a real origin.
val copyWebApp by tasks.registering(Copy::class) {
    from(rootProject.file("../app"))
    into(layout.buildDirectory.dir("webAssets/web"))
}
android.sourceSets["main"].assets.srcDir(layout.buildDirectory.dir("webAssets"))
tasks.named("preBuild") { dependsOn(copyWebApp) }
