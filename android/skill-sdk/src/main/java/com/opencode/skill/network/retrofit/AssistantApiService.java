package com.opencode.skill.network.retrofit;

import androidx.annotation.Nullable;

import com.google.gson.JsonElement;
import com.opencode.skill.model.AgentType;
import com.opencode.skill.network.retrofit.body.CreateDigitalTwinBody;
import com.opencode.skill.network.retrofit.body.UpdateQrcodeInfoBody;
import com.opencode.skill.network.retrofit.body.UpdateWeAgentBody;

import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.DELETE;
import retrofit2.http.GET;
import retrofit2.http.POST;
import retrofit2.http.PUT;
import retrofit2.http.Path;
import retrofit2.http.Query;

public interface AssistantApiService {
    @POST("v4-1/we-crew/im-register")
    Call<JsonElement> createDigitalTwin(@Body CreateDigitalTwinBody body);

    @GET("v4-1/we-crew/inner-assistant/list")
    Call<JsonElement> getAgentType();

    @GET("v4-1/we-crew/list")
    Call<JsonElement> getWeAgentList(
            @Query("pageSize") int pageSize,
            @Query("pageNumber") int pageNumber
    );

    @GET("v1/robot-partners/{partnerAccount}")
    Call<JsonElement> getWeAgentDetails(@Path("partnerAccount") String partnerAccount);

    @PUT("v4-1/we-crew")
    Call<JsonElement> updateWeAgent(@Body UpdateWeAgentBody body);

    @DELETE("v4-1/we-crew")
    Call<JsonElement> deleteWeAgent(
            @Query("partnerAccount") @Nullable String partnerAccount,
            @Query("robotId") @Nullable String robotId
    );

    @GET("nologin/we-crew/im-register/qrcode/{qrcode}")
    Call<JsonElement> queryQrcodeInfo(@Path("qrcode") String qrcode);

    @PUT("v4-1/we-crew/im-register/qrcode")
    Call<JsonElement> updateQrcodeInfo(@Body UpdateQrcodeInfoBody body);
}
