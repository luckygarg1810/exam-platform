package com.gbu.examplatform.modules.user.dto;

import com.gbu.examplatform.modules.user.User;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ChangeRoleRequest {
    @NotNull(message = "Role is required")
    private User.Role role;
}
