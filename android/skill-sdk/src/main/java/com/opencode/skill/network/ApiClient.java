package com.opencode.skill.network;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.google.gson.reflect.TypeToken;
import com.opencode.skill.SkillSDKConfig;
import com.opencode.skill.callback.SkillCallback;
import com.opencode.skill.model.CreateSessionParams;
import com.opencode.skill.model.PageResult;
import com.opencode.skill.model.ReplyPermissionResult;
import com.opencode.skill.model.SendMessageResult;
import com.opencode.skill.model.SendMessageToIMResult;
import com.opencode.skill.model.SessionMessage;
import com.opencode.skill.model.SkillSdkException;
import com.opencode.skill.model.SkillSession;
import com.opencode.skill.model.StopSkillResult;

import java.io.IOException;
import java.lang.reflect.Type;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import okhttp3.Call;
import okhttp3.HttpUrl;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

/**
* HTTP client for skill server REST APIs.
*/
public class ApiClient {
    private static final MediaType JSON_MEDIA_TYPE = MediaType.parse("application/json; charset=utf-8");

    @NonNull
    private final Gson gson = new Gson();
    @Nullable
    private OkHttpClient okHttpClient;
    @Nullable
    private String baseUrl;
    @NonNull
    private Map<String, String> defaultHeaders = Collections.emptyMap();

    public synchronized void configure(@NonNull SkillSDKConfig config) {
        this.baseUrl = trimTrailingSlash(config.getBaseUrl());
        this.defaultHeaders = new HashMap<>(config.getDefaultHeaders());
        this.okHttpClient = new OkHttpClient.Builder()
                .connectTimeout(config.getConnectTimeout(), TimeUnit.MILLISECONDS)
                .readTimeout(config.getReadTimeout(), TimeUnit.MILLISECONDS)
                .writeTimeout(config.getWriteTimeout(), TimeUnit.MILLISECONDS)
                .build();
    }

    public void createSession(@NonNull CreateSessionParams params, @NonNull SkillCallback<SkillSession> callback) {
        JsonObject body = new JsonObject();
        body.addProperty("ak", params.getAk());
        if (params.getTitle() != null && !params.getTitle().isEmpty()) {
            body.addProperty("title", params.getTitle());
        }
        body.addProperty("imGroupId", params.getImGroupId());

        Request request = newRequestBuilder("/api/skill/sessions")
                .post(RequestBody.create(body.toString(), JSON_MEDIA_TYPE))
                .build();
        executeEnvelope(request, SkillSession.class, callback);
    }

    public void listSessions(@Nullable String imGroupId, @Nullable String ak, @Nullable String status, int page, int size,
            @NonNull SkillCallback<PageResult<SkillSession>> callback) {
        HttpUrl.Builder builder = urlBuilder("/api/skill/sessions");
        if (imGroupId != null && !imGroupId.isEmpty()) {
            builder.addQueryParameter("imGroupId", imGroupId);
        }
        if (ak != null && !ak.isEmpty()) {
            builder.addQueryParameter("ak", ak);
        }
        if (status != null && !status.isEmpty()) {
            builder.addQueryParameter("status", status);
        }
        builder.addQueryParameter("page", String.valueOf(page));
        builder.addQueryParameter("size", String.valueOf(size));

        Request request = newRequestBuilder(builder.build())
                .get()
                .build();

        Type type = TypeToken.getParameterized(PageResult.class, SkillSession.class).getType();
        executeEnvelope(request, type, callback);
    }

    public void getSession(long welinkSessionId, @NonNull SkillCallback<SkillSession> callback) {
        Request request = newRequestBuilder("/api/skill/sessions/" + welinkSessionId)
                .get()
                .build();
        executeEnvelope(request, SkillSession.class, callback);
    }

    public void sendMessage(long welinkSessionId, @NonNull String content, @Nullable String toolCallId,
            @NonNull SkillCallback<SendMessageResult> callback) {
        JsonObject body = new JsonObject();
        body.addProperty("content", content);
        if (toolCallId != null && !toolCallId.isEmpty()) {
            body.addProperty("toolCallId", toolCallId);
        }

        Request request = newRequestBuilder("/api/skill/sessions/" + welinkSessionId + "/messages")
                .post(RequestBody.create(body.toString(), JSON_MEDIA_TYPE))
                .build();
        executeEnvelope(request, SendMessageResult.class, callback);
    }

