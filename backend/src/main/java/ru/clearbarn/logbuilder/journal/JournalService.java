package ru.clearbarn.logbuilder.journal;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import ru.clearbarn.logbuilder.access.JournalAccess;
import ru.clearbarn.logbuilder.model.audit.AuditEvent;
import ru.clearbarn.logbuilder.model.directory.DirectoryLocation;
import ru.clearbarn.logbuilder.model.directory.DirectoryMember;
import ru.clearbarn.logbuilder.model.directory.LocationId;
import ru.clearbarn.logbuilder.model.directory.MemberId;
import ru.clearbarn.logbuilder.model.journal.Journal;
import ru.clearbarn.logbuilder.model.shared.OrganizationObjectId;
import ru.clearbarn.logbuilder.model.template.JournalTemplate;

@Service
class JournalService {
    private final JournalStore store;
    private final EntityManager entities;

    JournalService(JournalStore store, EntityManager entities) {
        this.store = store;
        this.entities = entities;
    }

    @Transactional
    JournalApi.Detail create(JournalAccess access, JournalApi.Create request) {
        requireEditor(access);
        String name = validatedName(request.name());
        requireVersion(request.templateVersion());
        if (request.templateId() == null || request.locationId() == null || request.locationId() <= 0) {
            throw invalid("Укажите шаблон и филиал.");
        }
        if (!access.allowedLocationIds().contains(request.locationId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Филиал недоступен.");
        }

        var location = entities.find(DirectoryLocation.class, new LocationId(access.organizationId(), request.locationId()));
        if (location == null || Boolean.TRUE.equals(location.getIsRemoved()) || !"active".equals(location.getStatus())) {
            throw invalid("Филиал должен быть действующим.");
        }
        var template = entities.find(JournalTemplate.class,
            new OrganizationObjectId(access.organizationId(), request.templateId()), LockModeType.PESSIMISTIC_READ);
        if (template == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Шаблон недоступен.");
        }
        if (!"active".equals(template.getStatus()) || !template.getVersion().equals(request.templateVersion())) {
            throw conflict("Шаблон архивирован или его версия изменилась.");
        }
        validateResponsible(access, request.responsibleUid());
        String actorName = actorName(access);

        var journal = new Journal();
        journal.setKey(new OrganizationObjectId(access.organizationId(), UUID.randomUUID()));
        journal.setName(name);
        journal.setTemplateId(request.templateId());
        journal.setTemplateVersion(template.getVersion());
        journal.setLocationId(request.locationId());
        journal.setResponsibleUid(request.responsibleUid());
        journal.setCreatedByUid(access.memberUid());
        journal.setStatus("active");

        entities.persist(journal);
        entities.flush(); // The database copies the template fields on insert.
        recordChange(access, actorName, journal, "journal_created", null);
        return detail(journal);
    }

    @Transactional(readOnly = true)
    JournalApi.Page list(JournalAccess access, int page, int size, boolean includeArchived) {
        requireAccess(access);
        if (page < 0 || size < 1 || size > 100 || (long) page * size > Integer.MAX_VALUE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Некорректные параметры пагинации.");
        }
        if (access.allowedLocationIds().isEmpty()) {
            return new JournalApi.Page(List.of(), page, size, false);
        }
        var journals = store.list(access, page * size, size + 1, includeArchived);
        var items = journals.stream().limit(size).map(JournalApi.Summary::from).toList();
        return new JournalApi.Page(items, page, size, journals.size() > size);
    }

    @Transactional(readOnly = true)
    JournalApi.Detail get(JournalAccess access, UUID id) {
        requireAccess(access);
        return detail(find(access, id, LockModeType.NONE));
    }

    @Transactional
    JournalApi.Detail update(JournalAccess access, UUID id, JournalApi.Update request) {
        requireEditor(access);
        var journal = find(access, id, LockModeType.PESSIMISTIC_WRITE);
        requireVersion(request.version());
        checkVersion(journal, request.version());
        if (!"active".equals(journal.getStatus())) {
            throw conflict("Редактировать можно только активный журнал.");
        }

        String name = validatedName(request.name());
        boolean responsibleChanged = !Objects.equals(journal.getResponsibleUid(), request.responsibleUid());
        if (responsibleChanged) {
            validateResponsible(access, request.responsibleUid());
        }
        if (responsibleChanged || !journal.getName().equals(name)) {
            String actorName = actorName(access);
            var before = auditData(journal);
            journal.setName(name);
            journal.setResponsibleUid(request.responsibleUid());
            entities.flush();
            recordChange(access, actorName, journal, "journal_updated", before);
        }
        return detail(journal);
    }

    @Transactional
    void archive(JournalAccess access, UUID id, long version) {
        requireEditor(access);
        var journal = find(access, id, LockModeType.PESSIMISTIC_WRITE);
        requireVersion(version);
        if ("archived".equals(journal.getStatus())) {
            return;
        }
        checkVersion(journal, version);
        String actorName = actorName(access);
        var before = auditData(journal);
        journal.setStatus("archived");
        journal.setArchivedAt(Instant.now());
        entities.flush();
        recordChange(access, actorName, journal, "journal_archived", before);
    }

    private Journal find(JournalAccess access, UUID id, LockModeType lock) {
        if (!access.allowedLocationIds().isEmpty()) {
            var journal = store.find(access, id, lock);
            if (journal != null) {
                return journal;
            }
        }
        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Журнал недоступен.");
    }

    private JournalApi.Detail detail(Journal journal) {
        return new JournalApi.Detail(JournalApi.Summary.from(journal), store.columns(journal));
    }

    private void validateResponsible(JournalAccess access, UUID uid) {
        if (uid == null) {
            return;
        }
        var member = entities.find(DirectoryMember.class, new MemberId(access.organizationId(), uid));
        if (member == null || Boolean.TRUE.equals(member.getIsRemoved()) || !"active".equals(member.getStatus())) {
            throw invalid("Ответственный должен быть действующим сотрудником организации.");
        }
    }

    private String actorName(JournalAccess access) {
        var actor = entities.find(DirectoryMember.class, new MemberId(access.organizationId(), access.memberUid()));
        if (actor == null || actor.getFullName() == null || actor.getFullName().isBlank()) {
            throw conflict("Профиль пользователя ещё недоступен в локальном каталоге.");
        }
        return actor.getFullName();
    }

    private void recordChange(
        JournalAccess access, String actorName, Journal journal, String type, Map<String, Object> before
    ) {
        var event = new AuditEvent();
        event.setKey(new OrganizationObjectId(access.organizationId(), UUID.randomUUID()));
        event.setJournalId(journal.getKey().id());
        event.setTemplateId(journal.getTemplateId());
        event.setEventType(type);
        event.setActorUid(access.memberUid());
        event.setActorNameSnapshot(actorName);
        event.setActorRoleSnapshot(access.role().name().toLowerCase(Locale.ROOT));
        event.setBeforeData(before);
        event.setAfterData(auditData(journal));
        event.setRequestId(UUID.randomUUID());
        entities.persist(event);
    }

    private static Map<String, Object> auditData(Journal journal) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("name", journal.getName());
        data.put("status", journal.getStatus());
        data.put("version", journal.getVersion());
        data.put("responsibleUid", Objects.toString(journal.getResponsibleUid(), null));
        data.put("archivedAt", Objects.toString(journal.getArchivedAt(), null));
        return data;
    }

    private static void requireAccess(JournalAccess access) {
        if (access == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Требуется вход.");
        }
    }

    private static void requireEditor(JournalAccess access) {
        requireAccess(access);
        if (access.role() == JournalAccess.Role.EMPLOYEE) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Нет права изменять журналы.");
        }
    }

    private static String validatedName(String name) {
        if (name == null || name.isBlank() || name.indexOf(0) >= 0) {
            throw invalid("Укажите название журнала.");
        }
        return name.strip();
    }

    private static void requireVersion(Long version) {
        if (version == null || version < 0) {
            throw invalid("Укажите неотрицательную версию.");
        }
    }

    private static void checkVersion(Journal journal, long version) {
        if (journal.getVersion() != version) {
            throw conflict("Версия журнала изменилась.");
        }
    }

    private static ResponseStatusException invalid(String message) {
        return new ResponseStatusException(HttpStatus.UNPROCESSABLE_CONTENT, message);
    }

    private static ResponseStatusException conflict(String message) {
        return new ResponseStatusException(HttpStatus.CONFLICT, message);
    }
}
