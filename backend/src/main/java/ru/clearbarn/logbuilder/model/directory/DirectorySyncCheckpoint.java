package ru.clearbarn.logbuilder.model.directory;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Map;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "directory_sync_checkpoint")
@Getter
@Setter
public class DirectorySyncCheckpoint {
    @EmbeddedId
    private CheckpointId key;

    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Object> subscription;

    private String deltaCursor;

    @UpdateTimestamp
    private Instant updatedAt;
}
