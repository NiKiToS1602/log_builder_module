package ru.clearbarn.logbuilder.model.entry;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "cell_attachment")
@Getter
@Setter
public class CellAttachment {
    @EmbeddedId
    private CellId key;

    private String storageKey;

    private String originalName;

    private String mediaType;

    private Long sizeBytes;

    private String sha256;

    @CreationTimestamp
    private Instant createdAt;
}
