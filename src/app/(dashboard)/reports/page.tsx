"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAppData } from "@/hooks/use-data";
import { formatSAR, downloadExcel, downloadPDF } from "@/lib/format-utils";
import { Loader2, AlertCircle, Download, CreditCard, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ReportsPage() {
  const { data, isLoading } = useAppData();
  const { summaries } = data;
  const { toast } = useToast();

  // Memoize all calculations to prevent recalculation on every render
  const { stockReceived, paymentsMade, stillOwed, topDebtors } = useMemo(() => {
    const stock = summaries.reduce((acc, s) => acc + s.total_delivered, 0);
    const payments = summaries.reduce((acc, s) => acc + s.total_paid, 0);
    const owed = summaries.reduce((acc, s) => acc + s.balance_due, 0);
    const debtors = [...summaries]
      .filter((s) => s.balance_due > 0)
      .sort((a, b) => b.balance_due - a.balance_due)
      .slice(0, 5);
    return { stockReceived: stock, paymentsMade: payments, stillOwed: owed, topDebtors: debtors };
  }, [summaries]);

  const exportExcel = () => {
    const data = summaries.map((s) => ({
      "Supplier Name": s.name,
      Material: s.material_type || "N/A",
      "Total Delivered (SAR)": s.total_delivered,
      "Total Paid (SAR)": s.total_paid,
      "Balance Due (SAR)": s.balance_due,
      Status: s.balance_due > 0 ? "Unpaid" : "Settled",
    }));
    downloadExcel(data, "Full-Report");
    toast({ title: "Excel Downloaded", description: "Full report saved to your device." });
  };

  const exportPDF = () => {
    const headers = ["Supplier Name", "Material", "Total Delivered", "Total Paid", "Balance Due", "Status"];
    const data = summaries.map((s) => [
      s.name,
      s.material_type || "N/A",
      formatSAR(s.total_delivered),
      formatSAR(s.total_paid),
      formatSAR(s.balance_due),
      s.balance_due > 0 ? "Unpaid" : "Settled",
    ]);
    
    downloadPDF(
      "SupplierTrack - Full Report",
      headers,
      data,
      "Full-Report",
      [
        { label: "Total Suppliers", value: summaries.length.toString() },
        { label: "Stock Received", value: formatSAR(stockReceived) },
        { label: "Payments Made", value: formatSAR(paymentsMade) },
        { label: "Still Owed", value: formatSAR(stillOwed) },
      ]
    );
    toast({ title: "PDF Downloaded", description: "Full report saved to your device." });
  };

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#1a1a2e]">
            Reports
          </h1>
          <p className="text-sm text-[#64748b] mt-0.5">
            Simple numbers — no charts
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={exportExcel}
            variant="outline"
            className="gap-2 border-[#10b981] text-[#10b981] hover:bg-emerald-50 font-bold min-h-[44px]"
          >
            <Download className="w-4 h-4" /> Excel
          </Button>
          <Button
            onClick={exportPDF}
            variant="outline"
            className="gap-2 border-red-400 text-red-500 hover:bg-red-50 font-bold min-h-[44px]"
          >
            <FileText className="w-4 h-4" /> PDF
          </Button>
        </div>
      </div>

      {/* 3 Big Numbers */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-10 h-10 animate-spin text-[#f59e0b]" />
        </div>
      ) : (
        <div className="bg-white border border-[#e2e8f0] rounded-xl shadow-sm p-6 md:p-8 space-y-6">
          <h2 className="text-sm font-bold text-[#1a1a2e] uppercase tracking-wider">
            This Month Summary
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <div className="text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1">
                Stock received
              </div>
              <div className="text-2xl md:text-3xl font-bold text-[#1a1a2e]">
                {formatSAR(stockReceived)}
              </div>
            </div>
            <div>
              <div className="text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1">
                Payments made
              </div>
              <div className="text-2xl md:text-3xl font-bold text-[#1a1a2e]">
                {formatSAR(paymentsMade)}
              </div>
            </div>
            <div>
              <div className="text-xs font-bold text-red-500 uppercase tracking-wider mb-1">
                Still owed
              </div>
              <div className="text-2xl md:text-3xl font-bold text-red-500">
                {formatSAR(stillOwed)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top 5 Debtors */}
      {!isLoading && topDebtors.length > 0 && (
        <div className="bg-white border border-[#e2e8f0] rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#1a1a2e] uppercase tracking-wider flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500" /> Top suppliers
              with highest balance due
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {topDebtors.map((s, i) => (
                  <tr
                    key={s.id}
                    className="border-b border-[#e2e8f0] hover:bg-[#f8fafc] transition-colors"
                  >
                    <td className="px-5 py-3.5 w-8">
                      <span className="font-bold text-[#64748b]">{i + 1}.</span>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-[#1a1a2e]">
                      {s.name}
                    </td>
                    <td className="px-5 py-3.5 text-right font-bold text-red-500">
                      {formatSAR(s.balance_due)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link href={`/suppliers/${s.id}`}>
                        <Button
                          variant="outline"
                          className="border-[#10b981] text-[#10b981] hover:bg-emerald-50 font-bold text-xs h-8 px-3"
                        >
                          Pay Now
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!isLoading && topDebtors.length === 0 && (
        <div className="bg-white border border-[#e2e8f0] rounded-xl shadow-sm p-8 text-center">
          <CreditCard className="w-12 h-12 text-[#e2e8f0] mx-auto mb-3" />
          <p className="text-[#64748b] font-medium text-sm">
            All suppliers are paid up! No balances due.
          </p>
        </div>
      )}
    </div>
  );
}
