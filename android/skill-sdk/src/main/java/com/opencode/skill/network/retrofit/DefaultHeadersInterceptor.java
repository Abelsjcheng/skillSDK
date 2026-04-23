package com.opencode.skill.network.retrofit;

import androidx.annotation.NonNull;

import java.io.IOException;
import java.util.Map;

import okhttp3.Interceptor;
import okhttp3.Request;
import okhttp3.Response;

public final class DefaultHeadersInterceptor implements Interceptor {
    @NonNull
    private final Map<String, String> defaultHeaders;

    public DefaultHeadersInterceptor(@NonNull Map<String, String> defaultHeaders) {
        this.defaultHeaders = defaultHeaders;
    }

    @Override
    @NonNull
    public Response intercept(@NonNull Chain chain) throws IOException {
        Request.Builder builder = chain.request().newBuilder();
        for (Map.Entry<String, String> entry : defaultHeaders.entrySet()) {
            builder.header(entry.getKey(), entry.getValue());
        }
        return chain.proceed(builder.build());
    }
}
