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
import com.opencode.skill.model.SessionMessage;
import com.opencode.skill.model.SkillSdkException;
import com.opencode.skill.model.SkillSession;
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

    public void createSession(@NonNull CreateSessionParams params, @NonNull SkillCallback<SkillSession> callback) {
        SkillApiService service = requireSkillApiService();
        enqueueEnvelope(service.createSession(new CreateSessionBody(
                normalizeNonBlank(params.getAk()),
                normalizeNonBlank(params.getTitle()),
                normalizeNonBlank(params.getImGroupId())
        )), SkillSession.class, callback);
    }

    public void createNewSession(@NonNull CreateNewSessionParams params, @NonNull SkillCallback<SkillSession> callback) {
        SkillApiService service = requireSkillApiService();
        enqueueEnvelope(service.createNewSession(new CreateNewSessionBody(
                params.getAk().trim(),
                params.getBussinessDomain().trim(),
                params.getBussinessType().trim(),
                params.getBussinessId().trim(),
                params.getAssistantAccount().trim(),
                normalizeNonBlank(params.getTitle())
        )), SkillSession.class, callback);
    }

    public void createDigitalTwin(
            @NonNull String name,
            @NonNull String icon,
            @NonNull String description,
            int weCrewType,
            @Nullable String bizRobotId,
            @NonNull SkillCallback<CreateDigitalTwinResult> callback
    ) {
        AssistantApiService service = requireAssistantApiService();
        enqueueEnvelope(
                service.createDigitalTwin(new CreateDigitalTwinBody(name, icon, description, weCrewType, bizRobotId)),
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

    public void updateWeAgent(
            @Nullable String partnerAccount,
            @Nullable String robotId,
            @NonNull String name,
            @NonNull String icon,
            @NonNull String description,
            @NonNull SkillCallback<UpdateWeAgentResult> callback
    ) {
        AssistantApiService service = requireAssistantApiService();
        enqueueJson(service.updateWeAgent(new UpdateWeAgentBody(partnerAccount, robotId, name, icon, description)),
                new SkillCallback<JsonElement>() {
            @Override
            public void onSuccess(@Nullable JsonElement result) {
                try {
                    callback.onSuccess(new UpdateWeAgentResult(resolveResponseMessage(result)));
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

    public void deleteWeAgent(
            @Nullable String partnerAccount,
            @Nullable String robotId,
            @NonNull SkillCallback<DeleteWeAgentResult> callback
    ) {
        AssistantApiService service = requireAssistantApiService();
        String normalizedPartnerAccount = partnerAccount == null ? null : partnerAccount.trim();
        String normalizedRobotId = robotId == null ? null : robotId.trim();
        enqueueJson(service.deleteWeAgent(
                normalizedPartnerAccount == null || normalizedPartnerAccount.isEmpty() ? null : normalizedPartnerAccount,
                normalizedRobotId == null || normalizedRobotId.isEmpty() ? null : normalizedRobotId
        ), new SkillCallback<JsonElement>() {
            @Override
            public void onSuccess(@Nullable JsonElement result) {
                try {
                    callback.onSuccess(new DeleteWeAgentResult(resolveResponseMessage(result)));
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
        SkillApiService service = requireSkillApiService();
        Type type = TypeToken.getParameterized(PageResult.class, SkillSession.class).getType();
        enqueueEnvelope(service.listSessions(
                normalizeNonBlank(imGroupId),
                normalizeNonBlank(ak),
                normalizeNonBlank(status),
                page,
                size
        ), type, callback);
    }

    public void getHistorySessionsList(@NonNull HistorySessionsParams params,
            @NonNull SkillCallback<PageResult<SkillSession>> callback) {
        SkillApiService service = requireSkillApiService();
        Type type = TypeToken.getParameterized(PageResult.class, SkillSession.class).getType();
        enqueueEnvelope(service.getHistorySessionsList(
                params.getPage(),
                params.getSize(),
                normalizeNonBlank(params.getStatus()),
                normalizeNonBlank(params.getAk()),
                normalizeNonBlank(params.getBussinessId()),
                normalizeNonBlank(params.getAssistantAccount()),
                normalizeNonBlank(params.getBusinessSessionDomain())
        ), type, callback);
    }

    public void getSession(@NonNull String welinkSessionId, @NonNull SkillCallback<SkillSession> callback) {
        enqueueEnvelope(requireSkillApiService().getSession(welinkSessionId), SkillSession.class, callback);
    }

    public void sendMessage(@NonNull String welinkSessionId, @NonNull String content, @Nullable String toolCallId,
            @NonNull SkillCallback<SendMessageResult> callback) {
        enqueueEnvelope(requireSkillApiService().sendMessage(
                welinkSessionId,
                new SendMessageBody(content, normalizeNonBlank(toolCallId))
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

    public void replyPermission(@NonNull String welinkSessionId, @NonNull String permId, @NonNull String response,
            @NonNull SkillCallback<ReplyPermissionResult> callback) {
        enqueueEnvelope(requireSkillApiService().replyPermission(
                welinkSessionId,
                permId,
                new ReplyPermissionBody(response)
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
        if (result == null || result.isJsonNull() || !result.isJsonObject()) {
            throw new SkillSdkException(7000, "Unexpected updateQrcodeInfo response schema");
        }
        JsonObject rootObject = result.getAsJsonObject();
        String code = getString(rootObject, "code", "");
        if (!"200".equals(code) && !"200.0".equals(code)) {
            throw new SkillSdkException(7000, "updateQrcodeInfo did not return code 200");
        }
        return new UpdateQrcodeInfoResult("success");
    }

    @NonNull
    private String resolveResponseMessage(@Nullable JsonElement result) {
        if (result == null || result.isJsonNull() || !result.isJsonObject()) {
            throw new SkillSdkException(7000, "Unexpected response schema");
        }
        JsonObject rootObject = result.getAsJsonObject();
        String message = getString(rootObject, "message", "");
        if (message.isEmpty()) {
            throw new SkillSdkException(7000, "Response message is empty");
        }
        return message;
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
                callback.onSuccess(response.body());
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
}
