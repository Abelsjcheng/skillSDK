package com.opencode.skill.model;

import androidx.annotation.Nullable;

import com.google.gson.JsonElement;

import java.util.ArrayList;
import java.util.List;

public class SessionMessagePart {
  @Nullable
  private String partId;
  @Nullable
  private Integer partSeq;
  @Nullable
  private String type;
  @Nullable
  private String content;
  @Nullable
  private String toolName;
  @Nullable
  private String toolCallId;
  @Nullable
  private String toolStatus;
  @Nullable
  private JsonElement toolInput;
  @Nullable
  private String toolOutput;
  @Nullable
  private String question;
  @Nullable
  private List<String> options = new ArrayList<>();
  @Nullable
  private String permissionId;
  @Nullable
  private String fileName;
  @Nullable
  private String fileUrl;
  @Nullable
  private String fileMime;

  @Nullable
  public String getPartId() {
    return partId;
  }

  public void setPartId(@Nullable String partId) {
    this.partId = partId;
  }

  @Nullable
  public Integer getPartSeq() {
    return partSeq;
  }

  public void setPartSeq(@Nullable Integer partSeq) {
    this.partSeq = partSeq;
  }

  @Nullable
  public String getType() {
    return type;
  }

  public void setType(@Nullable String type) {
    this.type = type;
  }

  @Nullable
  public String getContent() {
    return content;
  }

  public void setContent(@Nullable String content) {
    this.content = content;
  }

  @Nullable
  public String getToolName() {
    return toolName;
  }

  public void setToolName(@Nullable String toolName) {
    this.toolName = toolName;
  }

  @Nullable
  public String getToolCallId() {
    return toolCallId;
  }

  public void setToolCallId(@Nullable String toolCallId) {
    this.toolCallId = toolCallId;
  }

  @Nullable
  public String getToolStatus() {
    return toolStatus;
  }

  public void setToolStatus(@Nullable String toolStatus) {
    this.toolStatus = toolStatus;
  }

  @Nullable
  public JsonElement getToolInput() {
    return toolInput;
  }

  public void setToolInput(@Nullable JsonElement toolInput) {
    this.toolInput = toolInput;
  }

  @Nullable
  public String getToolOutput() {
    return toolOutput;
  }

  public void setToolOutput(@Nullable String toolOutput) {
    this.toolOutput = toolOutput;
  }

  @Nullable
  public String getQuestion() {
    return question;
  }

  public void setQuestion(@Nullable String question) {
    this.question = question;
  }

  @Nullable
  public List<String> getOptions() {
    return options;
  }

  public void setOptions(@Nullable List<String> options) {
    this.options = options;
  }

  @Nullable
  public String getPermissionId() {
    return permissionId;
  }

  public void setPermissionId(@Nullable String permissionId) {
    this.permissionId = permissionId;
  }

  @Nullable
  public String getFileName() {
    return fileName;
  }

  public void setFileName(@Nullable String fileName) {
    this.fileName = fileName;
  }

  @Nullable
  public String getFileUrl() {
    return fileUrl;
  }

  public void setFileUrl(@Nullable String fileUrl) {
    this.fileUrl = fileUrl;
  }

  @Nullable
  public String getFileMime() {
    return fileMime;
  }

  public void setFileMime(@Nullable String fileMime) {
    this.fileMime = fileMime;
  }
}
