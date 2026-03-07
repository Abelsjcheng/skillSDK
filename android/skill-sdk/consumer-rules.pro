# Consumer rules for SkillSDK library
# This file is applied to apps that consume this library

# Keep all public SDK classes
-keep public class com.opencode.skill.SkillSDK { *; }
-keep public class com.opencode.skill.SkillSDKConfig { *; }
-keep public class com.opencode.skill.model.** { *; }
-keep public interface com.opencode.skill.callback.** { *; }