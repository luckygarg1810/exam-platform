package com.gbu.examplatform.modules.auth;

import com.gbu.examplatform.exception.BusinessException;
import com.gbu.examplatform.exception.ResourceNotFoundException;
import com.gbu.examplatform.modules.auth.dto.*;
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

    @Value("${jwt.access-token-expiry-ms:3600000}")
    private long accessTokenExpiryMs;

    @Value("${jwt.refresh-token-expiry-ms:604800000}")
    private long refreshTokenExpiryMs;

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
