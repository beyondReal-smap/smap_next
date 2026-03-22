plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.gms.google-services")
    id("com.google.dagger.hilt.android")
    id("com.google.devtools.ksp")
    id("org.jetbrains.kotlin.plugin.serialization")
}

android {
    namespace = "com.dmonster.smap"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.dmonster.smap"
        minSdk = 28
        targetSdk = 35
        versionCode = 49
        versionName = "3.0.4"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        resourceConfigurations += setOf("ko", "en")

        // 기기 지원 범위 명시

        buildConfigField("String", "API_BASE_URL", "\"https://api3.smap.site/api/v1/\"")
        buildConfigField("String", "IMAGE_BASE_URL", "\"https://api3.smap.site\"")
        buildConfigField("String", "WEB_BASE_URL", "\"https://nextstep.smap.site\"")
    }

    signingConfigs {
        create("release") {
            storeFile = file("smap.jks")
            storePassword = "dmonster"
            keyAlias = "key0"
            keyPassword = "dmonster"
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
            isMinifyEnabled = false  // 🔥 크래시 문제 해결을 위해 비활성화
            isShrinkResources = false
            signingConfig = signingConfigs.getByName("release")
            buildConfigField("String", "BASE_URL", baseUrl)
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            ndk {
                debugSymbolLevel = "FULL"
            }
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
        compose = true
    }
    
    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.14"
    }
    packaging {
        jniLibs {
            useLegacyPackaging = true
        }
    }
}

dependencies {
    // AndroidX Core
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.14.0-alpha01")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
    implementation("androidx.webkit:webkit:1.12.1")
    
    // Lifecycle
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    
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
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")

    // Gson for JSON parsing
    implementation("com.google.code.gson:gson:2.11.0")

    // JSON
    implementation("org.json:json:20240303")

    // Hilt DI
    implementation("com.google.dagger:hilt-android:2.51.1")
    ksp("com.google.dagger:hilt-android-compiler:2.51.1")
    implementation("androidx.hilt:hilt-navigation-compose:1.2.0")

    // Retrofit
    implementation("com.squareup.retrofit2:retrofit:2.11.0")

    // Kotlinx Serialization
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
    implementation("com.squareup.retrofit2:converter-kotlinx-serialization:2.11.0")
    
    // Jetpack Compose
    implementation(platform("androidx.compose:compose-bom:2024.12.01"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.7.0")
    implementation("androidx.navigation:navigation-compose:2.7.6")
    implementation("androidx.core:core-splashscreen:1.0.1")
    debugImplementation("androidx.compose.ui:ui-tooling")
    
    // Naver Map SDK
    implementation("com.naver.maps:map-sdk:3.23.0")
    implementation("io.github.fornewid:naver-map-compose:1.3.3")

    // Image Loading
    implementation("io.coil-kt:coil-compose:2.6.0")

    // QR Code Generation
    implementation("com.google.zxing:core:3.5.2")

    // Kakao SDK
    implementation("com.kakao.sdk:v2-user:2.20.1")

    // Testing
    testImplementation("junit:junit:4.13.2")
    testImplementation("com.squareup.okhttp3:mockwebserver:4.12.0")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.9.0")
    testImplementation("app.cash.turbine:turbine:1.0.0")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
} 