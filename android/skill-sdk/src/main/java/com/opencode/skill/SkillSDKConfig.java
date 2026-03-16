package com.opencode.skill;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

/**
 * Skill SDK configuration.
 */
public class SkillSDKConfig {

    @NonNull
    private final String baseUrl;
    @Nullable
    private final String wsUrl;
    private final long connectTimeout;
    private final long readTimeout;
    private final long writeTimeout;
    private final boolean enableReconnect;
    private final long reconnectInterval;
    private final boolean autoDisconnectWhenNoListener;
    @NonNull
    private final Map<String, String> defaultHeaders;
    @NonNull
    private final Map<String, String> webSocketHeaders;

    private SkillSDKConfig(@NonNull Builder builder) {
        this.baseUrl = builder.baseUrl;
        this.wsUrl = builder.wsUrl;
        this.connectTimeout = builder.connectTimeout;
        this.readTimeout = builder.readTimeout;
        this.writeTimeout = builder.writeTimeout;
        this.enableReconnect = builder.enableReconnect;
        this.reconnectInterval = builder.reconnectInterval;
        this.autoDisconnectWhenNoListener = builder.autoDisconnectWhenNoListener;
        this.defaultHeaders = Collections.unmodifiableMap(new HashMap<>(builder.defaultHeaders));
        this.webSocketHeaders = Collections.unmodifiableMap(new HashMap<>(builder.webSocketHeaders));
    }

    @NonNull
    public String getBaseUrl() {
        return baseUrl;
    }

    @Nullable
    public String getWsUrl() {
        return wsUrl;
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

    public boolean isAutoDisconnectWhenNoListener() {
        return autoDisconnectWhenNoListener;
    }

    @NonNull
    public Map<String, String> getDefaultHeaders() {
        return defaultHeaders;
    }

    @NonNull
    public Map<String, String> getWebSocketHeaders() {
        return webSocketHeaders;
    }

    public static class Builder {
        private String baseUrl;
        @Nullable
        private String wsUrl;
        private long connectTimeout = 30000L;
        private long readTimeout = 60000L;
        private long writeTimeout = 30000L;
        private boolean enableReconnect = true;
        private long reconnectInterval = 5000L;
        private boolean autoDisconnectWhenNoListener = false;
        private final Map<String, String> defaultHeaders = new HashMap<>();
        private final Map<String, String> webSocketHeaders = new HashMap<>();

        @NonNull
        public Builder baseUrl(@NonNull String baseUrl) {
            this.baseUrl = baseUrl;
            return this;
        }

        @NonNull
        public Builder wsUrl(@Nullable String wsUrl) {
            if (wsUrl == null) {
                this.wsUrl = null;
                return this;
            }
            String trimmed = wsUrl.trim();
            this.wsUrl = trimmed.isEmpty() ? null : trimmed;
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
        public Builder autoDisconnectWhenNoListener(boolean autoDisconnectWhenNoListener) {
            this.autoDisconnectWhenNoListener = autoDisconnectWhenNoListener;
            return this;
        }

        @NonNull
        public Builder addDefaultHeader(@NonNull String key, @Nullable String value) {
            if (value == null) {
                defaultHeaders.remove(key);
            } else {
                defaultHeaders.put(key, value);
            }
            return this;
        }

        @NonNull
        public Builder addWebSocketHeader(@NonNull String key, @Nullable String value) {
            if (value == null) {
                webSocketHeaders.remove(key);
            } else {
                webSocketHeaders.put(key, value);
            }
            return this;
        }

        @NonNull
        public SkillSDKConfig build() {
            if (baseUrl == null || baseUrl.trim().isEmpty()) {
                throw new IllegalArgumentException("baseUrl is required");
            }
            if (wsUrl != null && !(wsUrl.startsWith("ws://") || wsUrl.startsWith("wss://"))) {
                throw new IllegalArgumentException("wsUrl must start with ws:// or wss://");
            }
            return new SkillSDKConfig(this);
        }
    }
}
