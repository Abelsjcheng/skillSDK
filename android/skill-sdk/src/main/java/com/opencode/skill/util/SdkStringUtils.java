package com.opencode.skill.util;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

/** Common string and numeric helpers used by the SDK facade. */
public final class SdkStringUtils {
    private SdkStringUtils() {
    }

    @Nullable
    public static String normalizeOptionalString(@Nullable String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    public static boolean isBlank(@Nullable String value) {
        return value == null || value.trim().isEmpty();
    }

    public static boolean isPermissionResponseValid(@NonNull String value) {
        return "once".equalsIgnoreCase(value)
                || "always".equalsIgnoreCase(value)
                || "reject".equalsIgnoreCase(value);
    }

    public static boolean isSessionRecordStatusValid(@NonNull String value) {
        return "ACTIVE".equalsIgnoreCase(value)
                || "IDLE".equalsIgnoreCase(value)
                || "CLOSED".equalsIgnoreCase(value);
    }

    public static int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(value, max));
    }
}
