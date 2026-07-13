package com.opencode.skill.util;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.opencode.skill.model.CursorResult;
import com.opencode.skill.model.PageResult;
import com.opencode.skill.model.SessionMessage;
import com.opencode.skill.model.SessionMessagePart;

import java.util.ArrayList;
import java.util.List;

/** Helpers for session history normalization and message content lookup. */
public final class SessionMessageHelper {
    private SessionMessageHelper() {
    }

    @NonNull
    public static PageResult<SessionMessage> normalizeSessionMessagePage(
            @Nullable PageResult<SessionMessage> pageResult,
            int requestPage,
            int requestSize
    ) {
        PageResult<SessionMessage> source = pageResult == null ? new PageResult<>() : pageResult;

        int safePage = source.getPage() < 0 ? requestPage : source.getPage();
        int safeSize = source.getSize() <= 0 ? requestSize : source.getSize();
        List<SessionMessage> content = source.getContent() == null ? new ArrayList<>() : new ArrayList<>(source.getContent());
        long safeTotal = source.getTotal() < 0 ? content.size() : source.getTotal();
        int safeTotalPages = source.getTotalPages() < 0 ? 0 : source.getTotalPages();

        PageResult<SessionMessage> normalized = new PageResult<>();
        normalized.setContent(content);
        normalized.setPage(safePage);
        normalized.setSize(safeSize);
        normalized.setTotal(safeTotal);
        normalized.setTotalPages(safeTotalPages);
        return normalized;
    }

    @NonNull
    public static CursorResult<SessionMessage> normalizeSessionMessageCursor(
            @Nullable CursorResult<SessionMessage> cursorResult,
            int requestSize
    ) {
        CursorResult<SessionMessage> source = cursorResult == null ? new CursorResult<>() : cursorResult;
        int safeSize = source.getSize() <= 0 ? requestSize : source.getSize();
        List<SessionMessage> safeContent = new ArrayList<>(source.getContent());

        CursorResult<SessionMessage> normalized = new CursorResult<>();
        normalized.setContent(safeContent);
        normalized.setSize(safeSize);
        normalized.setHasMore(source.isHasMore());
        normalized.setNextBeforeSeq(source.getNextBeforeSeq());
        return normalized;
    }

    @Nullable
    public static String findLatestUserMessageContent(@Nullable List<SessionMessage> messages) {
        if (messages == null) {
            return null;
        }
        for (SessionMessage message : messages) {
            if (message == null) {
                continue;
            }
            if (!"user".equalsIgnoreCase(SdkStringUtils.normalizeOptionalString(message.getRole()))) {
                continue;
            }
            String content = SdkStringUtils.normalizeOptionalString(message.getContent());
            if (content != null) {
                return content;
            }
        }
        return null;
    }

    @Nullable
    public static String resolveSendToImContent(@Nullable List<SessionMessage> messages) {
        if (messages == null) {
            return null;
        }
        for (int index = messages.size() - 1; index >= 0; index--) {
            SessionMessage message = messages.get(index);
            if (message == null) {
                continue;
            }
            String content = resolveMessageDisplayContent(message);
            if (content != null) {
                return content;
            }
        }
        return null;
    }

    @Nullable
    public static String resolveMessageDisplayContent(@NonNull SessionMessage message) {
        String content = SdkStringUtils.normalizeOptionalString(message.getContent());
        if (content != null) {
            return content;
        }
        List<SessionMessagePart> parts = message.getParts();
        if (parts == null || parts.isEmpty()) {
            return null;
        }
        StringBuilder builder = new StringBuilder();
        for (SessionMessagePart part : parts) {
            if (part == null) {
                continue;
            }
            String partContent = SdkStringUtils.normalizeOptionalString(part.getContent());
            if (partContent == null) {
                partContent = SdkStringUtils.normalizeOptionalString(part.getOutput());
            }
            if (partContent == null) {
                continue;
            }
            if (builder.length() > 0) {
                builder.append('\n');
            }
            builder.append(partContent);
        }
        return builder.length() == 0 ? null : builder.toString();
    }

}
