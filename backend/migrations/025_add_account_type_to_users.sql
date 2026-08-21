CREATE TYPE account_type AS ENUM ('BUYER', 'SELLER', 'EMPLOYEE');

ALTER TABLE users
ADD COLUMN account_type account_type NOT NULL DEFAULT 'BUYER';

CREATE INDEX idx_users_account_type ON users(account_type);