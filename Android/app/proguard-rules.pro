# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# ==========================================
# 크래시 디버깅을 위한 스택 트레이스 보존
# ==========================================
-keepattributes SourceFile,LineNumberTable
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes Exceptions
-renamesourcefileattribute SourceFile

# ==========================================
# SMAP 앱 관련 규칙
# ==========================================
-keep class com.dmonster.smap.** { *; }
-keepclassmembers class com.dmonster.smap.** { *; }

# Data Models (Gson 직렬화/역직렬화용)
-keep class com.dmonster.smap.data.model.** { *; }
-keepclassmembers class com.dmonster.smap.data.model.** { *; }

# ==========================================
# WebView 관련 규칙
# ==========================================
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ==========================================
# Firebase 관련 규칙
# ==========================================
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# ==========================================
# Naver Map SDK 규칙 (필수!)
# ==========================================
-keep class com.naver.maps.** { *; }
-keep interface com.naver.maps.** { *; }
-keepclassmembers class com.naver.maps.** { *; }
-dontwarn com.naver.maps.**

# Naver Map 예외 클래스들
-keep class com.naver.maps.map.NaverMapSdk$* { *; }
-keep class com.naver.maps.map.NaverMapSdk$ClientUnspecifiedException { *; }
-keep class com.naver.maps.map.NaverMapSdk$UnauthorizedClientException { *; }
-keep class com.naver.maps.map.NaverMapSdk$QuotaExceededException { *; }

# ==========================================
# Kakao SDK 규칙 (필수!)
# ==========================================
-keep class com.kakao.sdk.** { *; }
-keepclassmembers class com.kakao.sdk.** { *; }
-dontwarn com.kakao.sdk.**

# Kakao Auth
-keep class com.kakao.sdk.auth.** { *; }
-keep class com.kakao.sdk.user.** { *; }
-keep class com.kakao.sdk.common.** { *; }

# ==========================================
# OkHttp 규칙
# ==========================================
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }
-keepclassmembers class okhttp3.** { *; }
-dontwarn okhttp3.**
-dontwarn okio.**

# ==========================================
# Gson 규칙
# ==========================================
-keep class com.google.gson.** { *; }
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}
-keepclassmembers,allowobfuscation class * {
    @com.google.gson.annotations.SerializedName <fields>;
}

# Gson TypeToken 관련
-keep class com.google.gson.reflect.TypeToken { *; }
-keep class * extends com.google.gson.reflect.TypeToken

# ==========================================
# Jetpack Compose 규칙
# ==========================================
-keep class androidx.compose.** { *; }
-dontwarn androidx.compose.**

# Compose Runtime
-keep class androidx.compose.runtime.** { *; }
-keepclassmembers class androidx.compose.runtime.** { *; }

# Compose UI
-keep class androidx.compose.ui.** { *; }

# ==========================================
# AndroidX 규칙
# ==========================================
-keep class androidx.** { *; }
-dontwarn androidx.**

# Core SplashScreen
-keep class androidx.core.splashscreen.** { *; }

# Lifecycle
-keep class androidx.lifecycle.** { *; }
-keepclassmembers class * implements androidx.lifecycle.LifecycleObserver {
    <init>(...);
}

# Navigation
-keep class androidx.navigation.** { *; }

# Activity
-keep class androidx.activity.** { *; }

# ==========================================
# Coil (이미지 로딩) 규칙
# ==========================================
-keep class coil.** { *; }
-dontwarn coil.**

# ==========================================
# Kotlin 관련 규칙
# ==========================================
-keep class kotlin.** { *; }
-keep class kotlinx.** { *; }
-dontwarn kotlin.**
-dontwarn kotlinx.**

# Kotlin Coroutines
-keepclassmembernames class kotlinx.** {
    volatile <fields>;
}

# ==========================================
# ZXing (QR Code) 규칙
# ==========================================
-keep class com.google.zxing.** { *; }
-dontwarn com.google.zxing.**

# ==========================================
# Enum 클래스 보존
# ==========================================
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# ==========================================
# Parcelable 보존
# ==========================================
-keepclassmembers class * implements android.os.Parcelable {
    public static final ** CREATOR;
}

# ==========================================
# Serializable 보존
# ==========================================
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# ==========================================
# Native Methods 보존
# ==========================================
-keepclasseswithmembernames class * {
    native <methods>;
} 