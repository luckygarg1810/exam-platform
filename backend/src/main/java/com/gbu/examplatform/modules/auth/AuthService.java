package com.gbu.examplatform.modules.auth;

import com.gbu.examplatform.exception.BusinessException;
import com.gbu.examplatform.exception.ResourceNotFoundException;
import com.gbu.examplatform.modules.auth.dto.*;
import com.gbu.examplatform.modules.notification.EmailService;
import com.gbu.examplatform.modules.user.User;
import com.gbu.examplatform.modules.user.UserRepository;
import com.gbu.examplatform.security.JwtTokenProvider;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final RefreshTokenService refreshTokenService;
    private final EmailService emailService;

    @Value("${jwt.access-token-expiry-ms:3600000}")
    private long accessTokenExpiryMs;

    @Value("${jwt.refresh-token-expiry-ms:604800000}")
    private long refreshTokenExpiryMs;

    @Value("${app.base-url:http://localhost:3000}")
    private String appBaseUrl;

    @Transactional
    public TokenResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new BusinessException("Email already registered: " + request.getEmail());
        }

        User user = User.builder()
                .name(request.getName())
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role(request.getRole())
                .universityRoll(request.getUniversityRoll())
                .department(request.getDepartment())
                .isActive(true)
                .build();

        user = userRepository.save(user);
        return buildTokenResponse(user);
    }

    @Transactional(readOnly = true)
    public TokenResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new BadCredentialsException("Invalid credentials"));

        if (!user.getIsActive()) {
            throw new BusinessException("Account is deactivated. Contact admin.");
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new BadCredentialsException("Invalid credentials");
        }

        return buildTokenResponse(user);
    }

    @Transactional
    public void logout(String accessToken) {
        try {
            String jti = jwtTokenProvider.extractJti(accessToken);
            long expiry = jwtTokenProvider.extractExpiry(accessToken);
            long ttl = expiry - System.currentTimeMillis();

            if (ttl > 0) {
                refreshTokenService.blacklistToken(jti, ttl);
            }

            String userId = jwtTokenProvider.extractUserId(accessToken);
            refreshTokenService.deleteRefreshToken(userId);
        } catch (Exception e) {
            log.warn("Error during logout: {}", e.getMessage());
        }
    }

    @Transactional(readOnly = true)
    public TokenResponse refreshToken(RefreshTokenRequest request) {
        String refreshToken = request.getRefreshToken();

        if (!jwtTokenProvider.validateToken(refreshToken)) {
            throw new BusinessException("Invalid or expired refresh token");
        }

        Claims claims = jwtTokenProvider.extractAllClaims(refreshToken);
        String userId = claims.getSubject();
        String type = claims.get("type", String.class);

        if (!"REFRESH".equals(type)) {
            throw new BusinessException("Invalid token type");
        }

        if (!refreshTokenService.isRefreshTokenValid(userId, refreshToken)) {
            throw new BusinessException("Refresh token has been revoked");
        }

        User user = userRepository.findById(UUID.fromString(userId))
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));

        String newAccessToken = jwtTokenProvider.generateAccessToken(
                user.getId().toString(), user.getEmail(), user.getRole().name());

        return TokenResponse.builder()
                .accessToken(newAccessToken)
                .refreshToken(refreshToken)
                .tokenType("Bearer")
                .expiresIn(accessTokenExpiryMs / 1000)
                .userId(user.getId())
                .email(user.getEmail())
                .name(user.getName())
                .role(user.getRole())
                .build();
    }

    /**
     * Generates a password reset token, stores it in Redis (30 min TTL),
     * and sends a reset link email asynchronously.
     * Silently succeeds if the email is not found (prevents email enumeration).
     */
    @Transactional
    public void forgotPassword(ForgotPasswordRequest request) {
        userRepository.findByEmail(request.getEmail()).ifPresent(user -> {
            String token = UUID.randomUUID().toString();
            refreshTokenService.storePasswordResetToken(request.getEmail(), token);

            String resetLink = appBaseUrl + "/reset-password?token=" + token;
            emailService.sendPasswordResetEmail(user.getEmail(), user.getName(), resetLink);
            log.info("Password reset email queued for: {}", user.getEmail());
        });
    }

    /**
     * Validates the reset token from Redis, updates the user's password,
     * then invalidates the token so it can't be reused.
     */
    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        String email = refreshTokenService.getEmailByResetToken(request.getToken());
        if (email == null) {
            throw new BusinessException("Invalid or expired password reset token");
        }

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", email));

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);

        // Invalidate the reset token and any existing refresh tokens
        refreshTokenService.deletePasswordResetToken(request.getToken());
        refreshTokenService.deleteRefreshToken(user.getId().toString());

        log.info("Password reset successfully for: {}", email);
    }

    private TokenResponse buildTokenResponse(User user) {
        String accessToken = jwtTokenProvider.generateAccessToken(
                user.getId().toString(), user.getEmail(), user.getRole().name());
        String refreshToken = jwtTokenProvider.generateRefreshToken(user.getId().toString());

        refreshTokenService.storeRefreshToken(user.getId().toString(), refreshToken, refreshTokenExpiryMs);

        return TokenResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .tokenType("Bearer")
                .expiresIn(accessTokenExpiryMs / 1000)
                .userId(user.getId())
                .email(user.getEmail())
                .name(user.getName())
                .role(user.getRole())
                .build();
    }
}
