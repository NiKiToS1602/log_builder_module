create index unresolved_confirmations_by_journal on entry_cell (organization_id, journal_id)
where field_type = 'confirmation' and state not in ('filled', 'skipped');
