package com.opencode.skill.network.retrofit;

import androidx.annotation.NonNull;

import java.util.concurrent.Executor;

public final class DirectExecutor implements Executor {
    @Override
    public void execute(@NonNull Runnable command) {
        command.run();
    }
}
