package com.opencode.skill.api;

import com.opencode.skill.model.ChatMessage;
import com.opencode.skill.model.CreateSessionRequest;
import com.opencode.skill.model.PageResult;
import com.opencode.skill.model.PermissionReplyRequest;
import com.opencode.skill.model.SendMessageRequest;
import com.opencode.skill.model.SkillSession;

import java.util.Map;

import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.DELETE;
import retrofit2.http.GET;
import retrofit2.http.POST;
import retrofit2.http.Path;
import retrofit2.http.Query;

public interface SkillApiService {
    @POST("api/skill/sessions")
    Call<SkillSession> createSession(@Body CreateSessionRequest request);

    @GET("api/skill/sessions/{id}")
    Call<SkillSession> getSession(@Path("id") Long sessionId);

    @GET("api/skill/sessions")
    Call<PageResult<SkillSession>> getSessions(
            @Query("userId") Long userId,
            @Query("statuses") String statuses,
            @Query("page") Integer page,
            @Query("size") Integer size
    );

    @DELETE("api/skill/sessions/{id}")
    Call<Map<String, Object>> closeSession(@Path("id") Long sessionId);

    @POST("api/skill/sessions/{sessionId}/messages")
    Call<ChatMessage> sendMessage(
            @Path("sessionId") Long sessionId,
            @Body SendMessageRequest request
    );

    @GET("api/skill/sessions/{sessionId}/messages")
    Call<PageResult<ChatMessage>> getMessages(
            @Path("sessionId") Long sessionId,
            @Query("page") Integer page,
            @Query("size") Integer size
    );

    @POST("api/skill/sessions/{sessionId}/permissions/{permissionId}")
    Call<Map<String, Object>> replyPermission(
            @Path("sessionId") Long sessionId,
            @Path("permissionId") String permissionId,
            @Body PermissionReplyRequest request
    );

    @POST("api/skill/sessions/{sessionId}/send-to-im")
    Call<Map<String, Object>> sendMessageToIM(
            @Path("sessionId") Long sessionId,
            @Body SendMessageRequest request
    );
}