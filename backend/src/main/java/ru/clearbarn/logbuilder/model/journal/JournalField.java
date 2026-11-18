package ru.clearbarn.logbuilder.model.journal;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

import ru.clearbarn.logbuilder.model.shared.OrganizationObjectId;

@Entity
@Table(name = "journal_field")
@Getter
@Setter
public class JournalField {
    @EmbeddedId
    private OrganizationObjectId key;

    private UUID journalId;

    private UUID sourceFieldId;

    private Integer position;

    private String type;

    private String name;

    private Boolean required;

    private String placeholder;

    private String fillMode;

    private BigDecimal minValue;

    private BigDecimal maxValue;

    private String confirmationRule;

    private String confirmationTiming;
}
