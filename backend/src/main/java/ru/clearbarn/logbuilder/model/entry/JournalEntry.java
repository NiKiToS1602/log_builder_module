package ru.clearbarn.logbuilder.model.entry;

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
@Table(name = "journal_entry")
@Getter
@Setter
public class JournalEntry {
    @EmbeddedId
    private OrganizationObjectId key;

    private UUID journalId;

    @Generated
    private Long number;

    private UUID authorUid;

    @CreationTimestamp
    private Instant createdAt;

    @UpdateTimestamp
    private Instant updatedAt;

    @Version
    private Long version;
}
