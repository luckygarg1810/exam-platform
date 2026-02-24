-- V100: Default admin user for GBU platform
-- Password: 'Admin@GBU2024' (BCrypt encoded)
INSERT INTO users (id, name, email, password_hash, role, department, is_active)
VALUES (
    gen_random_uuid(),
    'GBU Admin',
    'admin@gbu.ac.in',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGniB.f5j.5okmRx6Jw3AvBqVy.',
    'ADMIN',
    'Examination Cell',
    TRUE
) ON CONFLICT (email) DO NOTHING;
