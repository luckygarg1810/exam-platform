-- Drop the old constraint that restricts role to PROCTOR
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Add the new constraint supporting TEACHER
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role::text IN ('STUDENT', 'TEACHER', 'ADMIN'));

-- Update any existing PROCTORs to TEACHERs
UPDATE users SET role = 'TEACHER' WHERE role = 'PROCTOR';
