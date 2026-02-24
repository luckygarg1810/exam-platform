-- V101: Fix admin password hash (V100 had an incorrect BCrypt hash)
-- Password: 'Admin@GBU2024'
UPDATE users
SET password_hash = '$2b$12$9/qncE3ZuLHoQfFyhrnybeiVVPHmxXu2ZzHn8C1ahSPPEgIhpoD82'
WHERE email = 'admin@gbu.ac.in';
