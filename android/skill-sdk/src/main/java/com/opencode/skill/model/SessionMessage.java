package com.opencode.skill.model;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import java.util.ArrayList;
import java.util.List;

public class SessionMessage {
  private long id;
  private long welinkSessionId;
  @Nullable
  private String userId;
  @NonNull
  private String role = "assistant";
  @NonNull
  private String content = "";
  @Nullable
  private String contentType;
  private int messageSeq;
  @NonNull
  private List<SessionMessagePart> parts = new ArrayList<>();
  @NonNull
  private String createdAt = "";

  public long getId() {
    return id;
  }

  public void setId(long id) {
    this.id = id;
  }

  public long getWelinkSessionId() {
    return welinkSessionId;
  }

  public void setWelinkSessionId(long welinkSessionId) {
    this.welinkSessionId = welinkSessionId;
  }

  @Nullable
  public String getUserId() {
    return userId;
  }

  public void setUserId(@Nullable String userId) {
    this.userId = userId;
  }

  @NonNull
  public String getRole() {
    return role;
  }

  public void setRole(@NonNull String role) {
    this.role = role;
  }

  @NonNull
  public String getContent() {
    return content;
  }

  public void setContent(@NonNull String content) {
    this.content = content;
  }

  @Nullable
  public String getContentType() {
    return contentType;
  }

  public void setContentType(@Nullable String contentType) {
    this.contentType = contentType;
  }

  public int getMessageSeq() {
    return messageSeq;
  }

  public void setMessageSeq(int messageSeq) {
    this.messageSeq = messageSeq;
  }

  @NonNull
  public List<SessionMessagePart> getParts() {
    return parts;
  }

  public void setParts(@NonNull List<SessionMessagePart> parts) {
    this.parts = parts;
  }

  @NonNull
  public String getCreatedAt() {
    return createdAt;
  }

  public void setCreatedAt(@NonNull String createdAt) {
    this.createdAt = createdAt;
  }
}