    public void abortSession(long welinkSessionId, @NonNull SkillCallback<StopSkillResult> callback) {
        Request request = newRequestBuilder("/api/skill/sessions/" + welinkSessionId + "/abort")
                .post(RequestBody.create("{}", JSON_MEDIA_TYPE))
                .build();
        executeEnvelope(request, StopSkillResult.class, callback);
    }

    public void getMessages(long welinkSessionId, int page, int size,
            @NonNull SkillCallback<PageResult<SessionMessage>> callback) {
        HttpUrl url = urlBuilder("/api/skill/sessions/" + welinkSessionId + "/messages")
                .addQueryParameter("page", String.valueOf(page))
                .addQueryParameter("size", String.valueOf(size))
                .build();
        Request request = newRequestBuilder(url).get().build();
        Type type = TypeToken.getParameterized(PageResult.class, SessionMessage.class).getType();
        executeEnvelope(request, type, callback);
    }

    public void replyPermission(long welinkSessionId, @NonNull String permId, @NonNull String response,
            @NonNull SkillCallback<ReplyPermissionResult> callback) {
        JsonObject body = new JsonObject();
        body.addProperty("response", response);

        Request request = newRequestBuilder("/api/skill/sessions/" + welinkSessionId + "/permissions/" + permId)
                .post(RequestBody.create(body.toString(), JSON_MEDIA_TYPE))
                .build();
        executeEnvelope(request, ReplyPermissionResult.class, callback);
    }

    public void sendMessageToIM(long welinkSessionId, @NonNull String content, @Nullable String chatId,
            @NonNull SkillCallback<SendMessageToIMResult> callback) {
        JsonObject body = new JsonObject();
        body.addProperty("content", content);
        if (chatId != null && !chatId.trim().isEmpty()) {
            body.addProperty("chatId", chatId);
        }

        Request request = newRequestBuilder("/api/skill/sessions/" + welinkSessionId + "/send-to-im")
                .post(RequestBody.create(body.toString(), JSON_MEDIA_TYPE))
                .build();

        executeRaw(request, new SkillCallback<JsonObject>() {
            @Override
            public void onSuccess(@Nullable JsonObject result) {
                if (result == null) {
                    callback.onSuccess(new SendMessageToIMResult("failed", null, null, "Empty response"));
                    return;
                }

                if (result.has("code")) {
                    int code = result.get("code").getAsInt();
                    if (code != 0) {
                        callback.onError(new SkillSdkException(code, getString(result, "errormsg", "Server error")));
                        return;
                    }

                    JsonElement data = result.get("data");
                    if (data != null && data.isJsonObject()) {
                        JsonObject dataObj = data.getAsJsonObject();
                        SendMessageToIMResult wrapped = gson.fromJson(dataObj, SendMessageToIMResult.class);
                        String normalizedStatus = wrapped.getStatus();
                        if (dataObj.has("status") && !dataObj.get("status").isJsonNull()) {
                            normalizedStatus = dataObj.get("status").getAsString();
                        } else if (dataObj.has("success") && dataObj.get("success").isJsonPrimitive()) {
                            normalizedStatus = dataObj.get("success").getAsBoolean() ? "success" : "failed";
                        } else if (normalizedStatus == null || normalizedStatus.trim().isEmpty()
                                || "failed".equalsIgnoreCase(normalizedStatus)) {
                            normalizedStatus = "success";
                        }
                        wrapped.setStatus(normalizedStatus);
                        callback.onSuccess(wrapped);
                        return;
                    }

                    callback.onSuccess(new SendMessageToIMResult("success", null, null, null));
                    return;
                }

                // Compatibility for undocumented endpoint.
                boolean success = result.has("success") && result.get("success").isJsonPrimitive()
                        && result.get("success").getAsBoolean();
                SendMessageToIMResult compatibility = new SendMessageToIMResult();
                compatibility.setStatus(success ? "success" : "failed");
                if (result.has("chatId") && !result.get("chatId").isJsonNull()) {
                    compatibility.setChatId(result.get("chatId").getAsString());
                }
                if (result.has("contentLength") && !result.get("contentLength").isJsonNull()) {
                    compatibility.setContentLength(result.get("contentLength").getAsInt());
                }
                if (result.has("error") && !result.get("error").isJsonNull()) {
                    compatibility.setErrorMessage(result.get("error").getAsString());
                }
                callback.onSuccess(compatibility);
            }

            @Override
            public void onError(@NonNull Throwable error) {
                callback.onError(error);
            }
        });
    }

