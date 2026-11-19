package ru.clearbarn.logbuilder.journal;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import ru.clearbarn.logbuilder.model.journal.Journal;
import ru.clearbarn.logbuilder.model.journal.JournalField;

public final class JournalApi {
    private JournalApi() {
    }

    public record Create(
        String name, UUID templateId, Long templateVersion, Long locationId, UUID responsibleUid,
        LocalDate startDate, Schedule schedule
    ) {
    }

    public record Update(String name, UUID responsibleUid, Long version, LocalDate startDate, Schedule schedule) {
    }

    public record Schedule(
        String frequency, Integer interval, LocalDate endDate, List<Short> weekdays, List<Short> monthDays,
        Boolean lastDay, List<LocalDate> dates, List<String> times
    ) {
    }

    public record Summary(
        UUID id, String name, UUID templateId, long templateVersion, long locationId, UUID responsibleUid,
        String status, long version, Instant createdAt, Instant updatedAt, Instant completedAt, Instant archivedAt
    ) {
        static Summary from(Journal journal) {
            return new Summary(
                journal.getKey().id(), journal.getName(), journal.getTemplateId(), journal.getTemplateVersion(),
                journal.getLocationId(), journal.getResponsibleUid(), journal.getStatus(), journal.getVersion(),
                journal.getCreatedAt(), journal.getUpdatedAt(), journal.getCompletedAt(), journal.getArchivedAt()
            );
        }
    }

    public record Detail(Summary journal, List<Column> columns, LocalDate startDate, Schedule schedule) {
    }

    public record Column(
        UUID id, UUID sourceFieldId, int position, String name, String type, boolean required, String placeholder,
        String fillMode, BigDecimal minValue, BigDecimal maxValue, String confirmationRule,
        String confirmationTiming, List<UUID> approverUids
    ) {
        static Column from(JournalField field, List<UUID> approvers) {
            return new Column(
                field.getKey().id(), field.getSourceFieldId(), field.getPosition(), field.getName(),
                field.getType(), field.getRequired(), field.getPlaceholder(), field.getFillMode(),
                field.getMinValue(), field.getMaxValue(), field.getConfirmationRule(), field.getConfirmationTiming(),
                List.copyOf(approvers)
            );
        }
    }

    public record Page(List<Summary> items, int page, int size, boolean hasNext) {
    }
}
