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
  private final long connectTimeout;
  private final long readTimeout;
  private final long writeTimeout;
  private final boolean enableReconnect;
  private final long reconnectInterval;
  private final boolean autoDisconnectWhenNoListener;
  @NonNull
  private final Map<String, String> defaultHeaders;

  private SkillSDKConfig(@NonNull Builder builder) {
    this.baseUrl = builder.baseUrl;
    this.connectTimeout = builder.connectTimeout;
    this.readTimeout = builder.readTimeout;
    this.writeTimeout = builder.writeTimeout;
    this.enableReconnect = builder.enableReconnect;
    this.reconnectInterval = builder.reconnectInterval;
    this.autoDisconnectWhenNoListener = builder.autoDisconnectWhenNoListener;
    this.defaultHeaders = Collections.unmodifiableMap(new HashMap<>(builder.defaultHeaders));
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

  public boolean isAutoDisconnectWhenNoListener() {
    return autoDisconnectWhenNoListener;
  }

  @NonNull
  public Map<String, String> getDefaultHeaders() {
    return defaultHeaders;
  }

  public static class Builder {
    private String baseUrl;
    private long connectTimeout = 30000;
    private long readTimeout = 60000;
    private long writeTimeout = 30000;
    private boolean enableReconnect = true;
    private long reconnectInterval = 5000;
    private boolean autoDisconnectWhenNoListener = false;
    private final Map<String, String> defaultHeaders = new HashMap<>();

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
    public SkillSDKConfig build() {
      if (baseUrl == null || baseUrl.trim().isEmpty()) {
        throw new IllegalArgumentException("baseUrl is required");
      }
      return new SkillSDKConfig(this);
    }
  }
}
