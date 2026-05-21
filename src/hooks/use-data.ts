import useSWR from "swr";
import { supabase } from "@/lib/supabase";
import { Supplier, Delivery, Payment, SupplierSummary, Purchase, PurchaseItem } from "@/types";

const CACHE_KEY = "suppliertrack/global";

export interface AppData {
  suppliers: Supplier[];
  deliveries: Delivery[];
  payments: Payment[];
  purchases: Purchase[];
  purchaseItems: PurchaseItem[];
  summaries: SupplierSummary[];
}

async function fetchAll(): Promise<AppData> {
  const [
    { data: suppliers, error: sErr },
    { data: deliveries, error: dErr },
    { data: payments, error: pErr },
    { data: purchases, error: purErr },
    { data: purchaseItems, error: pItemErr },
  ] = await Promise.all([
    supabase.from("suppliers").select("*").order("created_at", { ascending: false }),
    supabase.from("deliveries").select("*").order("delivery_date", { ascending: false }),
    supabase.from("payments").select("*").order("payment_date", { ascending: false }),
    supabase.from("purchases").select("*").order("purchase_date", { ascending: false }),
    supabase.from("purchase_items").select("*"),
  ]);

  if (sErr) throw sErr;
  if (dErr) throw dErr;
  if (pErr) throw pErr;
  if (purErr) throw purErr;
  if (pItemErr) throw pItemErr;

  const sList: Supplier[] = suppliers || [];
  const dList: Delivery[] = deliveries || [];
  const pList: Payment[] = payments || [];
  const purList: Purchase[] = purchases || [];
  const pItemList: PurchaseItem[] = purchaseItems || [];

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

  const purchasesBySupplier = new Map<string, Purchase[]>();
  for (const pur of purList) {
    const arr = purchasesBySupplier.get(pur.supplier_id) || [];
    arr.push(pur);
    purchasesBySupplier.set(pur.supplier_id, arr);
  }

  const summaries: SupplierSummary[] = sList.map((s) => {
    const sDeliveries = deliveriesBySupplier.get(s.id) || [];
    const sPayments = paymentsBySupplier.get(s.id) || [];
    const sPurchases = purchasesBySupplier.get(s.id) || [];

    const total_delivered = sDeliveries.reduce(
      (acc, d) => acc + (Number(d.total_value) || 0),
      0
    ) + sPurchases.reduce(
      (acc, pur) => acc + (Number(pur.total_amount) || 0),
      0
    );
    
    const total_paid = sPayments.reduce(
      (acc, p) => acc + (Number(p.amount) || 0),
      0
    ) + sPurchases.reduce(
      (acc, pur) => acc + (Number(pur.payment_amount) || 0),
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

  return { suppliers: sList, deliveries: dList, payments: pList, purchases: purList, purchaseItems: pItemList, summaries };
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
    data: data || { suppliers: [], deliveries: [], payments: [], purchases: [], purchaseItems: [], summaries: [] },
    isLoading,
    error,
    mutate,
  };
}

export function useRefreshAppData() {
  const { mutate } = useSWR(CACHE_KEY);
  return () => mutate();
}
