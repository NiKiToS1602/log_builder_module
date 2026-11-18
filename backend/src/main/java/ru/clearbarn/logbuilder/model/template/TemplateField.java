package ru.clearbarn.logbuilder.model.template;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

import ru.clearbarn.logbuilder.model.shared.OrganizationObjectId;

@Entity
@Table(name = "template_field")
@Getter
@Setter
public class TemplateField {
    @EmbeddedId
    private OrganizationObjectId key;

    private UUID templateId;

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
