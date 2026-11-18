package ru.clearbarn.logbuilder.model.directory;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "organization")
@Getter
@Setter
public class Organization {
    @Id
    private Long id;

    private String issuer;

    @CreationTimestamp
    private Instant createdAt;
}
