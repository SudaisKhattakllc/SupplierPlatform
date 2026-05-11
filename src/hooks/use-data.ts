import useSWR from "swr";
import { supabase } from "@/lib/supabase";
import { Supplier, Delivery, Payment, SupplierSummary } from "@/types";

const CACHE_KEY = "suppliertrack/global";

export interface AppData {
  suppliers: Supplier[];
  deliveries: Delivery[];
  payments: Payment[];
  summaries: SupplierSummary[];
}

async function fetchAll(): Promise<AppData> {
  const [
    { data: suppliers, error: sErr },
    { data: deliveries, error: dErr },
    { data: payments, error: pErr },
  ] = await Promise.all([
    supabase.from("suppliers").select("*").order("created_at", { ascending: false }),
    supabase.from("deliveries").select("*").order("delivery_date", { ascending: false }),
    supabase.from("payments").select("*").order("payment_date", { ascending: false }),
  ]);

  if (sErr) throw sErr;
  if (dErr) throw dErr;
  if (pErr) throw pErr;

  const sList: Supplier[] = suppliers || [];
  const dList: Delivery[] = deliveries || [];
  const pList: Payment[] = payments || [];

  // Build lookup maps for O(1) access instead of O(n) filtering
  const deliveriesBySupplier = new Map<string, Delivery[]>();
  for (const d of dList) {
    const arr = deliveriesBySupplier.get(d.supplier_id) || [];
    arr.push(d);
    deliveriesBySupplier.set(d.supplier_id, arr);
  }

  const paymentsBySupplier = new Map<string, Payment[]>();
  for (const p of pList) {
    const arr = paymentsBySupplier.get(p.supplier_id) || [];
    arr.push(p);
    paymentsBySupplier.set(p.supplier_id, arr);
  }

  const summaries: SupplierSummary[] = sList.map((s) => {
    const sDeliveries = deliveriesBySupplier.get(s.id) || [];
    const sPayments = paymentsBySupplier.get(s.id) || [];

    const total_delivered = sDeliveries.reduce(
      (acc, d) => acc + (Number(d.total_value) || 0),
      0
    );
    const total_paid = sPayments.reduce(
      (acc, p) => acc + (Number(p.amount) || 0),
      0
    );

    return {
      id: s.id,
      name: s.name,
      contact_person: s.contact_person,
      material_type: s.material_type,
      phone: s.phone,
      total_delivered,
      total_paid,
      balance_due: total_delivered - total_paid,
    };
  });

  return { suppliers: sList, deliveries: dList, payments: pList, summaries };
}

export function useAppData() {
  const { data, error, isLoading, mutate } = useSWR<AppData>(
    CACHE_KEY,
    fetchAll,
    {
      revalidateOnFocus: false,        // Don't refresh when tab gains focus
      revalidateOnReconnect: false,    // Don't refresh on network reconnect
      dedupingInterval: 5000,          // Dedupe requests within 5 seconds
      refreshInterval: 0,              // NO auto-refresh - manual only
      keepPreviousData: true,          // Show cached data while fetching
      suspense: false,                 // Don't use suspense
    }
  );

  return {
    data: data || { suppliers: [], deliveries: [], payments: [], summaries: [] },
    isLoading,
    error,
    mutate,
  };
}

export function useRefreshAppData() {
  const { mutate } = useSWR(CACHE_KEY);
  return () => mutate();
}
