package ru.clearbarn.logbuilder.journal;

import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

@RestControllerAdvice(assignableTypes = JournalController.class)
class JournalErrors extends ResponseEntityExceptionHandler {
}
