create table journal (
    organization_id bigint not null references organization(id),
    id uuid not null,
    template_id uuid not null,
    template_version bigint not null,
    name text not null check (btrim(name) <> ''),
    location_id bigint not null,
    responsible_uid uuid,
    status text not null check (status in ('active','completed','archived')),
    next_entry_number bigint not null default 1 check (next_entry_number > 0),
    created_by_uid uuid not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    completed_at timestamptz,
    archived_at timestamptz,
    version bigint not null default 0 check (version >= 0),
    primary key (organization_id, id),
    foreign key (organization_id, template_id) references template (organization_id, id),
    foreign key (organization_id, location_id) references directory_location (organization_id, location_id),
    foreign key (organization_id, responsible_uid) references directory_member (organization_id, member_uid),
    foreign key (organization_id, created_by_uid) references directory_member (organization_id, member_uid),
    check ((status = 'archived') = (archived_at is not null)),
    check (status <> 'completed' or completed_at is not null)
);

create table journal_field (
    organization_id bigint not null references organization(id),
    id uuid not null,
    journal_id uuid not null,
    source_field_id uuid not null,
    position integer not null check (position >= 0),
    type text not null check (type in ('sequence','text','number','date','next_entry_date','employee','location','image','confirmation','boolean')),
    name text not null check (btrim(name) <> ''),
    required boolean not null,
    placeholder text,
    fill_mode text not null default 'manual',
    min_value numeric,
    max_value numeric,
    confirmation_rule text,
    confirmation_timing text,
    primary key (organization_id, id),
    foreign key (organization_id, journal_id) references journal (organization_id, id),
    unique (organization_id, journal_id, id, type),
    unique (organization_id, journal_id, position) deferrable initially deferred,
    check (type <> 'sequence' or name = '№'),
    check (placeholder is null or type in ('text','number')),
    check (fill_mode = 'manual' or (type, fill_mode) in (('date','current_date'),('employee','author'),('location','author_primary_location'))),
    check (type = 'number' or (min_value is null and max_value is null)),
    check (min_value <= max_value),
    check (min_value not in ('NaN','Infinity','-Infinity') and max_value not in ('NaN','Infinity','-Infinity')),
    check ((type = 'confirmation') = (confirmation_rule is not null) and (type = 'confirmation') = (confirmation_timing is not null)),
    check (confirmation_rule in ('anyone','author','anyone_except_author','manager','owner','manager_or_owner','selected_members')),
    check (confirmation_timing in ('on_entry','deferred'))
);

create table journal_field_approver (
    organization_id bigint not null references organization(id),
    field_id uuid not null,
    member_uid uuid not null,
    primary key (organization_id, field_id, member_uid),
    foreign key (organization_id, field_id) references journal_field (organization_id, id),
    foreign key (organization_id, member_uid) references directory_member (organization_id, member_uid)
);

create table journal_schedule (
    organization_id bigint not null references organization(id),
    journal_id uuid not null,
    starts_on date not null,
    ends_on date,
    frequency text not null check (frequency in ('day','week','month','year')),
    interval_count integer not null check (interval_count > 0),
    weekdays smallint[],
    month_day smallint check (month_day between 1 and 31),
    version bigint not null default 0 check (version >= 0),
    primary key (organization_id, journal_id),
    foreign key (organization_id, journal_id) references journal (organization_id, id),
    check (ends_on >= starts_on),
    check ((frequency in ('month','year')) = (month_day is not null)),
    check ((frequency = 'week') = (weekdays is not null)),
    check (cardinality(weekdays) > 0 and weekdays <@ array[1,2,3,4,5,6,7]::smallint[])
);

create function copy_journal_schema() returns trigger language plpgsql as $$
begin
    perform 1 from template where organization_id = new.organization_id and id = new.template_id
        and version = new.template_version for share;
    if not found then raise exception 'Template version mismatch' using errcode = '23514'; end if;
    insert into journal_field (organization_id, id, journal_id, source_field_id, position, type, name,
        required, placeholder, fill_mode, min_value, max_value, confirmation_rule, confirmation_timing)
    select organization_id, gen_random_uuid(), new.id, id, position, type, name,
        required, placeholder, fill_mode, min_value, max_value, confirmation_rule, confirmation_timing
    from template_field where organization_id = new.organization_id and template_id = new.template_id;
    if not found then raise exception 'Cannot snapshot an empty template' using errcode = '23514'; end if;
    insert into journal_field_approver (organization_id, field_id, member_uid)
    select f.organization_id, f.id, a.member_uid from journal_field f
    join template_field_approver a on a.organization_id = f.organization_id and a.field_id = f.source_field_id
    where f.organization_id = new.organization_id and f.journal_id = new.id;
    if exists (select from journal_field f where f.organization_id = new.organization_id and f.journal_id = new.id
        and (f.confirmation_rule is not distinct from 'selected_members') <> exists (
            select from journal_field_approver a where a.organization_id = f.organization_id and a.field_id = f.id
        )) then raise exception 'Incomplete approver snapshot' using errcode = '23514'; end if;
    return null;
end $$;

create trigger snapshot_fields after insert on journal for each row execute function copy_journal_schema();

create function reject_change() returns trigger language plpgsql as $$
begin
    raise exception '% does not allow %', tg_table_name, tg_op using errcode = '23514';
end $$;

create trigger immutable_snapshot before update or delete on journal_field
for each row execute function reject_change();
create trigger snapshot_insert_only before insert on journal_field
for each row when (pg_trigger_depth() = 0) execute function reject_change();
create trigger immutable_snapshot before update or delete on journal_field_approver
for each row execute function reject_change();
create trigger snapshot_insert_only before insert on journal_field_approver
for each row when (pg_trigger_depth() = 0) execute function reject_change();
create trigger preserve_journal before delete on journal for each row execute function reject_change();
create trigger stable_journal_schema before update on journal for each row
execute function keep_keys('organization_id','id','template_id','template_version','location_id');

create function valid_weekdays(days smallint[]) returns boolean language sql immutable strict as $$
    select cardinality(days) = count(distinct d) from unnest(days) d
$$;
alter table journal_schedule add check (valid_weekdays(weekdays));
