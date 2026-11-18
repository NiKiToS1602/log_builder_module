package ru.clearbarn.logbuilder.model.shared;

import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.UUID;

@Embeddable
public record FieldApproverId(Long organizationId, UUID fieldId, UUID memberUid) implements Serializable {
}
