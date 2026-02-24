package com.gbu.examplatform.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
public class SecurityUtils {

    public AuthenticatedUser getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof AuthenticatedUser user) {
            return user;
        }
        throw new IllegalStateException("No authenticated user found in security context");
    }

    public UUID getCurrentUserId() {
        return UUID.fromString(getCurrentUser().getId());
    }

    public String getCurrentUserRole() {
        return getCurrentUser().getRole();
    }

    public boolean hasRole(String role) {
        return getCurrentUser().getRole().equals(role);
    }

    public boolean isAdmin() {
        return hasRole("ADMIN");
    }

    public boolean isProctor() {
        return hasRole("PROCTOR");
    }

    public boolean isStudent() {
        return hasRole("STUDENT");
    }
}
