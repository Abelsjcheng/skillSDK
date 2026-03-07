package com.opencode.skill.network;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.opencode.skill.model.ChatMessage;
import com.opencode.skill.model.CloseSkillResult;
import com.opencode.skill.model.CreateSessionRequest;
import com.opencode.skill.model.PageResult;
import com.opencode.skill.model.PermissionReplyRequest;
import com.opencode.skill.model.SendMessageRequest;
import com.opencode.skill.model.SendMessageResult;
import com.opencode.skill.model.SendMessageToIMResult;
import com.opencode.skill.model.SessionError;
import com.opencode.skill.model.SkillSession;
import com.opencode.skill.callback.SkillCallback;
import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.google.gson.reflect.TypeToken;

import java.io.IOException;
import java.lang.reflect.Type;
import java.util.List;
import java.util.concurrent.TimeUnit;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

/**
 * REST API 客户端
 * 负责与服务端进行 HTTP 通信
 */
public class ApiClient {

    private static final MediaType JSON_MEDIA_TYPE = MediaType.parse("application/json; charset=utf-8");

    @NonNull
    private final OkHttpClient okHttpClient;
    @NonNull
    private final Gson gson;
    @Nullable
    private String baseUrl;

    public ApiClient() {
        this.okHttpClient = new OkHttpClient.Builder()
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(60, TimeUnit.SECONDS)
                .writeTimeout(30, TimeUnit.SECONDS)
                .build();
        this.gson = new Gson();
    }

    public void setBaseUrl(@NonNull String baseUrl) {
        this.baseUrl = baseUrl;
    }

    @Nullable
    public String getBaseUrl() {
        return baseUrl;
    }

