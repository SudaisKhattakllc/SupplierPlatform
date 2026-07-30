-- ============================================================
-- EMPLOYEE SALARY MODULE — Supabase SQL Migration
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. EMPLOYEES TABLE
-- Stores staff/employee info for KSA operations
-- ============================================================
CREATE TABLE IF NOT EXISTS employees (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  iqama_no    TEXT,
  job_title   TEXT,
  phone       TEXT,
  base_salary_sar NUMERIC NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'active',   -- 'active' | 'inactive'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast filtering by status
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);


-- 2. SALARY_MONTHS TABLE
-- One row per employee per month. Tracks salary vs payments.
-- balance = base_salary - total_paid
--   > 0 → Company owes Employee
--   < 0 → Employee owes Company (over-advanced)
-- ============================================================
CREATE TABLE IF NOT EXISTS salary_months (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  month        INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year         INT NOT NULL CHECK (year >= 2020),
  base_salary  NUMERIC NOT NULL DEFAULT 0,
  total_paid   NUMERIC NOT NULL DEFAULT 0,
  balance      NUMERIC GENERATED ALWAYS AS (base_salary - total_paid) STORED,
  status       TEXT NOT NULL DEFAULT 'open',   -- 'open' | 'closed'
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Each employee can only have one record per month/year
  UNIQUE(employee_id, month, year)
);

-- Index for fast lookups by month/year
CREATE INDEX IF NOT EXISTS idx_salary_months_period ON salary_months(year, month);
CREATE INDEX IF NOT EXISTS idx_salary_months_employee ON salary_months(employee_id);


-- 3. SALARY_TRANSACTIONS TABLE
-- Individual advance or payment records against a salary month
-- ============================================================
CREATE TABLE IF NOT EXISTS salary_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  salary_month_id UUID NOT NULL REFERENCES salary_months(id) ON DELETE CASCADE,
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  type            TEXT NOT NULL CHECK (type IN ('advance', 'payment')),
  amount          NUMERIC NOT NULL CHECK (amount > 0),
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_salary_txn_month ON salary_transactions(salary_month_id);
CREATE INDEX IF NOT EXISTS idx_salary_txn_employee ON salary_transactions(employee_id);


-- 4. TRIGGER — Auto-recalculate total_paid on salary_months
-- Fires after any INSERT, UPDATE, or DELETE on salary_transactions
-- ============================================================
CREATE OR REPLACE FUNCTION recalc_salary_month_total_paid()
RETURNS TRIGGER AS $$
DECLARE
  target_month_id UUID;
BEGIN
  -- Determine which salary_month_id was affected
  IF TG_OP = 'DELETE' THEN
    target_month_id := OLD.salary_month_id;
  ELSE
    target_month_id := NEW.salary_month_id;
  END IF;

  -- Recalculate total_paid from all transactions for this month
  UPDATE salary_months
  SET total_paid = COALESCE(
    (SELECT SUM(amount) FROM salary_transactions WHERE salary_month_id = target_month_id),
    0
  )
  WHERE id = target_month_id;

  -- If UPDATE changed the salary_month_id, also recalc the old month
  IF TG_OP = 'UPDATE' AND OLD.salary_month_id IS DISTINCT FROM NEW.salary_month_id THEN
    UPDATE salary_months
    SET total_paid = COALESCE(
      (SELECT SUM(amount) FROM salary_transactions WHERE salary_month_id = OLD.salary_month_id),
      0
    )
    WHERE id = OLD.salary_month_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists (safe re-run)
DROP TRIGGER IF EXISTS trg_recalc_salary_total ON salary_transactions;

CREATE TRIGGER trg_recalc_salary_total
AFTER INSERT OR UPDATE OR DELETE ON salary_transactions
FOR EACH ROW
EXECUTE FUNCTION recalc_salary_month_total_paid();


-- 5. DISABLE RLS (matches existing project setup)
-- ============================================================
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_months ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_transactions ENABLE ROW LEVEL SECURITY;

-- Allow all operations (same as existing tables in this project)
CREATE POLICY "Allow all on employees" ON employees FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on salary_months" ON salary_months FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on salary_transactions" ON salary_transactions FOR ALL USING (true) WITH CHECK (true);
