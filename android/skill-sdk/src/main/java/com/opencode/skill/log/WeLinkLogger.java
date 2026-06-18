package com.opencode.skill.log;

/**
 * 可替换的 SDK 日志接口。
 *
 * <p>宿主接入真实日志组件时，可替换该接口的提供者而无需修改业务日志调用点。</p>
 */
public interface WeLinkLogger {
    void i(String tag, String message);

    void e(String tag, String message);
}
