package ru.clearbarn.logbuilder.model.directory;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "directory_member_location")
@Getter
@Setter
public class DirectoryMemberLocation {
    @EmbeddedId
    private MemberLocationId key;
}
