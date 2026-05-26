"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppData } from "@/hooks/use-data";
import { formatSAR, downloadExcel, downloadPDF } from "@/lib/format-utils";
import {
  Loader2,
  Download,
  FileText,
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Calendar,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ReportsPage() {
  const { data, isLoading } = useAppData();
  const { summaries, deliveries, purchases, purchaseItems } = data;
  const { toast } = useToast();
  
  const [search, setSearch] = useState("");
  const [reportMonth] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Flat list of all entries (Deliveries and Purchases)
  const allEntries = useMemo(() => {
    const supplierMap = new Map(summaries.map(s => [s.id, s.name]));
    const typeMap = new Map(summaries.map(s => [s.id, s.material_type]));

    const dRows = deliveries.map(d => ({
      id: `del-${d.id}`,
      date: d.delivery_date,
      type: "Delivery",
      supplier_name: supplierMap.get(d.supplier_id) || "Unknown",
      material: d.material_name || typeMap.get(d.supplier_id) || "N/A",
      quantity: `${d.quantity} ${d.unit}`,
      amount: Number(d.total_value)
    }));

    const pRows = (purchases || []).flatMap(p => {
      const pItems = (purchaseItems || []).filter(pi => pi.purchase_id === p.id);
      return pItems.map(pi => ({
        id: `pur-${pi.id}`,
        date: p.purchase_date,
        type: "Purchase",
        supplier_name: supplierMap.get(p.supplier_id) || "Unknown",
        material: pi.item_name,
        quantity: `${pi.quantity} pcs`,
        amount: Number(pi.total_price)
      }));
    });

    let combined = [...dRows, ...pRows].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    // Apply date range filter if set
    if (dateFrom && dateTo) {
      combined = combined.filter(row => {
        const rowDate = new Date(row.date);
        const fromDate = new Date(dateFrom);
        const toDate = new Date(dateTo);
        return rowDate >= fromDate && rowDate <= toDate;
      });
    } else if (reportMonth !== "all") {
      combined = combined.filter(row => row.date.startsWith(reportMonth));
    }

    if (search) {
      const sLower = search.toLowerCase();
      combined = combined.filter(row => 
        row.supplier_name.toLowerCase().includes(sLower) || 
        row.material.toLowerCase().includes(sLower) ||
        row.type.toLowerCase().includes(sLower)
      );
    }

    return combined;
  }, [deliveries, purchases, purchaseItems, summaries, reportMonth, search, dateFrom, dateTo]);

  const { stockReceived, paymentsMade, stillOwed } = useMemo(() => {
    const stock = summaries.reduce((acc, s) => acc + s.total_delivered, 0);
    const payments = summaries.reduce((acc, s) => acc + s.total_paid, 0);
    const owed = summaries.reduce((acc, s) => acc + Math.max(s.balance_due, 0), 0);
    return { stockReceived: stock, paymentsMade: payments, stillOwed: owed };
  }, [summaries]);

  const exportAllExcel = () => {
    const rows = allEntries.map((e) => ({
      "Date": e.date,
      "Supplier Name": e.supplier_name,
      "Type": e.type,
      "Material": e.material,
      "Quantity": e.quantity,
      "Amount (SAR)": e.amount,
    }));
    downloadExcel(rows, `Full-Entries-Report-${reportMonth === 'all' ? 'All' : reportMonth}`);
    toast({ title: "Excel Downloaded", description: "Full entries report saved." });
  };

  const exportAllPDF = () => {
    const headers = ["Date", "Supplier Name", "Type", "Material", "Quantity", "Amount (SAR)"];
    const rows = allEntries.map((e) => [
      e.date,
      e.supplier_name,
      e.type,
      e.material,
      e.quantity,
      formatSAR(e.amount),
    ]);
    downloadPDF(`SupplierTrack - Entries Report (${reportMonth === 'all' ? 'All Time' : reportMonth})`, headers, rows, `Entries-Report-${reportMonth === 'all' ? 'All' : reportMonth}`, [
      { label: "Total Entries", value: allEntries.length.toString() },
      { label: "Filtered Value", value: formatSAR(allEntries.reduce((a, b) => a + b.amount, 0)) },
    ]);
    toast({ title: "PDF Downloaded", description: "Full entries report saved." });
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
            <p className="text-sm text-[#8faac3]">Detailed log of all supplier entries</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportAllExcel} variant="outline"
            className="gap-2 border-emerald-700 text-emerald-400 hover:bg-emerald-900/30 bg-transparent font-bold">
            <Download className="w-4 h-4" /> Export Excel
          </Button>
          <Button onClick={exportAllPDF} variant="outline"
            className="gap-2 border-red-700 text-red-400 hover:bg-red-900/30 bg-transparent font-bold">
            <FileText className="w-4 h-4" /> Export PDF
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
              <span className="text-xs font-bold text-[#8faac3] uppercase tracking-wider">Stock Received (All)</span>
              <TrendingUp className="w-4 h-4 text-[#3b82f6]" />
            </div>
            <div className="text-2xl font-bold text-white">{formatSAR(stockReceived)}</div>
          </div>
          <div className="bg-[#121e36] border border-[#1e3464] rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-[#8faac3] uppercase tracking-wider">Payment Paid (All)</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400">{formatSAR(paymentsMade)}</div>
          </div>
          <div className="bg-[#121e36] border border-[#1e3464] rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Payment Remaining</span>
              <TrendingDown className="w-4 h-4 text-red-400" />
            </div>
            <div className="text-2xl font-bold text-red-400">{formatSAR(stillOwed)}</div>
          </div>
        </div>
      )}

      {/* Entries Table */}
      {!isLoading && (
        <div className="bg-[#121e36] border border-[#1e3464] rounded-xl overflow-hidden shadow-xl">
          <div className="px-5 py-4 bg-[#0a1422] border-b border-[#1e3464] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="font-bold text-white">Tabular Entries Log</h2>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              {/* Date Range Filter - Premium Look */}
              <div className="flex items-center gap-2 bg-gradient-to-r from-[#1e3464] to-[#162040] border border-[#3b82f6]/40 rounded-lg p-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#3b82f6]" />
                  <span className="text-xs font-bold text-[#8faac3] uppercase">From:</span>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="h-8 bg-[#0d1526] border-[#1e3464] text-[#e2e8f0] text-xs w-[130px]"
                  />
                </div>
                <div className="w-px h-6 bg-[#3b82f6]/30"></div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#8faac3] uppercase">To:</span>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="h-8 bg-[#0d1526] border-[#1e3464] text-[#e2e8f0] text-xs w-[130px]"
                  />
                </div>
              </div>
              {/* Search */}
              <input
                placeholder="Search supplier or material..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="px-3 py-1.5 bg-[#0d1526] border border-[#1e3464] rounded-lg text-sm text-[#e2e8f0] placeholder-[#8faac3] outline-none focus:border-[#3b82f6] w-[200px]"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            {allEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <BarChart3 className="w-10 h-10 text-[#1e3464] mb-3" />
                <p className="text-[#8faac3] text-sm">No entries found.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1e3464]">
                    <th className="text-left px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">#</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">Supplier Name</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">Material</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">Quantity</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {allEntries.map((e, idx) => (
                    <tr key={e.id} className="border-b border-[#1e3464]/50 hover:bg-[#162040] transition-colors">
                      <td className="px-4 py-3 text-[#8faac3] text-xs">{idx + 1}</td>
                      <td className="px-4 py-3 text-[#8faac3] whitespace-nowrap">{e.date}</td>
                      <td className="px-4 py-3 font-semibold text-white">{e.supplier_name}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-[#1e3464] text-[#8faac3] rounded text-xs">
                          {e.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white">{e.material}</td>
                      <td className="px-4 py-3 text-right text-[#e2e8f0]">{e.quantity}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-[#3b82f6]">
                        {formatSAR(e.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {allEntries.length > 0 && (
            <div className="px-5 py-3 bg-[#0a1422] border-t border-[#1e3464] flex items-center justify-between">
              <span className="text-xs text-[#8faac3]"><span className="text-white font-bold">{allEntries.length}</span> entries</span>
              <div className="flex gap-6">
                <div>
                  <span className="text-xs text-[#8faac3]">Filtered Amount: </span>
                  <span className="text-sm font-bold text-[#3b82f6]">
                    {formatSAR(allEntries.reduce((a, e) => a + e.amount, 0))}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
