package ru.clearbarn.logbuilder.model.directory;

import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.UUID;

@Embeddable
public record MemberLocationId(Long organizationId, UUID memberUid, Long locationId) implements Serializable {
}
