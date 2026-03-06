package com.opencode.skill.config;

public class SkillSDKConfig {
    private String baseUrl;
    private String wsBaseUrl;
    private long connectTimeout = 30;
    private long readTimeout = 60;
    private long writeTimeout = 60;
    private boolean debugMode = false;
    private long defaultSkillDefinitionId = 1L;

    private SkillSDKConfig(Builder builder) {
        this.baseUrl = builder.baseUrl;
        this.wsBaseUrl = builder.wsBaseUrl;
        this.connectTimeout = builder.connectTimeout;
        this.readTimeout = builder.readTimeout;
        this.writeTimeout = builder.writeTimeout;
        this.debugMode = builder.debugMode;
        this.defaultSkillDefinitionId = builder.defaultSkillDefinitionId;
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    public String getWsBaseUrl() {
        return wsBaseUrl;
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

    public boolean isDebugMode() {
        return debugMode;
    }

    public long getDefaultSkillDefinitionId() {
        return defaultSkillDefinitionId;
    }

    public static class Builder {
        private String baseUrl;
        private String wsBaseUrl;
        private long connectTimeout = 30;
        private long readTimeout = 60;
        private long writeTimeout = 60;
        private boolean debugMode = false;
        private long defaultSkillDefinitionId = 1L;

        public Builder baseUrl(String baseUrl) {
            this.baseUrl = baseUrl;
            return this;
        }

        public Builder wsBaseUrl(String wsBaseUrl) {
            this.wsBaseUrl = wsBaseUrl;
            return this;
        }

        public Builder connectTimeout(long connectTimeout) {
            this.connectTimeout = connectTimeout;
            return this;
        }

        public Builder readTimeout(long readTimeout) {
            this.readTimeout = readTimeout;
            return this;
        }

        public Builder writeTimeout(long writeTimeout) {
            this.writeTimeout = writeTimeout;
            return this;
        }

        public Builder debugMode(boolean debugMode) {
            this.debugMode = debugMode;
            return this;
        }

        public Builder defaultSkillDefinitionId(long defaultSkillDefinitionId) {
            this.defaultSkillDefinitionId = defaultSkillDefinitionId;
            return this;
        }

        public SkillSDKConfig build() {
            if (baseUrl == null || baseUrl.isEmpty()) {
                throw new IllegalArgumentException("baseUrl is required");
            }
            if (wsBaseUrl == null || wsBaseUrl.isEmpty()) {
                if (baseUrl.startsWith("https://")) {
                    wsBaseUrl = "wss://" + baseUrl.substring(8);
                } else if (baseUrl.startsWith("http://")) {
                    wsBaseUrl = "ws://" + baseUrl.substring(7);
                } else {
                    wsBaseUrl = "ws://" + baseUrl;
                }
            }
            return new SkillSDKConfig(this);
        }
    }
}