package com.gbu.examplatform.modules.auth.dto;

import jakarta.validation.constraints.*;
import lombok.Data;
import org.springframework.web.multipart.MultipartFile;

@Data
public class RegisterRequest {

    @NotBlank(message = "Name is required")
    @Size(min = 2, max = 100, message = "Name must be 2-100 characters")
    private String name;

    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    private String email;

    @NotBlank(message = "Password is required")
    @Size(min = 8, message = "Password must be at least 8 characters")
    @Pattern(regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).*$", message = "Password must contain uppercase, lowercase, and a digit")
    private String password;

    private String universityRoll;

    @Size(max = 100, message = "Department must be under 100 characters")
    private String department;

    @Pattern(regexp = "^[6-9]\\d{9}$", message = "Enter a valid 10-digit Indian mobile number")
    private String mobileNumber;

    @Size(max = 150, message = "Father's name must be under 150 characters")
    private String fathersName;

    @Size(max = 100, message = "Programme must be under 100 characters")
    private String programme;

    @Min(value = 2000, message = "Year of admission must be 2000 or later")
    @Max(value = 2100, message = "Year of admission seems invalid")
    private Integer yearOfAdmission;

    // Required for STUDENT self-registration; validated in AuthService
    private MultipartFile photo;
}
