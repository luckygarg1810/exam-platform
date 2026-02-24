package com.gbu.examplatform.modules.user;

import com.gbu.examplatform.exception.ResourceNotFoundException;
import com.gbu.examplatform.exception.UnauthorizedAccessException;
import com.gbu.examplatform.modules.storage.StorageService;
import com.gbu.examplatform.modules.user.dto.*;
import com.gbu.examplatform.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final StorageService storageService;
    private final SecurityUtils securityUtils;

    @Value("${minio.buckets.profile-photos}")
    private String profilePhotosBucket;

    @Transactional(readOnly = true)
    public UserProfileDto getMyProfile() {
        UUID userId = securityUtils.getCurrentUserId();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId.toString()));
        return toDto(user);
    }

    @Transactional
    public UserProfileDto updateMyProfile(UpdateProfileRequest request) {
        UUID userId = securityUtils.getCurrentUserId();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId.toString()));

        if (request.getName() != null)
            user.setName(request.getName());
        if (request.getDepartment() != null)
            user.setDepartment(request.getDepartment());
        if (request.getUniversityRoll() != null)
            user.setUniversityRoll(request.getUniversityRoll());

        return toDto(userRepository.save(user));
    }

    @Transactional
    public String uploadProfilePhoto(MultipartFile file, boolean isIdPhoto) {
        UUID userId = securityUtils.getCurrentUserId();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId.toString()));

        String objectKey = (isIdPhoto ? "id/" : "profile/") + userId + "/" + System.currentTimeMillis()
                + getExt(file.getOriginalFilename());

        try {
            storageService.uploadFile(profilePhotosBucket, objectKey, file.getInputStream(),
                    file.getSize(), file.getContentType());
        } catch (Exception e) {
            throw new RuntimeException("Upload failed", e);
        }

        if (isIdPhoto) {
            String oldKey = user.getIdPhotoPath();
            if (oldKey != null) {
                try {
                    storageService.deleteFile(profilePhotosBucket, oldKey);
                } catch (Exception e) {
                    log.warn("Failed to delete old ID photo '{}': {}", oldKey, e.getMessage());
                }
            }
            user.setIdPhotoPath(objectKey);
        } else {
            String oldKey = user.getProfilePhotoPath();
            if (oldKey != null) {
                try {
                    storageService.deleteFile(profilePhotosBucket, oldKey);
                } catch (Exception e) {
                    log.warn("Failed to delete old profile photo '{}': {}", oldKey, e.getMessage());
                }
            }
            user.setProfilePhotoPath(objectKey);
        }
        userRepository.save(user);

        return storageService.getPresignedUrl(profilePhotosBucket, objectKey, 60);
    }

    @Transactional(readOnly = true)
    public Page<UserProfileDto> getAllUsers(String search, Pageable pageable) {
        Page<User> users;
        if (search != null && !search.isBlank()) {
            users = userRepository.searchActiveUsers(search, pageable);
        } else {
            users = userRepository.findByIsActiveTrue(pageable);
        }
        return users.map(this::toDto);
    }

    @Transactional(readOnly = true)
    public UserProfileDto getUserById(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId.toString()));
        return toDto(user);
    }

    @Transactional
    public UserProfileDto changeUserRole(UUID userId, User.Role newRole) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId.toString()));
        user.setRole(newRole);
        return toDto(userRepository.save(user));
    }

    @Transactional
    public void deleteUser(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId.toString()));

        // Prevent deleting yourself or another admin
        UUID currentId = securityUtils.getCurrentUserId();
        if (currentId.equals(userId)) {
            throw new UnauthorizedAccessException("Cannot delete your own account");
        }
        if (user.getRole() == User.Role.ADMIN) {
            throw new UnauthorizedAccessException("Cannot delete an admin account");
        }

        user.setIsActive(false);
        userRepository.save(user);
    }

    private UserProfileDto toDto(User user) {
        String photoUrl = null;
        if (user.getProfilePhotoPath() != null) {
            photoUrl = storageService.getPresignedUrl(profilePhotosBucket, user.getProfilePhotoPath(), 60);
        }
        return UserProfileDto.builder()
                .id(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .role(user.getRole())
                .universityRoll(user.getUniversityRoll())
                .department(user.getDepartment())
                .profilePhotoUrl(photoUrl)
                .isActive(user.getIsActive())
                .createdAt(user.getCreatedAt())
                .build();
    }

    private String getExt(String filename) {
        if (filename == null || !filename.contains("."))
            return ".jpg";
        return filename.substring(filename.lastIndexOf("."));
    }
}
