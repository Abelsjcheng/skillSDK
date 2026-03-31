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
import com.opencode.skill.model.AgentType;
import com.opencode.skill.model.AgentTypeListResult;
import com.opencode.skill.model.CreateNewSessionParams;
import com.opencode.skill.model.CreateDigitalTwinResult;
import com.opencode.skill.model.CreateSessionParams;
import com.opencode.skill.model.CursorResult;
import com.opencode.skill.model.HistorySessionsParams;
import com.opencode.skill.model.PageResult;
import com.opencode.skill.model.ReplyPermissionResult;
import com.opencode.skill.model.SendMessageResult;
import com.opencode.skill.model.SendMessageToIMResult;
import com.opencode.skill.model.SessionMessage;
import com.opencode.skill.model.SkillSdkException;
import com.opencode.skill.model.SkillSession;
import com.opencode.skill.model.StopSkillResult;
import com.opencode.skill.model.WeAgent;
import com.opencode.skill.model.WeAgentDetails;
import com.opencode.skill.model.WeAgentDetailsArrayResult;
import com.opencode.skill.model.WeAgentListResult;

import java.io.IOException;
import java.lang.reflect.Type;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
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
    @Nullable
    private String assistantBaseUrl;
    @NonNull
    private Map<String, String> defaultHeaders = Collections.emptyMap();

    public synchronized void configure(@NonNull SkillSDKConfig config) {
        this.baseUrl = trimTrailingSlash(config.getBaseUrl());
        this.assistantBaseUrl = trimTrailingSlash(config.getAssistantBaseUrl());
        this.defaultHeaders = new HashMap<>(config.getDefaultHeaders());
        this.okHttpClient = new OkHttpClient.Builder()
                .connectTimeout(config.getConnectTimeout(), TimeUnit.MILLISECONDS)
                .readTimeout(config.getReadTimeout(), TimeUnit.MILLISECONDS)
                .writeTimeout(config.getWriteTimeout(), TimeUnit.MILLISECONDS)
                .build();
    }

    public void createSession(@NonNull CreateSessionParams params, @NonNull SkillCallback<SkillSession> callback) {
        JsonObject body = new JsonObject();
        if (params.getAk() != null && !params.getAk().trim().isEmpty()) {
            body.addProperty("ak", params.getAk().trim());
        }
        if (params.getTitle() != null && !params.getTitle().trim().isEmpty()) {
            body.addProperty("title", params.getTitle().trim());
        }
        if (params.getImGroupId() != null && !params.getImGroupId().trim().isEmpty()) {
            body.addProperty("imGroupId", params.getImGroupId().trim());
        }

        Request request = newRequestBuilder("/api/skill/sessions")
                .post(RequestBody.create(body.toString(), JSON_MEDIA_TYPE))
                .build();
        executeEnvelope(request, SkillSession.class, callback);
    }

    public void createNewSession(@NonNull CreateNewSessionParams params, @NonNull SkillCallback<SkillSession> callback) {
        JsonObject body = new JsonObject();
        body.addProperty("ak", params.getAk().trim());
        body.addProperty("bussinessDomain", params.getBussinessDomain().trim());
        body.addProperty("bussinessType", params.getBussinessType().trim());
        body.addProperty("bussinessId", params.getBussinessId().trim());
        body.addProperty("assistantAccount", params.getAssistantAccount().trim());

        if (params.getTitle() != null && !params.getTitle().trim().isEmpty()) {
            body.addProperty("title", params.getTitle().trim());
        }

        Request request = newRequestBuilder("/api/skill/sessions")
                .post(RequestBody.create(body.toString(), JSON_MEDIA_TYPE))
                .build();
        executeEnvelope(request, SkillSession.class, callback);
    }

    public void createDigitalTwin(
            @NonNull String name,
            @NonNull String icon,
            @NonNull String description,
            int weCrewType,
            @Nullable String bizRobotId,
            @NonNull SkillCallback<CreateDigitalTwinResult> callback
    ) {
        JsonObject body = new JsonObject();
        body.addProperty("name", name);
        body.addProperty("icon", icon);
        body.addProperty("description", description);
        body.addProperty("weCrewType", weCrewType);
        if (bizRobotId != null && !bizRobotId.trim().isEmpty()) {
            body.addProperty("bizRobotId", bizRobotId.trim());
        }

        Request request = newRequestBuilder("/v4-1/we-crew/im-register", true)
                .post(RequestBody.create(body.toString(), JSON_MEDIA_TYPE))
                .build();
        executeEnvelope(request, CreateDigitalTwinResult.class, callback);
    }

    public void getAgentType(@NonNull SkillCallback<AgentTypeListResult> callback) {
        Request request = newRequestBuilder("/v4-1/we-crew/inner-assistant/list", true)
                .get()
                .build();
        Type type = TypeToken.getParameterized(List.class, AgentType.class).getType();
        executeEnvelope(request, type, new SkillCallback<List<AgentType>>() {
            @Override
            public void onSuccess(@Nullable List<AgentType> result) {
                AgentTypeListResult payload = new AgentTypeListResult();
                payload.setContent(result == null ? new ArrayList<>() : result);
                callback.onSuccess(payload);
            }

            @Override
            public void onError(@NonNull Throwable error) {
                callback.onError(error);
            }
        });
    }

    public void getWeAgentList(int pageSize, int pageNumber, @NonNull SkillCallback<WeAgentListResult> callback) {
        Request request = newRequestBuilder(urlBuilder("/v4-1/we-crew/list", true)
                        .addQueryParameter("pageSize", String.valueOf(pageSize))
                        .addQueryParameter("pageNumber", String.valueOf(pageNumber))
                        .build())
                .get()
                .build();
        Type type = TypeToken.getParameterized(List.class, WeAgent.class).getType();
        executeEnvelope(request, type, new SkillCallback<List<WeAgent>>() {
            @Override
            public void onSuccess(@Nullable List<WeAgent> result) {
                WeAgentListResult payload = new WeAgentListResult();
                payload.setContent(result == null ? new ArrayList<>() : result);
                callback.onSuccess(payload);
            }

            @Override
            public void onError(@NonNull Throwable error) {
                callback.onError(error);
            }
        });
    }

    public void getWeAgentDetails(
            @NonNull String partnerAccount,
            @NonNull SkillCallback<WeAgentDetailsArrayResult> callback
    ) {
        Request request = newRequestBuilder("/v1/robot-partners/" + partnerAccount, true)
                .get()
                .build();
        executeEnvelope(request, JsonElement.class, new SkillCallback<JsonElement>() {
            @Override
            public void onSuccess(@Nullable JsonElement result) {
                WeAgentDetailsArrayResult payload = new WeAgentDetailsArrayResult();
                payload.setWeAgentDetailsArray(parseWeAgentDetails(result));
                callback.onSuccess(payload);
            }

            @Override
            public void onError(@NonNull Throwable error) {
                callback.onError(error);
            }
        });
    }

    @NonNull
    private List<WeAgentDetails> parseWeAgentDetails(@Nullable JsonElement payload) {
        if (payload == null || payload.isJsonNull()) {
            return new ArrayList<>();
        }
        if (payload.isJsonArray()) {
            Type listType = TypeToken.getParameterized(List.class, WeAgentDetails.class).getType();
            List<WeAgentDetails> parsed = gson.fromJson(payload, listType);
            return parsed == null ? new ArrayList<>() : parsed;
        }
        if (payload.isJsonObject()) {
            WeAgentDetails one = gson.fromJson(payload, WeAgentDetails.class);
            List<WeAgentDetails> single = new ArrayList<>();
            if (one != null) {
                single.add(one);
            }
            return single;
        }
        return new ArrayList<>();
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

    public void getHistorySessionsList(@NonNull HistorySessionsParams params,
            @NonNull SkillCallback<PageResult<SkillSession>> callback) {
        HttpUrl.Builder builder = urlBuilder("/api/skill/sessions")
                .addQueryParameter("page", String.valueOf(params.getPage()))
                .addQueryParameter("size", String.valueOf(params.getSize()));

        if (params.getStatus() != null && !params.getStatus().isEmpty()) {
            builder.addQueryParameter("status", params.getStatus());
        }
        if (params.getAk() != null && !params.getAk().isEmpty()) {
            builder.addQueryParameter("ak", params.getAk());
        }
        if (params.getBussinessId() != null && !params.getBussinessId().isEmpty()) {
            builder.addQueryParameter("bussinessId", params.getBussinessId());
        }
        if (params.getAssistantAccount() != null && !params.getAssistantAccount().isEmpty()) {
            builder.addQueryParameter("assistantAccount", params.getAssistantAccount());
        }
        if (params.getBusinessSessionDomain() != null && !params.getBusinessSessionDomain().isEmpty()) {
            builder.addQueryParameter("businessSessionDomain", params.getBusinessSessionDomain());
        }

        Request request = newRequestBuilder(builder.build())
                .get()
                .build();
        Type type = TypeToken.getParameterized(PageResult.class, SkillSession.class).getType();
        executeEnvelope(request, type, callback);
    }

    public void getSession(@NonNull String welinkSessionId, @NonNull SkillCallback<SkillSession> callback) {
        Request request = newRequestBuilder("/api/skill/sessions/" + welinkSessionId)
                .get()
                .build();
        executeEnvelope(request, SkillSession.class, callback);
    }

    public void sendMessage(@NonNull String welinkSessionId, @NonNull String content, @Nullable String toolCallId,
            @NonNull SkillCallback<SendMessageResult> callback) {
        JsonObject body = new JsonObject();
        body.addProperty("content", content);
        if (toolCallId != null && !toolCallId.trim().isEmpty()) {
            body.addProperty("toolCallId", toolCallId.trim());
        }

        Request request = newRequestBuilder("/api/skill/sessions/" + welinkSessionId + "/messages")
                .post(RequestBody.create(body.toString(), JSON_MEDIA_TYPE))
                .build();
        executeEnvelope(request, SendMessageResult.class, callback);
    }

    public void abortSession(@NonNull String welinkSessionId, @NonNull SkillCallback<StopSkillResult> callback) {
        Request request = newRequestBuilder("/api/skill/sessions/" + welinkSessionId + "/abort")
                .post(RequestBody.create("{}", JSON_MEDIA_TYPE))
                .build();
        executeEnvelope(request, StopSkillResult.class, callback);
    }

    public void getMessages(@NonNull String welinkSessionId, int page, int size,
            @NonNull SkillCallback<PageResult<SessionMessage>> callback) {
        HttpUrl url = urlBuilder("/api/skill/sessions/" + welinkSessionId + "/messages")
                .addQueryParameter("page", String.valueOf(page))
                .addQueryParameter("size", String.valueOf(size))
                .build();
        Request request = newRequestBuilder(url).get().build();
        Type type = TypeToken.getParameterized(PageResult.class, SessionMessage.class).getType();
        executeEnvelope(request, type, callback);
    }

    public void getMessagesHistory(
            @NonNull String welinkSessionId,
            @Nullable Integer beforeSeq,
            int size,
            @NonNull SkillCallback<CursorResult<SessionMessage>> callback
    ) {
        HttpUrl.Builder urlBuilder = urlBuilder("/api/skill/sessions/" + welinkSessionId + "/messages/history")
                .addQueryParameter("size", String.valueOf(size));
        if (beforeSeq != null) {
            urlBuilder.addQueryParameter("beforeSeq", String.valueOf(beforeSeq));
        }
        Request request = newRequestBuilder(urlBuilder.build()).get().build();
        Type type = TypeToken.getParameterized(CursorResult.class, SessionMessage.class).getType();
        executeEnvelope(request, type, callback);
    }

    public void replyPermission(@NonNull String welinkSessionId, @NonNull String permId, @NonNull String response,
            @NonNull SkillCallback<ReplyPermissionResult> callback) {
        JsonObject body = new JsonObject();
        body.addProperty("response", response);

        Request request = newRequestBuilder("/api/skill/sessions/" + welinkSessionId + "/permissions/" + permId)
                .post(RequestBody.create(body.toString(), JSON_MEDIA_TYPE))
                .build();
        executeEnvelope(request, ReplyPermissionResult.class, callback);
    }

    public void sendMessageToIM(@NonNull String welinkSessionId, @NonNull String content, @Nullable String chatId,
            @NonNull SkillCallback<SendMessageToIMResult> callback) {
        JsonObject body = new JsonObject();
        body.addProperty("content", content);
        if (chatId != null && !chatId.trim().isEmpty()) {
            body.addProperty("chatId", chatId.trim());
        }

        Request request = newRequestBuilder("/api/skill/sessions/" + welinkSessionId + "/send-to-im")
                .post(RequestBody.create(body.toString(), JSON_MEDIA_TYPE))
                .build();

        executeRaw(request, new SkillCallback<JsonElement>() {
            @Override
            public void onSuccess(@Nullable JsonElement result) {
                try {
                    callback.onSuccess(resolveSendMessageToIMResult(result));
                } catch (SkillSdkException exception) {
                    callback.onError(exception);
                }
            }

            @Override
            public void onError(@NonNull Throwable error) {
                callback.onError(error);
            }
        });
    }

    @NonNull
    private SendMessageToIMResult resolveSendMessageToIMResult(@Nullable JsonElement result) {
        if (result == null || result.isJsonNull() || !result.isJsonObject()) {
            return new SendMessageToIMResult(false);
        }

        JsonObject rootObject = result.getAsJsonObject();
        Boolean directSuccess = readOptionalBoolean(rootObject, "success");
        if (directSuccess != null) {
            return new SendMessageToIMResult(directSuccess);
        }

        String directStatus = getString(rootObject, "status", "");
        if (!directStatus.isEmpty()) {
            return new SendMessageToIMResult("success".equalsIgnoreCase(directStatus));
        }

        JsonObject dataObj = readObject(rootObject, "data");
        if (dataObj != null) {
            return new SendMessageToIMResult(resolveSendToImDataSuccess(dataObj));
        }

        return new SendMessageToIMResult(false);
    }

    private static boolean resolveSendToImDataSuccess(@NonNull JsonObject dataObj) {
        Boolean success = readOptionalBoolean(dataObj, "success");
        if (success != null) {
            return success;
        }
        String status = getString(dataObj, "status", "");
        if (!status.isEmpty()) {
            return "success".equalsIgnoreCase(status);
        }
        return true;
    }

    public synchronized void shutdown() {
        if (okHttpClient != null) {
            okHttpClient.dispatcher().executorService().shutdown();
            okHttpClient.connectionPool().evictAll();
        }
    }

    private <T> void executeEnvelope(@NonNull Request request, @NonNull Type type, @NonNull SkillCallback<T> callback) {
        executeRaw(request, new SkillCallback<JsonElement>() {
            @Override
            public void onSuccess(@Nullable JsonElement root) {
                if (root == null || root.isJsonNull()) {
                    callback.onSuccess(null);
                    return;
                }

                JsonElement payload = root;
                if (root.isJsonObject()) {
                    JsonObject rootObject = root.getAsJsonObject();
                    if (rootObject.has("data")) {
                        payload = rootObject.get("data");
                    }
                }

                if (payload == null || payload.isJsonNull()) {
                    callback.onSuccess(null);
                    return;
                }
                callback.onSuccess(gson.fromJson(payload, type));
            }

            @Override
            public void onError(@NonNull Throwable error) {
                callback.onError(error);
            }
        });
    }

    private void executeRaw(@NonNull Request request, @NonNull SkillCallback<JsonElement> callback) {
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
                    callback.onSuccess(root);
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
    private Request.Builder newRequestBuilder(@NonNull String path, boolean useAssistantBaseUrl) {
        return newRequestBuilder(urlBuilder(path, useAssistantBaseUrl).build());
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
    private HttpUrl.Builder urlBuilder(@NonNull String path, boolean useAssistantBaseUrl) {
        if (!useAssistantBaseUrl) {
            return urlBuilder(path);
        }
        String base = requireAssistantBaseUrl();
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
    private synchronized String requireAssistantBaseUrl() {
        if (assistantBaseUrl == null || assistantBaseUrl.isEmpty()) {
            return requireBaseUrl();
        }
        return assistantBaseUrl;
    }

    @NonNull
    private static String trimTrailingSlash(@NonNull String value) {
        if (value.endsWith("/")) {
            return value.substring(0, value.length() - 1);
        }
        return value;
    }

    @Nullable
    private static JsonObject readObject(@NonNull JsonObject object, @NonNull String key) {
        if (!object.has(key) || object.get(key).isJsonNull()) {
            return null;
        }
        JsonElement value = object.get(key);
        if (!value.isJsonObject()) {
            return null;
        }
        return value.getAsJsonObject();
    }

    @Nullable
    private static Boolean readOptionalBoolean(@NonNull JsonObject object, @NonNull String key) {
        if (!object.has(key) || object.get(key).isJsonNull() || !object.get(key).isJsonPrimitive()) {
            return null;
        }
        try {
            return object.get(key).getAsBoolean();
        } catch (Exception ignored) {
            return null;
        }
    }

    @NonNull
    private static String getString(@NonNull JsonObject object, @NonNull String key, @NonNull String fallback) {
        if (!object.has(key) || object.get(key).isJsonNull()) {
            return fallback;
        }
        return object.get(key).getAsString();
    }
}
