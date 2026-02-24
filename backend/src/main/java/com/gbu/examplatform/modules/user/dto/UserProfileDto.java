package com.gbu.examplatform.modules.user.dto;

import com.gbu.examplatform.modules.user.User;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class UserProfileDto {
    private UUID id;
    private String name;
    private String email;
    private User.Role role;
    private String universityRoll;
    private String department;
    private String profilePhotoUrl;
    private Boolean isActive;
    private Instant createdAt;
}
