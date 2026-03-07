package com.opencode.skill;

import androidx.annotation.NonNull;

/**
 * Skill SDK 配置类
 */
public class SkillSDKConfig {

    @NonNull
    private final String baseUrl;
    private final long connectTimeout;
    private final long readTimeout;
    private final long writeTimeout;
    private final boolean enableReconnect;
    private final long reconnectInterval;

    private SkillSDKConfig(@NonNull Builder builder) {
        this.baseUrl = builder.baseUrl;
        this.connectTimeout = builder.connectTimeout;
        this.readTimeout = builder.readTimeout;
        this.writeTimeout = builder.writeTimeout;
        this.enableReconnect = builder.enableReconnect;
        this.reconnectInterval = builder.reconnectInterval;
    }

    @NonNull
    public String getBaseUrl() {
        return baseUrl;
    }

    public long getConnectTimeout() {
        return connectTimeout;
    }

    public long getReadTimeout() {
        return readTimeout;
    }

    public long getWriteTimeout() {
        return writeTimeout;
    }

    public boolean isEnableReconnect() {
        return enableReconnect;
    }

    public long getReconnectInterval() {
        return reconnectInterval;
    }

    public static class Builder {
        private String baseUrl;
        private long connectTimeout = 30000;
        private long readTimeout = 60000;
        private long writeTimeout = 30000;
        private boolean enableReconnect = true;
        private long reconnectInterval = 5000;

        @NonNull
        public Builder baseUrl(@NonNull String baseUrl) {
            this.baseUrl = baseUrl;
            return this;
        }

        @NonNull
        public Builder connectTimeout(long connectTimeout) {
            this.connectTimeout = connectTimeout;
            return this;
        }

        @NonNull
        public Builder readTimeout(long readTimeout) {
            this.readTimeout = readTimeout;
            return this;
        }

        @NonNull
        public Builder writeTimeout(long writeTimeout) {
            this.writeTimeout = writeTimeout;
            return this;
        }

        @NonNull
        public Builder enableReconnect(boolean enableReconnect) {
            this.enableReconnect = enableReconnect;
            return this;
        }

        @NonNull
        public Builder reconnectInterval(long reconnectInterval) {
            this.reconnectInterval = reconnectInterval;
            return this;
        }

        @NonNull
        public SkillSDKConfig build() {
            if (baseUrl == null || baseUrl.isEmpty()) {
                throw new IllegalArgumentException("baseUrl is required");
            }
            return new SkillSDKConfig(this);
        }
    }
}