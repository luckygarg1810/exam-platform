package com.gbu.examplatform.modules.user.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class UpdateProfileRequest {
    @Size(min = 2, max = 100)
    private String name;

    @Size(max = 100)
    private String department;

    @Size(max = 50)
    private String universityRoll;

    @Pattern(regexp = "^[6-9]\\d{9}$", message = "Enter a valid 10-digit Indian mobile number")
    private String mobileNumber;

    @Size(max = 150)
    private String fathersName;

    @Size(max = 100)
    private String programme;

    @Min(2000)
    @Max(2100)
    private Integer yearOfAdmission;
}
