package ru.clearbarn.logbuilder.model.entry;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "cell_confirmation")
@Getter
@Setter
public class CellConfirmation {
    @EmbeddedId
    private CellId key;

    private UUID confirmerUid;

    private String fullNameSnapshot;

    private String roleSnapshot;

    @CreationTimestamp
    private Instant confirmedAt;
}
