package com.gbu.examplatform.modules.auth.dto;

import com.gbu.examplatform.modules.user.User;
import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class TokenResponse {
    private String accessToken;
    private String refreshToken;
    private String tokenType;
    private long expiresIn; // seconds
    private UUID userId;
    private String email;
    private String name;
    private User.Role role;
}
