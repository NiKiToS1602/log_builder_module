package ru.clearbarn.logbuilder.journal;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import ru.clearbarn.logbuilder.model.journal.JournalSchedule;

record JournalScheduleSettings(LocalDate startDate, JournalApi.Schedule schedule) {
    private static final JournalApi.Schedule NO_RECURRENCE =
        new JournalApi.Schedule("none", null, null, null, null, null, null, null);

    static JournalScheduleSettings from(JournalSchedule stored) {
        if (stored == null) {
            return new JournalScheduleSettings(null, null);
        }
        String frequency = switch (stored.getFrequency()) {
            case "day" -> "daily";
            case "week" -> "weekly";
            case "month" -> "monthly";
            case "year" -> "yearly";
            default -> stored.getFrequency();
        };
        boolean recurring = isRecurring(frequency);
        return new JournalScheduleSettings(stored.getStartsOn(), new JournalApi.Schedule(
            frequency, recurring ? stored.getIntervalCount() : null, stored.getEndsOn(),
            sorted(stored.getWeekdays()), sorted(stored.getMonthDays()),
            "monthly".equals(frequency) ? stored.isLastDay() : null, sorted(stored.getDates()),
            "none".equals(frequency) ? null : Objects.requireNonNullElse(sorted(stored.getTimes()), List.of())
        ));
    }

    JournalScheduleSettings with(LocalDate startDate, JournalApi.Schedule schedule) {
        if (startDate == null && schedule == null) {
            return this;
        }
        LocalDate start = startDate == null ? this.startDate : startDate;
        requireDate(start, "Укажите корректную дату начала журнала.");

        JournalApi.Schedule input = schedule == null ? this.schedule : schedule;
        if (input == null) {
            return new JournalScheduleSettings(start, NO_RECURRENCE);
        }
        String frequency = input.frequency();
        if (frequency == null || !List.of("none", "once", "daily", "weekly", "monthly", "yearly", "custom")
            .contains(frequency)) {
            throw invalid("Выберите периодичность заполнения.");
        }
        boolean weekly = "weekly".equals(frequency);
        boolean monthly = "monthly".equals(frequency);
        boolean yearly = "yearly".equals(frequency);
        boolean custom = "custom".equals(frequency);
        boolean recurring = isRecurring(frequency);
        boolean lastDay = Boolean.TRUE.equals(input.lastDay());
        var weekdays = sorted(input.weekdays());
        var monthDays = sorted(input.monthDays());
        var dates = sorted(input.dates());
        var times = sorted(input.times());
        var end = input.endDate();

        if (recurring && (input.interval() == null || input.interval() < 1)) {
            throw invalid("Укажите целый интервал от 1.");
        }
        if (!recurring && (input.interval() != null || end != null)) {
            throw invalid("Интервал и дата окончания применимы только к повторяющемуся расписанию.");
        }
        if (end != null && (!validDate(end) || end.isBefore(start))) {
            throw invalid("Дата окончания расписания должна быть не раньше даты начала журнала.");
        }
        if (weekly == weekdays.isEmpty() || weekdays.stream().anyMatch(day -> day < 1 || day > 7)) {
            throw invalid("Для еженедельного расписания укажите дни недели от 1 до 7.");
        }
        if (lastDay && !monthly || monthly && monthDays.isEmpty() && !lastDay
            || yearly && monthDays.size() != 1 || !monthly && !yearly && !monthDays.isEmpty()
            || monthDays.stream().anyMatch(day -> day < 1 || day > 31)) {
            throw invalid("Проверьте числа месяца и настройку последнего дня месяца.");
        }
        if (custom == dates.isEmpty() || dates.stream().anyMatch(date -> !validDate(date) || date.isBefore(start))) {
            throw invalid("Для отдельных дат укажите даты заполнения начиная с даты начала журнала.");
        }
        if ("none".equals(frequency) && !times.isEmpty()
            || times.stream().anyMatch(time -> !time.matches("([01][0-9]|2[0-3]):[0-5][0-9]"))) {
            throw invalid("Укажите корректное время заполнения в формате ЧЧ:ММ.");
        }
        if ("none".equals(frequency)) {
            return new JournalScheduleSettings(start, NO_RECURRENCE);
        }
        return new JournalScheduleSettings(start, new JournalApi.Schedule(
            frequency, input.interval(), end, weekly ? weekdays : null, monthly || yearly ? monthDays : null,
            monthly ? lastDay : null, custom ? dates : null, times
        ));
    }

    void applyTo(JournalSchedule stored) {
        stored.setStartsOn(startDate);
        stored.setEndsOn(schedule.endDate());
        stored.setFrequency(switch (schedule.frequency()) {
            case "daily" -> "day";
            case "weekly" -> "week";
            case "monthly" -> "month";
            case "yearly" -> "year";
            default -> schedule.frequency();
        });
        stored.setIntervalCount(schedule.interval() == null ? 1 : schedule.interval());
        stored.setWeekdays(schedule.weekdays() == null ? null : schedule.weekdays().toArray(Short[]::new));
        stored.setMonthDays(schedule.monthDays() == null ? null : schedule.monthDays().toArray(Short[]::new));
        stored.setLastDay(Boolean.TRUE.equals(schedule.lastDay()));
        stored.setDates(schedule.dates() == null ? null : schedule.dates().toArray(LocalDate[]::new));
        stored.setTimes(schedule.times() == null ? null : schedule.times().toArray(String[]::new));
    }

    Map<String, Object> auditSchedule() {
        if (schedule == null) {
            return null;
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("frequency", schedule.frequency());
        data.put("interval", schedule.interval());
        data.put("endDate", Objects.toString(schedule.endDate(), null));
        data.put("weekdays", schedule.weekdays());
        data.put("monthDays", schedule.monthDays());
        data.put("lastDay", schedule.lastDay());
        data.put("dates", schedule.dates() == null ? null : schedule.dates().stream().map(LocalDate::toString).toList());
        data.put("times", schedule.times());
        return data;
    }

    private static boolean isRecurring(String frequency) {
        return List.of("daily", "weekly", "monthly", "yearly").contains(frequency);
    }

    private static void requireDate(LocalDate date, String message) {
        if (date == null || !validDate(date)) {
            throw invalid(message);
        }
    }

    private static boolean validDate(LocalDate date) {
        return date.getYear() >= 1 && date.getYear() <= 9999;
    }

    private static <T extends Comparable<? super T>> List<T> sorted(T[] values) {
        return values == null ? null : sorted(Arrays.asList(values));
    }

    private static <T extends Comparable<? super T>> List<T> sorted(List<T> values) {
        if (values == null) {
            return List.of();
        }
        if (values.stream().anyMatch(Objects::isNull)) {
            throw invalid("Списки в расписании не должны содержать пустые значения.");
        }
        return values.stream().distinct().sorted().toList();
    }

    private static ResponseStatusException invalid(String message) {
        return new ResponseStatusException(HttpStatus.UNPROCESSABLE_CONTENT, message);
    }
}
