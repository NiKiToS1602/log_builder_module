create table organization (
    id bigint not null,
    issuer text not null,
    created_at timestamptz not null default now(),
    primary key (id)
);

create table directory_location (
    organization_id bigint not null references organization(id),
    location_id bigint not null,
    name text,
    status text,
    is_removed boolean not null default false,
    external_updated_at timestamptz,
    source_payload jsonb,
    synced_at timestamptz not null default now(),
    primary key (organization_id, location_id)
);

create table directory_member (
    organization_id bigint not null references organization(id),
    member_uid uuid not null,
    full_name text,
    role text check (role in ('owner','manager','employee')),
    status text,
    primary_location_id bigint,
    is_removed boolean not null default false,
    external_updated_at timestamptz,
    source_payload jsonb,
    synced_at timestamptz not null default now(),
    primary key (organization_id, member_uid),
    foreign key (organization_id, primary_location_id) references directory_location (organization_id, location_id)
);

create table directory_member_location (
    organization_id bigint not null references organization(id),
    member_uid uuid not null,
    location_id bigint not null,
    primary key (organization_id, member_uid, location_id),
    foreign key (organization_id, member_uid) references directory_member (organization_id, member_uid),
    foreign key (organization_id, location_id) references directory_location (organization_id, location_id)
);

create table directory_sync_checkpoint (
    organization_id bigint not null references organization(id),
    resource text not null check (resource in ('members','locations')),
    subscription jsonb not null,
    delta_cursor text check (length(delta_cursor) <= 4096),
    updated_at timestamptz not null default now(),
    primary key (organization_id, resource)
);
