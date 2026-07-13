package com.opencode.skill.util;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.google.gson.Gson;
import com.google.gson.JsonSyntaxException;
import com.google.gson.reflect.TypeToken;
import com.opencode.skill.model.SkillSdkException;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

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
    public static Integer optionalInteger(@Nullable Object value, @NonNull String fieldName) {
        return parseInteger(value, fieldName);
    }

    @NonNull
    public static List<String> requireStringList(@Nullable Object value, @NonNull String fieldName) {
        List<String> converted = optionalStringList(value, fieldName);
        if (converted == null || converted.isEmpty()) {
            throw new SkillSdkException(1000, fieldName + " is required");
        }
        return converted;
    }

    @Nullable
    public static List<String> optionalStringList(@Nullable Object value, @NonNull String fieldName) {
        if (value == null) {
            return null;
        }
        List<String> result = new ArrayList<>();
        if (value instanceof List) {
            List<?> list = (List<?>) value;
            for (Object item : list) {
                String converted = optionalString(item);
                if (converted == null) {
                    throw new SkillSdkException(1000, fieldName + " must contain non-empty strings");
                }
                result.add(converted);
            }
            return result;
        }
        if (value instanceof Object[]) {
            Object[] array = (Object[]) value;
            for (Object item : array) {
                String converted = optionalString(item);
                if (converted == null) {
                    throw new SkillSdkException(1000, fieldName + " must contain non-empty strings");
                }
                result.add(converted);
            }
            return result;
        }
        throw new SkillSdkException(1000, fieldName + " must be a string array");
    }

    @Nullable
    /**
     * 将通知字段安全转换为字符串；仅接受字符串、数字和布尔值，复杂类型返回 null。
     */
    public static String valueAsString(@Nullable Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof String) {
            return (String) value;
        }
        if (value instanceof Number || value instanceof Boolean) {
            return String.valueOf(value);
        }
        return null;
    }

    @Nullable
    /**
     * 将通知字段安全转换为字符串键 Map。
     *
     * <p>输入可以是 Map 或 JSON 字符串；非法 JSON、数组及其他类型返回 null，避免异常通知
     * 中断同步链路。</p>
     */
    public static Map<String, Object> valueAsMap(@NonNull Gson gson, @Nullable Object value) {
        if (value instanceof Map) {
            Map<?, ?> raw = (Map<?, ?>) value;
            Map<String, Object> result = new HashMap<>();
            for (Map.Entry<?, ?> entry : raw.entrySet()) {
                if (entry.getKey() instanceof String) {
                    result.put((String) entry.getKey(), entry.getValue());
                }
            }
            return result;
        }
        if (value instanceof String) {
            try {
                return gson.fromJson((String) value, new TypeToken<Map<String, Object>>() {
                }.getType());
            } catch (JsonSyntaxException ignored) {
                return null;
            }
        }
        return null;
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
