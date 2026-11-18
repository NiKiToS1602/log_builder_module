package ru.clearbarn.logbuilder.model.journal;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.LocalDate;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "journal_schedule")
@Getter
@Setter
public class JournalSchedule {
    @EmbeddedId
    private JournalScheduleId key;

    private LocalDate startsOn;

    private LocalDate endsOn;

    private String frequency;

    private Integer intervalCount;

    private Short[] weekdays;

    private Short monthDay;

    @Version
    private Long version;
}
