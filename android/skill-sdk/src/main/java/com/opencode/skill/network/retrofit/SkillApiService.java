package com.opencode.skill.network.retrofit;

import androidx.annotation.Nullable;

import com.google.gson.JsonElement;
import com.opencode.skill.network.retrofit.body.CreateNewSessionBody;
import com.opencode.skill.network.retrofit.body.CreateSessionBody;
import com.opencode.skill.network.retrofit.body.EmptyBody;
import com.opencode.skill.network.retrofit.body.ReplyPermissionBody;
import com.opencode.skill.network.retrofit.body.SendMessageBody;
import com.opencode.skill.network.retrofit.body.SendMessageToImBody;

import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.GET;
import retrofit2.http.POST;
import retrofit2.http.Path;
import retrofit2.http.Query;

public interface SkillApiService {
    @POST("api/skill/sessions")
    Call<JsonElement> createSession(@Body CreateSessionBody body);

    @POST("api/skill/sessions")
    Call<JsonElement> createNewSession(@Body CreateNewSessionBody body);

    @GET("api/skill/sessions")
    Call<JsonElement> listSessions(
            @Query("imGroupId") @Nullable String imGroupId,
            @Query("ak") @Nullable String ak,
            @Query("status") @Nullable String status,
            @Query("page") int page,
            @Query("size") int size
    );

    @GET("api/skill/sessions")
    Call<JsonElement> getHistorySessionsList(
            @Query("page") int page,
            @Query("size") int size,
            @Query("status") @Nullable String status,
            @Query("ak") @Nullable String ak,
            @Query("bussinessId") @Nullable String bussinessId,
            @Query("assistantAccount") @Nullable String assistantAccount,
            @Query("businessSessionDomain") @Nullable String businessSessionDomain
    );

    @GET("api/skill/sessions/{welinkSessionId}")
    Call<JsonElement> getSession(@Path("welinkSessionId") String welinkSessionId);

    @POST("api/skill/sessions/{welinkSessionId}/messages")
    Call<JsonElement> sendMessage(
            @Path("welinkSessionId") String welinkSessionId,
            @Body SendMessageBody body
    );

    @POST("api/skill/sessions/{welinkSessionId}/abort")
    Call<JsonElement> abortSession(
            @Path("welinkSessionId") String welinkSessionId,
            @Body EmptyBody body
    );

    @GET("api/skill/sessions/{welinkSessionId}/messages")
    Call<JsonElement> getMessages(
            @Path("welinkSessionId") String welinkSessionId,
            @Query("page") int page,
            @Query("size") int size
    );

    @GET("api/skill/sessions/{welinkSessionId}/messages/history")
    Call<JsonElement> getMessagesHistory(
            @Path("welinkSessionId") String welinkSessionId,
            @Query("beforeSeq") @Nullable Integer beforeSeq,
            @Query("size") int size
    );

    @POST("api/skill/sessions/{welinkSessionId}/permissions/{permId}")
    Call<JsonElement> replyPermission(
            @Path("welinkSessionId") String welinkSessionId,
            @Path("permId") String permId,
            @Body ReplyPermissionBody body
    );

    @POST("api/skill/sessions/{welinkSessionId}/send-to-im")
    Call<JsonElement> sendMessageToIm(
            @Path("welinkSessionId") String welinkSessionId,
            @Body SendMessageToImBody body
    );
}
