package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.Nullable;

import java.util.ArrayList;
import java.util.List;

@Keep
public class QuestionItem {
    @Nullable
    private String header;
    @Nullable
    private String question;
    @Nullable
    private List<String> options = new ArrayList<>();
    @Nullable
    private Boolean multiSelect;

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
    public Boolean getMultiSelect() {
        return multiSelect;
    }

    public void setMultiSelect(@Nullable Boolean multiSelect) {
        this.multiSelect = multiSelect;
    }
}
