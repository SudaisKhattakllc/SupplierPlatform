"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAppData } from "@/hooks/use-data";
import { formatSAR } from "@/lib/format-utils";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Users, Package, Wallet, AlertCircle, Plus, Trash2, CheckCircle, Filter } from "lucide-react";
import QuickUpdatePopup from "@/components/QuickUpdatePopup";

export default function DashboardPage() {
  const { data, isLoading, mutate } = useAppData();
  const { summaries } = data;
  const { toast } = useToast();

  const [selectedSupplier, setSelectedSupplier] = useState<{
    id: string;
    name: string;
    balance: number;
  } | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Filter state: 'all' | 'paid' | 'unpaid'
  const [filterStatus, setFilterStatus] = useState<"all" | "paid" | "unpaid">("all");

  // Memoize calculations to prevent recalculation on every render
  const stats = useMemo(() => {
    const totalSuppliers = summaries.length;
    const totalStockValue = summaries.reduce((a, s) => a + s.total_delivered, 0);
    const totalPaid = summaries.reduce((a, s) => a + s.total_paid, 0);
    const outstandingBalance = totalStockValue - totalPaid;
    return { totalSuppliers, totalStockValue, totalPaid, outstandingBalance };
  }, [summaries]);

  const { totalSuppliers, totalStockValue, totalPaid, outstandingBalance } = stats;

  // Filter suppliers based on status
  const filteredSummaries = useMemo(() => {
    return summaries.filter((s) => {
      if (filterStatus === "paid") return s.balance_due <= 0 && s.total_delivered > 0;
      if (filterStatus === "unpaid") return s.balance_due > 0;
      return true;
    });
  }, [summaries, filterStatus]);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto w-full animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#1a1a2e] tracking-tight">
            Dashboard
          </h1>
          <p className="text-sm text-[#64748b] font-medium mt-0.5">
            Everything at a glance
          </p>
        </div>
      </div>

      {/* Stats Grid - 4 big cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-[#64748b] uppercase tracking-wider">
              Suppliers
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#f8fafc] flex items-center justify-center">
              <Users className="w-4 h-4 text-[#1a1a2e]" />
            </div>
          </div>
          <div className="text-3xl font-bold text-[#1a1a2e]">
            {totalSuppliers}
          </div>
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-[#64748b] uppercase tracking-wider">
              Total Stock
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <Package className="w-4 h-4 text-amber-600" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-bold text-[#1a1a2e] truncate">
            {formatSAR(totalStockValue)}
          </div>
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-[#64748b] uppercase tracking-wider">
              Total Paid
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-bold text-[#1a1a2e] truncate">
            {formatSAR(totalPaid)}
          </div>
        </div>

        <div className="bg-white border border-red-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-red-500 uppercase tracking-wider">
              STILL OWED
            </span>
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-red-500" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-bold text-red-500 truncate">
            {formatSAR(outstandingBalance)}
          </div>
        </div>
      </div>

      {/* Supplier List Table */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#e2e8f0] bg-[#f8fafc] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-[#1a1a2e] uppercase tracking-wider flex items-center gap-2">
            <Users className="w-4 h-4 text-[#f59e0b]" /> Suppliers
            <span className="text-xs font-normal text-[#64748b] bg-white px-2 py-0.5 rounded-full border">
              {filteredSummaries.length}
            </span>
          </h2>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#64748b]" />
            <div className="flex bg-white rounded-lg border border-[#e2e8f0] p-0.5">
              <button
                onClick={() => setFilterStatus("all")}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                  filterStatus === "all"
                    ? "bg-[#f59e0b] text-white"
                    : "text-[#64748b] hover:bg-[#f8fafc]"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterStatus("paid")}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-colors flex items-center gap-1 ${
                  filterStatus === "paid"
                    ? "bg-emerald-500 text-white"
                    : "text-emerald-600 hover:bg-emerald-50"
                }`}
              >
                <CheckCircle className="w-3 h-3" /> Paid
              </button>
              <button
                onClick={() => setFilterStatus("unpaid")}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                  filterStatus === "unpaid"
                    ? "bg-red-500 text-white"
                    : "text-red-500 hover:bg-red-50"
                }`}
              >
                Unpaid
              </button>
            </div>
          </div>
        </div>
        <div className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-[#f59e0b]" />
            </div>
          ) : filteredSummaries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-[#64748b]">
              <Package className="w-12 h-12 mb-3 opacity-20" />
              <p className="font-medium text-sm">
                No suppliers yet — add your first one
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#f8fafc]">
                  <tr>
                    <th className="text-left px-5 py-3 font-bold text-[#1a1a2e] text-xs">
                      Name
                    </th>
                    <th className="text-left px-5 py-3 font-bold text-[#1a1a2e] text-xs">
                      Material
                    </th>
                    <th className="text-right px-5 py-3 font-bold text-[#1a1a2e] text-xs">
                      Owed Amount
                    </th>
                    <th className="text-right px-5 py-3 font-bold text-[#1a1a2e] text-xs">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSummaries.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-[#e2e8f0] hover:bg-[#f8fafc] transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[#1a1a2e]">
                            {item.name}
                          </span>
                          {item.balance_due <= 0 && item.total_delivered > 0 && (
                            <CheckCircle className="w-4 h-4 text-emerald-500" />
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-[#64748b]">
                          {item.material_type || "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span
                          className={`font-bold ${
                            item.balance_due > 0
                              ? "text-red-500"
                              : "text-emerald-500"
                          }`}
                        >
                          {formatSAR(item.balance_due)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            onClick={() =>
                              setSelectedSupplier({
                                id: item.id,
                                name: item.name,
                                balance: item.balance_due,
                              })
                            }
                            className="bg-[#f59e0b] hover:bg-amber-600 text-white font-bold text-xs h-8 gap-1 shadow-sm px-3"
                          >
                            <Plus className="w-3.5 h-3.5" /> Update
                          </Button>
                          <Button
                            onClick={() => setDeleteConfirm({ id: item.id, name: item.name })}
                            variant="outline"
                            className="border-red-200 text-red-500 hover:bg-red-50 font-bold text-xs h-8 px-2"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selectedSupplier && (
        <QuickUpdatePopup
          isOpen={!!selectedSupplier}
          onClose={() => setSelectedSupplier(null)}
          supplierId={selectedSupplier.id}
          supplierName={selectedSupplier.name}
          currentBalance={selectedSupplier.balance}
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
              This will permanently delete <strong>{deleteConfirm?.name}</strong> and all their records.
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
