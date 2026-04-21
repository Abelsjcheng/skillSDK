package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;

import com.google.gson.annotations.SerializedName;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Keep
public class WeAgentDetailsArrayResult {
    @SerializedName("weAgentDetailsArray")
    @NonNull
    private List<WeAgentDetails> weAgentDetailsArray = new ArrayList<>();

    @NonNull
    public List<WeAgentDetails> getWeAgentDetailsArray() {
        return weAgentDetailsArray;
    }

    public void setWeAgentDetailsArray(@NonNull List<WeAgentDetails> weAgentDetailsArray) {
        this.weAgentDetailsArray = new ArrayList<>(
                Objects.requireNonNull(weAgentDetailsArray, "weAgentDetailsArray == null")
        );
    }
}
