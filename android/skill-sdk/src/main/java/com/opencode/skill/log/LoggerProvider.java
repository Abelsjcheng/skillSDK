package com.opencode.skill.log;

import android.util.Log;

/**
 * SDK 日志提供者。宿主可通过 {@link #setLogger(WeLinkLogger)} 注入真实封装的日志实现。
 */
public final class LoggerProvider {
    private static volatile WeLinkLogger logger = new WeLinkLogger() {
        @Override
        public void i(String tag, String message) {
            Log.i(tag, message);
        }

        @Override
        public void e(String tag, String message) {
            Log.e(tag, message);
        }
    };

    private LoggerProvider() {
    }

    public static WeLinkLogger getLogger() {
        return logger;
    }

    public static void setLogger(WeLinkLogger replacement) {
        if (replacement != null) {
            logger = replacement;
        }
    }
}
