package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Keep
public class AgentTypeListResult {
    @NonNull
    private List<AgentType> content = new ArrayList<>();

    @NonNull
    public List<AgentType> getContent() {
        return content;
    }

    public void setContent(@NonNull List<AgentType> content) {
        this.content = new ArrayList<>(Objects.requireNonNull(content, "content == null"));
    }
}
