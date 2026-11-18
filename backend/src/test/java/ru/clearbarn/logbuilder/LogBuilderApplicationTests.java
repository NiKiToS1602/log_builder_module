package ru.clearbarn.logbuilder;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.io.IOException;
import javax.sql.DataSource;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.dao.DataIntegrityViolationException;
import org.flywaydb.core.Flyway;
import ru.clearbarn.logbuilder.model.directory.Organization;
import ru.clearbarn.logbuilder.model.entry.JournalEntry;
import ru.clearbarn.logbuilder.model.shared.OrganizationObjectId;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@AutoConfigureMockMvc
class LogBuilderApplicationTests {

    @TestConfiguration
    static class Database {
        @Bean(destroyMethod = "close")
        EmbeddedPostgres postgres() throws IOException {
            return EmbeddedPostgres.start();
        }

        @Bean
        DataSource dataSource(EmbeddedPostgres postgres) {
            return postgres.getPostgresDatabase();
        }
    }

    @Autowired JdbcTemplate sql;
    @Autowired TransactionTemplate transactions;
    @Autowired EntityManager entities;
    @Autowired DataSource database;
    @Autowired MockMvc mvc;

    @Test
    void servesSwaggerAndOpenApi() throws Exception {
        mvc.perform(get("/v3/api-docs"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.openapi").exists());
        mvc.perform(get("/swagger-ui/index.html"))
            .andExpect(status().isOk())
            .andExpect(content().string(org.hamcrest.Matchers.containsString("Swagger UI")));
        mvc.perform(get("/v3/api-docs/swagger-config"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.url").value("/v3/api-docs"));
    }

    @Test
    void upgradesAnExistingDirectory() {
        var config = Flyway.configure().dataSource(database).schemas("upgrade_test");
        config.target("1").load().migrate();
        sql.update("insert into upgrade_test.organization(id, issuer) values (42, 'test')");
        config.target("latest").load().migrate();
        assertEquals("test", sql.queryForObject("select issuer from upgrade_test.organization where id=42", String.class));
    }

    @Test
    void pendingConfirmationBlocksCompletionUntilSigned() {
        long tenant = 3;
        var member = java.util.UUID.randomUUID();
        var template = java.util.UUID.randomUUID();
        var journal = java.util.UUID.randomUUID();
        var entry = java.util.UUID.randomUUID();
        transactions.executeWithoutResult(tx -> {
            sql.update("insert into organization(id,issuer) values (?,'test')", tenant);
            sql.update("insert into directory_member(organization_id,member_uid) values (?,?)", tenant, member);
            sql.update("insert into directory_location(organization_id,location_id) values (?,1)", tenant);
            sql.update("insert into template(organization_id,id,name,status,created_by_uid) values (?,?,'Test','active',?)", tenant, template, member);
            sql.update("""
                insert into template_field(organization_id,id,template_id,position,type,name,required,confirmation_rule,confirmation_timing)
                values (?,gen_random_uuid(),?,0,'confirmation','Review',true,'manager','deferred')
                """, tenant, template);
            sql.update("insert into journal(organization_id,id,template_id,template_version,name,location_id,status,created_by_uid) values (?,?,?,0,'Review',1,'active',?)",
                tenant, journal, template, member);
            sql.update("insert into journal_entry(organization_id,id,journal_id,author_uid) values (?,?,?,?)", tenant, entry, journal, member);
            sql.update("""
                insert into entry_cell(organization_id,journal_id,entry_id,field_id,field_type,state)
                select organization_id,journal_id,?,id,type,'pending' from journal_field where journal_id=?
                """, entry, journal);
        });
        String complete = "update journal set status='completed',completed_at=now() where id=?";
        assertThrows(DataIntegrityViolationException.class, () -> sql.update(complete, journal));
        transactions.executeWithoutResult(tx -> {
            sql.update("""
                insert into cell_confirmation(organization_id,journal_id,entry_id,field_id,confirmer_uid,full_name_snapshot,role_snapshot)
                select organization_id,journal_id,entry_id,field_id,?,'Reviewer','manager' from entry_cell where entry_id=?
                """, member, entry);
            sql.update("update entry_cell set state='filled' where entry_id=?", entry);
        });
        assertEquals(1, sql.update(complete, journal));
        assertThrows(DataIntegrityViolationException.class, () -> sql.update(
            "insert into journal_entry(organization_id,id,journal_id,author_uid) values (?,gen_random_uuid(),?,?)", tenant, journal, member));
    }

    @Test
    void snapshotSurvivesTemplateEditAndIncompleteEntryRollsBack() {
        var member = java.util.UUID.randomUUID();
        var template = java.util.UUID.randomUUID();
        var journal = java.util.UUID.randomUUID();
        var entry = java.util.UUID.randomUUID();
        transactions.executeWithoutResult(tx -> {
            var organization = new Organization();
            organization.setId(1L);
            organization.setIssuer("test");
            entities.persist(organization);
            entities.flush();
            sql.update("insert into directory_member(organization_id,member_uid) values (1,?)", member);
            sql.update("insert into directory_location(organization_id,location_id) values (1,1)");
            sql.update("insert into template(organization_id,id,name,status,created_by_uid) values (1,?,'Test','active',?)", template, member);
            sql.update("insert into template_field(organization_id,id,template_id,position,type,name,required) values (1,gen_random_uuid(),?,0,'number','Temperature',true)", template);
            sql.update("insert into journal(organization_id,id,template_id,template_version,name,location_id,status,created_by_uid) values (1,?,?,0,'Test',1,'active',?)", journal, template, member);
        });
        sql.update("update template_field set name='Changed' where template_id=?", template);
        assertEquals("Temperature", sql.queryForObject("select name from journal_field where journal_id=?", String.class, journal));
        String insert = "insert into journal_entry(organization_id,id,journal_id,author_uid) values (1,?,?,?)";
        assertThrows(DataIntegrityViolationException.class, () -> sql.update(insert, entry, journal, member));
        transactions.executeWithoutResult(tx -> {
            var row = new JournalEntry();
            row.setKey(new OrganizationObjectId(1L, entry));
            row.setJournalId(journal);
            row.setAuthorUid(member);
            entities.persist(row);
            entities.flush();
            assertEquals(1L, row.getNumber());
            sql.update("""
                insert into entry_cell(organization_id,journal_id,entry_id,field_id,field_type,state,number_value)
                select organization_id,journal_id,?,id,type,'filled',0 from journal_field where journal_id=?
                """, entry, journal);
        });
        assertEquals(1L, sql.queryForObject("select number from journal_entry where id=?", Long.class, entry));
        sql.update("insert into organization(id,issuer) values (2,'test')");
        assertThrows(DataIntegrityViolationException.class, () -> sql.update(
            "insert into template(organization_id,id,name,status,created_by_uid) values (2,gen_random_uuid(),'Foreign','active',?)", member));
        assertThrows(DataIntegrityViolationException.class, () -> sql.update(
            "update journal_field set name='Rewritten' where journal_id=?", journal));
    }

}
