package ru.clearbarn.logbuilder.model.template;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import ru.clearbarn.logbuilder.model.shared.OrganizationObjectId;

@Entity
@Table(name = "template")
@Getter
@Setter
public class JournalTemplate {
    @EmbeddedId
    private OrganizationObjectId key;

    private String name;

    private String status;

    private UUID createdByUid;

    @CreationTimestamp
    private Instant createdAt;

    @UpdateTimestamp
    private Instant updatedAt;

    @Version
    private Long version;
}
