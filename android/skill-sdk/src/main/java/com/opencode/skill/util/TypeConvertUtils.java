package com.opencode.skill.util;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.opencode.skill.model.SkillSdkException;

/**
 * Utility helpers for runtime parameter coercion.
 */
public final class TypeConvertUtils {
    private TypeConvertUtils() {
    }

    @NonNull
    public static String requireString(@Nullable Object value, @NonNull String fieldName) {
        String normalized = optionalString(value);
        if (normalized == null) {
            throw new SkillSdkException(1000, fieldName + " is required");
        }
        return normalized;
    }

    @Nullable
    public static String optionalString(@Nullable Object value) {
        if (value == null) {
            return null;
        }
        String text;
        if (value instanceof String) {
            text = (String) value;
        } else if (value instanceof Number || value instanceof Boolean) {
            text = String.valueOf(value);
        } else {
            throw new SkillSdkException(1000, "Unsupported parameter type: " + value.getClass().getSimpleName());
        }
        String trimmed = text.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    public static int toNonNegativeInt(@Nullable Object value, int defaultValue, @NonNull String fieldName) {
        Integer converted = parseInteger(value, fieldName);
        if (converted == null) {
            return Math.max(defaultValue, 0);
        }
        return Math.max(converted, 0);
    }

    public static int toPositiveInt(@Nullable Object value, int defaultValue, @NonNull String fieldName) {
        int safeDefault = defaultValue > 0 ? defaultValue : 1;
        Integer converted = parseInteger(value, fieldName);
        if (converted == null) {
            return safeDefault;
        }
        return converted > 0 ? converted : safeDefault;
    }

    public static int requireInteger(@Nullable Object value, @NonNull String fieldName) {
        Integer converted = parseInteger(value, fieldName);
        if (converted == null) {
            throw new SkillSdkException(1000, fieldName + " is required");
        }
        return converted;
    }

    @Nullable
    private static Integer parseInteger(@Nullable Object value, @NonNull String fieldName) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        if (value instanceof String) {
            String trimmed = ((String) value).trim();
            if (trimmed.isEmpty()) {
                return null;
            }
            try {
                return Integer.parseInt(trimmed);
            } catch (NumberFormatException ignored) {
                throw new SkillSdkException(1000, fieldName + " must be an integer");
            }
        }
        if (value instanceof Boolean) {
            return (Boolean) value ? 1 : 0;
        }
        throw new SkillSdkException(1000, fieldName + " must be an integer");
    }
}
