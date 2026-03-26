package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Keep
public class WeAgentListResult {
    @NonNull
    private List<WeAgent> content = new ArrayList<>();

    @NonNull
    public List<WeAgent> getContent() {
        return content;
    }

    public void setContent(@NonNull List<WeAgent> content) {
        this.content = new ArrayList<>(Objects.requireNonNull(content, "content == null"));
    }
}
