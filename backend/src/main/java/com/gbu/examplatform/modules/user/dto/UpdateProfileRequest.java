package com.gbu.examplatform.modules.user.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateProfileRequest {
    @Size(min = 2, max = 100)
    private String name;
    @Size(max = 100)
    private String department;
    @Size(max = 50)
    private String universityRoll;
}
