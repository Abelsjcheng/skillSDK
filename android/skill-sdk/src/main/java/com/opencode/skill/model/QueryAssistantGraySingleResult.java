package com.opencode.skill.model;

import androidx.annotation.Keep;

@Keep
public class QueryAssistantGraySingleResult {
    private final boolean data;

    public QueryAssistantGraySingleResult(boolean data) {
        this.data = data;
    }

    public boolean isData() {
        return data;
    }
}
