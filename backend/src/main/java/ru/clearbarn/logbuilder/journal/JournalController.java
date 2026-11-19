package ru.clearbarn.logbuilder.journal;

import io.swagger.v3.oas.annotations.Parameter;
import java.net.URI;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import ru.clearbarn.logbuilder.access.JournalAccess;
import static ru.clearbarn.logbuilder.access.JournalAccess.REQUEST_ATTRIBUTE;

@RestController
@RequestMapping("/api/v1/journals")
class JournalController {
    private final JournalService journals;

    JournalController(JournalService journals) {
        this.journals = journals;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    ResponseEntity<JournalApi.Detail> create(
        @Parameter(hidden = true) @RequestAttribute(name = REQUEST_ATTRIBUTE, required = false) JournalAccess access,
        @RequestBody JournalApi.Create request
    ) {
        var result = journals.create(access, request);
        return ResponseEntity.created(URI.create("/api/v1/journals/" + result.journal().id())).body(result);
    }

    @GetMapping
    JournalApi.Page list(
        @Parameter(hidden = true) @RequestAttribute(name = REQUEST_ATTRIBUTE, required = false) JournalAccess access,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "50") int size,
        @RequestParam(defaultValue = "false") boolean includeArchived
    ) {
        return journals.list(access, page, size, includeArchived);
    }

    @GetMapping("/{id}")
    JournalApi.Detail get(
        @Parameter(hidden = true) @RequestAttribute(name = REQUEST_ATTRIBUTE, required = false) JournalAccess access,
        @PathVariable UUID id
    ) {
        return journals.get(access, id);
    }

    @PutMapping("/{id}")
    JournalApi.Detail update(
        @Parameter(hidden = true) @RequestAttribute(name = REQUEST_ATTRIBUTE, required = false) JournalAccess access,
        @PathVariable UUID id,
        @RequestBody JournalApi.Update request
    ) {
        return journals.update(access, id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(
        @Parameter(hidden = true) @RequestAttribute(name = REQUEST_ATTRIBUTE, required = false) JournalAccess access,
        @PathVariable UUID id,
        @RequestParam long version
    ) {
        journals.archive(access, id, version);
    }
}
