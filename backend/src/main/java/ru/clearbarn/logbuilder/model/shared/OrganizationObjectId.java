package ru.clearbarn.logbuilder.model.shared;

import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.UUID;

@Embeddable
public record OrganizationObjectId(Long organizationId, UUID id) implements Serializable {
}
