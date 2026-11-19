alter table journal_schedule
    add column month_days smallint[],
    add column last_day boolean not null default false,
    add column dates date[],
    add column times varchar[],
    drop constraint journal_schedule_frequency_check;

update journal_schedule set month_days = array[month_day] where month_day is not null;

alter table journal_schedule
    drop column month_day,
    add constraint journal_schedule_frequency_check
        check (frequency in ('none', 'once', 'day', 'week', 'month', 'year', 'custom')),
    add constraint journal_schedule_month_days_check check (
        (frequency in ('month', 'year')) = (month_days is not null)
        and month_days <@ array[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,
            17,18,19,20,21,22,23,24,25,26,27,28,29,30,31]::smallint[]
        and valid_weekdays(month_days)
        and (frequency <> 'month' or last_day or cardinality(month_days) > 0)
        and (frequency <> 'year' or cardinality(month_days) = 1)
    ),
    add constraint journal_schedule_last_day_check check (not last_day or frequency = 'month'),
    add constraint journal_schedule_custom_dates_check check (
        (frequency = 'custom') = (dates is not null)
        and cardinality(dates) > 0
        and array_position(dates, null) is null
        and starts_on <= all(dates)
    ),
    add constraint journal_schedule_non_recurring_check check (
        frequency not in ('none', 'once', 'custom') or (ends_on is null and interval_count = 1)
    ),
    add constraint journal_schedule_disabled_times_check check (frequency <> 'none' or times is null);
