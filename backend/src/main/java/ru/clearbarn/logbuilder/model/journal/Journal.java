package ru.clearbarn.logbuilder.model.journal;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.Generated;
import org.hibernate.annotations.UpdateTimestamp;

import ru.clearbarn.logbuilder.model.shared.OrganizationObjectId;

@Entity
@Table(name = "journal")
@Getter
@Setter
public class Journal {
    @EmbeddedId
    private OrganizationObjectId key;

    private UUID templateId;

    private Long templateVersion;

    private String name;

    private Long locationId;

    private UUID responsibleUid;

    private String status;

    @Generated
    private Long nextEntryNumber;

    private UUID createdByUid;

    @CreationTimestamp
    private Instant createdAt;

    @UpdateTimestamp
    private Instant updatedAt;

    private Instant completedAt;

    private Instant archivedAt;

    @Version
    private Long version;
}
