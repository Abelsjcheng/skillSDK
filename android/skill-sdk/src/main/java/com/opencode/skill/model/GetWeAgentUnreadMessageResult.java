package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;

import java.util.ArrayList;
import java.util.List;

@Keep
public class GetWeAgentUnreadMessageResult {
    @NonNull private final String partnerAccount;
    private final boolean assistantUnread;
    private final boolean redDotVisible;
    @NonNull private final List<WeAgentSessionUnreadState> sessions;
    @NonNull private final String source;
    public GetWeAgentUnreadMessageResult(@NonNull String partnerAccount, boolean assistantUnread,
            boolean redDotVisible, @NonNull List<WeAgentSessionUnreadState> sessions, @NonNull String source) {
        this.partnerAccount = partnerAccount;
        this.assistantUnread = assistantUnread;
        this.redDotVisible = redDotVisible;
        this.sessions = new ArrayList<>(sessions);
        this.source = source;
    }
    @NonNull public String getPartnerAccount() { return partnerAccount; }
    public boolean isAssistantUnread() { return assistantUnread; }
    public boolean isRedDotVisible() { return redDotVisible; }
    @NonNull public List<WeAgentSessionUnreadState> getSessions() { return new ArrayList<>(sessions); }
    @NonNull public String getSource() { return source; }
}
