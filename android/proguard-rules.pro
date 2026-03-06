# Skill SDK ProGuard Rules
-keep class com.opencode.skill.model.** { *; }
-keep class com.opencode.skill.listener.** { *; }
-keep class com.opencode.skill.SkillSDK { *; }
-keepclassmembers class com.opencode.skill.** { *; }

# OkHttp
-dontwarn okhttp3.**
-keep class okhttp3.** { *; }

# Retrofit
-keep class retrofit2.** { *; }
-keepclasseswithmembers class * {
    @retrofit2.http.* <methods>;
}

# Gson
-keepattributes Signature
-keep class com.google.gson.** { *; }
-keep class * implements com.google.gson.TypeAdapterFactory
-keep class * implements com.google.gson.JsonSerializer
-keep class * implements com.google.gson.JsonDeserializer