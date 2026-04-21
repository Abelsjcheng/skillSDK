package com.opencode.skill.util;

import android.app.Application;
import android.content.Context;
import android.content.SharedPreferences;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import com.opencode.skill.model.WeAgent;
import com.opencode.skill.model.WeAgentDetails;

import java.lang.reflect.Method;
import java.lang.reflect.Type;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * SharedPreferences-backed storage for V2 assistant data.
 * Data is isolated by mock user id.
 */
public final class WeAgentStorage {
    private static final String MOCK_USER_ID = "mock_user_id";
    private static final String PREFS_NAME_PREFIX = "skill_sdk_we_agent_";
    private static final String KEY_CURRENT_WE_AGENT_DETAIL = "current_we_agent_detail";
    private static final String KEY_WE_AGENT_LIST_CACHE = "we_agent_list_cache";
    private static final String KEY_WE_AGENT_DETAILS = "we_agent_details";

    @NonNull
    private final Gson gson = new Gson();
    @NonNull
    private final Map<String, String> memoryFallback = new HashMap<>();
    @Nullable
    private volatile SharedPreferences sharedPreferences;

    public synchronized void configure(@Nullable Context context) {
        sharedPreferences = resolveSharedPreferences(context);
    }

    public synchronized void saveCurrentWeAgentDetail(@Nullable WeAgentDetails details) {
        SharedPreferences prefs = resolveSharedPreferencesIfNeeded();
        if (details == null) {
            removeValue(prefs, KEY_CURRENT_WE_AGENT_DETAIL);
            return;
        }
        String encoded = gson.toJson(details);
        putValue(prefs, KEY_CURRENT_WE_AGENT_DETAIL, encoded);
    }

    @Nullable
    public synchronized WeAgentDetails getCurrentWeAgentDetail() {
        String raw = readValue(resolveSharedPreferencesIfNeeded(), KEY_CURRENT_WE_AGENT_DETAIL);
        if (raw == null || raw.trim().isEmpty()) {
            return null;
        }
        try {
            return gson.fromJson(raw, WeAgentDetails.class);
        } catch (Exception ignored) {
            return null;
        }
    }

    public synchronized void saveWeAgentList(@Nullable List<WeAgent> list) {
        SharedPreferences prefs = resolveSharedPreferencesIfNeeded();
        if (list == null) {
            removeValue(prefs, KEY_WE_AGENT_LIST_CACHE);
            return;
        }
        putValue(prefs, KEY_WE_AGENT_LIST_CACHE, gson.toJson(list));
    }

    @NonNull
    public synchronized List<WeAgent> getWeAgentList() {
        String raw = readValue(resolveSharedPreferencesIfNeeded(), KEY_WE_AGENT_LIST_CACHE);
        if (raw == null || raw.trim().isEmpty()) {
            return new ArrayList<>();
        }
        try {
            Type listType = TypeToken.getParameterized(List.class, WeAgent.class).getType();
            List<WeAgent> parsed = gson.fromJson(raw, listType);
            return parsed == null ? new ArrayList<>() : new ArrayList<>(parsed);
        } catch (Exception ignored) {
            return new ArrayList<>();
        }
    }

    public synchronized void saveWeAgentDetails(
            @NonNull String partnerAccount,
            @Nullable WeAgentDetails details
    ) {
        if (details == null) {
            return;
        }
        SharedPreferences prefs = resolveSharedPreferencesIfNeeded();
        Map<String, WeAgentDetails> cache = loadWeAgentDetailsCache();
        cache.put(partnerAccount, details);
        persistWeAgentDetailsCache(prefs, cache);
    }

    @Nullable
    public synchronized WeAgentDetails getWeAgentDetails(
            @NonNull String partnerAccount
    ) {
        Map<String, WeAgentDetails> cache = loadWeAgentDetailsCache();
        WeAgentDetails details = cache.get(partnerAccount);
        if (details == null) {
            return null;
        }
        return details;
    }

    @Nullable
    private SharedPreferences resolveSharedPreferencesIfNeeded() {
        if (sharedPreferences != null) {
            return sharedPreferences;
        }

        synchronized (this) {
            if (sharedPreferences == null) {
                sharedPreferences = resolveSharedPreferences(null);
            }
            return sharedPreferences;
        }
    }

    @Nullable
    private SharedPreferences resolveSharedPreferences(@Nullable Context context) {
        Context appContext = context == null ? resolveApplicationContext() : context.getApplicationContext();
        if (appContext == null) {
            return null;
        }
        return appContext.getSharedPreferences(PREFS_NAME_PREFIX + MOCK_USER_ID, Context.MODE_PRIVATE);
    }

    @Nullable
    private static Context resolveApplicationContext() {
        try {
            Class<?> activityThreadClass = Class.forName("android.app.ActivityThread");
            Method method = activityThreadClass.getDeclaredMethod("currentApplication");
            Object application = method.invoke(null);
            if (application instanceof Application) {
                return ((Application) application).getApplicationContext();
            }
        } catch (Exception ignored) {
            // Ignore reflection failures.
        }
        return null;
    }

    private void putValue(@Nullable SharedPreferences prefs, @NonNull String key, @NonNull String value) {
        if (prefs != null) {
            prefs.edit().putString(key, value).apply();
        }
        memoryFallback.put(key, value);
    }

    private void removeValue(@Nullable SharedPreferences prefs, @NonNull String key) {
        if (prefs != null) {
            prefs.edit().remove(key).apply();
        }
        memoryFallback.remove(key);
    }

    @Nullable
    private String readValue(@Nullable SharedPreferences prefs, @NonNull String key) {
        if (prefs != null) {
            String fromPrefs = prefs.getString(key, null);
            if (fromPrefs != null) {
                return fromPrefs;
            }
        }
        return memoryFallback.get(key);
    }

    @NonNull
    private Map<String, WeAgentDetails> loadWeAgentDetailsCache() {
        String raw = readValue(resolveSharedPreferencesIfNeeded(), KEY_WE_AGENT_DETAILS);
        if (raw == null || raw.trim().isEmpty()) {
            return new HashMap<>();
        }
        try {
            Type mapType = TypeToken.getParameterized(
                    Map.class,
                    String.class,
                    WeAgentDetails.class
            ).getType();
            Map<String, WeAgentDetails> parsed = gson.fromJson(raw, mapType);
            return parsed == null ? new HashMap<>() : new HashMap<>(parsed);
        } catch (Exception ignored) {
            return new HashMap<>();
        }
    }

    private void persistWeAgentDetailsCache(
            @Nullable SharedPreferences prefs,
            @NonNull Map<String, WeAgentDetails> cache
    ) {
        if (cache.isEmpty()) {
            removeValue(prefs, KEY_WE_AGENT_DETAILS);
            return;
        }
        putValue(prefs, KEY_WE_AGENT_DETAILS, gson.toJson(cache));
    }

}
