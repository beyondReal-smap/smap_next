# 앱 전용 R8 규칙.
#
# 2026-11-17: 예전에는 앱 코드(com.dmonster.smap.**)와 androidx·compose·kotlin·firebase·okhttp 등을
# 통째로 -keep 해서 난독화 비율이 6% 남짓이었다(Play "DEX 코드 최적화 기준점 미만" 경고, 기준 25%).
# 각 라이브러리는 AAR 안에 자기 소비자 규칙(consumer rules)을 함께 배포하므로 여기서 다시 보존하지 않는다.
# 여기에는 라이브러리 규칙으로 커버되지 않는 것만 남긴다.

# ==========================================
# 크래시 스택 트레이스 — Play 가 AAB 에 든 mapping.txt 로 원래 이름을 복원한다
# ==========================================
-keepattributes SourceFile,LineNumberTable
-keepattributes *Annotation*,Signature,Exceptions,InnerClasses,EnclosingMethod
-renamesourcefileattribute SourceFile

# ==========================================
# WebView JS 브리지(있는 경우) — 이름으로 호출되므로 보존
# ==========================================
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ==========================================
# Naver Map SDK — 네이티브(JNI)에서 클래스·필드를 이름으로 찾는다
# ==========================================
-keep class com.naver.maps.** { *; }
-keep interface com.naver.maps.** { *; }
-dontwarn com.naver.maps.**

# ==========================================
# Kakao SDK — 내부 모델을 Gson 으로 (역)직렬화한다
# ==========================================
-keep class com.kakao.sdk.** { *; }
-dontwarn com.kakao.sdk.**

# ==========================================
# Retrofit API 인터페이스 — 프록시로 메서드 애노테이션을 읽는다(이름은 바뀌어도 됨)
# ==========================================
-keep,allowobfuscation interface com.dmonster.smap.data.api.** { *; }

# ==========================================
# Kotlinx Serialization — 앱 모델의 생성된 serializer 를 보존
# (직렬화 이름은 컴파일 때 descriptor 에 문자열로 들어가므로 클래스·필드 이름은 바뀌어도 된다)
# ==========================================
-keepattributes RuntimeVisibleAnnotations,AnnotationDefault
-keep,includedescriptorclasses class com.dmonster.smap.**$$serializer { *; }
-keepclassmembers class com.dmonster.smap.** {
    *** Companion;
}
-keepclasseswithmembers class com.dmonster.smap.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# ==========================================
# Hilt — R8 이 KSP 생성·집계 클래스를 missing 으로 오탐하던 문제(AGP missing_rules.txt 권고)
# ==========================================
-dontwarn com.dmonster.smap.SmapApplication_GeneratedInjector
-dontwarn dagger.hilt.internal.aggregatedroot.codegen.**
-dontwarn hilt_aggregated_deps.**
