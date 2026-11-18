package ru.clearbarn.logbuilder;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.support.TransactionTemplate;
import ru.clearbarn.logbuilder.access.JournalAccess;
import ru.clearbarn.logbuilder.access.JournalAccess.Role;
import tools.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static ru.clearbarn.logbuilder.access.JournalAccess.REQUEST_ATTRIBUTE;

@SpringBootTest
@AutoConfigureMockMvc
@Import(LogBuilderApplicationTests.Database.class)
class JournalApiTests {
    private static final String API = "/api/v1/journals";

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate sql;
    @Autowired TransactionTemplate transactions;
    @Autowired ObjectMapper json;

    @Test
    void publishesJournalOperationsInOpenApi() throws Exception {
        mvc.perform(get("/v3/api-docs"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.paths['/api/v1/journals'].get").exists())
            .andExpect(jsonPath("$.paths['/api/v1/journals'].post.responses['201']").exists())
            .andExpect(jsonPath("$.paths['/api/v1/journals/{id}'].get").exists())
            .andExpect(jsonPath("$.paths['/api/v1/journals/{id}'].put").exists())
            .andExpect(jsonPath("$.paths['/api/v1/journals/{id}'].delete.responses['204']").exists());
    }

    @Test
    void createsReadsUpdatesAndArchivesJournalWithHistory() throws Exception {
        var fixture = seed(101);
        var access = fixture.access(Role.MANAGER, 1L);
        var created = mvc.perform(post(API).requestAttr(REQUEST_ATTRIBUTE, access)
                .contentType("application/json").content(createBody(fixture, 1, 0)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.journal.name").value("Контроль"))
            .andExpect(jsonPath("$.journal.version").value(0))
            .andExpect(jsonPath("$.journal.status").value("active"))
            .andExpect(jsonPath("$.columns[0].name").value("Комментарий"))
            .andExpect(jsonPath("$.columns[1].approverUids[0]").value(fixture.member().toString()))
            .andReturn();

        String id = journalId(created).toString();
        String url = API + "/" + id;
        assertEquals(url, created.getResponse().getHeader("Location"));
        sql.update("update template_field set name='Новое поле' where template_id=? and position=0", fixture.template());
        mvc.perform(get(url).requestAttr(REQUEST_ATTRIBUTE, access))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.columns[0].name").value("Комментарий"));

        UUID entry = UUID.randomUUID();
        transactions.executeWithoutResult(tx -> {
            sql.update("""
                insert into journal_entry (organization_id, id, journal_id, author_uid) values (?, ?, ?::uuid, ?)
                """, fixture.organization(), entry, id, fixture.member());
            sql.update("""
                insert into entry_cell (organization_id, journal_id, entry_id, field_id, field_type, state)
                select organization_id, journal_id, ?, id, type, 'skipped' from journal_field
                where organization_id=? and journal_id=?::uuid
                """, entry, fixture.organization(), id);
        });

        mvc.perform(put(url).requestAttr(REQUEST_ATTRIBUTE, access)
                .contentType("application/json").content(updateBody(fixture, 0)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.journal.name").value("Переименован"))
            .andExpect(jsonPath("$.journal.responsibleUid").value(fixture.member().toString()))
            .andExpect(jsonPath("$.journal.version").value(1));

        mvc.perform(put(url).requestAttr(REQUEST_ATTRIBUTE, access)
                .contentType("application/json").content(updateBody(fixture, 0)))
            .andExpect(status().isConflict());
        mvc.perform(delete(url).requestAttr(REQUEST_ATTRIBUTE, access).param("version", "0"))
            .andExpect(status().isConflict());

        mvc.perform(delete(url).requestAttr(REQUEST_ATTRIBUTE, access).param("version", "1"))
            .andExpect(status().isNoContent());
        mvc.perform(delete(url).requestAttr(REQUEST_ATTRIBUTE, access).param("version", "1"))
            .andExpect(status().isNoContent());
        mvc.perform(get(url).requestAttr(REQUEST_ATTRIBUTE, access))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.journal.status").value("archived"))
            .andExpect(jsonPath("$.journal.version").value(2))
            .andExpect(jsonPath("$.journal.archivedAt").isString())
            .andExpect(jsonPath("$.columns[0].name").value("Комментарий"));
        mvc.perform(put(url).requestAttr(REQUEST_ATTRIBUTE, access)
                .contentType("application/json").content(updateBody(fixture, 2)))
            .andExpect(status().isConflict());

        mvc.perform(get(API).requestAttr(REQUEST_ATTRIBUTE, access))
            .andExpect(jsonPath("$.items").isEmpty());
        mvc.perform(get(API).requestAttr(REQUEST_ATTRIBUTE, access).param("includeArchived", "true"))
            .andExpect(jsonPath("$.items[0].id").value(id));

        assertEquals(2, sql.queryForObject("select count(*) from entry_cell where entry_id=?", Integer.class, entry));
        assertEquals(
            List.of("journal_created", "journal_updated", "journal_archived"),
            sql.queryForList("""
                select event_type from audit_event where organization_id=? and journal_id=?::uuid
                order by (after_data->>'version')::bigint
                """, String.class, fixture.organization(), id)
        );
        assertEquals("active", sql.queryForObject("""
            select before_data->>'status' from audit_event
            where organization_id=? and journal_id=?::uuid and event_type='journal_archived'
            """, String.class, fixture.organization(), id));
    }

    @Test
    void scopesEveryOperationToVerifiedOrganizationLocationsAndRole() throws Exception {
        var fixture = seed(102);
        var other = seed(103);
        var journal = insertJournal(fixture, 1, "00000000-0000-4000-8000-000000000001");
        String url = API + "/" + journal;
        var wrongLocation = fixture.access(Role.OWNER, 2L);
        var wrongOrganization = other.access(Role.OWNER, 1L);
        var employee = fixture.access(Role.EMPLOYEE, 1L);
        var noLocations = fixture.access(Role.OWNER);

        mvc.perform(get(url).header("X-Organization-Id", "102").header("X-Role", "owner"))
            .andExpect(status().isUnauthorized());
        mvc.perform(get(url).requestAttr(REQUEST_ATTRIBUTE, employee)).andExpect(status().isOk());
        mvc.perform(get(API + "/" + UUID.randomUUID()).requestAttr(REQUEST_ATTRIBUTE, employee))
            .andExpect(status().isNotFound());

        for (var denied : List.of(wrongLocation, wrongOrganization, noLocations)) {
            mvc.perform(get(url).requestAttr(REQUEST_ATTRIBUTE, denied)).andExpect(status().isNotFound());
            mvc.perform(put(url).requestAttr(REQUEST_ATTRIBUTE, denied)
                    .contentType("application/json").content(updateBody(fixture, 0)))
                .andExpect(status().isNotFound());
            mvc.perform(delete(url).requestAttr(REQUEST_ATTRIBUTE, denied).param("version", "0"))
                .andExpect(status().isNotFound());
            mvc.perform(get(API).requestAttr(REQUEST_ATTRIBUTE, denied))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isEmpty());
        }

        mvc.perform(put(url).requestAttr(REQUEST_ATTRIBUTE, employee)
                .contentType("application/json").content(updateBody(fixture, 0)))
            .andExpect(status().isForbidden());
        mvc.perform(delete(url).requestAttr(REQUEST_ATTRIBUTE, employee).param("version", "0"))
            .andExpect(status().isForbidden());
        mvc.perform(post(API).requestAttr(REQUEST_ATTRIBUTE, employee)
                .contentType("application/json").content(createBody(fixture, 1, 0)))
            .andExpect(status().isForbidden());
        mvc.perform(post(API).requestAttr(REQUEST_ATTRIBUTE, wrongLocation)
                .contentType("application/json").content(createBody(fixture, 1, 0)))
            .andExpect(status().isForbidden());
        mvc.perform(post(API).requestAttr(REQUEST_ATTRIBUTE, wrongOrganization)
                .contentType("application/json").content(createBody(fixture, 1, 0)))
            .andExpect(status().isNotFound());
        assertEquals(0, sql.queryForObject("""
            select count(*) from audit_event where organization_id in (?,?)
            """, Integer.class, fixture.organization(), other.organization()));
    }

    @Test
    void paginatesVisibleJournalsWithDeterministicOrderForEqualTimestamps() throws Exception {
        var fixture = seed(104);
        var first = insertJournal(fixture, 1, "00000000-0000-4000-8000-000000000002");
        var second = insertJournal(fixture, 1, "00000000-0000-4000-8000-000000000001");
        insertJournal(fixture, 2, "00000000-0000-4000-8000-000000000003");
        var access = fixture.access(Role.OWNER, 1L);

        mvc.perform(get(API).requestAttr(REQUEST_ATTRIBUTE, access).param("size", "1"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items.length()").value(1))
            .andExpect(jsonPath("$.items[0].id").value(first.toString()))
            .andExpect(jsonPath("$.hasNext").value(true));
        mvc.perform(get(API).requestAttr(REQUEST_ATTRIBUTE, access).param("size", "1").param("page", "1"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[0].id").value(second.toString()))
            .andExpect(jsonPath("$.hasNext").value(false));
        mvc.perform(get(API).requestAttr(REQUEST_ATTRIBUTE, access).param("size", "1").param("page", "2"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items").isEmpty());
        mvc.perform(get(API).requestAttr(REQUEST_ATTRIBUTE, access).param("size", "0"))
            .andExpect(status().isBadRequest());
    }

    @Test
    void rejectsInvalidCreateWithoutLeavingPartialState() throws Exception {
        var fixture = seed(105);
        var access = fixture.access(Role.MANAGER, 1L);
        mvc.perform(post(API).requestAttr(REQUEST_ATTRIBUTE, access)
                .contentType("application/json").content(createBody(fixture, 1, 1)))
            .andExpect(status().isConflict())
            .andExpect(header().string("Content-Type", "application/problem+json"))
            .andExpect(jsonPath("$.detail").isString());
        mvc.perform(post(API).requestAttr(REQUEST_ATTRIBUTE, access)
                .contentType("application/json").content(createBody(fixture, 1, 0).replace("Контроль", " ")))
            .andExpect(status().is(422));
        var unknownActor = new JournalAccess(fixture.organization(), UUID.randomUUID(), Role.MANAGER, Set.of(1L));
        mvc.perform(post(API).requestAttr(REQUEST_ATTRIBUTE, unknownActor)
                .contentType("application/json").content(createBody(fixture, 1, 0)))
            .andExpect(status().isConflict());
        assertEquals(0, sql.queryForObject("select count(*) from journal where organization_id=?",
            Integer.class, fixture.organization()));
        assertEquals(0, sql.queryForObject("select count(*) from journal_field where organization_id=?",
            Integer.class, fixture.organization()));
    }

    private UUID journalId(MvcResult result) throws Exception {
        var body = json.readTree(result.getResponse().getContentAsByteArray());
        return UUID.fromString(body.path("journal").path("id").asString());
    }

    private static String createBody(Fixture fixture, long location, long version) {
        return """
            {"name":" Контроль ","templateId":"%s","templateVersion":%d,"locationId":%d}
            """.formatted(fixture.template(), version, location);
    }

    private static String updateBody(Fixture fixture, long version) {
        return """
            {"name":"Переименован","responsibleUid":"%s","version":%d}
            """.formatted(fixture.member(), version);
    }

    private Fixture seed(long organization) {
        UUID member = UUID.randomUUID();
        UUID template = UUID.randomUUID();
        UUID confirmationField = UUID.randomUUID();
        transactions.executeWithoutResult(tx -> {
            sql.update("insert into organization(id, issuer) values (?,'test')", organization);
            sql.update("""
                insert into directory_member (organization_id, member_uid, full_name, status)
                values (?, ?, 'Тестовый сотрудник', 'active')
                """, organization, member);
            sql.update("""
                insert into directory_location (organization_id, location_id, status) values (?, 1, 'active'), (?, 2, 'active')
                """, organization, organization);
            sql.update("""
                insert into template (organization_id, id, name, status, created_by_uid)
                values (?, ?, 'Шаблон', 'active', ?)
                """, organization, template, member);
            sql.update("""
                insert into template_field (organization_id, id, template_id, position, type, name, required)
                values (?, gen_random_uuid(), ?, 0, 'text', 'Комментарий', false)
                """, organization, template);
            sql.update("""
                insert into template_field (organization_id, id, template_id, position, type, name, required,
                    confirmation_rule, confirmation_timing)
                values (?, ?, ?, 1, 'confirmation', 'Подпись', true, 'selected_members', 'deferred')
                """, organization, confirmationField, template);
            sql.update("""
                insert into template_field_approver (organization_id, field_id, member_uid) values (?, ?, ?)
                """, organization, confirmationField, member);
        });
        return new Fixture(organization, member, template);
    }

    private UUID insertJournal(Fixture fixture, long location, String id) {
        UUID journal = UUID.fromString(id);
        sql.update("""
            insert into journal (organization_id, id, template_id, template_version, name, location_id, status,
                created_by_uid, created_at)
            values (?, ?, ?, 0, 'Журнал', ?, 'active', ?, '2026-01-01T00:00:00Z')
            """, fixture.organization(), journal, fixture.template(), location, fixture.member());
        return journal;
    }

    private record Fixture(long organization, UUID member, UUID template) {
        JournalAccess access(Role role, Long... locations) {
            return new JournalAccess(organization, member, role, Set.of(locations));
        }
    }
}
