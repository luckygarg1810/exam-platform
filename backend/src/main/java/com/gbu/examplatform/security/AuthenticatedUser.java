package com.gbu.examplatform.security;

import lombok.Getter;

@Getter
public class AuthenticatedUser {
    private final String id;
    private final String email;
    private final String role;

    public AuthenticatedUser(String id, String email, String role) {
        this.id = id;
        this.email = email;
        this.role = role;
    }
}
