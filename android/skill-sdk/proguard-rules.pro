# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in Android SDK tools/proguard/proguard-android-optimize.txt

# Keep all public SDK classes
-keep public class com.opencode.skill.** { *; }

# Keep all model classes for JSON serialization
-keep class com.opencode.skill.model.** { *; }

# Keep all callback interfaces
-keep interface com.opencode.skill.callback.** { *; }

# OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }
-keep class okio.** { *; }

# Gson
-keepattributes Signature
-keepattributes *Annotation*
-keep class com.google.gson.** { *; }
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}

# Keep enum constants for proper JSON deserialization
-keepclassmembers enum com.opencode.skill.constant.** {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}