    public void createSession(@NonNull CreateSessionRequest request, @NonNull SkillCallback<SkillSession> callback) {
        String url = buildUrl("/api/skill/sessions");
        String json = gson.toJson(request);
        
        Request httpRequest = new Request.Builder()
                .url(url)
                .post(RequestBody.create(json, JSON_MEDIA_TYPE))
                .build();

        okHttpClient.newCall(httpRequest).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                callback.onError(new SessionError("NETWORK_ERROR", e.getMessage()));
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) {
                try {
                    if (response.isSuccessful() && response.body() != null) {
                        String responseBody = response.body().string();
                        SkillSession session = gson.fromJson(responseBody, SkillSession.class);
                        callback.onSuccess(session);
                    } else {
                        String errorMsg = parseErrorMessage(response);
                        callback.onError(new SessionError("API_ERROR", errorMsg));
                    }
                } catch (Exception e) {
                    callback.onError(new SessionError("PARSE_ERROR", e.getMessage()));
                } finally {
                    response.close();
                }
            }
        });
    }

    public void closeSession(long sessionId, @NonNull SkillCallback<CloseSkillResult> callback) {
        String url = buildUrl("/api/skill/sessions/" + sessionId);
        
        Request request = new Request.Builder()
                .url(url)
                .delete()
                .build();

        okHttpClient.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                callback.onError(new SessionError("NETWORK_ERROR", e.getMessage()));
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) {
                try {
                    if (response.isSuccessful() && response.body() != null) {
                        callback.onSuccess(new CloseSkillResult("success"));
                    } else {
                        String errorMsg = parseErrorMessage(response);
                        callback.onError(new SessionError("API_ERROR", errorMsg));
                    }
                } catch (Exception e) {
                    callback.onError(new SessionError("PARSE_ERROR", e.getMessage()));
                } finally {
                    response.close();
                }
            }
        });
    }

    public void getSession(long sessionId, @NonNull SkillCallback<SkillSession> callback) {
        String url = buildUrl("/api/skill/sessions/" + sessionId);
        
        Request request = new Request.Builder()
                .url(url)
                .get()
                .build();

        okHttpClient.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                callback.onError(new SessionError("NETWORK_ERROR", e.getMessage()));
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) {
                try {
                    if (response.isSuccessful() && response.body() != null) {
                        String responseBody = response.body().string();
                        SkillSession session = gson.fromJson(responseBody, SkillSession.class);
                        callback.onSuccess(session);
                    } else {
                        String errorMsg = parseErrorMessage(response);
                        callback.onError(new SessionError("API_ERROR", errorMsg));
                    }
                } catch (Exception e) {
                    callback.onError(new SessionError("PARSE_ERROR", e.getMessage()));
                } finally {
                    response.close();
                }
            }
        });
    }

    public void sendMessage(long sessionId, @NonNull String content, @NonNull SkillCallback<SendMessageResult> callback) {
        String url = buildUrl("/api/skill/sessions/" + sessionId + "/messages");
        SendMessageRequest request = new SendMessageRequest(content);
        String json = gson.toJson(request);
        
        Request httpRequest = new Request.Builder()
                .url(url)
                .post(RequestBody.create(json, JSON_MEDIA_TYPE))
                .build();

        okHttpClient.newCall(httpRequest).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                callback.onError(new SessionError("NETWORK_ERROR", e.getMessage()));
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) {
                try {
                    if (response.isSuccessful() && response.body() != null) {
                        String responseBody = response.body().string();
                        ChatMessage message = gson.fromJson(responseBody, ChatMessage.class);
                        callback.onSuccess(new SendMessageResult(message.getId(), message.getSeq(), message.getCreatedAt()));
                    } else {
                        String errorMsg = parseErrorMessage(response);
                        callback.onError(new SessionError("API_ERROR", errorMsg));
                    }
                } catch (Exception e) {
                    callback.onError(new SessionError("PARSE_ERROR", e.getMessage()));
                } finally {
                    response.close();
                }
            }
        });
    }

    public void getMessages(long sessionId, int page, int size, @NonNull SkillCallback<PageResult<ChatMessage>> callback) {
        String url = buildUrl("/api/skill/sessions/" + sessionId + "/messages?page=" + page + "&size=" + size);
        
        Request request = new Request.Builder()
                .url(url)
                .get()
                .build();

        okHttpClient.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                callback.onError(new SessionError("NETWORK_ERROR", e.getMessage()));
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) {
                try {
                    if (response.isSuccessful() && response.body() != null) {
                        String responseBody = response.body().string();
                        Type type = new TypeToken<PageResult<ChatMessage>>(){}.getType();
                        PageResult<ChatMessage> result = gson.fromJson(responseBody, type);
                        callback.onSuccess(result);
                    } else {
                        String errorMsg = parseErrorMessage(response);
                        callback.onError(new SessionError("API_ERROR", errorMsg));
                    }
                } catch (Exception e) {
                    callback.onError(new SessionError("PARSE_ERROR", e.getMessage()));
                } finally {
                    response.close();
                }
            }
        });
    }

    public void replyPermission(long sessionId, @NonNull String permissionId, boolean approved, @NonNull SkillCallback<Boolean> callback) {
        String url = buildUrl("/api/skill/sessions/" + sessionId + "/permissions/" + permissionId);
        PermissionReplyRequest request = new PermissionReplyRequest(approved);
        String json = gson.toJson(request);
        
        Request httpRequest = new Request.Builder()
                .url(url)
                .post(RequestBody.create(json, JSON_MEDIA_TYPE))
                .build();

        okHttpClient.newCall(httpRequest).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                callback.onError(new SessionError("NETWORK_ERROR", e.getMessage()));
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) {
                try {
                    if (response.isSuccessful()) {
                        callback.onSuccess(true);
                    } else {
                        String errorMsg = parseErrorMessage(response);
                        callback.onError(new SessionError("API_ERROR", errorMsg));
                    }
                } catch (Exception e) {
                    callback.onError(new SessionError("PARSE_ERROR", e.getMessage()));
                } finally {
                    response.close();
                }
            }
        });
    }

    public void sendMessageToIM(long sessionId, @NonNull String content, @NonNull SkillCallback<SendMessageToIMResult> callback) {
        String url = buildUrl("/api/skill/sessions/" + sessionId + "/send-to-im");
        SendMessageRequest request = new SendMessageRequest(content);
        String json = gson.toJson(request);
        
        Request httpRequest = new Request.Builder()
                .url(url)
                .post(RequestBody.create(json, JSON_MEDIA_TYPE))
                .build();

        okHttpClient.newCall(httpRequest).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                callback.onError(new SessionError("NETWORK_ERROR", e.getMessage()));
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) {
                try {
                    if (response.isSuccessful() && response.body() != null) {
                        String responseBody = response.body().string();
                        JsonObject result = JsonParser.parseString(responseBody).getAsJsonObject();
                        boolean success = result.has("success") && result.get("success").isBoolean() && result.get("success").getAsBoolean();
                        if (success) {
                            String chatId = result.has("chatId") ? result.get("chatId").getAsString() : "";
                            int contentLength = result.has("contentLength") ? result.get("contentLength").getAsInt() : 0;
                            callback.onSuccess(SendMessageToIMResult.success(chatId, contentLength));
                        } else {
                            String errorMsg = result.has("error") ? result.get("error").getAsString() : "Unknown error";
                            callback.onSuccess(SendMessageToIMResult.failure(errorMsg));
                        }
                    } else {
                        String errorMsg = parseErrorMessage(response);
                        callback.onSuccess(SendMessageToIMResult.failure(errorMsg));
                    }
                } catch (Exception e) {
                    callback.onError(new SessionError("PARSE_ERROR", e.getMessage()));
                } finally {
                    response.close();
                }
            }
        });
    }

    public void getSessions(long userId, int page, int size, @NonNull SkillCallback<PageResult<SkillSession>> callback) {
        String url = buildUrl("/api/skill/sessions?userId=" + userId + "&page=" + page + "&size=" + size);
        
        Request request = new Request.Builder()
                .url(url)
                .get()
                .build();

        okHttpClient.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                callback.onError(new SessionError("NETWORK_ERROR", e.getMessage()));
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) {
                try {
                    if (response.isSuccessful() && response.body() != null) {
                        String responseBody = response.body().string();
                        Type type = new TypeToken<PageResult<SkillSession>>(){}.getType();
                        PageResult<SkillSession> result = gson.fromJson(responseBody, type);
                        callback.onSuccess(result);
                    } else {
                        String errorMsg = parseErrorMessage(response);
                        callback.onError(new SessionError("API_ERROR", errorMsg));
                    }
                } catch (Exception e) {
                    callback.onError(new SessionError("PARSE_ERROR", e.getMessage()));
                } finally {
                    response.close();
                }
            }
        });
    }

    @NonNull
    private String buildUrl(@NonNull String path) {
        if (baseUrl == null) {
            throw new IllegalStateException("Base URL is not configured");
        }
        String base = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
        return base + path;
    }

    @NonNull
    private String parseErrorMessage(@NonNull Response response) {
        try {
            if (response.body() != null) {
                String body = response.body().string();
                JsonObject json = JsonParser.parseString(body).getAsJsonObject();
                if (json.has("error")) {
                    return json.get("error").getAsString();
                }
            }
        } catch (Exception ignored) {
        }
        return "HTTP " + response.code() + ": " + response.message();
    }

    public void shutdown() {
        okHttpClient.dispatcher().executorService().shutdown();
        okHttpClient.connectionPool().evictAll();
    }
}