"use client";

import React, { useState, useMemo } from "react";
import { useAppData } from "@/hooks/use-data";
import { formatSAR, downloadExcel } from "@/lib/format-utils";
import { Loader2, Download, Package, Search } from "lucide-react";
import { format } from "date-fns";

export default function StockPage() {
  const { data, isLoading } = useAppData();
  const { deliveries, suppliers, purchases, purchaseItems } = data;
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [search, setSearch] = useState("");

  const supplierMap = useMemo(
    () => new Map(suppliers.map((s) => [s.id, s.name])),
    [suppliers]
  );

  // Combine deliveries + purchase items into unified stock rows
  type StockRow = {
    id: string | number;
    date: string;
    supplier_id: string;
    supplier_name: string;
    material: string;
    quantity: number;
    unit: string;
    value: number;
    source: "delivery" | "purchase";
  };

  const allStockRows = useMemo(() => {
    // Legacy deliveries
    const deliveryRows: StockRow[] = deliveries.map((d) => ({
      id: d.id,
      date: d.delivery_date,
      supplier_id: d.supplier_id,
      supplier_name: supplierMap.get(d.supplier_id) || "Unknown",
      material: d.material_name,
      quantity: Number(d.quantity),
      unit: d.unit || "units",
      value: Number(d.total_value) || 0,
      source: "delivery",
    }));

    // Purchase items as stock rows
    const purchaseRows: StockRow[] = [];
    (purchases || []).forEach((pur) => {
      const purItems = (purchaseItems || []).filter((pi) => pi.purchase_id === pur.id);
      purItems.forEach((pi) => {
        purchaseRows.push({
          id: pi.id,
          date: pur.purchase_date,
          supplier_id: pur.supplier_id,
          supplier_name: supplierMap.get(pur.supplier_id) || "Unknown",
          material: pi.item_name,
          quantity: Number(pi.quantity),
          unit: "pcs",
          value: Number(pi.total_price) || 0,
          source: "purchase",
        });
      });
    });

    return [...deliveryRows, ...purchaseRows].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [deliveries, purchases, purchaseItems, supplierMap]);

  const { filteredRows, totalValue, totalQty } = useMemo(() => {
    const filtered = allStockRows.filter((row) => {
      const matchSupplier = supplierFilter === "all" || row.supplier_id === supplierFilter;
      const matchFrom = !dateFrom || new Date(row.date) >= new Date(dateFrom);
      const matchTo = !dateTo || new Date(row.date) <= new Date(dateTo);
      const matchSearch =
        !search ||
        row.material.toLowerCase().includes(search.toLowerCase()) ||
        row.supplier_name.toLowerCase().includes(search.toLowerCase());
      return matchSupplier && matchFrom && matchTo && matchSearch;
    });

    const total = filtered.reduce((acc, r) => acc + r.value, 0);
    const qty = filtered.reduce((acc, r) => acc + r.quantity, 0);
    return { filteredRows: filtered, totalValue: total, totalQty: qty };
  }, [allStockRows, supplierFilter, dateFrom, dateTo, search]);

  const exportToExcel = () => {
    const rows = filteredRows.map((r) => ({
      Date: format(new Date(r.date), "yyyy-MM-dd"),
      Supplier: r.supplier_name,
      Material: r.material,
      Quantity: r.quantity,
      Unit: r.unit.toUpperCase(),
      "Value (SAR)": r.value,
    }));
    rows.push({ Date: "TOTAL", Supplier: "", Material: "", Quantity: totalQty, Unit: "", "Value (SAR)": totalValue });
    downloadExcel(rows as never, "Stock-Report");
  };

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto w-full space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] flex items-center justify-center">
            <Package className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Stock Inventory</h1>
            <p className="text-sm text-[#8faac3]">Manage and track raw materials and finished goods</p>
          </div>
        </div>
        <button
          onClick={exportToExcel}
          className="flex items-center gap-2 px-4 py-2.5 border border-[#f59e0b]/60 text-[#f59e0b] hover:bg-[#f59e0b]/10 rounded-lg text-sm font-bold transition-all"
        >
          <Download className="w-4 h-4" /> Export to Excel
        </button>
      </div>

      {/* Filters Row */}
      <div className="bg-[#121e36] border border-[#1e3464] rounded-xl p-4 flex flex-col sm:flex-row items-center gap-3 flex-wrap">
        {/* Supplier Filter */}
        <div className="flex flex-col gap-1 min-w-[180px]">
          <label className="text-xs font-bold text-[#8faac3] uppercase tracking-wider">Supplier</label>
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="h-10 bg-[#0d1526] border border-[#1e3464] rounded-lg px-3 text-sm text-[#e2e8f0] outline-none focus:border-[#3b82f6]"
          >
            <option value="all">All Suppliers</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* Date From */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-[#8faac3] uppercase tracking-wider">Date From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-10 bg-[#0d1526] border border-[#1e3464] rounded-lg px-3 text-sm text-[#e2e8f0] outline-none focus:border-[#3b82f6]"
          />
        </div>

        {/* Date To */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-[#8faac3] uppercase tracking-wider">Date To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-10 bg-[#0d1526] border border-[#1e3464] rounded-lg px-3 text-sm text-[#e2e8f0] outline-none focus:border-[#3b82f6]"
          />
        </div>

        {/* Search */}
        <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
          <label className="text-xs font-bold text-[#8faac3] uppercase tracking-wider">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8faac3]" />
            <input
              placeholder="Material or supplier..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 h-10 bg-[#0d1526] border border-[#1e3464] rounded-lg text-sm text-[#e2e8f0] placeholder-[#8faac3] outline-none focus:border-[#3b82f6]"
            />
          </div>
        </div>

        {/* Reset */}
        {(dateFrom || dateTo || supplierFilter !== "all" || search) && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-transparent uppercase tracking-wider">Reset</label>
            <button
              onClick={() => { setDateFrom(""); setDateTo(""); setSupplierFilter("all"); setSearch(""); }}
              className="h-10 px-4 bg-[#1e3464] hover:bg-[#3b82f6] text-[#8faac3] hover:text-white rounded-lg text-sm font-bold transition-all"
            >
              Reset
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-[#121e36] border border-[#1e3464] rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-[#3b82f6]" />
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Package className="w-12 h-12 text-[#1e3464] mb-3" />
              <p className="text-[#8faac3] font-medium">No stock records found.</p>
              <p className="text-[#8faac3] text-sm mt-1">Try adjusting your filters.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#0a1422] border-b border-[#1e3464]">
                  <th className="text-left px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">#</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">Supplier</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">Material</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">Qty</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">Unit</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">Value (SAR)</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, idx) => (
                  <tr
                    key={row.id}
                    className="border-b border-[#1e3464]/50 hover:bg-[#162040] transition-colors"
                  >
                    <td className="px-4 py-3.5 text-[#8faac3] text-xs">{idx + 1}</td>
                    <td className="px-4 py-3.5 text-[#8faac3] text-xs whitespace-nowrap">
                      {format(new Date(row.date), "yyyy-MM-dd")}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-semibold text-white">{row.supplier_name}</span>
                    </td>
                    <td className="px-4 py-3.5 text-[#e2e8f0] capitalize">{row.material}</td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="font-mono font-bold text-white">{row.quantity.toFixed(2)}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs bg-[#1e3464] text-[#8faac3] px-2 py-0.5 rounded uppercase font-bold">
                        {row.unit}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-[#3b82f6]">
                      {formatSAR(row.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer Totals */}
        {filteredRows.length > 0 && (
          <div className="px-5 py-4 bg-[#0a1422] border-t border-[#1e3464] flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="text-sm text-[#8faac3]">
              Showing <span className="text-white font-bold">{filteredRows.length}</span> of{" "}
              <span className="text-white font-bold">{allStockRows.length}</span> entries
            </div>
            <div className="flex items-center gap-6">
              <div>
                <span className="text-xs font-bold text-[#8faac3] uppercase tracking-wider">Total Volume: </span>
                <span className="text-sm font-bold text-white">{totalQty.toFixed(2)} Mixed</span>
              </div>
              <div className="h-4 w-px bg-[#1e3464]" />
              <div>
                <span className="text-xs font-bold text-[#8faac3] uppercase tracking-wider">Total Value: </span>
                <span className="text-xl font-bold text-[#3b82f6]">{formatSAR(totalValue)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
