-- Create the user_role enum type with updated values (PROCTOR renamed to TEACHER)
CREATE TYPE user_role AS ENUM ('STUDENT', 'TEACHER', 'ADMIN');

-- Create the new default ADMIN account for user management if it doesn't exist
INSERT INTO users (id, name, email, password_hash, role, is_active, created_at)
VALUES (gen_random_uuid(), 'Platform Admin', 'admin@gbu.ac.in', '$2a$10$w0h4onJJj.tcPzwGRfR.p.gI4gzmAFl3wiEexV0K6Bop1hi92tJki', 'ADMIN', true, now())
ON CONFLICT (email) DO NOTHING;
