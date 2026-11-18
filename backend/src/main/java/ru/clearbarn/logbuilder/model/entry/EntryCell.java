package ru.clearbarn.logbuilder.model.entry;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "entry_cell")
@Getter
@Setter
public class EntryCell {
    @EmbeddedId
    private CellId key;

    private String fieldType;

    private String state;

    private String textValue;

    private BigDecimal numberValue;

    private LocalDate dateValue;

    private UUID memberUid;

    private Long locationId;

    private Boolean booleanValue;
}
