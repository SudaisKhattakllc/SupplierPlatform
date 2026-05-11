"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppData } from "@/hooks/use-data";
import { Delivery } from "@/types";
import { formatSAR, downloadExcel } from "@/lib/format-utils";
import { Loader2, Download, Package } from "lucide-react";
import { format } from "date-fns";

export default function StockPage() {
  const { data, isLoading } = useAppData();
  const { deliveries, suppliers } = data;
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Memoize data processing to prevent recalculation on every render
  const { filteredDeliveries, totalValue } = useMemo(() => {
    // Enrich deliveries with supplier names using lookup map for O(1) performance
    const supplierMap = new Map(suppliers.map((s) => [s.id, s.name]));
    const enriched = deliveries.map((d) => ({
      ...d,
      supplier_name: supplierMap.get(d.supplier_id) || "Unknown",
    }));

    const filtered = enriched.filter((d) => {
      const matchFrom =
        !dateFrom || new Date(d.delivery_date) >= new Date(dateFrom);
      const matchTo = !dateTo || new Date(d.delivery_date) <= new Date(dateTo);
      return matchFrom && matchTo;
    });

    const total = filtered.reduce(
      (acc: number, curr: Delivery) => acc + (Number(curr.total_value) || 0),
      0
    );

    return { enrichedDeliveries: enriched, filteredDeliveries: filtered, totalValue: total };
  }, [deliveries, suppliers, dateFrom, dateTo]);

  const exportToExcel = () => {
    const data = filteredDeliveries.map((d) => ({
      Date: format(new Date(d.delivery_date), "yyyy-MM-dd"),
      Supplier: d.supplier_name || "Unknown",
      Material: d.material_name,
      Quantity: `${d.quantity} ${d.unit}`,
      "Unit Price (SAR)": Number(d.unit_price),
      "Total Value (SAR)": Number(d.total_value),
    }));
    data.push({
      Date: "TOTAL",
      Supplier: "",
      Material: "",
      Quantity: "",
      "Unit Price (SAR)": 0,
      "Total Value (SAR)": totalValue,
    });
    downloadExcel(data, "Stock-Report");
  };

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#1a1a2e]">
            Stock
          </h1>
          <p className="text-sm text-[#64748b] mt-0.5">
            All material deliveries from suppliers
          </p>
        </div>
        <Button
          onClick={exportToExcel}
          variant="outline"
          className="gap-2 border-[#f59e0b] text-[#f59e0b] hover:bg-amber-50 font-bold min-h-[44px]"
        >
          <Download className="w-4 h-4" /> Download Excel
        </Button>
      </div>

      {/* Date Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex-1 sm:flex-none">
            <Label className="text-xs font-bold text-[#64748b] uppercase tracking-wider block mb-1">
              From
            </Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="border-[#e2e8f0] h-11"
            />
          </div>
          <div className="flex-1 sm:flex-none">
            <Label className="text-xs font-bold text-[#64748b] uppercase tracking-wider block mb-1">
              To
            </Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="border-[#e2e8f0] h-11"
            />
          </div>
        </div>
        <Button
          variant="ghost"
          onClick={() => {
            setDateFrom("");
            setDateTo("");
          }}
          className="text-[#64748b] min-h-[44px]"
        >
          Clear
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-[#f59e0b]" />
            </div>
          ) : filteredDeliveries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-[#64748b]">
              <Package className="w-12 h-12 mb-3 opacity-20" />
              <p className="font-medium text-sm">No stock records found.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[#f8fafc]">
                <tr>
                  <th className="text-left px-5 py-3 font-bold text-[#1a1a2e] text-xs">
                    Date
                  </th>
                  <th className="text-left px-5 py-3 font-bold text-[#1a1a2e] text-xs">
                    Supplier
                  </th>
                  <th className="text-left px-5 py-3 font-bold text-[#1a1a2e] text-xs">
                    Material
                  </th>
                  <th className="text-right px-5 py-3 font-bold text-[#1a1a2e] text-xs">
                    Qty
                  </th>
                  <th className="text-right px-5 py-3 font-bold text-[#1a1a2e] text-xs">
                    Value
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredDeliveries.map((d) => (
                  <tr
                    key={d.id}
                    className="border-b border-[#e2e8f0] hover:bg-[#f8fafc] transition-colors"
                  >
                    <td className="px-5 py-3.5 text-[#64748b] text-xs">
                      {format(new Date(d.delivery_date), "dd MMM yyyy")}
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-[#1a1a2e]">
                      {(d as Delivery & { supplier_name?: string }).supplier_name || "Unknown"}
                    </td>
                    <td className="px-5 py-3.5 text-[#1a1a2e]">
                      {d.material_name}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {d.quantity}{" "}
                      <span className="text-[#64748b] text-xs uppercase">
                        {d.unit}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-bold text-[#1a1a2e]">
                      {formatSAR(Number(d.total_value) || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer Total */}
        <div className="px-5 py-4 bg-[#f8fafc] border-t border-[#e2e8f0] flex justify-between items-center">
          <div className="text-sm text-[#64748b]">
            {filteredDeliveries.length} entries
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-[#64748b] uppercase tracking-wider">
              Total Value:
            </span>
            <span className="text-xl font-bold text-[#1a1a2e]">
              {formatSAR(totalValue)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
