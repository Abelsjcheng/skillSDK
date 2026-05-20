package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.Nullable;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.annotations.SerializedName;

import java.util.ArrayList;
import java.util.List;

@Keep
public class StreamMessage {
    @Nullable
    private String type;
    @Nullable
    private Long seq;
    @Nullable
    private String welinkSessionId;
    @Nullable
    private String emittedAt;
    @Nullable
    private JsonObject raw;

    @Nullable
    private String messageId;
    @Nullable
    private String sourceMessageId;
    @Nullable
    private Integer messageSeq;
    @Nullable
    private String role;
    @Nullable
    private String partId;
    @Nullable
    private Integer partSeq;

    @Nullable
    private String content;
    @Nullable
    private String toolName;
    @Nullable
    private String toolCallId;
    @Nullable
    private String status;
    @Nullable
    private JsonElement input;
    @Nullable
    private String output;
    @Nullable
    private String error;
    @Nullable
    private String title;
    @Nullable
    private String header;
    @Nullable
    private String question;
    @Nullable
    @SerializedName(value = "questionId", alternate = {"requestId"})
    private String questionId;
    @Nullable
    private List<String> options = new ArrayList<>();
    @Nullable
    private String fileName;
    @Nullable
    private String fileUrl;
    @Nullable
    private String fileMime;
    @Nullable
    private JsonObject tokens;
    @Nullable
    private Double cost;
    @Nullable
    private String reason;
    @Nullable
    private String sessionStatus;
    @Nullable
    private String permissionId;
    @Nullable
    private String permType;
    @Nullable
    private JsonObject metadata;
    @Nullable
    private String response;
    @Nullable
    private String subagentSessionId;
    @Nullable
    private String subagentName;
    @Nullable
    private JsonArray messages;
    @Nullable
    private JsonArray parts;
    @Nullable
    private String deliveryMode;
    @Nullable
    private Boolean replayDone;

    @Nullable
    public String getType() {
        return type;
    }

    public void setType(@Nullable String type) {
        this.type = type;
    }

    @Nullable
    public Long getSeq() {
        return seq;
    }

    public void setSeq(@Nullable Long seq) {
        this.seq = seq;
    }

    @Nullable
    public String getWelinkSessionId() {
        return welinkSessionId;
    }

    public void setWelinkSessionId(@Nullable String welinkSessionId) {
        this.welinkSessionId = welinkSessionId;
    }

    @Nullable
    public String getEmittedAt() {
        return emittedAt;
    }

    public void setEmittedAt(@Nullable String emittedAt) {
        this.emittedAt = emittedAt;
    }

    @Nullable
    public JsonObject getRaw() {
        return raw;
    }

    public void setRaw(@Nullable JsonObject raw) {
        this.raw = raw;
    }

    @Nullable
    public String getMessageId() {
        return messageId;
    }

    public void setMessageId(@Nullable String messageId) {
        this.messageId = messageId;
    }

    @Nullable
    public String getSourceMessageId() {
        return sourceMessageId;
    }

    public void setSourceMessageId(@Nullable String sourceMessageId) {
        this.sourceMessageId = sourceMessageId;
    }

    @Nullable
    public Integer getMessageSeq() {
        return messageSeq;
    }

    public void setMessageSeq(@Nullable Integer messageSeq) {
        this.messageSeq = messageSeq;
    }

    @Nullable
    public String getRole() {
        return role;
    }

    public void setRole(@Nullable String role) {
        this.role = role;
    }

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
    public String getStatus() {
        return status;
    }

    public void setStatus(@Nullable String status) {
        this.status = status;
    }

    @Nullable
    public JsonElement getInput() {
        return input;
    }

    public void setInput(@Nullable JsonElement input) {
        this.input = input;
    }

    @Nullable
    public String getOutput() {
        return output;
    }

    public void setOutput(@Nullable String output) {
        this.output = output;
    }

    @Nullable
    public String getError() {
        return error;
    }

    public void setError(@Nullable String error) {
        this.error = error;
    }

    @Nullable
    public String getTitle() {
        return title;
    }

    public void setTitle(@Nullable String title) {
        this.title = title;
    }

    @Nullable
    public String getHeader() {
        return header;
    }

    public void setHeader(@Nullable String header) {
        this.header = header;
    }

    @Nullable
    public String getQuestion() {
        return question;
    }

    public void setQuestion(@Nullable String question) {
        this.question = question;
    }

    @Nullable
    public String getQuestionId() {
        return questionId;
    }

    public void setQuestionId(@Nullable String questionId) {
        this.questionId = questionId;
    }

    @Nullable
    public List<String> getOptions() {
        return options;
    }

    public void setOptions(@Nullable List<String> options) {
        this.options = options;
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

    @Nullable
    public JsonObject getTokens() {
        return tokens;
    }

    public void setTokens(@Nullable JsonObject tokens) {
        this.tokens = tokens;
    }

    @Nullable
    public Double getCost() {
        return cost;
    }

    public void setCost(@Nullable Double cost) {
        this.cost = cost;
    }

    @Nullable
    public String getReason() {
        return reason;
    }

    public void setReason(@Nullable String reason) {
        this.reason = reason;
    }

    @Nullable
    public String getSessionStatus() {
        return sessionStatus;
    }

    public void setSessionStatus(@Nullable String sessionStatus) {
        this.sessionStatus = sessionStatus;
    }

    @Nullable
    public String getPermissionId() {
        return permissionId;
    }

    public void setPermissionId(@Nullable String permissionId) {
        this.permissionId = permissionId;
    }

    @Nullable
    public String getPermType() {
        return permType;
    }

    public void setPermType(@Nullable String permType) {
        this.permType = permType;
    }

    @Nullable
    public JsonObject getMetadata() {
        return metadata;
    }

    public void setMetadata(@Nullable JsonObject metadata) {
        this.metadata = metadata;
    }

    @Nullable
    public String getResponse() {
        return response;
    }

    public void setResponse(@Nullable String response) {
        this.response = response;
    }

    @Nullable
    public String getSubagentSessionId() {
        return subagentSessionId;
    }

    public void setSubagentSessionId(@Nullable String subagentSessionId) {
        this.subagentSessionId = subagentSessionId;
    }

    @Nullable
    public String getSubagentName() {
        return subagentName;
    }

    public void setSubagentName(@Nullable String subagentName) {
        this.subagentName = subagentName;
    }

    @Nullable
    public JsonArray getMessages() {
        return messages;
    }

    public void setMessages(@Nullable JsonArray messages) {
        this.messages = messages;
    }

    @Nullable
    public JsonArray getParts() {
        return parts;
    }

    public void setParts(@Nullable JsonArray parts) {
        this.parts = parts;
    }

    @Nullable
    public String getDeliveryMode() {
        return deliveryMode;
    }

    public void setDeliveryMode(@Nullable String deliveryMode) {
        this.deliveryMode = deliveryMode;
    }

    @Nullable
    public Boolean getReplayDone() {
        return replayDone;
    }

    public void setReplayDone(@Nullable Boolean replayDone) {
        this.replayDone = replayDone;
    }
}
