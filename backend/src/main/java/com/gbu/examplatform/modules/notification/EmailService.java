package com.gbu.examplatform.modules.notification;

import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username:noreply@gbu.ac.in}")
    private String fromEmail;

    @Async
    public void sendResultEmail(String to, String name, String examTitle,
            BigDecimal score, boolean passed) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom(fromEmail);
            helper.setTo(to);
            helper.setSubject("Exam Result: " + examTitle);

            String status = passed ? "✅ PASSED" : "❌ NOT PASSED";
            String html = String.format("""
                    <html><body>
                    <h2>Exam Result – %s</h2>
                    <p>Dear %s,</p>
                    <p>Your result for <strong>%s</strong>:</p>
                    <table>
                      <tr><td><b>Score</b></td><td>%s</td></tr>
                      <tr><td><b>Status</b></td><td>%s</td></tr>
                    </table>
                    <p>Thank you for taking the exam. Contact admin for short-answer review.</p>
                    <p>— GBU Exam Platform</p>
                    </body></html>
                    """, examTitle, name, examTitle, score.toPlainString(), status);

            helper.setText(html, true);
            mailSender.send(message);
            log.info("Result email sent to {}", to);
        } catch (Exception e) {
            log.error("Failed to send result email to {}: {}", to, e.getMessage());
        }
    }

    @Async
    public void sendPasswordResetEmail(String to, String name, String resetLink) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom(fromEmail);
            helper.setTo(to);
            helper.setSubject("Password Reset – GBU Exam Platform");

            String html = String.format("""
                    <html><body>
                    <h2>Password Reset Request</h2>
                    <p>Dear %s,</p>
                    <p>Click below to reset your password. This link expires in 30 minutes.</p>
                    <p><a href="%s">Reset Password</a></p>
                    <p>If you didn't request this, ignore this email.</p>
                    <p>— GBU Exam Platform</p>
                    </body></html>
                    """, name, resetLink);

            helper.setText(html, true);
            mailSender.send(message);
            log.info("Password reset email sent to {}", to);
        } catch (Exception e) {
            log.error("Failed to send reset email to {}: {}", to, e.getMessage());
        }
    }
}
