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
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

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
    private static final String KEY_ASSISTANT_GRAY_SINGLE_CACHE = "assistant_gray_single_cache";

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

    public synchronized boolean hasWeAgentListCache() {
        return readValue(resolveSharedPreferencesIfNeeded(), KEY_WE_AGENT_LIST_CACHE) != null;
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

    @NonNull
    /**
     * 汇总详情缓存键和当前助理账号，按首次出现顺序去重后返回冷启动补偿查询账号。
     */
    public synchronized List<String> getCachedWeAgentPartnerAccounts() {
        Set<String> accounts = new LinkedHashSet<>();
        for (String key : loadWeAgentDetailsCache().keySet()) {
            String normalized = normalize(key);
            if (normalized != null) {
                accounts.add(normalized);
            }
        }
        WeAgentDetails currentDetail = getCurrentWeAgentDetail();
        if (currentDetail != null) {
            String currentPartnerAccount = normalize(currentDetail.getPartnerAccount());
            if (currentPartnerAccount != null) {
                accounts.add(currentPartnerAccount);
            }
        }
        return new ArrayList<>(accounts);
    }

    /**
     * 仅在目标详情已缓存时用完整详情覆盖它；若目标同时是当前助理，也同步覆盖当前详情。
     *
     * <p>该方法不会创建新的详情缓存，避免迟到的更新通知恢复已经删除的助理。</p>
     */
    public synchronized void replaceCachedWeAgentDetailsIfPresent(
            @NonNull String partnerAccount,
            @NonNull WeAgentDetails details
    ) {
        SharedPreferences prefs = resolveSharedPreferencesIfNeeded();
        Map<String, WeAgentDetails> cache = loadWeAgentDetailsCache();
        if (cache.containsKey(partnerAccount)) {
            cache.put(partnerAccount, details);
            persistWeAgentDetailsCache(prefs, cache);
        }
        if (matchesDetail(getCurrentWeAgentDetail(), partnerAccount)) {
            saveCurrentWeAgentDetail(details);
        }
    }

    public synchronized void updateCachedWeAgentDetails(
            @Nullable String partnerAccount,
            @NonNull String name,
            @NonNull String icon,
            @NonNull String description
    ) {
        SharedPreferences prefs = resolveSharedPreferencesIfNeeded();
        WeAgentDetails currentDetail = getCurrentWeAgentDetail();
        if (matchesDetail(currentDetail, partnerAccount)) {
            applyUpdatedBasicFields(currentDetail, name, icon, description);
            saveCurrentWeAgentDetail(currentDetail);
        }

        Map<String, WeAgentDetails> cache = loadWeAgentDetailsCache();
        boolean updated = false;
        if (partnerAccount != null) {
            WeAgentDetails cachedDetail = cache.get(partnerAccount);
            if (cachedDetail != null) {
                applyUpdatedBasicFields(cachedDetail, name, icon, description);
                updated = true;
            }
        }

        if (updated) {
            persistWeAgentDetailsCache(prefs, cache);
        }
    }

    /**
     * 按 partnerAccount 幂等删除详情缓存；目标不存在时不写入存储。
     */
    public synchronized void removeWeAgentDetails(@NonNull String partnerAccount) {
        SharedPreferences prefs = resolveSharedPreferencesIfNeeded();
        Map<String, WeAgentDetails> cache = loadWeAgentDetailsCache();
        if (cache.remove(partnerAccount) != null) {
            persistWeAgentDetailsCache(prefs, cache);
        }
    }

    /**
     * 从已有列表缓存中移除指定账号的全部条目。
     *
     * <p>没有列表缓存或未命中目标时不回写，命中后统一保存过滤后的列表。</p>
     */
    public synchronized void removeWeAgentFromList(@NonNull String partnerAccount) {
        if (!hasWeAgentListCache()) {
            return;
        }
        List<WeAgent> list = getWeAgentList();
        boolean removed = false;
        for (int i = list.size() - 1; i >= 0; i--) {
            if (partnerAccount.equals(normalize(list.get(i).getPartnerAccount()))) {
                list.remove(i);
                removed = true;
            }
        }
        if (removed) {
            saveWeAgentList(list);
        }
    }

    public synchronized void saveAssistantGraySingle(@NonNull String partnerAccount, boolean value) {
        SharedPreferences prefs = resolveSharedPreferencesIfNeeded();
        Map<String, Boolean> cache = loadAssistantGraySingleCache();
        cache.put(partnerAccount, value);
        putValue(prefs, KEY_ASSISTANT_GRAY_SINGLE_CACHE, gson.toJson(cache));
    }

    @Nullable
    public synchronized Boolean getAssistantGraySingle(@NonNull String partnerAccount) {
        Map<String, Boolean> cache = loadAssistantGraySingleCache();
        return cache.get(partnerAccount);
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
    private Map<String, Boolean> loadAssistantGraySingleCache() {
        String raw = readValue(resolveSharedPreferencesIfNeeded(), KEY_ASSISTANT_GRAY_SINGLE_CACHE);
        if (raw == null || raw.trim().isEmpty()) {
            return new HashMap<>();
        }
        try {
            Type mapType = TypeToken.getParameterized(Map.class, String.class, Boolean.class).getType();
            Map<String, Boolean> parsed = gson.fromJson(raw, mapType);
            return parsed == null ? new HashMap<>() : new HashMap<>(parsed);
        } catch (Exception ignored) {
            return new HashMap<>();
        }
    }

    /**
     * 读取并反序列化完整助理详情缓存，供冷启动补偿和缓存更新逻辑复用。
     */
    @NonNull
    public synchronized Map<String, WeAgentDetails> loadWeAgentDetailsCache() {
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

    private boolean matchesDetail(@Nullable WeAgentDetails details, @Nullable String partnerAccount) {
        if (details == null) {
            return false;
        }
        return partnerAccount != null && partnerAccount.equals(normalize(details.getPartnerAccount()));
    }

    private void applyUpdatedBasicFields(
            @NonNull WeAgentDetails details,
            @NonNull String name,
            @NonNull String icon,
            @NonNull String description
    ) {
        details.setName(name);
        details.setIcon(icon);
        details.setDesc(description);
    }

    @Nullable
    private String normalize(@Nullable String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

}
