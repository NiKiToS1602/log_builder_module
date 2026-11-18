package ru.clearbarn.logbuilder.model.journal;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import ru.clearbarn.logbuilder.model.shared.FieldApproverId;

@Entity
@Table(name = "journal_field_approver")
@Getter
@Setter
public class JournalFieldApprover {
    @EmbeddedId
    private FieldApproverId key;
}
