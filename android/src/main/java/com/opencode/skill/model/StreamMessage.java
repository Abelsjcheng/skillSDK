package com.opencode.skill.model;

import com.google.gson.annotations.SerializedName;

public class StreamMessage {
    @SerializedName("type")
    private String type;

    @SerializedName("seq")
    private Long seq;

    @SerializedName("content")
    private Object content;

    private Usage usage;

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public Long getSeq() {
        return seq;
    }

    public void setSeq(Long seq) {
        this.seq = seq;
    }

    public Object getContent() {
        return content;
    }

    public void setContent(Object content) {
        this.content = content;
    }

    public String getContentAsString() {
        if (content instanceof String) {
            return (String) content;
        }
        return content != null ? content.toString() : null;
    }

    public Usage getUsage() {
        return usage;
    }

    public void setUsage(Usage usage) {
        this.usage = usage;
    }

    public static class Usage {
        @SerializedName("inputTokens")
        private long inputTokens;

        @SerializedName("outputTokens")
        private long outputTokens;

        public long getInputTokens() {
            return inputTokens;
        }

        public void setInputTokens(long inputTokens) {
            this.inputTokens = inputTokens;
        }

        public long getOutputTokens() {
            return outputTokens;
        }

        public void setOutputTokens(long outputTokens) {
            this.outputTokens = outputTokens;
        }
    }
}