package ru.clearbarn.logbuilder.model.audit;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import ru.clearbarn.logbuilder.model.shared.OrganizationObjectId;

@Entity
@Table(name = "audit_event")
@Getter
@Setter
public class AuditEvent {
    @EmbeddedId
    private OrganizationObjectId key;

    private UUID journalId;

    private UUID templateId;

    private UUID entryId;

    private String eventType;

    private UUID actorUid;

    private String actorNameSnapshot;

    private String actorRoleSnapshot;

    @CreationTimestamp
    private Instant occurredAt;

    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Object> beforeData;

    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Object> afterData;

    private UUID requestId;
}
