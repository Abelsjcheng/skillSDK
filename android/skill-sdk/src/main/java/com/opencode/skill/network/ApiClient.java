package com.opencode.skill.network;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.reflect.TypeToken;
import com.opencode.skill.SkillSDKConfig;
import com.opencode.skill.callback.SkillCallback;
import com.opencode.skill.model.AgentType;
import com.opencode.skill.model.AgentTypeListResult;
import com.opencode.skill.model.CreateNewSessionParams;
import com.opencode.skill.model.CreateDigitalTwinResult;
import com.opencode.skill.model.CreateSessionParams;
import com.opencode.skill.model.CursorResult;
import com.opencode.skill.model.DeleteWeAgentResult;
import com.opencode.skill.model.HistorySessionsParams;
import com.opencode.skill.model.PageResult;
import com.opencode.skill.model.QrcodeInfo;
import com.opencode.skill.model.ReplyPermissionResult;
import com.opencode.skill.model.SendMessageResult;
import com.opencode.skill.model.SendMessageToIMResult;
import com.opencode.skill.model.Session;
import com.opencode.skill.model.SessionMessage;
import com.opencode.skill.model.SkillSdkException;
import com.opencode.skill.model.StopSkillResult;
import com.opencode.skill.model.UpdateQrcodeInfoResult;
import com.opencode.skill.model.UpdateWeAgentResult;
import com.opencode.skill.model.WeAgent;
import com.opencode.skill.model.WeAgentDetails;
import com.opencode.skill.model.WeAgentDetailsArrayResult;
import com.opencode.skill.model.WeAgentListResult;
import com.opencode.skill.network.retrofit.AssistantApiService;
import com.opencode.skill.network.retrofit.DefaultHeadersInterceptor;
import com.opencode.skill.network.retrofit.DirectExecutor;
import com.opencode.skill.network.retrofit.SkillApiService;
import com.opencode.skill.network.retrofit.body.CreateDigitalTwinBody;
import com.opencode.skill.network.retrofit.body.CreateNewSessionBody;
import com.opencode.skill.network.retrofit.body.CreateSessionBody;
import com.opencode.skill.network.retrofit.body.EmptyBody;
import com.opencode.skill.network.retrofit.body.ReplyPermissionBody;
import com.opencode.skill.network.retrofit.body.SendMessageBody;
import com.opencode.skill.network.retrofit.body.SendMessageToImBody;
import com.opencode.skill.network.retrofit.body.UpdateQrcodeInfoBody;
import com.opencode.skill.network.retrofit.body.UpdateWeAgentBody;

import java.io.IOException;
import java.lang.reflect.Type;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import okhttp3.OkHttpClient;
import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;

/**
 * HTTP client for skill server REST APIs.
 */
