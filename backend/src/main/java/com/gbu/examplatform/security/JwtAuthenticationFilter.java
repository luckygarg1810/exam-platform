package com.gbu.examplatform.security;

import com.gbu.examplatform.modules.auth.RefreshTokenService;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider jwtTokenProvider;
    private final RefreshTokenService refreshTokenService;

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain) throws ServletException, IOException {

        String token = extractTokenFromRequest(request);

        if (token != null && jwtTokenProvider.validateToken(token)) {
            try {
                Claims claims = jwtTokenProvider.extractAllClaims(token);

                // Reject refresh tokens used as bearer tokens on REST endpoints
                String tokenType = claims.get("type", String.class);
                if (!"ACCESS".equals(tokenType)) {
                    log.debug("Rejected non-ACCESS token on REST request: type={}", tokenType);
                    filterChain.doFilter(request, response);
                    return;
                }

                String jti = claims.getId();

                // Check if token is blacklisted (logged out)
                if (refreshTokenService.isTokenBlacklisted(jti)) {
                    log.debug("JWT token is blacklisted: {}", jti);
                    filterChain.doFilter(request, response);
                    return;
                }

                String userId = claims.getSubject();
                String role = claims.get("role", String.class);
                String email = claims.get("email", String.class);

                UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                        new AuthenticatedUser(userId, email, role),
                        null,
                        List.of(new SimpleGrantedAuthority("ROLE_" + role)));

                SecurityContextHolder.getContext().setAuthentication(authentication);
            } catch (Exception e) {
                log.debug("Could not set user authentication: {}", e.getMessage());
            }
        }

        filterChain.doFilter(request, response);
    }

    private String extractTokenFromRequest(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        return null;
    }
}
