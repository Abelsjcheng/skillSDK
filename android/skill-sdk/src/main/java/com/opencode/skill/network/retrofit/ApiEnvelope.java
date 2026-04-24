package com.opencode.skill.network.retrofit;

import androidx.annotation.Keep;
import androidx.annotation.Nullable;

@Keep
public final class ApiEnvelope<T> {
    @Nullable
    private String code;
    @Nullable
    private String message;
    @Nullable
    private T data;

    @Nullable
    public String getCode() {
        return code;
    }

    public void setCode(@Nullable String code) {
        this.code = code;
    }

    @Nullable
    public String getMessage() {
        return message;
    }

    public void setMessage(@Nullable String message) {
        this.message = message;
    }

    @Nullable
    public T getData() {
        return data;
    }

    public void setData(@Nullable T data) {
        this.data = data;
    }
}
