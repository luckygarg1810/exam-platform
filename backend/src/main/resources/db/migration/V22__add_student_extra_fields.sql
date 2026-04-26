-- V22: Add extended student profile fields
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS mobile_number   VARCHAR(15),
    ADD COLUMN IF NOT EXISTS fathers_name    VARCHAR(150),
    ADD COLUMN IF NOT EXISTS programme       VARCHAR(100),
    ADD COLUMN IF NOT EXISTS year_of_admission INT;
