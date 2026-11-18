package ru.clearbarn.logbuilder.model.directory;

import jakarta.persistence.Embeddable;
import java.io.Serializable;

@Embeddable
public record CheckpointId(Long organizationId, String resource) implements Serializable {
}
