package ru.clearbarn.logbuilder.model.template;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import ru.clearbarn.logbuilder.model.shared.FieldApproverId;

@Entity
@Table(name = "template_field_approver")
@Getter
@Setter
public class TemplateFieldApprover {
    @EmbeddedId
    private FieldApproverId key;
}
