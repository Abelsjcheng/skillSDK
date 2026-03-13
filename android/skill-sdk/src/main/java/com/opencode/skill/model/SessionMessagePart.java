package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.Nullable;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.util.ArrayList;
import java.util.List;

@Keep
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
    private List<String> options = new ArrayList<>();
    @Nullable
    private String permissionId;
    @Nullable
    private String permType;
    @Nullable
    private JsonObject metadata;
    @Nullable
    private String response;
    @Nullable
    private String status;
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
    public String getStatus() {
        return status;
    }

    public void setStatus(@Nullable String status) {
        this.status = status;
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

    @Deprecated
    @Nullable
    public String getToolStatus() {
        return status;
    }

    @Deprecated
    public void setToolStatus(@Nullable String toolStatus) {
        this.status = toolStatus;
    }

    @Deprecated
    @Nullable
    public JsonElement getToolInput() {
        return input;
    }

    @Deprecated
    public void setToolInput(@Nullable JsonElement toolInput) {
        this.input = toolInput;
    }

    @Deprecated
    @Nullable
    public String getToolOutput() {
        return output;
    }

    @Deprecated
    public void setToolOutput(@Nullable String toolOutput) {
        this.output = toolOutput;
    }
}
