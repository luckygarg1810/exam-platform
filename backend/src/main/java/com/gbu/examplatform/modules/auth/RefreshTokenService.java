package com.gbu.examplatform.modules.auth;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Slf4j
@Service
@RequiredArgsConstructor
public class RefreshTokenService {

    private static final String REFRESH_PREFIX = "refresh:";
    private static final String BLACKLIST_PREFIX = "blacklist:jwt:";

    private final RedisTemplate<String, String> redisTemplate;

    public void storeRefreshToken(String userId, String refreshToken, long expiryMs) {
        redisTemplate.opsForValue().set(
                REFRESH_PREFIX + userId,
                refreshToken,
                Duration.ofMillis(expiryMs));
    }

    public boolean isRefreshTokenValid(String userId, String providedToken) {
        String stored = redisTemplate.opsForValue().get(REFRESH_PREFIX + userId);
        return stored != null && stored.equals(providedToken);
    }

    public void deleteRefreshToken(String userId) {
        redisTemplate.delete(REFRESH_PREFIX + userId);
    }

    public void blacklistToken(String jti, long ttlMs) {
        if (ttlMs > 0) {
            redisTemplate.opsForValue().set(
                    BLACKLIST_PREFIX + jti,
                    "1",
                    Duration.ofMillis(ttlMs));
        }
    }

    public boolean isTokenBlacklisted(String jti) {
        return Boolean.TRUE.equals(redisTemplate.hasKey(BLACKLIST_PREFIX + jti));
    }

    // Password reset token storage
    public void storePasswordResetToken(String email, String token) {
        redisTemplate.opsForValue().set(
                "reset:" + token,
                email,
                Duration.ofMinutes(30));
    }

    public String getEmailByResetToken(String token) {
        return redisTemplate.opsForValue().get("reset:" + token);
    }

    public void deletePasswordResetToken(String token) {
        redisTemplate.delete("reset:" + token);
    }
}