public class ApiClient {
    @NonNull
    private final Gson gson = new Gson();
    @Nullable
    private OkHttpClient okHttpClient;
    @Nullable
    private Retrofit skillRetrofit;
    @Nullable
    private SkillApiService skillApiService;
    @Nullable
    private Retrofit assistantRetrofit;
    @Nullable
    private AssistantApiService assistantApiService;
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
                .addInterceptor(new DefaultHeadersInterceptor(defaultHeaders))
                .connectTimeout(config.getConnectTimeout(), TimeUnit.MILLISECONDS)
                .readTimeout(config.getReadTimeout(), TimeUnit.MILLISECONDS)
                .writeTimeout(config.getWriteTimeout(), TimeUnit.MILLISECONDS)
                .build();
        this.skillRetrofit = new Retrofit.Builder()
                .baseUrl(ensureTrailingSlash(requireBaseUrl()))
                .client(requireClient())
                .callbackExecutor(new DirectExecutor())
                .addConverterFactory(GsonConverterFactory.create(gson))
                .build();
        this.assistantRetrofit = new Retrofit.Builder()
                .baseUrl(ensureTrailingSlash(requireAssistantBaseUrl()))
                .client(requireClient())
                .callbackExecutor(new DirectExecutor())
                .addConverterFactory(GsonConverterFactory.create(gson))
                .build();
        this.skillApiService = skillRetrofit.create(SkillApiService.class);
        this.assistantApiService = assistantRetrofit.create(AssistantApiService.class);
    }

    public void createSession(@NonNull CreateSessionParams params, @NonNull SkillCallback<Session> callback) {
        SkillApiService service = requireSkillApiService();
        enqueueEnvelope(service.createSession(new CreateSessionBody(
                normalizeNonBlank(params.getAk()),
                normalizeNonBlank(params.getTitle()),
                normalizeNonBlank(params.getBusinessSessionDomain()),
                params.getBusinessSessionId().trim(),
                normalizeNonBlank(params.getBusinessSessionType()),
                normalizeNonBlank(params.getAssistantAccount())
        )), Session.class, callback);
    }

    public void createNewSession(@NonNull CreateNewSessionParams params, @NonNull SkillCallback<Session> callback) {
        SkillApiService service = requireSkillApiService();
        enqueueEnvelope(service.createNewSession(new CreateNewSessionBody(
                normalizeNonBlank(params.getAk()),
                normalizeNonBlank(params.getBusinessSessionDomain()),
                normalizeNonBlank(params.getBusinessSessionType()),
                params.getBusinessSessionId().trim(),
                normalizeNonBlank(params.getAssistantAccount()),
                normalizeNonBlank(params.getTitle())
        )), Session.class, callback);
    }

    public void createDigitalTwin(
            @NonNull String name,
            @NonNull String icon,
            @NonNull String description,
            @Nullable Integer weCrewType,
            @Nullable String bizRobotId,
            @Nullable String qrcode,
            @NonNull SkillCallback<CreateDigitalTwinResult> callback
    ) {
        AssistantApiService service = requireAssistantApiService();
        enqueueEnvelope(
                service.createDigitalTwin(new CreateDigitalTwinBody(name, icon, description, weCrewType, bizRobotId, qrcode)),
                CreateDigitalTwinResult.class,
                callback
        );
    }

    public void getAgentType(@NonNull SkillCallback<AgentTypeListResult> callback) {
        AssistantApiService service = requireAssistantApiService();
        Type type = TypeToken.getParameterized(List.class, AgentType.class).getType();
        enqueueEnvelope(service.getAgentType(), type, new SkillCallback<List<AgentType>>() {
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
        AssistantApiService service = requireAssistantApiService();
        Type type = TypeToken.getParameterized(List.class, WeAgent.class).getType();
        enqueueEnvelope(service.getWeAgentList(pageSize, pageNumber), type, new SkillCallback<List<WeAgent>>() {
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
        AssistantApiService service = requireAssistantApiService();
        enqueueEnvelope(service.getWeAgentDetails(partnerAccount), JsonElement.class, new SkillCallback<JsonElement>() {
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

    public void getMyWeAgentDetail(@NonNull SkillCallback<WeAgentDetails> callback) {
        AssistantApiService service = requireAssistantApiService();
        enqueueEnvelope(service.getMyWeAgent(), JsonElement.class, new SkillCallback<JsonElement>() {
            @Override
            public void onSuccess(@Nullable JsonElement result) {
                callback.onSuccess(parseMyWeAgentDetail(result));
            }

            @Override
            public void onError(@NonNull Throwable error) {
                callback.onError(error);
            }
        });
    }

    /**
     * 使用 partnerAccount 定位助理并提交名称、头像和描述更新。
     *
     * <p>方法组装更新请求体，复用统一 JSON 入队与响应解析流程，将服务端结果转换为
     * {@link UpdateWeAgentResult} 后回调。</p>
     */
    public void updateWeAgent(
            @NonNull String partnerAccount,
            @NonNull String name,
            @NonNull String icon,
            @NonNull String description,
            @NonNull SkillCallback<UpdateWeAgentResult> callback
    ) {
        AssistantApiService service = requireAssistantApiService();
        enqueueJson(service.updateWeAgent(new UpdateWeAgentBody(partnerAccount, name, icon, description)),
                new SkillCallback<JsonElement>() {
            @Override
            public void onSuccess(@Nullable JsonElement result) {
                try {
                    callback.onSuccess(resolveUpdateWeAgentResult(result));
                } catch (SkillSdkException error) {
                    callback.onError(error);
                }
            }

            @Override
            public void onError(@NonNull Throwable error) {
                callback.onError(error);
            }
        });
    }

    /**
     * 使用唯一 partnerAccount 调用助理删除接口。
     *
     * <p>账号会先去除首尾空白，再作为删除查询参数发送；响应由统一解析流程转换为
     * {@link DeleteWeAgentResult}。</p>
     */
    public void deleteWeAgent(
            @NonNull String partnerAccount,
            @NonNull SkillCallback<DeleteWeAgentResult> callback
    ) {
        AssistantApiService service = requireAssistantApiService();
        String normalizedPartnerAccount = partnerAccount == null ? null : partnerAccount.trim();
        enqueueJson(service.deleteWeAgent(
                normalizedPartnerAccount == null || normalizedPartnerAccount.isEmpty() ? null : normalizedPartnerAccount,
                null
        ), new SkillCallback<JsonElement>() {
            @Override
            public void onSuccess(@Nullable JsonElement result) {
                try {
                    callback.onSuccess(resolveDeleteWeAgentResult(result));
                } catch (SkillSdkException error) {
                    callback.onError(error);
                }
            }

            @Override
            public void onError(@NonNull Throwable error) {
                callback.onError(error);
            }
        });
    }

    public void queryQrcodeInfo(@NonNull String qrcode, @NonNull SkillCallback<QrcodeInfo> callback) {
        AssistantApiService service = requireAssistantApiService();
        enqueueEnvelope(service.queryQrcodeInfo(qrcode), QrcodeInfo.class, callback);
    }

    public void updateQrcodeInfo(
            @NonNull String qrcode,
            @Nullable String robotId,
            int status,
            @NonNull SkillCallback<UpdateQrcodeInfoResult> callback
    ) {
        AssistantApiService service = requireAssistantApiService();
        enqueueJson(service.updateQrcodeInfo(new UpdateQrcodeInfoBody(qrcode, robotId, status)), new SkillCallback<JsonElement>() {
            @Override
            public void onSuccess(@Nullable JsonElement result) {
                try {
                    callback.onSuccess(resolveUpdateQrcodeInfoResult(result));
                } catch (SkillSdkException error) {
                    callback.onError(error);
                }
            }

            @Override
            public void onError(@NonNull Throwable error) {
                callback.onError(error);
            }
        });
    }

    public void queryAssistantGraySingle(
            @NonNull String partnerAccount,
            @NonNull SkillCallback<Boolean> callback
    ) {
        AssistantApiService service = requireAssistantApiService();
        enqueueEnvelope(service.queryAssistantGraySingle(partnerAccount), Boolean.class, callback);
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

    @Nullable
    private WeAgentDetails parseMyWeAgentDetail(@Nullable JsonElement payload) {
        if (payload == null || payload.isJsonNull() || !payload.isJsonObject()) {
            return null;
        }

        JsonObject rootObject = payload.getAsJsonObject();
        WeAgentDetails detail = gson.fromJson(rootObject, WeAgentDetails.class);
        if (detail == null) {
            detail = new WeAgentDetails();
        }
        detail.setId(getString(rootObject, "robotId", detail.getId()));
        return detail;
    }

    public void listSessions(@Nullable String imGroupId, @Nullable String ak, @Nullable String status, int page, int size,
            @NonNull SkillCallback<PageResult<Session>> callback) {
        SkillApiService service = requireSkillApiService();
        Type type = TypeToken.getParameterized(PageResult.class, Session.class).getType();
        enqueueEnvelope(service.listSessions(
                normalizeNonBlank(imGroupId),
                normalizeNonBlank(ak),
                normalizeNonBlank(status),
                page,
                size
        ), type, callback);
    }

    public void getHistorySessionsList(@NonNull HistorySessionsParams params,
            @NonNull SkillCallback<PageResult<Session>> callback) {
        SkillApiService service = requireSkillApiService();
        Type type = TypeToken.getParameterized(PageResult.class, Session.class).getType();
        enqueueEnvelope(service.getHistorySessionsList(
                params.getPage(),
                params.getSize(),
                normalizeNonBlank(params.getStatus()),
                normalizeNonBlank(params.getAk()),
                normalizeNonBlank(params.getBusinessSessionId()),
                normalizeNonBlank(params.getAssistantAccount()),
                normalizeNonBlank(params.getBusinessSessionDomain())
        ), type, callback);
    }

    public void getSession(@NonNull String welinkSessionId, @NonNull SkillCallback<Session> callback) {
        enqueueEnvelope(requireSkillApiService().getSession(welinkSessionId), Session.class, callback);
    }

    public void sendMessage(
            @NonNull String welinkSessionId,
            @NonNull String content,
            @Nullable String toolCallId,
            @Nullable String questionId,
            @Nullable String subagentSessionId,
            @Nullable JsonObject businessExtParam,
            @NonNull SkillCallback<SendMessageResult> callback) {
        enqueueEnvelope(requireSkillApiService().sendMessage(
                welinkSessionId,
                new SendMessageBody(
                        content,
                        normalizeNonBlank(toolCallId),
                        normalizeNonBlank(questionId),
                        normalizeNonBlank(subagentSessionId),
                        businessExtParam
                )
        ), SendMessageResult.class, callback);
    }

    public void abortSession(@NonNull String welinkSessionId, @NonNull SkillCallback<StopSkillResult> callback) {
        enqueueEnvelope(
                requireSkillApiService().abortSession(welinkSessionId, new EmptyBody()),
                StopSkillResult.class,
                callback
        );
    }

    public void getMessages(@NonNull String welinkSessionId, int page, int size,
            @NonNull SkillCallback<PageResult<SessionMessage>> callback) {
        Type type = TypeToken.getParameterized(PageResult.class, SessionMessage.class).getType();
        enqueueEnvelope(requireSkillApiService().getMessages(welinkSessionId, page, size), type, callback);
    }

    public void getMessagesHistory(
            @NonNull String welinkSessionId,
            @Nullable Integer beforeSeq,
            int size,
            @NonNull SkillCallback<CursorResult<SessionMessage>> callback
    ) {
        Type type = TypeToken.getParameterized(CursorResult.class, SessionMessage.class).getType();
        enqueueEnvelope(requireSkillApiService().getMessagesHistory(welinkSessionId, beforeSeq, size), type, callback);
    }

    public void replyPermission(
            @NonNull String welinkSessionId,
            @NonNull String permId,
            @NonNull String response,
            @Nullable String subagentSessionId,
            @Nullable JsonObject businessExtParam,
            @NonNull SkillCallback<ReplyPermissionResult> callback) {
        enqueueEnvelope(requireSkillApiService().replyPermission(
                welinkSessionId,
                permId,
                new ReplyPermissionBody(response, normalizeNonBlank(subagentSessionId), businessExtParam)
        ), ReplyPermissionResult.class, callback);
    }

    public void sendMessageToIM(@NonNull String welinkSessionId, @NonNull String content, @Nullable String chatId,
            @NonNull SkillCallback<SendMessageToIMResult> callback) {
        enqueueJson(requireSkillApiService().sendMessageToIm(
                welinkSessionId,
                new SendMessageToImBody(content, normalizeNonBlank(chatId))
        ), new SkillCallback<JsonElement>() {
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

    @NonNull
    private UpdateQrcodeInfoResult resolveUpdateQrcodeInfoResult(@Nullable JsonElement result) {
        return new UpdateQrcodeInfoResult("success");
    }

    @NonNull
    private UpdateWeAgentResult resolveUpdateWeAgentResult(@Nullable JsonElement result) {
        return new UpdateWeAgentResult("success");
    }

    @NonNull
    private DeleteWeAgentResult resolveDeleteWeAgentResult(@Nullable JsonElement result) {
        return new DeleteWeAgentResult("success");
    }

    private void ensureSuccessCode(@NonNull JsonObject rootObject, @NonNull String method) {
        Integer code = getInteger(rootObject, "code");
        int errorCode = code == null ? 7000 : code;
        if (errorCode == 0 || errorCode == 200) {
            return;
        }
        String message = getString(rootObject, "message", "");
        if (message.isEmpty()) {
            message = getString(rootObject, "errormsg", "");
        }
        throw new SkillSdkException(errorCode, message.isEmpty() ? "Request failed" : message);
    }

    public synchronized void shutdown() {
        if (okHttpClient != null) {
            okHttpClient.dispatcher().executorService().shutdown();
            okHttpClient.connectionPool().evictAll();
        }
        skillApiService = null;
        skillRetrofit = null;
        assistantApiService = null;
        assistantRetrofit = null;
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
    private synchronized AssistantApiService requireAssistantApiService() {
        if (assistantApiService == null) {
            throw new IllegalStateException("AssistantApiService is not configured");
        }
        return assistantApiService;
    }

    @NonNull
    private synchronized SkillApiService requireSkillApiService() {
        if (skillApiService == null) {
            throw new IllegalStateException("SkillApiService is not configured");
        }
        return skillApiService;
    }

    @NonNull
    private static String trimTrailingSlash(@NonNull String value) {
        if (value.endsWith("/")) {
            return value.substring(0, value.length() - 1);
        }
        return value;
    }

    @NonNull
    private static String ensureTrailingSlash(@NonNull String value) {
        return value.endsWith("/") ? value : value + "/";
    }

    @Nullable
    private static String normalizeNonBlank(@Nullable String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private <T> void enqueueEnvelope(
            @NonNull retrofit2.Call<JsonElement> call,
            @NonNull Type type,
            @NonNull SkillCallback<T> callback
    ) {
        call.enqueue(new retrofit2.Callback<JsonElement>() {
            @Override
            public void onResponse(
                    @NonNull retrofit2.Call<JsonElement> call,
                    @NonNull retrofit2.Response<JsonElement> response
            ) {
                if (!response.isSuccessful()) {
                    callback.onError(new SkillSdkException(
                            7000,
                            "HTTP " + response.code() + ": " + response.message()
                    ));
                    return;
                }
                JsonElement root = response.body();
                if (root == null || root.isJsonNull()) {
                    callback.onSuccess(null);
                    return;
                }

                JsonElement payload = root;
                if (root.isJsonObject()) {
                    JsonObject rootObject = root.getAsJsonObject();
                    if (rootObject.has("code")) {
                        try {
                            ensureSuccessCode(rootObject, "request");
                        } catch (SkillSdkException exception) {
                            callback.onError(exception);
                            return;
                        }
                    }
                    if (rootObject.has("data")) {
                        payload = rootObject.get("data");
                    }
                }

                if (payload == null || payload.isJsonNull()) {
                    callback.onSuccess(null);
                    return;
                }

                try {
                    callback.onSuccess(gson.fromJson(payload, type));
                } catch (Exception exception) {
                    callback.onError(new SkillSdkException(
                            5000,
                            "Parse response failed: " + exception.getMessage(),
                            exception
                    ));
                }
            }

            @Override
            public void onFailure(@NonNull retrofit2.Call<JsonElement> call, @NonNull Throwable throwable) {
                callback.onError(wrapRetrofitFailure(throwable));
            }
        });
    }

    private void enqueueJson(
            @NonNull retrofit2.Call<JsonElement> call,
            @NonNull SkillCallback<JsonElement> callback
    ) {
        call.enqueue(new retrofit2.Callback<JsonElement>() {
            @Override
            public void onResponse(
                    @NonNull retrofit2.Call<JsonElement> call,
                    @NonNull retrofit2.Response<JsonElement> response
            ) {
                if (!response.isSuccessful()) {
                    callback.onError(new SkillSdkException(
                            7000,
                            "HTTP " + response.code() + ": " + response.message()
                    ));
                    return;
                }
                JsonElement root = response.body();
                if (root != null && root.isJsonObject()) {
                    JsonObject rootObject = root.getAsJsonObject();
                    if (rootObject.has("code")) {
                        try {
                            ensureSuccessCode(rootObject, "request");
                        } catch (SkillSdkException exception) {
                            callback.onError(exception);
                            return;
                        }
                    }
                }
                callback.onSuccess(root);
            }

            @Override
            public void onFailure(@NonNull retrofit2.Call<JsonElement> call, @NonNull Throwable throwable) {
                callback.onError(wrapRetrofitFailure(throwable));
            }
        });
    }

    @NonNull
    private SkillSdkException wrapRetrofitFailure(@NonNull Throwable throwable) {
        if (throwable instanceof IOException) {
            return new SkillSdkException(6000, "Network error: " + throwable.getMessage(), throwable);
        }
        return new SkillSdkException(5000, "Parse response failed: " + throwable.getMessage(), throwable);
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

    @Nullable
    private static Integer getInteger(@NonNull JsonObject object, @NonNull String key) {
        if (!object.has(key) || object.get(key).isJsonNull()) {
            return null;
        }
        try {
            return object.get(key).getAsInt();
        } catch (Exception ignored) {
            return null;
        }
    }
}