    public synchronized void shutdown() {
        if (okHttpClient != null) {
            okHttpClient.dispatcher().executorService().shutdown();
            okHttpClient.connectionPool().evictAll();
        }
    }

    private <T> void executeEnvelope(@NonNull Request request, @NonNull Type type, @NonNull SkillCallback<T> callback) {
        executeRaw(request, new SkillCallback<JsonObject>() {
            @Override
            public void onSuccess(@Nullable JsonObject root) {
                if (root == null) {
                    callback.onError(new SkillSdkException(5000, "Empty response"));
                    return;
                }
                if (!root.has("code")) {
                    callback.onError(new SkillSdkException(7000, "Invalid server response"));
                    return;
                }

                int code = root.get("code").getAsInt();
                String errormsg = getString(root, "errormsg", "");
                if (code != 0) {
                    callback.onError(new SkillSdkException(code, errormsg.isEmpty() ? "Server error" : errormsg));
                    return;
                }

                JsonElement data = root.get("data");
                if (data == null || data.isJsonNull()) {
                    callback.onSuccess(null);
                    return;
                }
                callback.onSuccess(gson.fromJson(data, type));
            }

            @Override
            public void onError(@NonNull Throwable error) {
                callback.onError(error);
            }
        });
    }

    private void executeRaw(@NonNull Request request, @NonNull SkillCallback<JsonObject> callback) {
        OkHttpClient client = requireClient();
        client.newCall(request).enqueue(new okhttp3.Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                callback.onError(new SkillSdkException(6000, "Network error: " + e.getMessage(), e));
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) {
                try {
                    if (!response.isSuccessful()) {
                        callback.onError(new SkillSdkException(7000, "HTTP " + response.code() + ": " + response.message()));
                        return;
                    }
                    if (response.body() == null) {
                        callback.onSuccess(null);
                        return;
                    }
                    String responseBody = response.body().string();
                    if (responseBody.trim().isEmpty()) {
                        callback.onSuccess(null);
                        return;
                    }
                    JsonElement root = JsonParser.parseString(responseBody);
                    if (!root.isJsonObject()) {
                        callback.onError(new SkillSdkException(7000, "Unexpected response JSON type"));
                        return;
                    }
                    callback.onSuccess(root.getAsJsonObject());
                } catch (Exception e) {
                    callback.onError(new SkillSdkException(5000, "Parse response failed: " + e.getMessage(), e));
                } finally {
                    response.close();
                }
            }
        });
    }

    @NonNull
    private Request.Builder newRequestBuilder(@NonNull String path) {
        return newRequestBuilder(urlBuilder(path).build());
    }

    @NonNull
    private Request.Builder newRequestBuilder(@NonNull HttpUrl url) {
        Request.Builder builder = new Request.Builder().url(url);
        for (Map.Entry<String, String> entry : defaultHeaders.entrySet()) {
            builder.addHeader(entry.getKey(), entry.getValue());
        }
        return builder;
    }

    @NonNull
    private HttpUrl.Builder urlBuilder(@NonNull String path) {
        String base = requireBaseUrl();
        HttpUrl parsed = HttpUrl.parse(base + path);
        if (parsed == null) {
            throw new IllegalStateException("Invalid URL: " + base + path);
        }
        return parsed.newBuilder();
    }

    @NonNull
    private synchronized OkHttpClient requireClient() {
        if (okHttpClient == null) {
            throw new IllegalStateException("ApiClient is not configured");
        }
        return okHttpClient;
    }

    @NonNull
    private synchronized String requireBaseUrl() {
        if (baseUrl == null || baseUrl.isEmpty()) {
            throw new IllegalStateException("ApiClient baseUrl is not configured");
        }
        return baseUrl;
    }

    @NonNull
    private static String trimTrailingSlash(@NonNull String value) {
        if (value.endsWith("/")) {
            return value.substring(0, value.length() - 1);
        }
        return value;
    }

    @NonNull
    private static String getString(@NonNull JsonObject object, @NonNull String key, @NonNull String fallback) {
        if (!object.has(key) || object.get(key).isJsonNull()) {
            return fallback;
        }
        return object.get(key).getAsString();
    }
}
