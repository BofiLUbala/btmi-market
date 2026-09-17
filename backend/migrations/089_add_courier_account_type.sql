-- Migration 089: Add COURIER to account_type enum
ALTER TYPE account_type ADD VALUE IF NOT EXISTS 'COURIER';
