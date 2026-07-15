package com.opencode.skill.util;

import android.net.Uri;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

public final class SdkUriUtil {
    private SdkUriUtil() {
    }

    @Nullable
    public static String appendQueryParameter(@Nullable String baseUrl, @NonNull String key, @Nullable String value) {
        if (baseUrl == null) {
            return null;
        }
        String trimmedBase = baseUrl.trim();
        if (trimmedBase.isEmpty()) {
            return null;
        }
        String fragment = null;
        int hashIndex = trimmedBase.indexOf('#');
        if (hashIndex >= 0) {
            fragment = trimmedBase.substring(hashIndex + 1);
            trimmedBase = trimmedBase.substring(0, hashIndex);
        }
        String encoded;
        try {
            encoded = URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8.name());
        } catch (Exception ignored) {
            encoded = value == null ? "" : value;
        }
        String connector;
        if (trimmedBase.contains("?")) {
            connector = trimmedBase.endsWith("?") || trimmedBase.endsWith("&") ? "" : "&";
        } else {
            connector = "?";
        }
        String result = trimmedBase + connector + key + "=" + encoded;
        if (fragment == null || fragment.isEmpty()) {
            return result;
        }
        return result + "#" + fragment;
    }

    @Nullable
    public static String appendHashFragment(@Nullable String baseUrl, @NonNull String hash) {
        if (baseUrl == null) {
            return null;
        }
        String trimmedBase = baseUrl.trim();
        if (trimmedBase.isEmpty()) {
            return null;
        }
        int hashIndex = trimmedBase.indexOf('#');
        String baseWithoutHash = hashIndex >= 0 ? trimmedBase.substring(0, hashIndex) : trimmedBase;
        return baseWithoutHash + "#" + hash;
    }

    @Nullable
    public static String extractUriHost(@Nullable String uri) {
        if (uri == null || uri.trim().isEmpty()) {
            return null;
        }
        String host = Uri.parse(uri.trim()).getHost();
        if (host == null || host.trim().isEmpty()) {
            return null;
        }
        return host.trim();
    }
}
