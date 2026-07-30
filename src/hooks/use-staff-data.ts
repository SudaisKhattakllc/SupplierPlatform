import useSWR from "swr";
import { supabase } from "@/lib/supabase";
import { Employee, SalaryMonth, SalaryTransaction } from "@/types";

// ─── Cache Keys ──────────────────────────────────────────────
const STAFF_CACHE_KEY = "suppliertrack/staff";

// ─── Data Shape ──────────────────────────────────────────────
export interface StaffData {
  employees: Employee[];
  salaryMonths: SalaryMonth[];
  transactions: SalaryTransaction[];
}

// ─── Fetcher ─────────────────────────────────────────────────
async function fetchStaffData(): Promise<StaffData> {
  const [
    { data: employees, error: eErr },
    { data: salaryMonths, error: smErr },
    { data: transactions, error: tErr },
  ] = await Promise.all([
    supabase
      .from("employees")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("salary_months")
      .select("*, employees(name)")
      .order("year", { ascending: false })
      .order("month", { ascending: false }),
    supabase
      .from("salary_transactions")
      .select("*, employees(name), salary_months(month, year)")
      .order("date", { ascending: false }),
  ]);

  if (eErr) throw eErr;
  if (smErr) throw smErr;
  if (tErr) throw tErr;

  return {
    employees: (employees || []) as Employee[],
    salaryMonths: (salaryMonths || []) as SalaryMonth[],
    transactions: (transactions || []) as SalaryTransaction[],
  };
}

// ─── Hook: All Staff Data ────────────────────────────────────
// Used by /staff and /staff/payroll pages
export function useStaffData() {
  const { data, error, isLoading, mutate } = useSWR<StaffData>(
    STAFF_CACHE_KEY,
    fetchStaffData,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 5000,
      refreshInterval: 0,
      keepPreviousData: true,
      suspense: false,
    }
  );

  return {
    data: data || { employees: [], salaryMonths: [], transactions: [] },
    isLoading,
    error,
    mutate,
  };
}

// ─── Hook: Single Employee Detail ────────────────────────────
// Used by /staff/[id] page — fetches one employee + their months + transactions
export function useEmployeeDetail(employeeId: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR(
    employeeId ? `suppliertrack/staff/${employeeId}` : null,
    async () => {
      if (!employeeId) return null;

      const [
        { data: employee, error: eErr },
        { data: months, error: mErr },
        { data: txns, error: tErr },
      ] = await Promise.all([
        supabase
          .from("employees")
          .select("*")
          .eq("id", employeeId)
          .single(),
        supabase
          .from("salary_months")
          .select("*")
          .eq("employee_id", employeeId)
          .order("year", { ascending: false })
          .order("month", { ascending: false }),
        supabase
          .from("salary_transactions")
          .select("*")
          .eq("employee_id", employeeId)
          .order("date", { ascending: false }),
      ]);

      if (eErr) throw eErr;
      if (mErr) throw mErr;
      if (tErr) throw tErr;

      return {
        employee: employee as Employee,
        salaryMonths: (months || []) as SalaryMonth[],
        transactions: (txns || []) as SalaryTransaction[],
      };
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 5000,
      refreshInterval: 0,
      keepPreviousData: true,
      suspense: false,
    }
  );

  return {
    data: data || null,
    isLoading,
    error,
    mutate,
  };
}

// ─── Refresh helper ──────────────────────────────────────────
export function useRefreshStaffData() {
  const { mutate } = useSWR(STAFF_CACHE_KEY);
  return () => mutate();
}
