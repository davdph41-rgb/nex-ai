-- NEX AI Stock Management - Stage 5
-- Jalankan SATU KALI di Neon SQL Editor setelah backup database.

CREATE TABLE IF NOT EXISTS stock_sessions (
  id BIGSERIAL PRIMARY KEY,
  business_date DATE NOT NULL,
  session_number INTEGER NOT NULL CHECK (session_number BETWEEN 1 AND 3),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'open', 'closed')),
  opened_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT stock_sessions_date_number_unique UNIQUE (business_date, session_number),
  CONSTRAINT stock_sessions_time_check CHECK (end_time > start_time)
);

ALTER TABLE stock_transactions
  ADD COLUMN IF NOT EXISTS session_id BIGINT REFERENCES stock_sessions(id);

CREATE INDEX IF NOT EXISTS idx_stock_sessions_business_date
  ON stock_sessions (business_date, session_number);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_session_id
  ON stock_transactions (session_id);
