package ru.clearbarn.logbuilder.model.directory;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Map;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "directory_location")
@Getter
@Setter
public class DirectoryLocation {
    @EmbeddedId
    private LocationId key;

    private String name;

    private String status;

    private Boolean isRemoved;

    private Instant externalUpdatedAt;

    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Object> sourcePayload;

    @CreationTimestamp
    private Instant syncedAt;
}
