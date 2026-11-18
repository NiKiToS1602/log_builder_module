package ru.clearbarn.logbuilder.journal;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Repository;
import ru.clearbarn.logbuilder.access.JournalAccess;
import ru.clearbarn.logbuilder.model.journal.Journal;
import ru.clearbarn.logbuilder.model.journal.JournalField;
import ru.clearbarn.logbuilder.model.journal.JournalFieldApprover;

@Repository
class JournalStore {
    private final EntityManager entities;

    JournalStore(EntityManager entities) {
        this.entities = entities;
    }

    List<Journal> list(JournalAccess access, int offset, int limit, boolean includeArchived) {
        return entities.createQuery("""
            select j from Journal j
            where j.key.organizationId = :organization and j.locationId in :locations
              and (:includeArchived = true or j.status <> 'archived')
            order by j.createdAt desc, j.key.id desc
            """, Journal.class)
            .setParameter("organization", access.organizationId())
            .setParameter("locations", access.allowedLocationIds())
            .setParameter("includeArchived", includeArchived)
            .setFirstResult(offset)
            .setMaxResults(limit)
            .getResultList();
    }

    Journal find(JournalAccess access, UUID id, LockModeType lock) {
        return entities.createQuery("""
            select j from Journal j
            where j.key.organizationId = :organization and j.key.id = :id and j.locationId in :locations
            """, Journal.class)
            .setParameter("organization", access.organizationId())
            .setParameter("locations", access.allowedLocationIds())
            .setParameter("id", id)
            .setLockMode(lock)
            .getSingleResultOrNull();
    }

    List<JournalApi.Column> columns(Journal journal) {
        var fields = entities.createQuery("""
            select f from JournalField f
            where f.key.organizationId = :organization and f.journalId = :journal
            order by f.position
            """, JournalField.class)
            .setParameter("organization", journal.getKey().organizationId())
            .setParameter("journal", journal.getKey().id())
            .getResultList();

        var approvers = new HashMap<UUID, List<UUID>>();
        entities.createQuery("""
            select a from JournalFieldApprover a
            where a.key.organizationId = :organization and a.key.fieldId in (
                select f.key.id from JournalField f
                where f.key.organizationId = :organization and f.journalId = :journal
            )
            order by a.key.memberUid
            """, JournalFieldApprover.class)
            .setParameter("organization", journal.getKey().organizationId())
            .setParameter("journal", journal.getKey().id())
            .getResultList()
            .forEach(approver -> {
                var key = approver.getKey();
                approvers.computeIfAbsent(key.fieldId(), id -> new ArrayList<>()).add(key.memberUid());
            });

        return fields.stream()
            .map(field -> JournalApi.Column.from(field, approvers.getOrDefault(field.getKey().id(), List.of())))
            .toList();
    }
}
