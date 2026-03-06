package com.opencode.skill.listener;

public interface SkillCallback<T> {
    void onSuccess(T result);
    void onError(Throwable error);
}