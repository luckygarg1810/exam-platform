package com.gbu.examplatform.modules.user;

import com.gbu.examplatform.modules.user.dto.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
@Tag(name = "Users", description = "User management endpoints")
public class UserController {

    private final UserService userService;

    @GetMapping("/me")
    @Operation(summary = "Get my profile")
    public ResponseEntity<UserProfileDto> getMyProfile() {
        return ResponseEntity.ok(userService.getMyProfile());
    }

    @PutMapping("/me")
    @Operation(summary = "Update my profile")
    public ResponseEntity<UserProfileDto> updateMyProfile(@Valid @RequestBody UpdateProfileRequest request) {
        return ResponseEntity.ok(userService.updateMyProfile(request));
    }

    @PostMapping("/me/photo")
    @Operation(summary = "Upload profile photo (multipart/form-data)")
    public ResponseEntity<Map<String, String>> uploadPhoto(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "isIdPhoto", defaultValue = "false") boolean isIdPhoto) {
        String url = userService.uploadProfilePhoto(file, isIdPhoto);
        return ResponseEntity.ok(Map.of("url", url));
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "List all users (Admin only)")
    public ResponseEntity<Page<UserProfileDto>> getAllUsers(
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "DESC") String sortDir) {

        Sort sort = Sort.by(Sort.Direction.fromString(sortDir), sortBy);
        Pageable pageable = PageRequest.of(page, size, sort);
        return ResponseEntity.ok(userService.getAllUsers(search, pageable));
    }

    @GetMapping("/{userId}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Get user by ID (Admin only)")
    public ResponseEntity<UserProfileDto> getUserById(@PathVariable UUID userId) {
        return ResponseEntity.ok(userService.getUserById(userId));
    }

    @PutMapping("/{userId}/role")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Change user role (Admin only)")
    public ResponseEntity<UserProfileDto> changeRole(
            @PathVariable UUID userId,
            @Valid @RequestBody ChangeRoleRequest request) {
        return ResponseEntity.ok(userService.changeUserRole(userId, request.getRole()));
    }

    @DeleteMapping("/{userId}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Soft-delete user (Admin only)")
    public ResponseEntity<Map<String, String>> deleteUser(@PathVariable UUID userId) {
        userService.deleteUser(userId);
        return ResponseEntity.ok(Map.of("message", "User deactivated successfully"));
    }
}
