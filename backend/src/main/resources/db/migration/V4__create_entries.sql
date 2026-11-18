create table journal_entry (
    organization_id bigint not null references organization(id),
    id uuid not null,
    journal_id uuid not null,
    number bigint not null check (number > 0),
    author_uid uuid not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    version bigint not null default 0 check (version >= 0),
    primary key (organization_id, id),
    foreign key (organization_id, journal_id) references journal (organization_id, id),
    foreign key (organization_id, author_uid) references directory_member (organization_id, member_uid),
    unique (organization_id, journal_id, id),
    unique (organization_id, journal_id, number)
);

create table entry_cell (
    organization_id bigint not null references organization(id),
    journal_id uuid not null,
    entry_id uuid not null,
    field_id uuid not null,
    field_type text not null,
    state text not null check (state in ('filled','empty','skipped','pending')),
    text_value text check (text_value = btrim(text_value) and text_value <> ''),
    number_value numeric check (number_value not in ('NaN','Infinity','-Infinity')),
    date_value date,
    member_uid uuid,
    location_id bigint,
    boolean_value boolean,
    primary key (organization_id, journal_id, entry_id, field_id),
    foreign key (organization_id, journal_id, entry_id) references journal_entry (organization_id, journal_id, id),
    foreign key (organization_id, journal_id, field_id, field_type) references journal_field (organization_id, journal_id, id, type),
    foreign key (organization_id, member_uid) references directory_member (organization_id, member_uid),
    foreign key (organization_id, location_id) references directory_location (organization_id, location_id),
    check (field_type <> 'sequence' or state = 'filled'),
    check (state <> 'pending' or field_type = 'confirmation'),
    check (num_nonnulls(text_value, number_value, date_value, member_uid, location_id, boolean_value) =
        case when state = 'filled' and field_type not in ('image','confirmation') then 1 else 0 end),
    check (text_value is null or field_type = 'text'),
    check (number_value is null or field_type in ('number','sequence')),
    check (date_value is null or field_type in ('date','next_entry_date')),
    check (member_uid is null or field_type = 'employee'),
    check (location_id is null or field_type = 'location'),
    check (boolean_value is null or field_type = 'boolean')
);

create table cell_confirmation (
    organization_id bigint not null references organization(id),
    journal_id uuid not null,
    entry_id uuid not null,
    field_id uuid not null,
    confirmer_uid uuid not null,
    full_name_snapshot text not null,
    role_snapshot text not null check (role_snapshot in ('employee','owner','manager')),
    confirmed_at timestamptz not null default now(),
    primary key (organization_id, journal_id, entry_id, field_id),
    foreign key (organization_id, journal_id, entry_id, field_id) references entry_cell (organization_id, journal_id, entry_id, field_id),
    foreign key (organization_id, confirmer_uid) references directory_member (organization_id, member_uid)
);

create table cell_attachment (
    organization_id bigint not null references organization(id),
    journal_id uuid not null,
    entry_id uuid not null,
    field_id uuid not null,
    storage_key text not null unique,
    original_name text not null,
    media_type text not null check (media_type in ('image/png','image/jpeg','image/webp','image/gif','image/avif')),
    size_bytes bigint not null check (size_bytes between 1 and 1048576),
    sha256 text not null check (sha256 ~ '^[0-9a-fA-F]{64}$'),
    created_at timestamptz not null default now(),
    primary key (organization_id, journal_id, entry_id, field_id),
    foreign key (organization_id, journal_id, entry_id, field_id) references entry_cell (organization_id, journal_id, entry_id, field_id)
);

create function assign_entry_number() returns trigger language plpgsql as $$
declare
    supplied_number bigint := new.number;
begin
    update journal set next_entry_number = next_entry_number + 1
    where organization_id = new.organization_id and id = new.journal_id and status = 'active'
    returning next_entry_number - 1 into new.number;
    if not found then raise exception 'An active journal is required' using errcode = '23514'; end if;
    if supplied_number is not null and supplied_number <> new.number then
        raise exception 'Unexpected entry number' using errcode = '23514';
    end if;
    return new;
