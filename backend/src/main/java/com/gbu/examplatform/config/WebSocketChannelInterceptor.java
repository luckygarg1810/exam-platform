package com.gbu.examplatform.config;

import com.gbu.examplatform.modules.auth.RefreshTokenService;
import com.gbu.examplatform.security.AuthenticatedUser;
import com.gbu.examplatform.security.JwtTokenProvider;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.List;

/**
 * Validates JWT tokens on STOMP CONNECT frames.
 * The token should be sent in the STOMP Authorization header:
 * CONNECT
 * Authorization: Bearer <access_token>
 *
 * On success, sets a UsernamePasswordAuthenticationToken as the WebSocket
 * session principal so security context is available in @MessageMapping
 * methods.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WebSocketChannelInterceptor implements ChannelInterceptor {

    private final JwtTokenProvider jwtTokenProvider;
    private final RefreshTokenService refreshTokenService;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

        if (accessor == null || !StompCommand.CONNECT.equals(accessor.getCommand())) {
            return message; // Only process CONNECT frames
        }

        String token = extractToken(accessor);
        if (token == null) {
            log.warn("WebSocket CONNECT rejected: no Authorization header");
            throw new IllegalArgumentException("Missing JWT token in WebSocket CONNECT");
        }

        if (!jwtTokenProvider.validateToken(token)) {
            log.warn("WebSocket CONNECT rejected: invalid or expired JWT");
            throw new IllegalArgumentException("Invalid or expired JWT token");
        }

        try {
            Claims claims = jwtTokenProvider.extractAllClaims(token);
            String jti = claims.getId();

            if (refreshTokenService.isTokenBlacklisted(jti)) {
                log.warn("WebSocket CONNECT rejected: blacklisted JWT");
                throw new IllegalArgumentException("JWT token has been revoked");
            }

            String userId = claims.getSubject();
            String role = claims.get("role", String.class);
            String email = claims.get("email", String.class);

            UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                    new AuthenticatedUser(userId, email, role),
                    null,
                    List.of(new SimpleGrantedAuthority("ROLE_" + role)));

            accessor.setUser(auth);
            log.debug("WebSocket CONNECT authenticated: userId={} role={}", userId, role);

        } catch (IllegalArgumentException e) {
            throw e; // re-throw auth errors
        } catch (Exception e) {
            log.error("WebSocket authentication error: {}", e.getMessage());
            throw new IllegalArgumentException("Authentication failed: " + e.getMessage());
        }

        return message;
    }

    private String extractToken(StompHeaderAccessor accessor) {
        // Try STOMP Authorization header first
        String bearer = accessor.getFirstNativeHeader("Authorization");
        if (StringUtils.hasText(bearer) && bearer.startsWith("Bearer ")) {
            return bearer.substring(7);
        }
        // Fallback: custom header "token" (used by some STOMP clients)
        String token = accessor.getFirstNativeHeader("token");
        if (StringUtils.hasText(token)) {
            return token;
        }
        return null;
    }
}
