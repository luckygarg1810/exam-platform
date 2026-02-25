package com.gbu.examplatform.config;

import com.gbu.examplatform.modules.auth.RefreshTokenService;
import com.gbu.examplatform.modules.proctoring.ExamProctorRepository;
import com.gbu.examplatform.modules.session.ExamSessionRepository;
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
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Validates JWT tokens on STOMP CONNECT frames and enforces ownership/role
 * rules on SUBSCRIBE frames.
 *
 * CONNECT: The token should be sent in the STOMP Authorization header:
 * Authorization: Bearer <access_token>
 *
 * SUBSCRIBE rules:
 * /queue/exam/{sessionId}/** — only the session's enrolled student
 * /topic/proctor/** — only PROCTOR or ADMIN
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WebSocketChannelInterceptor implements ChannelInterceptor {

    private static final Pattern SESSION_DEST = Pattern.compile("^/queue/exam/([^/]+)/");
    private static final Pattern EXAM_ALERT_DEST = Pattern.compile("^/topic/proctor/exam/([^/]+)/");

    private final JwtTokenProvider jwtTokenProvider;
    private final RefreshTokenService refreshTokenService;
    private final ExamSessionRepository sessionRepository;
    private final ExamProctorRepository examProctorRepository;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null)
            return message;

        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            handleConnect(accessor);
        } else if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
            handleSubscribe(accessor);
        }
        return message;
    }

    private void handleConnect(StompHeaderAccessor accessor) {

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

            // Only ACCESS tokens are permitted on the WebSocket connection
            String tokenType = claims.get("type", String.class);
            if (!"ACCESS".equals(tokenType)) {
                log.warn("WebSocket CONNECT rejected: non-ACCESS token type={}", tokenType);
                throw new IllegalArgumentException("Only access tokens may be used for WebSocket connections");
            }

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
            throw e;
        } catch (Exception e) {
            log.error("WebSocket authentication error: {}", e.getMessage());
            throw new IllegalArgumentException("Authentication failed: " + e.getMessage());
        }
    }

    private void handleSubscribe(StompHeaderAccessor accessor) {
        String destination = accessor.getDestination();
        if (destination == null)
            return;

        AuthenticatedUser principal = extractPrincipal(accessor);
        if (principal == null) {
            log.warn("SUBSCRIBE rejected: no authenticated principal for destination {}", destination);
            throw new IllegalArgumentException("Not authenticated");
        }

        // /queue/exam/{sessionId}/warning|suspend — only the session's own student
        Matcher m = SESSION_DEST.matcher(destination);
        if (m.find()) {
            String sessionIdStr = m.group(1);
            try {
                UUID sessionId = UUID.fromString(sessionIdStr);
                String role = principal.getRole();
                // Proctors and admins may subscribe to monitor any session
                if ("PROCTOR".equals(role) || "ADMIN".equals(role))
                    return;

                // Students must own the session
                UUID ownerId = sessionRepository.findById(sessionId)
                        .map(s -> s.getEnrollment().getUser().getId())
                        .orElse(null);
                if (ownerId == null || !ownerId.toString().equals(principal.getId())) {
                    log.warn("SUBSCRIBE rejected: user {} does not own session {}", principal.getId(), sessionId);
                    throw new IllegalArgumentException("You are not authorised to subscribe to this session");
                }
            } catch (IllegalArgumentException e) {
                throw e;
            } catch (Exception e) {
                log.error("SUBSCRIBE ownership check error: {}", e.getMessage());
                throw new IllegalArgumentException("Subscription authorization failed");
            }
            return;
        }

        // /topic/proctor/exam/{examId}/** — assigned proctors and admins only
        Matcher examMatcher = EXAM_ALERT_DEST.matcher(destination);
        if (examMatcher.find()) {
            String role = principal.getRole();
            if (!"PROCTOR".equals(role) && !"ADMIN".equals(role)) {
                log.warn("SUBSCRIBE rejected: role {} cannot subscribe to {}", role, destination);
                throw new IllegalArgumentException("Only proctors and admins may subscribe to exam alert topics");
            }
            // Proctors must be assigned to the specific exam
            if ("PROCTOR".equals(role)) {
                try {
                    UUID examId = UUID.fromString(examMatcher.group(1));
                    UUID proctorId = UUID.fromString(principal.getId());
                    if (!examProctorRepository.isProctorForExam(examId, proctorId)) {
                        log.warn("SUBSCRIBE rejected: proctor {} not assigned to exam {}", proctorId, examId);
                        throw new IllegalArgumentException("You are not assigned as a proctor for this exam");
                    }
                } catch (IllegalArgumentException e) {
                    throw e;
                } catch (Exception e) {
                    log.error("Exam-alert subscription check error: {}", e.getMessage());
                    throw new IllegalArgumentException("Subscription authorization failed");
                }
            }
            return;
        }

        // /topic/proctor/** (other sub-paths) — PROCTOR or ADMIN only
        if (destination.startsWith("/topic/proctor/")) {
            String role = principal.getRole();
            if (!"PROCTOR".equals(role) && !"ADMIN".equals(role)) {
                log.warn("SUBSCRIBE rejected: role {} cannot subscribe to {}", role, destination);
                throw new IllegalArgumentException("Only proctors and admins may subscribe to proctor topics");
            }
        }

        // /topic/admin/** — ADMIN only
        if (destination.startsWith("/topic/admin/")) {
            if (!"ADMIN".equals(principal.getRole())) {
                log.warn("SUBSCRIBE rejected: role {} cannot subscribe to {}", principal.getRole(), destination);
                throw new IllegalArgumentException("Only admins may subscribe to admin topics");
            }
        }
    }

    private AuthenticatedUser extractPrincipal(StompHeaderAccessor accessor) {
        if (accessor.getUser() instanceof UsernamePasswordAuthenticationToken auth
                && auth.getPrincipal() instanceof AuthenticatedUser user) {
            return user;
        }
        return null;
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
