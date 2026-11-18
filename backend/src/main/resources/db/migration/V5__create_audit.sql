create table audit_event (
    organization_id bigint not null references organization(id),
    id uuid not null,
    journal_id uuid,
    template_id uuid,
    entry_id uuid,
    event_type text not null,
    actor_uid uuid not null,
    actor_name_snapshot text not null,
    actor_role_snapshot text not null,
    occurred_at timestamptz not null default now(),
    before_data jsonb,
    after_data jsonb,
    request_id uuid not null,
    primary key (organization_id, id),
    foreign key (organization_id, journal_id) references journal (organization_id, id),
    foreign key (organization_id, template_id) references template (organization_id, id),
    foreign key (organization_id, journal_id, entry_id) references journal_entry (organization_id, journal_id, id),
    foreign key (organization_id, actor_uid) references directory_member (organization_id, member_uid),
    check (entry_id is null or journal_id is not null)
);

create index audit_journal_history on audit_event (organization_id, journal_id, occurred_at desc, id);
create index audit_template_history on audit_event (organization_id, template_id, occurred_at desc, id);

create trigger append_only before update or delete or truncate on audit_event
for each statement execute function reject_change();
