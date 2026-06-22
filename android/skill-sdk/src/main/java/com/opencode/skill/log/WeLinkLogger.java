package com.opencode.skill.log;

import android.util.Log;

/**
 * 可替换的 SDK 静态日志入口。
 *
 * <p>业务代码统一调用 {@link #i(String, String)} 和 {@link #e(String, String)}；
 * 宿主可通过 {@link #setAdapter(Adapter)} 注入真实封装的日志实现。</p>
 */
public final class WeLinkLogger {
    private static volatile Adapter adapter = new Adapter() {
        @Override
        public void i(String tag, String message) {
            Log.i(tag, message);
        }

        @Override
        public void e(String tag, String message) {
            Log.e(tag, message);
        }
    };

    private WeLinkLogger() {
    }

    public static void i(String tag, String message) {
        adapter.i(tag, message);
    }

    public static void e(String tag, String message) {
        adapter.e(tag, message);
    }

    public static void setAdapter(Adapter replacement) {
        if (replacement != null) {
            adapter = replacement;
        }
    }

    public interface Adapter {
        void i(String tag, String message);

        void e(String tag, String message);
    }
}
