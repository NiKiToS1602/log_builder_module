package ru.clearbarn.logbuilder.model.journal;

import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.UUID;

@Embeddable
public record JournalScheduleId(Long organizationId, UUID journalId) implements Serializable {
}
