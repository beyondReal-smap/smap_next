plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.gms.google-services")
}

android {
    namespace = "com.dmonster.smap"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.dmonster.smap"
        minSdk = 24
        targetSdk = 35
        versionCode = 27
        versionName = "2.2.6"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        resourceConfigurations += setOf("ko", "en")

        // 기기 지원 범위 명시
    }

    signingConfigs {
        create("release") {
            storeFile = file("my-release-key.jks")
            storePassword = "Smap2023##"
            keyAlias = "my-key-alias"
            keyPassword = "Smap2023##"
        }
    }

    buildTypes {
        val baseUrl: String = project.properties["baseUrl"] as String
        val baseUrlDebug: String = project.properties["baseUrlDebug"] as String

        getByName("debug") {
            isMinifyEnabled = false
            isJniDebuggable = true
            buildConfigField("String", "BASE_URL", baseUrlDebug)
            // Debug 빌드에도 서명 적용 (테스트용)
            signingConfig = signingConfigs.getByName("release")
        }

        getByName("release") {
            isMinifyEnabled = true
            signingConfig = signingConfigs.getByName("release")
            buildConfigField("String", "BASE_URL", baseUrl)
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

    buildFeatures {
        viewBinding = true
        buildConfig = true
    }
}

dependencies {
    // AndroidX Core
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
    implementation("androidx.webkit:webkit:1.12.1")
    
    // Lifecycle
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.8.7")
    
    // Coroutine
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.9.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    
    // Firebase
    implementation(platform("com.google.firebase:firebase-bom:33.7.0"))
    implementation("com.google.firebase:firebase-messaging-ktx")
    
    // Google Play Services
    implementation("com.google.android.gms:play-services-auth:21.2.0")
    implementation("com.google.android.gms:play-services-location:21.3.0")
    
    // AdMob
    implementation("com.google.android.gms:play-services-ads:23.6.0")
    
    // OkHttp for network requests
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    
    // Gson for JSON parsing
    implementation("com.google.code.gson:gson:2.11.0")
    
    // JSON
    implementation("org.json:json:20240303")
    
    // Testing
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
} 