create table template (
    organization_id bigint not null references organization(id),
    id uuid not null,
    name text not null check (btrim(name) <> ''),
    status text not null check (status in ('active','archived')),
    created_by_uid uuid not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    version bigint not null default 0 check (version >= 0),
    primary key (organization_id, id),
    foreign key (organization_id, created_by_uid) references directory_member (organization_id, member_uid)
);

create table template_field (
    organization_id bigint not null references organization(id),
    id uuid not null,
    template_id uuid not null,
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
    foreign key (organization_id, template_id) references template (organization_id, id),
    unique (organization_id, template_id, position) deferrable initially deferred,
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

create table template_field_approver (
    organization_id bigint not null references organization(id),
    field_id uuid not null,
    member_uid uuid not null,
    primary key (organization_id, field_id, member_uid),
    foreign key (organization_id, field_id) references template_field (organization_id, id),
    foreign key (organization_id, member_uid) references directory_member (organization_id, member_uid)
);

-- Identifiers and parent references remain stable for the life of a row.
create function keep_keys() returns trigger language plpgsql as $$
declare
    col text;
begin
    foreach col in array tg_argv loop
        if to_jsonb(old)->col is distinct from to_jsonb(new)->col then
            raise exception 'Cannot change %.%', tg_table_name, col using errcode = '23514';
        end if;
    end loop;
    return new;
end $$;

create trigger stable_template_field before update on template_field for each row
execute function keep_keys('organization_id','id','template_id');

create trigger stable_approver before update on template_field_approver for each row
execute function keep_keys('organization_id','field_id','member_uid');

create function check_template_shape() returns trigger language plpgsql as $$
declare
    tenant bigint := coalesce(new.organization_id, old.organization_id);
    parent_id uuid;
begin
    if tg_table_name = 'template' then
        parent_id := new.id;
    elsif tg_table_name = 'template_field' then
        parent_id := coalesce(new.template_id, old.template_id);
    else
        select template_id into parent_id from template_field
        where organization_id = tenant and id = coalesce(new.field_id, old.field_id);
    end if;
    perform 1 from template where organization_id = tenant and id = parent_id for update;
    if not found then return null; end if;

    if not exists (select from template_field where organization_id = tenant and template_id = parent_id)
       or exists (
           select from template_field f where f.organization_id = tenant and f.template_id = parent_id
           and (f.confirmation_rule is not distinct from 'selected_members') <> exists (
               select from template_field_approver a where a.organization_id = tenant and a.field_id = f.id
           )
       ) then
        raise exception 'Invalid field or approver list for template %', parent_id using errcode = '23514';
    end if;
    return null;
end $$;

create constraint trigger validate_template after insert on template
deferrable initially deferred for each row execute function check_template_shape();

create constraint trigger validate_template_field after insert or update or delete on template_field
deferrable initially deferred for each row execute function check_template_shape();

create constraint trigger validate_template_field_approver after insert or update or delete on template_field_approver
deferrable initially deferred for each row execute function check_template_shape();
