-- V21: Enforce uniqueness on university_roll for students.
-- Step 1: Remove duplicate accounts, keeping only the earliest-created one per roll number.
DELETE FROM users
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY university_roll
                   ORDER BY created_at ASC
               ) AS rn
        FROM users
        WHERE university_roll IS NOT NULL
    ) ranked
    WHERE rn > 1
);

-- Step 2: Partial unique index — NULLs (admins/proctors) are excluded automatically.
CREATE UNIQUE INDEX uq_users_university_roll
    ON users (university_roll)
    WHERE university_roll IS NOT NULL;
