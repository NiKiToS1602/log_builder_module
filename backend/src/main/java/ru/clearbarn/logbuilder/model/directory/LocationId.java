package ru.clearbarn.logbuilder.model.directory;

import jakarta.persistence.Embeddable;
import java.io.Serializable;

@Embeddable
public record LocationId(Long organizationId, Long locationId) implements Serializable {
}
