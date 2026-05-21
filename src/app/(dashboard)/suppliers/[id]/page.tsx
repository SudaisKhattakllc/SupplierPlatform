"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { Supplier, Delivery, Payment, Purchase, PurchaseItem } from "@/types";
import { formatSAR, downloadExcel, downloadPDF } from "@/lib/format-utils";
import {
  Loader2,
  ArrowLeft,
  Package,
  CreditCard,
  Edit2,
  Plus,
  FileSpreadsheet,
  FileText,
  CheckCircle,
  Calendar,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import QuickUpdatePopup from "@/components/QuickUpdatePopup";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

export default function SupplierDetailPage() {
  const { id } = useParams();
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [quickUpdateOpen, setQuickUpdateOpen] = useState(false);
  const [quickUpdateTab, setQuickUpdateTab] = useState<"stock" | "payment">("stock");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  
  // Date filters
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [editForm, setEditForm] = useState<Partial<Supplier>>({});
  const [editErrors, setEditErrors] = useState<Record<string, boolean>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: sData, error: sError } = await supabase
        .from("suppliers")
        .select("*")
        .eq("id", id)
        .single();
      if (sError) throw sError;
      setSupplier(sData);
      setEditForm(sData || {});

      const { data: dData, error: dError } = await supabase
        .from("deliveries")
        .select("*")
        .eq("supplier_id", id)
        .order("delivery_date", { ascending: false });
      if (dError) throw dError;
      setDeliveries(dData || []);

      const { data: pData, error: pError } = await supabase
        .from("payments")
        .select("*")
        .eq("supplier_id", id)
        .order("payment_date", { ascending: false });
      if (pError) throw pError;
      setPayments(pData || []);

      const { data: purData, error: purError } = await supabase
        .from("purchases")
        .select("*")
        .eq("supplier_id", id)
        .order("purchase_date", { ascending: false });
      if (purError) throw purError;
      setPurchases(purData || []);

      if (purData && purData.length > 0) {
        const purchaseIds = purData.map(p => p.id);
        const { data: piData, error: piError } = await supabase
          .from("purchase_items")
          .select("*")
          .in("purchase_id", purchaseIds);
        if (piError) throw piError;
        setPurchaseItems(piData || []);
      }
    } catch (error: unknown) {
      toast({
        title: "Error loading supplier",
        description: (error as Error)?.message || "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter deliveries and payments by date
  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((d) => {
      const date = new Date(d.delivery_date);
      if (fromDate && date < new Date(fromDate)) return false;
      if (toDate && date > new Date(toDate)) return false;
      return true;
    });
  }, [deliveries, fromDate, toDate]);

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const date = new Date(p.payment_date);
      if (fromDate && date < new Date(fromDate)) return false;
      if (toDate && date > new Date(toDate)) return false;
      return true;
    });
  }, [payments, fromDate, toDate]);

  const filteredPurchases = useMemo(() => {
    return purchases.filter((p) => {
      const date = new Date(p.purchase_date);
      if (fromDate && date < new Date(fromDate)) return false;
      if (toDate && date > new Date(toDate)) return false;
      return true;
    });
  }, [purchases, fromDate, toDate]);

  const totalDelivered = filteredDeliveries.reduce(
    (acc: number, curr: Delivery) => acc + (Number(curr.total_value) || 0),
    0
  ) + filteredPurchases.reduce(
    (acc: number, curr: Purchase) => acc + (Number(curr.total_amount) || 0),
    0
  );
  
  const totalPaid = filteredPayments.reduce(
    (acc: number, curr: Payment) => acc + (Number(curr.amount) || 0),
    0
  ) + filteredPurchases.reduce(
    (acc: number, curr: Purchase) => acc + (Number(curr.payment_amount) || 0),
    0
  );
  const balanceDue = totalDelivered - totalPaid;
  
  const isFullyPaid = balanceDue <= 0 && totalDelivered > 0;

  const combinedStock = useMemo(() => {
    const list = [
      ...filteredDeliveries.map(d => ({
        id: d.id,
        date: d.delivery_date,
        material_name: d.material_name,
        quantity: d.quantity,
        unit: d.unit,
        unit_price: d.unit_price,
        total_value: d.total_value,
        type: "Delivery"
      })),
      ...filteredPurchases.flatMap(p => 
        purchaseItems.filter(pi => pi.purchase_id === p.id).map(pi => ({
          id: pi.id,
          date: p.purchase_date,
          material_name: pi.item_name,
          quantity: pi.quantity,
          unit: "pcs",
          unit_price: pi.unit_price,
          total_value: pi.total_price,
          type: "Purchase"
        }))
      )
    ];
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredDeliveries, filteredPurchases, purchaseItems]);

  const combinedPayments = useMemo(() => {
    const list = [
      ...filteredPayments.map(p => ({
        id: p.id,
        date: p.payment_date,
        amount: p.amount,
        method: p.payment_method,
        reference: p.reference_number
      })),
      ...filteredPurchases.filter(p => Number(p.payment_amount) > 0).map(p => ({
        id: `pay-${p.id}`,
        date: p.purchase_date,
        amount: p.payment_amount,
        method: "Purchase Payment",
        reference: p.branch
      }))
    ];
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredPayments, filteredPurchases]);

  const itemsBroughtSummary = useMemo(() => {
    const itemsMap = new Map<string, number>();
    filteredDeliveries.forEach(d => {
      if (d.material_name) {
        itemsMap.set(d.material_name, (itemsMap.get(d.material_name) || 0) + Number(d.quantity || 0));
      }
    });
    filteredPurchases.forEach(pur => {
      const purItems = purchaseItems.filter(pi => pi.purchase_id === pur.id);
      purItems.forEach(pi => {
        if (pi.item_name) {
          itemsMap.set(pi.item_name, (itemsMap.get(pi.item_name) || 0) + Number(pi.quantity || 0));
        }
      });
    });
    return Array.from(itemsMap.entries()).map(([name, qty]) => `${qty} ${name}`).join(", ");
  }, [filteredDeliveries, filteredPurchases, purchaseItems]);

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.name?.trim()) {
      setEditErrors({ name: true });
      return;
    }
    try {
      const { error } = await supabase
        .from("suppliers")
        .update(editForm)
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Updated", description: "Supplier info saved." });
      setIsEditModalOpen(false);
      fetchData();
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: (error as Error)?.message || "Something went wrong.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    try {
      // Delete supplier (cascade will delete related deliveries and payments due to ON DELETE CASCADE)
      const { error } = await supabase
        .from("suppliers")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Supplier deleted",
        description: "All records for this supplier have been removed.",
      });

      // Redirect to suppliers list
      router.push("/suppliers");
    } catch (error: unknown) {
      toast({
        title: "Error deleting supplier",
        description: (error as Error)?.message || "Something went wrong.",
        variant: "destructive",
      });
    }
  };

  if (loading && !supplier) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="w-10 h-10 animate-spin text-[#f59e0b]" />
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="p-6 text-center">
        <p className="text-[#64748b]">Supplier not found.</p>
        <Link href="/suppliers">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Suppliers
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 pb-28 max-w-[1400px] mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link
            href="/suppliers"
            className="text-sm text-[#64748b] hover:text-[#1a1a2e] flex items-center gap-1 mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-bold text-[#1a1a2e]">
              {supplier.name}
            </h1>
            {isFullyPaid && (
              <span className="flex items-center gap-1 bg-emerald-100 text-emerald-600 px-3 py-1 rounded-full text-sm font-bold">
                <CheckCircle className="w-4 h-4" /> Paid
              </span>
            )}
          </div>
          <p className="text-sm text-[#64748b] mt-0.5">
            {supplier.material_type || "Supplier"} Provider
            {supplier.contact_person ? ` · ${supplier.contact_person}` : ""}
            {supplier.phone ? ` · ${supplier.phone}` : ""}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => setIsEditModalOpen(true)}
            className="border-[#e2e8f0] hover:bg-[#f8fafc] font-bold gap-1.5 min-h-[44px]"
          >
            <Edit2 className="w-3.5 h-3.5" /> Edit Info
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsDeleteModalOpen(true)}
            className="border-red-200 text-red-500 hover:bg-red-50 font-bold gap-1.5 min-h-[44px]"
          >
            Delete
          </Button>
          <Button
            onClick={() => {
              setQuickUpdateTab("stock");
              setQuickUpdateOpen(true);
            }}
            className="bg-[#f59e0b] hover:bg-amber-600 text-white font-bold gap-1.5 min-h-[44px]"
          >
            <Plus className="w-4 h-4" /> Update
          </Button>
        </div>
      </div>

      {/* Items Brought Summary */}
      {(itemsBroughtSummary || fromDate || toDate) && (
        <div className="bg-white border border-[#e2e8f0] rounded-xl shadow-sm p-4 mt-4">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-5 h-5 text-[#f59e0b]" />
            <h2 className="text-lg font-bold text-[#1a1a2e]">Items Brought Summary</h2>
          </div>
          {itemsBroughtSummary ? (
            <p className="text-[#1a1a2e] text-sm font-medium">{itemsBroughtSummary}</p>
          ) : (
            <p className="text-[#64748b] text-sm">No items found for this period.</p>
          )}
        </div>
      )}

      {/* Date Filters & Download */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl shadow-sm p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-[#1a1a2e] font-bold">
            <Calendar className="w-4 h-4 text-[#f59e0b]" />
            Filter by Date Range
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                // Download Excel
                const stockData = filteredDeliveries.map((d) => ({
                  Date: format(new Date(d.delivery_date), "dd MMM yyyy"),
                  Material: d.material_name,
                  Quantity: `${d.quantity} ${d.unit}`,
                  "Price/Unit": formatSAR(Number(d.unit_price) || 0),
                  "Total Value": formatSAR(Number(d.total_value) || 0),
                }));
                const paymentData = filteredPayments.map((p) => ({
                  Date: format(new Date(p.payment_date), "dd MMM yyyy"),
                  Amount: formatSAR(Number(p.amount) || 0),
                  Method: p.payment_method,
                  Reference: p.reference_number || "-",
                }));
                downloadExcel(
                  [
                    { Type: "=== STOCK HISTORY ===" },
                    ...stockData,
                    {},
                    { Type: "=== PAYMENT HISTORY ===" },
                    ...paymentData,
                    {},
                    { Type: "=== SUMMARY ===" },
                    { Type: "Total Delivered", Value: formatSAR(totalDelivered) },
                    { Type: "Total Paid", Value: formatSAR(totalPaid) },
                    { Type: "Balance Due", Value: formatSAR(balanceDue) },
                  ],
                  `${supplier.name}-Report`
                );
                toast({ title: "Excel Downloaded", description: "Report saved to your device." });
              }}
              className="border-[#10b981] text-[#10b981] hover:bg-emerald-50 font-bold text-xs h-9 gap-1.5"
            >
              <FileSpreadsheet className="w-4 h-4" /> Excel
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                // Download PDF - Combine stock and payment data
                const allHeaders = ["Date", "Type", "Description", "Amount"];
                const allData = [
                  ...filteredDeliveries.map((d) => [
                    format(new Date(d.delivery_date), "dd MMM yyyy"),
                    "STOCK",
                    `${d.material_name} (${d.quantity} ${d.unit})`,
                    formatSAR(Number(d.total_value) || 0),
                  ]),
                  ...filteredPayments.map((p) => [
                    format(new Date(p.payment_date), "dd MMM yyyy"),
                    "PAYMENT",
                    `${p.payment_method}${p.reference_number ? ` (${p.reference_number})` : ""}`,
                    formatSAR(Number(p.amount) || 0),
                  ]),
                ].sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());
                
                downloadPDF(
                  `${supplier.name} - Report`,
                  allHeaders,
                  allData,
                  `${supplier.name}-Report`,
                  [
                    { label: "Total Delivered", value: formatSAR(totalDelivered) },
                    { label: "Total Paid", value: formatSAR(totalPaid) },
                    { label: "Balance Due", value: formatSAR(balanceDue) },
                  ]
                );
                toast({ title: "PDF Downloaded", description: "Report saved to your device." });
              }}
              className="border-red-400 text-red-500 hover:bg-red-50 font-bold text-xs h-9 gap-1.5"
            >
              <FileText className="w-4 h-4" /> PDF
            </Button>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-2 flex-1">
            <Label className="text-sm text-[#64748b] whitespace-nowrap">From:</Label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="border-[#e2e8f0] h-10"
            />
          </div>
          <div className="flex items-center gap-2 flex-1">
            <Label className="text-sm text-[#64748b] whitespace-nowrap">To:</Label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="border-[#e2e8f0] h-10"
            />
          </div>
          {(fromDate || toDate) && (
            <Button
              variant="ghost"
              onClick={() => {
                setFromDate("");
                setToDate("");
              }}
              className="text-[#64748b] hover:text-[#1a1a2e] h-10"
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Two side-by-side sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT — Stock History */}
        <div className="bg-white border border-[#e2e8f0] rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#1a1a2e] uppercase tracking-wider flex items-center gap-2">
              <Package className="w-4 h-4 text-[#f59e0b]" /> Stock History
              {combinedStock.length > 0 && (
                <span className="text-xs font-normal text-[#64748b] bg-white px-2 py-0.5 rounded-full border">
                  {combinedStock.length} items
                </span>
              )}
            </h2>
          </div>
          <div className="overflow-x-auto">
            {combinedStock.length === 0 ? (
              <div className="py-12 text-center text-[#64748b] text-sm">
                No stock entries yet.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-[#f8fafc]">
                  <tr>
                    <th className="text-left px-5 py-3 font-bold text-[#1a1a2e] text-xs">
                      Date
                    </th>
                    <th className="text-left px-5 py-3 font-bold text-[#1a1a2e] text-xs">
                      Material
                    </th>
                    <th className="text-right px-5 py-3 font-bold text-[#1a1a2e] text-xs">
                      Quantity
                    </th>
                    <th className="text-right px-5 py-3 font-bold text-[#1a1a2e] text-xs">
                      Price/Unit
                    </th>
                    <th className="text-right px-5 py-3 font-bold text-[#1a1a2e] text-xs">
                      Total Value
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {combinedStock.map((d) => (
                    <tr
                      key={d.id}
                      className="border-b border-[#e2e8f0] hover:bg-[#f8fafc] transition-colors"
                    >
                      <td className="px-5 py-3 text-[#64748b] text-xs">
                        {format(new Date(d.date), "dd MMM yyyy")}
                        <div className="text-[9px] text-[#f59e0b] mt-0.5 uppercase tracking-wider">{d.type}</div>
                      </td>
                      <td className="px-5 py-3 font-semibold text-[#1a1a2e]">
                        {d.material_name}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="font-semibold">{d.quantity}</span>{" "}
                        <span className="text-[#64748b] text-xs uppercase">
                          {d.unit}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right text-[#64748b] text-xs">
                        {formatSAR(Number(d.unit_price) || 0)}
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-[#1a1a2e]">
                        {formatSAR(Number(d.total_value) || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* RIGHT — Payment History */}
        <div className="bg-white border border-[#e2e8f0] rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#1a1a2e] uppercase tracking-wider flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#10b981]" /> Payment History
              {combinedPayments.length > 0 && (
                <span className="text-xs font-normal text-[#64748b] bg-white px-2 py-0.5 rounded-full border">
                  {combinedPayments.length} items
                </span>
              )}
            </h2>
            <Button
              onClick={() => {
                setQuickUpdateTab("payment");
                setQuickUpdateOpen(true);
              }}
              className="bg-[#10b981] hover:bg-emerald-600 text-white font-bold text-xs h-8 px-3"
            >
              + Pay
            </Button>
          </div>
          <div className="overflow-x-auto">
            {combinedPayments.length === 0 ? (
              <div className="py-12 text-center text-[#64748b] text-sm">
                No payment records yet.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-[#f8fafc]">
                  <tr>
                    <th className="text-left px-5 py-3 font-bold text-[#1a1a2e] text-xs">
                      Date
                    </th>
                    <th className="text-right px-5 py-3 font-bold text-[#1a1a2e] text-xs">
                      Amount
                    </th>
                    <th className="text-left px-5 py-3 font-bold text-[#1a1a2e] text-xs">
                      Method
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {combinedPayments.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-[#e2e8f0] hover:bg-[#f8fafc] transition-colors"
                    >
                      <td className="px-5 py-3 text-[#64748b] text-xs">
                        {format(new Date(p.date), "dd MMM yyyy")}
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-[#1a1a2e]">
                        {formatSAR(Number(p.amount) || 0)}
                      </td>
                      <td className="px-5 py-3">
                        <span className="capitalize text-[#64748b] text-xs">
                          {p.method}
                        </span>
                        {p.reference && (
                          <span className="text-[#64748b] text-xs ml-1">
                            ({p.reference})
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Sticky Bottom Balance Bar */}
      <div className="fixed bottom-0 left-0 right-0 md:left-[220px] bg-white border-t border-[#e2e8f0] shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-30">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-6 sm:gap-10 w-full sm:w-auto">
            <div className="text-center sm:text-left">
              <div className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">
                Total Goods
              </div>
              <div className="text-lg font-bold text-[#1a1a2e]">
                {formatSAR(totalDelivered)}
              </div>
            </div>
            <div className="hidden sm:block w-px h-8 bg-[#e2e8f0]" />
            <div className="text-center sm:text-left">
              <div className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">
                Total Paid
              </div>
              <div className="text-lg font-bold text-[#1a1a2e]">
                {formatSAR(totalPaid)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
            <div className="text-center sm:text-right">
              <div className="text-[10px] font-bold text-red-500 uppercase tracking-wider">
                Balance Due
              </div>
              <div className="text-xl font-bold text-red-500">
                {formatSAR(balanceDue)}
              </div>
              <div className="text-xs text-[#64748b] mt-0.5">
                {balanceDue > 0 ? "Payment Required" : "All Paid"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Update Popup */}
      <QuickUpdatePopup
        isOpen={quickUpdateOpen}
        onClose={() => setQuickUpdateOpen(false)}
        supplierId={supplier.id}
        supplierName={supplier.name}
        currentBalance={balanceDue}
        defaultTab={quickUpdateTab}
        onSuccess={fetchData}
      />

      {/* Edit Supplier Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-[#1a1a2e] p-5 text-white">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">Edit Supplier Info</DialogTitle>
            </DialogHeader>
          </div>
          <form onSubmit={handleEditSave} className="p-5 bg-white space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[#1a1a2e] text-sm font-medium">Company Name *</Label>
              <Input
                value={editForm.name || ""}
                onChange={(e) => {
                  setEditForm({ ...editForm, name: e.target.value });
                  if (editErrors.name) setEditErrors((p) => ({ ...p, name: false }));
                }}
                className={cn(
                  "border h-11",
                  editErrors.name ? "border-red-400 ring-1 ring-red-400" : "border-[#e2e8f0]"
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[#1a1a2e] text-sm font-medium">Contact Person</Label>
                <Input
                  value={editForm.contact_person || ""}
                  onChange={(e) => setEditForm({ ...editForm, contact_person: e.target.value })}
                  className="border-[#e2e8f0] h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[#1a1a2e] text-sm font-medium">Phone</Label>
                <Input
                  value={editForm.phone || ""}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="border-[#e2e8f0] h-11"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[#1a1a2e] text-sm font-medium">Material Type</Label>
              <Select
                value={editForm.material_type || ""}
                onValueChange={(v) => setEditForm({ ...editForm, material_type: v })}
              >
                <SelectTrigger className="border-[#e2e8f0] h-11">
                  <SelectValue placeholder="Select material type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Marble">Marble</SelectItem>
                  <SelectItem value="Granite">Granite</SelectItem>
                  <SelectItem value="Tiles">Tiles</SelectItem>
                  <SelectItem value="Drums">Drums</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[#1a1a2e] text-sm font-medium">Notes</Label>
              <Textarea
                value={editForm.notes || ""}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                className="border-[#e2e8f0] min-h-[80px]"
              />
            </div>
            <DialogFooter className="pt-2 gap-2">
              <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)} className="flex-1 font-bold h-11">
                Cancel
              </Button>
              <Button type="submit" className="flex-1 bg-[#f59e0b] hover:bg-amber-600 text-white font-bold h-11">
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-red-500 p-5 text-white">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">Delete Supplier?</DialogTitle>
            </DialogHeader>
          </div>
          <div className="p-5 bg-white space-y-4">
            <p className="text-sm text-[#64748b]">
              This will permanently delete <strong>{supplier.name}</strong> and all their stock and payment records.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
              ⚠️ This action cannot be undone.
            </div>
            <DialogFooter className="pt-2 gap-2">
              <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)} className="flex-1 font-bold h-11">
                Cancel
              </Button>
              <Button 
                onClick={handleDelete}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold h-11"
              >
                Yes, Delete
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
