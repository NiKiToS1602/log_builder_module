package ru.clearbarn.logbuilder.model.directory;

import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.UUID;

@Embeddable
public record MemberId(Long organizationId, UUID memberUid) implements Serializable {
}
