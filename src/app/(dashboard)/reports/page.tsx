"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useAppData } from "@/hooks/use-data";
import { formatSAR, downloadExcel, downloadPDF } from "@/lib/format-utils";
import {
  Loader2,
  Download,
  FileText,
  BarChart3,
  Eye,
  X,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SupplierSummary } from "@/types";
import { cn } from "@/lib/utils";

export default function ReportsPage() {
  const { data, isLoading } = useAppData();
  const { summaries } = data;
  const { toast } = useToast();
  const [viewingSupplier, setViewingSupplier] = useState<SupplierSummary | null>(null);
  const [search, setSearch] = useState("");

  const { stockReceived, paymentsMade, stillOwed } = useMemo(() => {
    const stock = summaries.reduce((acc, s) => acc + s.total_delivered, 0);
    const payments = summaries.reduce((acc, s) => acc + s.total_paid, 0);
    const owed = summaries.reduce((acc, s) => acc + s.balance_due, 0);
    return { stockReceived: stock, paymentsMade: payments, stillOwed: owed };
  }, [summaries]);

  const filtered = useMemo(() =>
    summaries.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.material_type || "").toLowerCase().includes(search.toLowerCase())),
    [summaries, search]
  );

  const exportAllExcel = () => {
    const rows = summaries.map((s) => ({
      "Supplier Name": s.name,
      Material: s.material_type || "N/A",
      "Total Delivered (SAR)": s.total_delivered,
      "Total Paid (SAR)": s.total_paid,
      "Balance Due (SAR)": s.balance_due,
      Status: s.balance_due > 0 ? "Unpaid" : "Settled",
    }));
    downloadExcel(rows, "Full-Report");
    toast({ title: "Excel Downloaded", description: "Full report saved." });
  };

  const exportAllPDF = () => {
    const headers = ["Supplier Name", "Material", "Total Delivered", "Total Paid", "Balance Due", "Status"];
    const rows = summaries.map((s) => [
      s.name, s.material_type || "N/A",
      formatSAR(s.total_delivered), formatSAR(s.total_paid),
      formatSAR(s.balance_due), s.balance_due > 0 ? "Unpaid" : "Settled",
    ]);
    downloadPDF("SupplierTrack - Full Report", headers, rows, "Full-Report", [
      { label: "Total Suppliers", value: summaries.length.toString() },
      { label: "Stock Received", value: formatSAR(stockReceived) },
      { label: "Payments Made", value: formatSAR(paymentsMade) },
      { label: "Still Owed", value: formatSAR(stillOwed) },
    ]);
    toast({ title: "PDF Downloaded", description: "Full report saved." });
  };

  const downloadSupplierPDF = (s: SupplierSummary) => {
    const headers = ["Metric", "Value"];
    const rows = [
      ["Supplier Name", s.name],
      ["Material Type", s.material_type || "N/A"],
      ["Contact Person", s.contact_person || "N/A"],
      ["Phone", s.phone || "N/A"],
      ["Total Delivered", formatSAR(s.total_delivered)],
      ["Total Paid", formatSAR(s.total_paid)],
      ["Balance Due", formatSAR(s.balance_due)],
      ["Status", s.balance_due > 0 ? "Unpaid" : "Settled"],
    ];
    downloadPDF(`SupplierTrack - ${s.name}`, headers, rows, `Report-${s.name.replace(/\s+/g, "-")}`);
    toast({ title: "PDF Downloaded", description: `Report for ${s.name} saved.` });
  };

  const downloadSupplierExcel = (s: SupplierSummary) => {
    const rows = [{
      "Supplier Name": s.name,
      "Material Type": s.material_type || "N/A",
      "Contact Person": s.contact_person || "N/A",
      "Phone": s.phone || "N/A",
      "Total Delivered (SAR)": s.total_delivered,
      "Total Paid (SAR)": s.total_paid,
      "Balance Due (SAR)": s.balance_due,
      "Status": s.balance_due > 0 ? "Unpaid" : "Settled",
    }];
    downloadExcel(rows, `Report-${s.name.replace(/\s+/g, "-")}`);
    toast({ title: "Excel Downloaded", description: `Report for ${s.name} saved.` });
  };

  const getStatus = (s: SupplierSummary) => {
    if (s.total_delivered === 0) return { label: "New", cls: "bg-[#1e3464] text-[#8faac3]" };
    if (s.balance_due <= 0) return { label: "Settled", cls: "bg-emerald-900/60 text-emerald-400" };
    if (s.total_paid > 0) return { label: "Partial", cls: "bg-amber-900/60 text-amber-400" };
    return { label: "Unpaid", cls: "bg-red-900/60 text-red-400" };
  };

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto w-full space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Reports</h1>
            <p className="text-sm text-[#8faac3]">Complete financial overview of all suppliers</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportAllExcel} variant="outline"
            className="gap-2 border-emerald-700 text-emerald-400 hover:bg-emerald-900/30 bg-transparent font-bold">
            <Download className="w-4 h-4" /> Export All Excel
          </Button>
          <Button onClick={exportAllPDF} variant="outline"
            className="gap-2 border-red-700 text-red-400 hover:bg-red-900/30 bg-transparent font-bold">
            <FileText className="w-4 h-4" /> Export All PDF
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-10 h-10 animate-spin text-[#3b82f6]" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#121e36] border border-[#1e3464] rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-[#8faac3] uppercase tracking-wider">Total Suppliers</span>
              <Users className="w-4 h-4 text-[#3b82f6]" />
            </div>
            <div className="text-2xl font-bold text-white">{summaries.length}</div>
          </div>
          <div className="bg-[#121e36] border border-[#1e3464] rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-[#8faac3] uppercase tracking-wider">Stock Received</span>
              <TrendingUp className="w-4 h-4 text-[#3b82f6]" />
            </div>
            <div className="text-2xl font-bold text-white">{formatSAR(stockReceived)}</div>
          </div>
          <div className="bg-[#121e36] border border-[#1e3464] rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-[#8faac3] uppercase tracking-wider">Payments Made</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400">{formatSAR(paymentsMade)}</div>
          </div>
          <div className="bg-[#121e36] border border-[#1e3464] rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Still Owed</span>
              <TrendingDown className="w-4 h-4 text-red-400" />
            </div>
            <div className="text-2xl font-bold text-red-400">{formatSAR(stillOwed)}</div>
          </div>
        </div>
      )}

      {/* Suppliers Table */}
      {!isLoading && (
        <div className="bg-[#121e36] border border-[#1e3464] rounded-xl overflow-hidden shadow-xl">
          <div className="px-5 py-4 bg-[#0a1422] border-b border-[#1e3464] flex items-center justify-between gap-3">
            <h2 className="font-bold text-white">All Suppliers — Detailed Report</h2>
            <input
              placeholder="Search suppliers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-3 py-1.5 bg-[#0d1526] border border-[#1e3464] rounded-lg text-sm text-[#e2e8f0] placeholder-[#8faac3] outline-none focus:border-[#3b82f6] w-[200px]"
            />
          </div>
          <div className="overflow-x-auto">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <BarChart3 className="w-10 h-10 text-[#1e3464] mb-3" />
                <p className="text-[#8faac3] text-sm">No suppliers found.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1e3464]">
                    <th className="text-left px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">#</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">Supplier Name</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">Material</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">Total Delivered</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">Total Paid</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">Balance Due</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">Status</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s, idx) => {
                    const status = getStatus(s);
                    return (
                      <tr key={s.id} className="border-b border-[#1e3464]/50 hover:bg-[#162040] transition-colors">
                        <td className="px-4 py-3.5 text-[#8faac3] text-xs">{idx + 1}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-[#1e3464] flex items-center justify-center text-[#3b82f6] text-xs font-bold flex-shrink-0">
                              {s.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-semibold text-white">{s.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          {s.material_type
                            ? <span className="px-2 py-0.5 bg-[#1e3464] text-[#8faac3] rounded text-xs">{s.material_type}</span>
                            : <span className="text-[#8faac3]">—</span>}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono text-[#e2e8f0]">{formatSAR(s.total_delivered)}</td>
                        <td className="px-4 py-3.5 text-right font-mono text-emerald-400">{formatSAR(s.total_paid)}</td>
                        <td className="px-4 py-3.5 text-right font-mono font-bold">
                          <span className={s.balance_due > 0 ? "text-red-400" : "text-emerald-400"}>
                            {formatSAR(s.balance_due)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className={cn("text-xs font-bold px-2.5 py-1 rounded-full", status.cls)}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setViewingSupplier(s)}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-[#1e3464] hover:bg-[#3b82f6] text-[#8faac3] hover:text-white rounded-lg text-xs font-bold transition-all"
                            >
                              <Eye className="w-3 h-3" /> View
                            </button>
                            <button
                              onClick={() => downloadSupplierExcel(s)}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-900/30 hover:bg-emerald-700 text-emerald-400 hover:text-white rounded-lg text-xs font-bold transition-all"
                              title="Download Excel"
                            >
                              <Download className="w-3 h-3" /> XLS
                            </button>
                            <button
                              onClick={() => downloadSupplierPDF(s)}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-red-900/30 hover:bg-red-700 text-red-400 hover:text-white rounded-lg text-xs font-bold transition-all"
                              title="Download PDF"
                            >
                              <FileText className="w-3 h-3" /> PDF
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
          {filtered.length > 0 && (
            <div className="px-5 py-3 bg-[#0a1422] border-t border-[#1e3464] flex items-center justify-between">
              <span className="text-xs text-[#8faac3]"><span className="text-white font-bold">{filtered.length}</span> suppliers</span>
              <div className="flex gap-6">
                <div><span className="text-xs text-[#8faac3]">Total Delivered: </span><span className="text-sm font-bold text-white">{formatSAR(filtered.reduce((a, s) => a + s.total_delivered, 0))}</span></div>
                <div><span className="text-xs text-[#8faac3]">Total Paid: </span><span className="text-sm font-bold text-emerald-400">{formatSAR(filtered.reduce((a, s) => a + s.total_paid, 0))}</span></div>
                <div><span className="text-xs text-red-400">Total Owed: </span><span className="text-sm font-bold text-red-400">{formatSAR(filtered.reduce((a, s) => a + s.balance_due, 0))}</span></div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Supplier Detail Modal */}
      {viewingSupplier && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setViewingSupplier(null)}>
          <div className="bg-[#121e36] border border-[#1e3464] rounded-2xl shadow-2xl w-full max-w-[520px]" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-5 bg-[#0a1422] rounded-t-2xl border-b border-[#1e3464]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] flex items-center justify-center text-white font-bold">
                  {viewingSupplier.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg">{viewingSupplier.name}</h3>
                  <p className="text-xs text-[#8faac3]">{viewingSupplier.material_type || "No material type"}</p>
                </div>
              </div>
              <button onClick={() => setViewingSupplier(null)} className="w-8 h-8 rounded-lg bg-[#1e3464] hover:bg-red-900/50 text-[#8faac3] hover:text-red-400 transition-all flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#0d1526] border border-[#1e3464] rounded-xl p-4">
                  <div className="text-xs text-[#8faac3] uppercase tracking-wider mb-1">Contact</div>
                  <div className="text-sm font-semibold text-white">{viewingSupplier.contact_person || "—"}</div>
                </div>
                <div className="bg-[#0d1526] border border-[#1e3464] rounded-xl p-4">
                  <div className="text-xs text-[#8faac3] uppercase tracking-wider mb-1">Phone</div>
                  <div className="text-sm font-semibold text-white">{viewingSupplier.phone || "—"}</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#0d1526] border border-[#1e3464] rounded-xl p-4 text-center">
                  <div className="text-xs text-[#8faac3] uppercase tracking-wider mb-2">Delivered</div>
                  <div className="text-lg font-bold text-white">{formatSAR(viewingSupplier.total_delivered)}</div>
                </div>
                <div className="bg-[#0d1526] border border-emerald-800/50 rounded-xl p-4 text-center">
                  <div className="text-xs text-emerald-400 uppercase tracking-wider mb-2">Paid</div>
                  <div className="text-lg font-bold text-emerald-400">{formatSAR(viewingSupplier.total_paid)}</div>
                </div>
                <div className={cn("bg-[#0d1526] border rounded-xl p-4 text-center", viewingSupplier.balance_due > 0 ? "border-red-800/50" : "border-emerald-800/50")}>
                  <div className={cn("text-xs uppercase tracking-wider mb-2", viewingSupplier.balance_due > 0 ? "text-red-400" : "text-emerald-400")}>Balance</div>
                  <div className={cn("text-lg font-bold", viewingSupplier.balance_due > 0 ? "text-red-400" : "text-emerald-400")}>
                    {formatSAR(viewingSupplier.balance_due)}
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#8faac3]">Status:</span>
                <span className={cn("text-xs font-bold px-3 py-1 rounded-full", getStatus(viewingSupplier).cls)}>
                  {getStatus(viewingSupplier).label}
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex gap-2 px-6 pb-6">
              <button onClick={() => downloadSupplierExcel(viewingSupplier)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-900/30 hover:bg-emerald-700 border border-emerald-700/50 text-emerald-400 hover:text-white rounded-xl text-sm font-bold transition-all">
                <Download className="w-4 h-4" /> Download Excel
              </button>
              <button onClick={() => downloadSupplierPDF(viewingSupplier)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-900/30 hover:bg-red-700 border border-red-700/50 text-red-400 hover:text-white rounded-xl text-sm font-bold transition-all">
                <FileText className="w-4 h-4" /> Download PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
