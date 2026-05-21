"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useAppData } from "@/hooks/use-data";
import { Supplier, SupplierSummary } from "@/types";
import { formatSAR } from "@/lib/format-utils";
import {
  Loader2,
  Plus,
  Search,
  Edit2,
  Eye,
  Phone,
  Package,
  Trash2,
  CheckCircle,
  Filter,
  Calendar,
} from "lucide-react";
import { format, subMonths, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import QuickUpdatePopup from "@/components/QuickUpdatePopup";
import { cn } from "@/lib/utils";

export default function SuppliersPage() {
  const { data, isLoading, mutate } = useAppData();
  const { suppliers, summaries } = data;
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSupplierForUpdate, setSelectedSupplierForUpdate] = useState<{
    id: string;
    name: string;
    balance: number;
  } | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    name: string;
  } | null>(null);
  
  // Filter state: 'all' | 'paid' | 'unpaid' | 'new'
  const [filterStatus, setFilterStatus] = useState<"all" | "paid" | "unpaid">("all");
  const [dateFilter, setDateFilter] = useState<"all" | "1m" | "3m" | "custom">("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  
  const [formErrors, setFormErrors] = useState<Record<string, boolean>>({});

  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    contact_person: "",
    phone: "",
    material_type: "",
    notes: "",
  });

  const validateForm = () => {
    const errors: Record<string, boolean> = {};
    if (!formData.name.trim()) errors.name = true;
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      // Prepare data - remove empty strings that should be null
      const dataToSave = {
        name: formData.name.trim(),
        contact_person: formData.contact_person?.trim() || null,
        phone: formData.phone?.trim() || null,
        material_type: formData.material_type?.trim() || null,
        notes: formData.notes?.trim() || null,
      };

      if (editingSupplier) {
        const { data, error } = await supabase
          .from("suppliers")
          .update(dataToSave)
          .eq("id", editingSupplier.id)
          .select();
        if (error) {
          console.error("Update error:", error);
          throw new Error(error.message || "Failed to update supplier");
        }
        console.log("Update success:", data);
        toast({ title: "Updated", description: "Supplier updated successfully." });
      } else {
        const { data, error } = await supabase
          .from("suppliers")
          .insert(dataToSave)
          .select();
        if (error) {
          console.error("Insert error:", error);
          throw new Error(error.message || "Failed to add supplier");
        }
        console.log("Insert success:", data);
        toast({ title: "Success", description: "New supplier added." });
      }
      setIsModalOpen(false);
      setEditingSupplier(null);
      setFormData({
        name: "",
        contact_person: "",
        phone: "",
        material_type: "",
        notes: "",
      });
      setFormErrors({});
      mutate();
    } catch (error: unknown) {
      console.error("Save supplier error:", error);
      const errorMessage = (error as Error)?.message || "Network error - please check your connection";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const openEditModal = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      contact_person: supplier.contact_person || "",
      phone: supplier.phone || "",
      material_type: supplier.material_type || "",
      notes: supplier.notes || "",
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const openAddModal = () => {
    setEditingSupplier(null);
    setFormData({
      name: "",
      contact_person: "",
      phone: "",
      material_type: "",
      notes: "",
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const computedSummaries = useMemo(() => {
    let fromDate: Date | null = null;
    let toDate: Date | null = null;
    const now = new Date();

    if (dateFilter === "1m") {
      fromDate = subMonths(now, 1);
      toDate = now;
    } else if (dateFilter === "3m") {
      fromDate = subMonths(now, 3);
      toDate = now;
    } else if (dateFilter === "custom") {
      if (customFrom) fromDate = startOfDay(new Date(customFrom));
      if (customTo) toDate = endOfDay(new Date(customTo));
    }

    return suppliers.map((s) => {
      let sDeliveries = data.deliveries.filter((d) => d.supplier_id === s.id);
      let sPayments = data.payments.filter((p) => p.supplier_id === s.id);
      let sPurchases = (data.purchases || []).filter((pur) => pur.supplier_id === s.id);

      if (fromDate) {
        sDeliveries = sDeliveries.filter((d) => isAfter(new Date(d.delivery_date), fromDate!));
        sPayments = sPayments.filter((p) => isAfter(new Date(p.payment_date), fromDate!));
        sPurchases = sPurchases.filter((pur) => isAfter(new Date(pur.purchase_date), fromDate!));
      }
      if (toDate) {
        sDeliveries = sDeliveries.filter((d) => isBefore(new Date(d.delivery_date), toDate!));
        sPayments = sPayments.filter((p) => isBefore(new Date(p.payment_date), toDate!));
        sPurchases = sPurchases.filter((pur) => isBefore(new Date(pur.purchase_date), toDate!));
      }

      const total_delivered = sDeliveries.reduce((acc, d) => acc + (Number(d.total_value) || 0), 0) +
        sPurchases.reduce((acc, pur) => acc + (Number(pur.total_amount) || 0), 0);
      const total_paid = sPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0) +
        sPurchases.reduce((acc, pur) => acc + (Number(pur.payment_amount) || 0), 0);

      // Aggregate items brought
      const itemsMap = new Map<string, number>();
      
      // Legacy deliveries
      sDeliveries.forEach(d => {
        if (d.material_name) {
          itemsMap.set(d.material_name, (itemsMap.get(d.material_name) || 0) + Number(d.quantity || 0));
        }
      });
      
      // New purchases items
      sPurchases.forEach(pur => {
        const purItems = (data.purchaseItems || []).filter(pi => pi.purchase_id === pur.id);
        purItems.forEach(pi => {
          if (pi.item_name) {
            itemsMap.set(pi.item_name, (itemsMap.get(pi.item_name) || 0) + Number(pi.quantity || 0));
          }
        });
      });

      const itemsBrought = Array.from(itemsMap.entries()).map(([name, qty]) => `${qty} ${name}`).join(", ");

      return {
        ...s,
        total_delivered,
        total_paid,
        balance_due: total_delivered - total_paid,
        items_brought: itemsBrought
      };
    });
  }, [suppliers, data.deliveries, data.payments, data.purchases, data.purchaseItems, dateFilter, customFrom, customTo]);

  const filteredSummaries = useMemo(
    () =>
      computedSummaries.filter((s) => {
        // Text search
        const matchesSearch =
          s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (s.material_type?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
          (s.contact_person?.toLowerCase() || "").includes(searchTerm.toLowerCase());
        
        // Status filter
        if (filterStatus === "paid") return matchesSearch && s.balance_due <= 0 && s.total_delivered > 0;
        if (filterStatus === "unpaid") return matchesSearch && s.balance_due > 0;
        
        return matchesSearch;
      }),
    [computedSummaries, searchTerm, filterStatus]
  );

  const getStatusInfo = useMemo(() => (summary: SupplierSummary) => {
    if (summary.total_delivered === 0)
      return { label: "New", className: "bg-slate-100 text-slate-500" };
    if (summary.balance_due <= 0)
      return { label: "Paid", className: "bg-emerald-100 text-emerald-600" };
    if (summary.total_paid > 0)
      return { label: "Partial", className: "bg-amber-100 text-amber-600" };
    return { label: "Unpaid", className: "bg-red-100 text-red-600" };
  }, []);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto w-full animate-in fade-in duration-500">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#1a1a2e] tracking-tight">
            Suppliers
          </h1>
          <p className="text-sm text-[#64748b] font-medium mt-0.5">
            Manage your relationships and balances
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#64748b]" />
            <div className="flex bg-white rounded-lg border border-[#e2e8f0] p-0.5">
              <button
                onClick={() => setFilterStatus("all")}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
                  filterStatus === "all"
                    ? "bg-[#1a1a2e] text-white"
                    : "text-[#64748b] hover:bg-[#f8fafc]"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterStatus("paid")}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors flex items-center gap-1 ${
                  filterStatus === "paid"
                    ? "bg-emerald-500 text-white"
                    : "text-emerald-600 hover:bg-emerald-50"
                }`}
              >
                <CheckCircle className="w-3 h-3" /> Paid
              </button>
              <button
                onClick={() => setFilterStatus("unpaid")}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
                  filterStatus === "unpaid"
                    ? "bg-red-500 text-white"
                    : "text-red-500 hover:bg-red-50"
                }`}
              >
                Unpaid
              </button>
            </div>
          </div>
          <div className="relative flex-1 md:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748b]" />
            <Input
              placeholder="Search suppliers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full md:w-[200px] border-[#e2e8f0] bg-white"
            />
          </div>
          <Button
            onClick={openAddModal}
            className="bg-[#1a1a2e] hover:bg-[#2d2d44] text-white font-bold gap-2 shadow-lg min-h-[44px]"
          >
            <Plus className="w-4 h-4" /> Add New
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-3 rounded-lg border border-[#e2e8f0]">
        <div className="flex items-center gap-2 text-sm font-bold text-[#1a1a2e]">
          <Calendar className="w-4 h-4 text-[#f59e0b]" /> Date Range:
        </div>
        <Select value={dateFilter} onValueChange={(v: any) => setDateFilter(v)}>
          <SelectTrigger className="w-[150px] h-9">
            <SelectValue placeholder="All Time" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="1m">Last 1 Month</SelectItem>
            <SelectItem value="3m">Last 3 Months</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
        {dateFilter === "custom" && (
          <div className="flex items-center gap-2">
            <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="h-9 w-auto" />
            <span className="text-[#64748b]">to</span>
            <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="h-9 w-auto" />
          </div>
        )}
      </div>

      {/* Cards Grid */}
      {isLoading && summaries.length === 0 ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-[#f59e0b]" />
        </div>
      ) : filteredSummaries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-[#f8fafc] rounded-xl border-2 border-dashed border-[#e2e8f0]">
          <Package className="w-12 h-12 text-[#e2e8f0] mb-3" />
          <h3 className="text-lg font-bold text-[#64748b]">
            No suppliers found
          </h3>
          <p className="text-[#64748b] text-sm">
            Try adjusting your search or add a new supplier.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSummaries.map((summary) => {
            const status = getStatusInfo(summary);
            return (
              <div
                key={summary.id}
                className="bg-white border border-[#e2e8f0] rounded-xl shadow-sm hover:shadow-md transition-all p-5"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-[#1a1a2e] line-clamp-1">
                      {summary.name}
                    </h3>
                    {summary.balance_due <= 0 && summary.total_delivered > 0 && (
                      <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-xs font-bold px-2.5 py-1 rounded-full",
                      status.className
                    )}
                  >
                    {status.label}
                  </span>
                </div>

                <div className="space-y-1 text-sm text-[#64748b] mb-4">
                  {summary.contact_person && (
                    <p>{summary.contact_person}</p>
                  )}
                  {summary.phone && (
                    <p className="flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {summary.phone}
                    </p>
                  )}
                  <p>Material: {summary.material_type || "—"}</p>
                  {summary.items_brought && (
                    <div className="mt-2 p-2 bg-[#f8fafc] rounded text-xs text-[#1a1a2e] border border-[#e2e8f0]">
                      <span className="font-bold text-[#64748b]">Items Brought:</span> {summary.items_brought}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                  <div className="bg-[#f8fafc] rounded-lg p-2">
                    <div className="text-[10px] font-bold text-[#64748b] uppercase">
                      Delivered
                    </div>
                    <div className="text-sm font-bold text-[#1a1a2e] truncate">
                      {formatSAR(summary.total_delivered)}
                    </div>
                  </div>
                  <div className="bg-[#f8fafc] rounded-lg p-2">
                    <div className="text-[10px] font-bold text-[#64748b] uppercase">
                      Paid
                    </div>
                    <div className="text-sm font-bold text-emerald-600 truncate">
                      {formatSAR(summary.total_paid)}
                    </div>
                  </div>
                  <div className="bg-[#f8fafc] rounded-lg p-2">
                    <div className="text-[10px] font-bold text-[#64748b] uppercase">
                      Owed
                    </div>
                    <div
                      className={cn(
                        "text-sm font-bold truncate",
                        summary.balance_due > 0
                          ? "text-red-500"
                          : "text-emerald-600"
                      )}
                    >
                      {formatSAR(summary.balance_due)}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Link href={`/suppliers/${summary.id}`} className="flex-1">
                    <Button
                      variant="outline"
                      className="w-full border-[#e2e8f0] hover:bg-[#f8fafc] font-bold text-xs h-9 gap-1.5 min-h-[44px]"
                    >
                      <Eye className="w-3.5 h-3.5" /> View
                    </Button>
                  </Link>
                  <Button
                    onClick={() =>
                      setSelectedSupplierForUpdate({
                        id: summary.id,
                        name: summary.name,
                        balance: summary.balance_due,
                      })
                    }
                    className="flex-1 bg-[#f59e0b] hover:bg-amber-600 text-white font-bold text-xs h-9 gap-1.5 min-h-[44px]"
                  >
                    <Plus className="w-3.5 h-3.5" /> Update
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const original = suppliers.find(
                        (s) => s.id === summary.id
                      );
                      if (original) openEditModal(original);
                    }}
                    className="w-9 h-9 p-0 border-[#e2e8f0] hover:bg-[#f8fafc] min-h-[44px] min-w-[44px]"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setDeleteConfirm({ id: summary.id, name: summary.name })}
                    className="w-9 h-9 p-0 border-red-200 text-red-500 hover:bg-red-50 min-h-[44px] min-w-[44px]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-[#1a1a2e] p-5 text-white">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">
                {editingSupplier ? "Edit Supplier" : "Add New Supplier"}
              </DialogTitle>
              <p className="text-slate-400 text-sm mt-1">
                Fill in the company details below.
              </p>
            </DialogHeader>
          </div>
          <form
            onSubmit={handleSaveSupplier}
            className="p-5 bg-white space-y-4"
          >
            <div className="space-y-1.5">
              <Label
                htmlFor="cname"
                className="text-[#1a1a2e] text-sm font-medium"
              >
                Company Name *
              </Label>
              <Input
                id="cname"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  if (formErrors.name)
                    setFormErrors((p) => ({ ...p, name: false }));
                }}
                className={cn(
                  "border h-11",
                  formErrors.name
                    ? "border-red-400 ring-1 ring-red-400"
                    : "border-[#e2e8f0]"
                )}
                placeholder="e.g. Saudi Marble Ltd"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label
                  htmlFor="contact"
                  className="text-[#1a1a2e] text-sm font-medium"
                >
                  Contact Person
                </Label>
                <Input
                  id="contact"
                  value={formData.contact_person}
                  onChange={(e) =>
                    setFormData({ ...formData, contact_person: e.target.value })
                  }
                  className="border-[#e2e8f0] h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="phone"
                  className="text-[#1a1a2e] text-sm font-medium"
                >
                  Phone
                </Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  className="border-[#e2e8f0] h-11"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="mtype"
                className="text-[#1a1a2e] text-sm font-medium"
              >
                Material Type
              </Label>
              <Select
                value={formData.material_type}
                onValueChange={(v) =>
                  setFormData({ ...formData, material_type: v })
                }
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
              <Label
                htmlFor="notes"
                className="text-[#1a1a2e] text-sm font-medium"
              >
                Notes (optional)
              </Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                className="border-[#e2e8f0] min-h-[80px]"
                placeholder="Additional information..."
              />
            </div>
            <DialogFooter className="pt-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 font-bold h-11"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="flex-1 bg-[#f59e0b] hover:bg-amber-600 text-white font-bold h-11"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Save Supplier
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {selectedSupplierForUpdate && (
        <QuickUpdatePopup
          isOpen={!!selectedSupplierForUpdate}
          onClose={() => setSelectedSupplierForUpdate(null)}
          supplierId={selectedSupplierForUpdate.id}
          supplierName={selectedSupplierForUpdate.name}
          currentBalance={selectedSupplierForUpdate.balance}
          onSuccess={mutate}
        />
      )}

      {/* Delete Confirmation Modal */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-red-500 p-5 text-white">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">Delete Supplier?</DialogTitle>
            </DialogHeader>
          </div>
          <div className="p-5 bg-white space-y-4">
            <p className="text-sm text-[#64748b]">
              This will permanently delete <strong>{deleteConfirm?.name}</strong> and all their stock and payment records.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
              ⚠️ This action cannot be undone.
            </div>
            <DialogFooter className="pt-2 gap-2">
              <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="flex-1 font-bold h-11">
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  if (!deleteConfirm) return;
                  try {
                    const { error } = await supabase.from("suppliers").delete().eq("id", deleteConfirm.id);
                    if (error) throw error;
                    toast({ title: "Deleted", description: `${deleteConfirm.name} has been removed.` });
                    mutate();
                    setDeleteConfirm(null);
                  } catch (error: unknown) {
                    toast({
                      title: "Error",
                      description: (error as Error)?.message || "Failed to delete",
                      variant: "destructive",
                    });
                  }
                }}
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