end $$;
create trigger allocate_number before insert on journal_entry for each row execute function assign_entry_number();
create trigger preserve_entry before delete on journal_entry for each row execute function reject_change();
create trigger stable_entry before update on journal_entry for each row
execute function keep_keys('organization_id','journal_id','id','number','author_uid');

create function require_active_journal() returns trigger language plpgsql as $$
begin
    perform 1 from journal where organization_id = coalesce(new.organization_id, old.organization_id)
        and id = coalesce(new.journal_id, old.journal_id) and status = 'active' for update;
    if not found then raise exception 'Journal is closed' using errcode = '23514'; end if;
    if tg_op = 'DELETE' then return old; end if;
    return new;
end $$;
create trigger stable_identity before update on entry_cell for each row
execute function keep_keys('organization_id','journal_id','entry_id','field_id');
create trigger active_journal before insert or update or delete on entry_cell for each row execute function require_active_journal();
create trigger stable_identity before update on cell_confirmation for each row
execute function keep_keys('organization_id','journal_id','entry_id','field_id');
create trigger active_journal before insert or update or delete on cell_confirmation for each row execute function require_active_journal();
create trigger stable_identity before update on cell_attachment for each row
execute function keep_keys('organization_id','journal_id','entry_id','field_id');
create trigger active_journal before insert or update or delete on cell_attachment for each row execute function require_active_journal();
create trigger immutable_confirmation before update or delete on cell_confirmation for each row execute function reject_change();
create trigger keep_final_confirmation before update or delete on entry_cell for each row
when (old.field_type = 'confirmation' and old.state in ('skipped','filled')) execute function reject_change();

create function check_entry_shape() returns trigger language plpgsql as $$
declare
    tenant bigint := coalesce(new.organization_id, old.organization_id);
    jid uuid := coalesce(new.journal_id, old.journal_id);
    eid uuid;
    row_number_value bigint;
begin
    if tg_table_name = 'journal_entry' then eid := new.id;
    else eid := coalesce(new.entry_id, old.entry_id); end if;
    select number into strict row_number_value from journal_entry
        where organization_id = tenant and journal_id = jid and id = eid;
    if exists (
        select from journal_field f
        left join entry_cell c on c.organization_id = tenant and c.journal_id = jid and c.entry_id = eid and c.field_id = f.id
        left join cell_attachment a on (a.organization_id, a.journal_id, a.entry_id, a.field_id)
            = (c.organization_id, c.journal_id, c.entry_id, c.field_id)
        left join cell_confirmation s on (s.organization_id, s.journal_id, s.entry_id, s.field_id)
            = (c.organization_id, c.journal_id, c.entry_id, c.field_id)
        where f.organization_id = tenant and f.journal_id = jid and (
            c.field_id is null or (f.required and c.state = 'empty')
            or (f.type = 'sequence' and c.number_value is distinct from row_number_value)
            or (f.type = 'confirmation' and (c.state = 'empty' or (c.state = 'pending' and f.confirmation_timing <> 'deferred')))
            or ((f.type = 'image' and c.state = 'filled') <> (a.field_id is not null))
            or ((f.type = 'confirmation' and c.state = 'filled') <> (s.field_id is not null))
        )
    ) then raise exception 'Invalid cells for entry %', eid using errcode = '23514'; end if;
    return null;
end $$;
create constraint trigger validate_entry after insert or update on journal_entry
deferrable initially deferred for each row execute function check_entry_shape();
create constraint trigger validate_entry after insert or update or delete on entry_cell
deferrable initially deferred for each row execute function check_entry_shape();
create constraint trigger validate_entry after insert or update or delete on cell_attachment
deferrable initially deferred for each row execute function check_entry_shape();
create constraint trigger validate_entry after insert or update or delete on cell_confirmation
deferrable initially deferred for each row execute function check_entry_shape();
create function check_closing_journal() returns trigger language plpgsql as $$
begin
    if old.status = 'active' and new.status <> 'active' and exists (
        select from entry_cell where organization_id = new.organization_id and journal_id = new.id
        and field_type = 'confirmation' and state not in ('filled','skipped')
    ) then raise exception 'Journal has pending confirmations' using errcode = '23514'; end if;
    return new;
end $$;
create trigger validate_closure before update of status on journal for each row execute function check_closing_journal();
