package ru.clearbarn.logbuilder.model.entry;

import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.UUID;

@Embeddable
public record CellId(Long organizationId, UUID journalId, UUID entryId, UUID fieldId) implements Serializable {
}
