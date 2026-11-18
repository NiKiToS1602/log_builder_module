create index journal_by_location on journal (organization_id, location_id, status, created_at desc, id);
create index journal_by_template on journal (organization_id, template_id);
create index template_list on template (organization_id, status, name, id);
create index entries_by_time on journal_entry (organization_id, journal_id, created_at, id);
create index cells_by_date on entry_cell (organization_id, journal_id, field_id, date_value, entry_id) where date_value is not null;
create index cells_by_number on entry_cell (organization_id, journal_id, field_id, number_value, entry_id) where number_value is not null;
create index confirmation_states on entry_cell (organization_id, journal_id, state) where field_type = 'confirmation';

-- Reverse lookups for references not covered by primary or list indexes.
create index directory_member_by_primary_location_id on directory_member (organization_id, primary_location_id);
create index directory_member_location_by_location_id on directory_member_location (organization_id, location_id);
create index template_by_created_by_uid on template (organization_id, created_by_uid);
create index template_field_approver_by_member_uid on template_field_approver (organization_id, member_uid);
create index journal_by_responsible_uid on journal (organization_id, responsible_uid);
create index journal_by_created_by_uid on journal (organization_id, created_by_uid);
create index journal_field_approver_by_member_uid on journal_field_approver (organization_id, member_uid);
create index journal_entry_by_author_uid on journal_entry (organization_id, author_uid);
create index entry_cell_by_member_uid on entry_cell (organization_id, member_uid);
create index entry_cell_by_location_id on entry_cell (organization_id, location_id);
create index cell_confirmation_by_confirmer_uid on cell_confirmation (organization_id, confirmer_uid);
create index audit_event_by_actor_uid on audit_event (organization_id, actor_uid);
create index audit_event_by_journal_id_entry_id on audit_event (organization_id, journal_id, entry_id);
