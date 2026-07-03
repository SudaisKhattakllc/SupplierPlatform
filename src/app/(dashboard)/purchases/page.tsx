"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppData } from "@/hooks/use-data";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, ShoppingCart, Calendar, Package, ChevronDown, ChevronUp, Edit2, X, FileSpreadsheet, FileText } from "lucide-react";
import { downloadExcel, downloadPDF, formatSAR } from "@/lib/format-utils";
import { format } from "date-fns";
import { Purchase, PurchaseItem } from "@/types";

const PREDEFINED_BRANCHES = ["Al Shifa", "Ad Dillam", "Mohammadia", "Exit 9 Number"];
const PREDEFINED_ITEMS = ["Thinner", "Oil", "Grease", "Scrap", "Ibcs 1000 ltrs", "Plastic drum", "Satal"];
const UNITS = ["pcs", "kg", "litre", "CBM", "SQM", "ton", "box", "set", "other"];

type PurchaseFormItem = {
  id: string | number;
  item_name: string;
  custom_item_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
};

export default function PurchasesPage() {
  const { data: appData, isLoading: dataLoading, mutate } = useAppData();
  const { suppliers } = appData;
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(true);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [formData, setFormData] = useState({
    supplier_id: "",
    purchase_date: new Date().toISOString().split("T")[0],
    branch: "",
    custom_branch: "",
    payment_amount: "",
    notes: "",
  });
  const [branchFilter, setBranchFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [items, setItems] = useState<PurchaseFormItem[]>([
    { id: 1, item_name: "", custom_item_name: "", quantity: 1, unit: "pcs", unit_price: 0 },
  ]);

  const handleItemChange = (index: number, field: string, value: string | number) => {
    const newItems = [...items];
    (newItems[index] as Record<string, string | number>)[field] = value;
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { id: Date.now(), item_name: "", custom_item_name: "", quantity: 1, unit: "pcs", unit_price: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) { const n = [...items]; n.splice(index, 1); setItems(n); }
  };

  const calculateTotalAmount = () =>
    items.reduce((acc, item) => acc + item.quantity * item.unit_price, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.supplier_id) {
      toast({ title: "Error", description: "Please select a supplier", variant: "destructive" }); return;
    }
    const finalBranch = formData.branch === "Custom" ? formData.custom_branch : formData.branch;
    if (!finalBranch) {
      toast({ title: "Error", description: "Please specify a branch", variant: "destructive" }); return;
    }
    for (let i = 0; i < items.length; i++) {
      const finalItemName = items[i].item_name === "Custom" ? items[i].custom_item_name : items[i].item_name;
      if (!finalItemName) {
        toast({ title: "Error", description: `Please specify item name for item #${i + 1}`, variant: "destructive" }); return;
      }
    }

    setIsLoading(true);
    try {
      const totalAmount = calculateTotalAmount();
      const paymentAmount = Number(formData.payment_amount) || 0;

      const purchasePayload = {
        supplier_id: formData.supplier_id,
        branch: finalBranch,
        purchase_date: formData.purchase_date,
        payment_amount: paymentAmount,
        total_amount: totalAmount,
        notes: formData.notes,
      };

      const { data: purchaseData, error: purchaseError } = editingPurchase
        ? await supabase.from("purchases").update(purchasePayload).eq("id", editingPurchase.id).select().single()
        : await supabase.from("purchases").insert(purchasePayload).select().single();
      if (purchaseError) throw purchaseError;

      if (editingPurchase) {
        const { error: deleteItemsError } = await supabase
          .from("purchase_items")
          .delete()
          .eq("purchase_id", editingPurchase.id);
        if (deleteItemsError) throw deleteItemsError;
      }

      const purchaseItemsData = items.map((item) => {
        const finalItemName = item.item_name === "Custom" ? item.custom_item_name : item.item_name;
        return {
          purchase_id: purchaseData.id,
          item_name: finalItemName,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.quantity * item.unit_price,
        };
      });
      const { error: itemsError } = await supabase.from("purchase_items").insert(purchaseItemsData);
      if (itemsError) throw itemsError;

      toast({ title: "Success ✓", description: "Purchase recorded & supplier balance updated!" });
      mutate();
      setEditingPurchase(null);
      setFormData({ supplier_id: "", purchase_date: new Date().toISOString().split("T")[0], branch: "", custom_branch: "", payment_amount: "", notes: "" });
      setItems([{ id: Date.now(), item_name: "", custom_item_name: "", quantity: 1, unit: "pcs", unit_price: 0 }]);
    } catch (error: unknown) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to record purchase", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string | number) => {
    if (!window.confirm("Are you sure you want to delete this purchase entry? This action cannot be undone.")) return;
    setIsLoading(true);
    try {
      const { error: itemsError } = await supabase.from("purchase_items").delete().eq("purchase_id", id);
      if (itemsError) throw itemsError;
      const { error: purError } = await supabase.from("purchases").delete().eq("id", id);
      if (purError) throw purError;
      toast({ title: "Success ✓", description: "Purchase entry deleted successfully." });
      mutate();
    } catch (error: unknown) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to delete purchase", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // Build enriched purchases list
  const enrichedPurchases = useMemo(() => {
    const supplierMap = new Map(suppliers.map((s) => [s.id, s.name]));
    return appData.purchases.map((pur) => {
      const purItems = (appData.purchaseItems || []).filter((pi) => pi.purchase_id === pur.id);
      return {
        ...pur,
        supplier_name: supplierMap.get(pur.supplier_id) || "Unknown",
        items: purItems,
      };
    });
  }, [appData.purchases, appData.purchaseItems, suppliers]);

  const branchOptions = useMemo(
    () => Array.from(new Set(enrichedPurchases.map((pur) => pur.branch))).sort(),
    [enrichedPurchases]
  );

  const filteredPurchases = useMemo(
    () => {
      return enrichedPurchases.filter((purchase) => {
        const matchBranch = branchFilter === "all" || purchase.branch === branchFilter;
        const matchFrom = !dateFrom || new Date(purchase.purchase_date) >= new Date(dateFrom);
        const matchTo = !dateTo || new Date(purchase.purchase_date) <= new Date(dateTo);
        return matchBranch && matchFrom && matchTo;
      });
    },
    [branchFilter, dateFrom, dateTo, enrichedPurchases]
  );

  const purchaseProductSummary = useMemo(() => {
    const productMap = new Map<string, { quantity: number; unit: string }>();
    filteredPurchases.forEach((purchase) => {
      (purchase.items || []).forEach((item: PurchaseItem) => {
        const productName = item.item_name || "Unknown";
        const existing = productMap.get(productName) || { quantity: 0, unit: "pcs" };
        productMap.set(productName, {
          quantity: existing.quantity + (Number(item.quantity) || 0),
          unit: existing.unit,
        });
      });
    });
    return Array.from(productMap.entries()).map(([name, data]) => ({ name, quantity: data.quantity, unit: data.unit }));
  }, [filteredPurchases]);

  const exportPurchasesExcel = () => {
    const rows: Array<Record<string, string | number | undefined>> = filteredPurchases.flatMap((pur, idx) => [
      { "#": idx + 1, Date: format(new Date(pur.purchase_date), "yyyy-MM-dd"), Supplier: pur.supplier_name, Branch: pur.branch, Item: "", Qty: "", "Unit Price": "", Total: pur.total_amount },
      ...(pur.items || []).map((it: PurchaseItem) => ({ "#": "", Date: "", Supplier: "", Branch: "", Item: it.item_name, Qty: it.quantity, "Unit Price": it.unit_price, Total: it.total_price })),
      { "#": "", Date: "", Supplier: "", Branch: "", Item: "Payment", Qty: "", "Unit Price": "", Total: pur.payment_amount },
      {}
    ]);

    const totalQuantity = purchaseProductSummary.reduce((sum, item) => sum + item.quantity, 0);
    const totalAmount = filteredPurchases.reduce((sum, purchase) => sum + (Number(purchase.total_amount) || 0), 0);

    rows.push({});
    rows.push({ "#": "=== PRODUCT SUMMARY ===" });
    purchaseProductSummary.forEach((item) => {
      rows.push({ "#": "", Date: "", Supplier: "", Branch: "", Item: item.name, Qty: `${item.quantity} ${item.unit}`, "Unit Price": "", Total: "" });
    });
    rows.push({ "#": "", Date: "", Supplier: "", Branch: "", Item: "Total Quantity", Qty: totalQuantity, "Unit Price": "", Total: totalAmount });

    downloadExcel(rows, "Purchases-Report");
    toast({ title: "Excel Downloaded", description: "Purchases exported." });
  };

  const exportPurchasesPDF = () => {
    const headers = ["#", "Date", "Supplier", "Branch", "Item", "Qty", "Unit Price", "Total"];
    const rows = filteredPurchases.flatMap((pur, idx) => [
      [idx + 1, format(new Date(pur.purchase_date), "yyyy-MM-dd"), pur.supplier_name, pur.branch, "", "", "", pur.total_amount],
      ...((pur.items || []).map((it: PurchaseItem) => ["", "", "", "", it.item_name, it.quantity, it.unit_price.toFixed(2), it.total_price])),
      ["", "", "", "", "Payment", "", "", pur.payment_amount],
      ["", "", "", "", "", "", "", ""]
    ]);
    const totalQuantity = purchaseProductSummary.reduce((sum, item) => sum + item.quantity, 0);
    const totalAmount = filteredPurchases.reduce((sum, purchase) => sum + (Number(purchase.total_amount) || 0), 0);

    downloadPDF("Purchases Report", headers, rows, "Purchases-Report", [
      ...purchaseProductSummary.map((item) => ({ label: item.name, value: `${item.quantity} ${item.unit}` })),
      { label: "Total Quantity", value: totalQuantity.toFixed(2) },
      { label: "Total Amount", value: formatSAR(totalAmount) },
    ]);
    toast({ title: "PDF Downloaded", description: "Purchases exported." });
  };

  const selectedSupplierName = suppliers.find(s => s.id === formData.supplier_id)?.name || "";

  const startEditPurchase = (purchase: Purchase & { items: typeof appData.purchaseItems }) => {
    const isKnownBranch = PREDEFINED_BRANCHES.includes(purchase.branch);
    setEditingPurchase(purchase);
    setFormData({
      supplier_id: purchase.supplier_id,
      purchase_date: purchase.purchase_date,
      branch: isKnownBranch ? purchase.branch : "Custom",
      custom_branch: isKnownBranch ? "" : purchase.branch,
      payment_amount: String(Number(purchase.payment_amount) || 0),
      notes: purchase.notes || "",
    });
    setItems(purchase.items.length > 0
      ? purchase.items.map((item) => {
          const isKnownItem = PREDEFINED_ITEMS.includes(item.item_name);
          return {
            id: item.id,
            item_name: isKnownItem ? item.item_name : "Custom",
            custom_item_name: isKnownItem ? "" : item.item_name,
            quantity: Number(item.quantity) || 1,
            unit: "pcs",
            unit_price: Number(item.unit_price) || 0,
          };
        })
      : [{ id: Date.now(), item_name: "", custom_item_name: "", quantity: 1, unit: "pcs", unit_price: 0 }]
    );
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingPurchase(null);
    setFormData({ supplier_id: "", purchase_date: new Date().toISOString().split("T")[0], branch: "", custom_branch: "", payment_amount: "", notes: "" });
    setItems([{ id: Date.now(), item_name: "", custom_item_name: "", quantity: 1, unit: "pcs", unit_price: 0 }]);
  };

  if (dataLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-10 h-10 animate-spin text-[#3b82f6]" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1200px] mx-auto w-full">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] flex items-center justify-center">
          <ShoppingCart className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Purchases</h1>
          <p className="text-sm text-[#8faac3]">Record new stock purchases from your suppliers</p>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={exportPurchasesExcel} className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded text-sm font-bold">
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </button>
          <button onClick={exportPurchasesPDF} className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded text-sm font-bold">
            <FileText className="w-4 h-4" /> PDF
          </button>
        </div>
      </div>

      {/* New Purchase Form */}
      <div className="bg-[#121e36] border border-[#1e3464] rounded-xl overflow-hidden shadow-xl">
        {/* Form Header Toggle */}
        <button
          type="button"
          onClick={() => setFormOpen(!formOpen)}
          className="w-full flex items-center justify-between px-5 py-4 bg-[#0a1422] border-b border-[#1e3464] hover:bg-[#162040] transition-colors"
        >
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#3b82f6]" />
            <span className="font-bold text-white">{editingPurchase ? "Edit Purchase Entry" : "New Purchase Entry"}</span>
          </div>
          {formOpen ? <ChevronUp className="w-4 h-4 text-[#8faac3]" /> : <ChevronDown className="w-4 h-4 text-[#8faac3]" />}
        </button>

        {formOpen && (
          <form onSubmit={handleSubmit} className="p-5 space-y-5">
            {/* Top row: Supplier | Date | Branch */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[#8faac3] text-xs font-bold uppercase tracking-wider">Supplier *</Label>
                <Select value={formData.supplier_id} onValueChange={(val) => setFormData({ ...formData, supplier_id: val })}>
                  <SelectTrigger className="h-11 bg-[#0d1526] border-[#1e3464] text-[#e2e8f0]">
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#121e36] border-[#1e3464]">
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id} className="text-[#e2e8f0] focus:bg-[#1e3464]">{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[#8faac3] text-xs font-bold uppercase tracking-wider">Purchase Date *</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8faac3]" />
                  <Input
                    type="date"
                    required
                    value={formData.purchase_date}
                    onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                    className="pl-10 h-11 bg-[#0d1526] border-[#1e3464] text-[#e2e8f0]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[#8faac3] text-xs font-bold uppercase tracking-wider">Branch *</Label>
                <Select value={formData.branch} onValueChange={(val) => setFormData({ ...formData, branch: val })}>
                  <SelectTrigger className="h-11 bg-[#0d1526] border-[#1e3464] text-[#e2e8f0]">
                    <SelectValue placeholder="Select Branch" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#121e36] border-[#1e3464]">
                    {PREDEFINED_BRANCHES.map((b) => (
                      <SelectItem key={b} value={b} className="text-[#e2e8f0] focus:bg-[#1e3464]">{b}</SelectItem>
                    ))}
                    <SelectItem value="Custom" className="text-[#e2e8f0] focus:bg-[#1e3464]">Custom / Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.branch === "Custom" && (
              <div className="space-y-1.5">
                <Label className="text-[#8faac3] text-xs font-bold uppercase tracking-wider">Custom Branch Name *</Label>
                <Input required placeholder="Enter branch name" value={formData.custom_branch}
                  onChange={(e) => setFormData({ ...formData, custom_branch: e.target.value })}
                  className="h-11 bg-[#0d1526] border-[#1e3464] text-[#e2e8f0] placeholder-[#8faac3]" />
              </div>
            )}

            {/* Items Table */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-white font-bold text-sm flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#3b82f6]" /> Items Purchased
                </Label>
                <button type="button" onClick={addItem}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e3464] hover:bg-[#3b82f6] text-[#8faac3] hover:text-white rounded-lg text-xs font-bold transition-all">
                  <Plus className="w-3.5 h-3.5" /> Add Item
                </button>
              </div>

              {/* Items Header */}
              <div className="hidden md:grid grid-cols-12 gap-2 px-3 py-2 bg-[#0a1422] rounded-lg border border-[#1e3464]">
                <div className="col-span-4 text-xs font-bold text-[#8faac3] uppercase">Item Name</div>
                <div className="col-span-2 text-xs font-bold text-[#8faac3] uppercase">Qty</div>
                <div className="col-span-2 text-xs font-bold text-[#8faac3] uppercase">Unit</div>
                <div className="col-span-2 text-xs font-bold text-[#8faac3] uppercase">Unit Price</div>
                <div className="col-span-1 text-xs font-bold text-[#8faac3] uppercase text-right">Total</div>
                <div className="col-span-1"></div>
              </div>

              {items.map((item, index) => (
                <div key={item.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 p-3 bg-[#0d1526] border border-[#1e3464] rounded-lg">
                  <div className="md:col-span-4">
                    <Select value={item.item_name} onValueChange={(val) => handleItemChange(index, "item_name", val)}>
                      <SelectTrigger className="h-10 bg-[#121e36] border-[#1e3464] text-[#e2e8f0] text-sm">
                        <SelectValue placeholder="Select item" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#121e36] border-[#1e3464]">
                        {PREDEFINED_ITEMS.map((i) => (
                          <SelectItem key={i} value={i} className="text-[#e2e8f0] focus:bg-[#1e3464] capitalize">{i}</SelectItem>
                        ))}
                        <SelectItem value="Custom" className="text-[#e2e8f0] focus:bg-[#1e3464]">Custom / Other</SelectItem>
                      </SelectContent>
                    </Select>
                    {item.item_name === "Custom" && (
                      <Input required placeholder="Custom item name" value={item.custom_item_name}
                        onChange={(e) => handleItemChange(index, "custom_item_name", e.target.value)}
                        className="mt-1.5 h-10 bg-[#121e36] border-[#1e3464] text-[#e2e8f0] placeholder-[#8faac3] text-sm" />
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <Input type="number" min="1" step="0.01" required value={item.quantity}
                      onChange={(e) => handleItemChange(index, "quantity", Number(e.target.value))}
                      className="h-10 bg-[#121e36] border-[#1e3464] text-[#e2e8f0] text-sm" placeholder="Qty" />
                  </div>

                  <div className="md:col-span-2">
                    <Select value={item.unit} onValueChange={(val) => handleItemChange(index, "unit", val)}>
                      <SelectTrigger className="h-10 bg-[#121e36] border-[#1e3464] text-[#e2e8f0] text-sm">
                        <SelectValue placeholder="Unit" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#121e36] border-[#1e3464]">
                        {UNITS.map((u) => (
                          <SelectItem key={u} value={u} className="text-[#e2e8f0] focus:bg-[#1e3464] uppercase">{u}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="md:col-span-2">
                    <Input type="number" min="0" step="0.01" required value={item.unit_price}
                      onChange={(e) => handleItemChange(index, "unit_price", Number(e.target.value))}
                      className="h-10 bg-[#121e36] border-[#1e3464] text-[#e2e8f0] text-sm" placeholder="Price" />
                  </div>

                  <div className="md:col-span-1 flex items-center justify-end">
                    <span className="text-sm font-bold text-[#3b82f6]">
                      {(item.quantity * item.unit_price).toFixed(2)}
                    </span>
                  </div>

                  <div className="md:col-span-1 flex items-center justify-end">
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItem(index)}
                        className="w-8 h-8 rounded-lg bg-red-900/30 hover:bg-red-600 text-red-400 hover:text-white transition-all flex items-center justify-center">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Payment & Total */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-[#1e3464]">
              <div className="space-y-1.5">
                <Label className="text-[#8faac3] text-xs font-bold uppercase tracking-wider">Payment Made Now (Optional)</Label>
                <Input type="number" min="0" step="0.01" placeholder="0.00" value={formData.payment_amount}
                  onChange={(e) => setFormData({ ...formData, payment_amount: e.target.value })}
                  className="h-11 bg-[#0d1526] border-[#1e3464] text-[#e2e8f0] placeholder-[#8faac3]" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[#8faac3] text-xs font-bold uppercase tracking-wider">Notes</Label>
                <Input placeholder="Optional notes" value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="h-11 bg-[#0d1526] border-[#1e3464] text-[#e2e8f0] placeholder-[#8faac3]" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[#8faac3] text-xs font-bold uppercase tracking-wider">Total Purchase Amount</Label>
                <div className="h-11 flex items-center px-4 bg-gradient-to-r from-[#1e3464] to-[#162040] border border-[#3b82f6]/40 rounded-lg">
                  <span className="text-lg font-bold text-[#3b82f6]">SAR {calculateTotalAmount().toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="flex items-center justify-between pt-2">
              {selectedSupplierName && (
                <div className="text-sm text-[#8faac3]">
                  Supplier: <span className="text-white font-bold">{selectedSupplierName}</span>
                  <span className="ml-2 text-xs text-[#3b82f6]">→ Balance will be updated automatically</span>
                </div>
              )}
              <div className="ml-auto flex gap-2">
                {editingPurchase && (
                  <Button type="button" variant="outline" onClick={cancelEdit}
                    className="border-[#1e3464] text-[#8faac3] bg-transparent hover:bg-[#1e3464] font-bold h-11 px-4">
                    <X className="w-4 h-4 mr-2" /> Cancel
                  </Button>
                )}
                <Button type="submit" disabled={isLoading}
                  className="bg-gradient-to-r from-[#3b82f6] to-[#2563eb] hover:from-[#2563eb] hover:to-[#1d4ed8] text-white font-bold h-11 px-8 shadow-lg">
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : editingPurchase ? <Edit2 className="w-4 h-4 mr-2" /> : <ShoppingCart className="w-4 h-4 mr-2" />}
                  {editingPurchase ? "Update Purchase" : "Save Purchase Record"}
                </Button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* Purchases History Table */}
      <div className="bg-[#121e36] border border-[#1e3464] rounded-xl overflow-hidden shadow-xl">
        <div className="px-5 py-4 bg-[#0a1422] border-b border-[#1e3464] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="font-bold text-white flex items-center gap-2">
              <Package className="w-4 h-4 text-[#3b82f6]" /> Purchase History
            </h2>
            <p className="text-xs text-[#8faac3] mt-0.5">{filteredPurchases.length} total purchases</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-[#8faac3]">From</span>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-10 bg-[#0d1526] border border-[#1e3464] rounded-lg px-3 text-sm text-[#e2e8f0] outline-none focus:border-[#3b82f6]" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-[#8faac3]">To</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-10 bg-[#0d1526] border border-[#1e3464] rounded-lg px-3 text-sm text-[#e2e8f0] outline-none focus:border-[#3b82f6]" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-[#8faac3]">Branch</span>
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="h-10 bg-[#0d1526] border border-[#1e3464] rounded-lg px-3 text-sm text-[#e2e8f0] outline-none focus:border-[#3b82f6]"
              >
                <option value="all">All Branches</option>
                {branchOptions.map((branch) => (
                  <option key={branch} value={branch}>{branch}</option>
                ))}
              </select>
            </div>
            {(dateFrom || dateTo || branchFilter !== "all") && (
              <button onClick={() => { setDateFrom(""); setDateTo(""); setBranchFilter("all"); }} className="h-10 px-3 bg-[#1e3464] hover:bg-[#3b82f6] text-[#8faac3] hover:text-white rounded-lg text-sm font-bold transition-all">
                Reset
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          {filteredPurchases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <ShoppingCart className="w-10 h-10 text-[#1e3464] mb-3" />
              <p className="text-[#8faac3] text-sm">No purchase records yet.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e3464]">
                  <th className="text-left px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">#</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">Supplier</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">Branch</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">Items</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">Total Amount</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">Paid</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">Balance</th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredPurchases.map((pur, idx) => {
                  const balance = pur.total_amount - pur.payment_amount;
                  return (
                    <tr key={pur.id} className="border-b border-[#1e3464]/50 hover:bg-[#162040] transition-colors">
                      <td className="px-4 py-3.5 text-[#8faac3] text-xs">{idx + 1}</td>
                      <td className="px-4 py-3.5 text-[#8faac3] text-xs whitespace-nowrap">
                        {format(new Date(pur.purchase_date), "dd MMM yyyy")}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-semibold text-white">{pur.supplier_name}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="px-2 py-0.5 bg-[#1e3464] text-[#8faac3] rounded text-xs">{pur.branch}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {pur.items.length > 0 ? pur.items.map((pi, i) => (
                            <span key={i} className="text-xs bg-[#162040] border border-[#1e3464] text-[#8faac3] px-1.5 py-0.5 rounded capitalize">
                              {pi.item_name} × {pi.quantity}
                            </span>
                          )) : <span className="text-[#8faac3] text-xs">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-white font-bold">
                        {formatSAR(pur.total_amount)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-emerald-400">
                        {formatSAR(pur.payment_amount)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-bold">
                        <span className={balance > 0 ? "text-red-400" : "text-emerald-400"}>
                          {formatSAR(balance)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => startEditPurchase(pur)}
                            className="w-8 h-8 rounded-lg bg-[#1e3464] hover:bg-[#2563eb] text-[#8faac3] hover:text-white transition-all inline-flex items-center justify-center"
                            title="Edit purchase"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(pur.id)}
                            className="w-8 h-8 rounded-lg bg-red-900/30 hover:bg-red-600 text-red-400 hover:text-white transition-all inline-flex items-center justify-center"
                            title="Delete purchase"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        {filteredPurchases.length > 0 && (
          <div className="px-5 py-3 bg-[#0a1422] border-t border-[#1e3464] flex items-center justify-end gap-6">
            <div>
              <span className="text-xs text-[#8faac3]">Total Purchases: </span>
              <span className="text-sm font-bold text-white">{formatSAR(filteredPurchases.reduce((a, p) => a + p.total_amount, 0))}</span>
            </div>
            <div>
              <span className="text-xs text-[#8faac3]">Total Paid: </span>
              <span className="text-sm font-bold text-emerald-400">{formatSAR(filteredPurchases.reduce((a, p) => a + p.payment_amount, 0))}</span>
            </div>
            <div>
              <span className="text-xs text-[#8faac3]">Total Remaining: </span>
              <span className="text-sm font-bold text-red-400">{formatSAR(filteredPurchases.reduce((a, p) => a + (p.total_amount - p.payment_amount), 0))}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
