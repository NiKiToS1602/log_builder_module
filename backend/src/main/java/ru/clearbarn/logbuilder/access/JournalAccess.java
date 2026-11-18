package ru.clearbarn.logbuilder.access;

import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/** Access verified by server-side authentication for this request. */
public record JournalAccess(long organizationId, UUID memberUid, Role role, Set<Long> allowedLocationIds) {
    public static final String REQUEST_ATTRIBUTE = "ru.clearbarn.logbuilder.access.JournalAccess";

    public JournalAccess {
        Objects.requireNonNull(memberUid);
        Objects.requireNonNull(role);
        allowedLocationIds = Set.copyOf(allowedLocationIds);
    }

    public enum Role {
        OWNER, MANAGER, EMPLOYEE
    }
}
