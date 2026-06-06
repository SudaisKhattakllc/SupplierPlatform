"use client";

import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppData } from "@/hooks/use-data";
import { formatSAR, downloadExcel, downloadPDF } from "@/lib/format-utils";
import {
  BarChart3,
  Calendar,
  Download,
  FileText,
  Loader2,
  Package,
  UserRound,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

type StatementRow = {
  id: string;
  date: string;
  supplier_id: string;
  supplier_name: string;
  item: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_amount: number;
  payment_method: string;
  payment_amount: number;
  running_balance: number;
};

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 8 }, (_, index) => String(currentYear - index));
const months = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const formatDate = (date: string) => format(new Date(date), "dd/MM/yyyy");
const dateStamp = (label: string) => label.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");

export default function ReportsPage() {
  const { data, isLoading } = useAppData();
  const { suppliers, deliveries, payments, purchases, purchaseItems } = data;
  const { toast } = useToast();

  const [supplierFilter, setSupplierFilter] = useState("all");
  const [periodType, setPeriodType] = useState<"all" | "year" | "month" | "custom">("year");
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1).padStart(2, "0"));
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [search, setSearch] = useState("");
  const [supplierSearch, setSupplierSearch] = useState("");
  const [isSupplierMenuOpen, setIsSupplierMenuOpen] = useState(false);

  const supplierMap = useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers]);
  const filteredSuppliers = useMemo(() => {
    const query = supplierSearch.trim().toLowerCase();
    if (!query) return suppliers;
    return suppliers.filter((supplier) =>
      supplier.name.toLowerCase().includes(query) ||
      (supplier.material_type || "").toLowerCase().includes(query)
    );
  }, [supplierSearch, suppliers]);

  const period = useMemo(() => {
    if (periodType === "all") return { from: "", to: "", label: "All Time" };
    if (periodType === "year") {
      return { from: `${selectedYear}-01-01`, to: `${selectedYear}-12-31`, label: selectedYear };
    }
    if (periodType === "month") {
      const lastDay = new Date(Number(selectedYear), Number(selectedMonth), 0).getDate();
      const label = `${months.find((m) => m.value === selectedMonth)?.label} ${selectedYear}`;
      return {
        from: `${selectedYear}-${selectedMonth}-01`,
        to: `${selectedYear}-${selectedMonth}-${String(lastDay).padStart(2, "0")}`,
        label,
      };
    }
    return { from: customFrom, to: customTo, label: customFrom || customTo ? `${customFrom || "Start"} to ${customTo || "Today"}` : "Custom" };
  }, [periodType, selectedYear, selectedMonth, customFrom, customTo]);

  const statementRows = useMemo(() => {
    const rawRows: Omit<StatementRow, "running_balance">[] = [];

    deliveries.forEach((d) => {
      const supplier = supplierMap.get(d.supplier_id);
      rawRows.push({
        id: `delivery-${d.id}`,
        date: d.delivery_date,
        supplier_id: d.supplier_id,
        supplier_name: supplier?.name || "Unknown",
        item: d.material_name || supplier?.material_type || "Stock",
        quantity: Number(d.quantity) || 0,
        unit: d.unit || "units",
        unit_price: Number(d.unit_price) || 0,
        total_amount: Number(d.total_value) || 0,
        payment_method: "",
        payment_amount: 0,
      });
    });

    purchases.forEach((purchase) => {
      const supplier = supplierMap.get(purchase.supplier_id);
      const items = purchaseItems.filter((item) => item.purchase_id === purchase.id);
      items.forEach((item) => {
        rawRows.push({
          id: `purchase-item-${item.id}`,
          date: purchase.purchase_date,
          supplier_id: purchase.supplier_id,
          supplier_name: supplier?.name || "Unknown",
          item: item.item_name,
          quantity: Number(item.quantity) || 0,
          unit: "pcs",
          unit_price: Number(item.unit_price) || 0,
          total_amount: Number(item.total_price) || 0,
          payment_method: "",
          payment_amount: 0,
        });
      });

      if (Number(purchase.payment_amount) > 0) {
        rawRows.push({
          id: `purchase-payment-${purchase.id}`,
          date: purchase.purchase_date,
          supplier_id: purchase.supplier_id,
          supplier_name: supplier?.name || "Unknown",
          item: purchase.notes || `Purchase payment - ${purchase.branch}`,
          quantity: 0,
          unit: "",
          unit_price: 0,
          total_amount: 0,
          payment_method: "Purchase Payment",
          payment_amount: Number(purchase.payment_amount) || 0,
        });
      }
    });

    payments.forEach((payment) => {
      const supplier = supplierMap.get(payment.supplier_id);
      rawRows.push({
        id: `payment-${payment.id}`,
        date: payment.payment_date,
        supplier_id: payment.supplier_id,
        supplier_name: supplier?.name || "Unknown",
        item: payment.notes || payment.reference_number || "Supplier payment",
        quantity: 0,
        unit: "",
        unit_price: 0,
        total_amount: 0,
        payment_method: payment.payment_method || "Payment",
        payment_amount: Number(payment.amount) || 0,
      });
    });

    const searchText = search.trim().toLowerCase();
    const selectedSupplierIds = supplierFilter === "all" ? suppliers.map((s) => s.id) : [supplierFilter];
    const rowsBySupplier = new Map<string, Omit<StatementRow, "running_balance">[]>();

    selectedSupplierIds.forEach((supplierId) => {
      rowsBySupplier.set(supplierId, rawRows.filter((row) => row.supplier_id === supplierId));
    });

    const result: StatementRow[] = [];
    rowsBySupplier.forEach((supplierRows, supplierId) => {
      const supplier = supplierMap.get(supplierId);
      let runningBalance = Number(supplier?.opening_balance) || 0;
      const sortedRows = supplierRows.sort((a, b) => {
        const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
        return dateDiff || a.id.localeCompare(b.id);
      });

      sortedRows.forEach((row) => {
        const rowDate = new Date(row.date);
        const beforeFrom = period.from && rowDate < new Date(period.from);
        const afterTo = period.to && rowDate > new Date(period.to);
        runningBalance += row.total_amount - row.payment_amount;

        if (beforeFrom || afterTo) return;
        if (searchText && !`${row.supplier_name} ${row.item} ${row.payment_method}`.toLowerCase().includes(searchText)) return;

        result.push({ ...row, running_balance: runningBalance });
      });
    });

    return result.sort((a, b) => {
      const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
      return dateDiff || a.supplier_name.localeCompare(b.supplier_name);
    });
  }, [deliveries, payments, purchases, purchaseItems, search, supplierFilter, supplierMap, suppliers, period.from, period.to]);

  const totals = useMemo(() => {
    const totalItems = statementRows.reduce((acc, row) => acc + row.total_amount, 0);
    const totalPaid = statementRows.reduce((acc, row) => acc + row.payment_amount, 0);
    const totalQty = statementRows.reduce((acc, row) => acc + row.quantity, 0);

    const endingBalance = supplierFilter === "all"
      ? Array.from(statementRows.reduce((acc, row) => {
          acc.set(row.supplier_id, row.running_balance);
          return acc;
        }, new Map<string, number>()).values()).reduce((acc, balance) => acc + balance, 0)
      : statementRows.at(-1)?.running_balance || Number(supplierMap.get(supplierFilter)?.opening_balance) || 0;

    return { totalItems, totalPaid, totalQty, endingBalance };
  }, [statementRows, supplierFilter, supplierMap]);

  const selectedSupplierName = supplierFilter === "all" ? "All Suppliers" : supplierMap.get(supplierFilter)?.name || "Supplier";
  const filename = `${dateStamp(selectedSupplierName)}-${dateStamp(period.label)}-Statement`;

  const exportExcel = () => {
    const rows: Record<string, string | number>[] = statementRows.map((row, index) => ({
      "S.No.": index + 1,
      Date: formatDate(row.date),
      "Supplier Name": row.supplier_name,
      "Item Description": row.item,
      Qty: row.quantity || "",
      Unit: row.unit,
      "Unit Price": row.unit_price || "",
      "Total Amount": row.total_amount,
      "Payment Method": row.payment_method,
      "Payment Amount": row.payment_amount || "",
      "Running Balance": row.running_balance,
    }));

    rows.push({
      "S.No.": "Total Summary",
      Date: "",
      "Supplier Name": selectedSupplierName,
      "Item Description": period.label,
      Qty: totals.totalQty,
      Unit: "",
      "Unit Price": "",
      "Total Amount": totals.totalItems,
      "Payment Method": "",
      "Payment Amount": totals.totalPaid,
      "Running Balance": totals.endingBalance,
    });

    downloadExcel(rows, filename);
    toast({ title: "Excel Downloaded", description: `${selectedSupplierName} statement saved.` });
  };

  const exportPDF = () => {
    const headers = ["S.No.", "Date", "Supplier", "Item Description", "Qty", "Unit Price", "Total", "Payment", "Pay Amt", "Balance"];
    const rows = statementRows.map((row, index) => [
      index + 1,
      formatDate(row.date),
      row.supplier_name,
      row.item,
      row.quantity ? `${row.quantity} ${row.unit}` : "",
      row.unit_price ? row.unit_price.toFixed(2) : "",
      row.total_amount ? row.total_amount.toFixed(2) : "",
      row.payment_method,
      row.payment_amount ? row.payment_amount.toFixed(2) : "",
      row.running_balance.toFixed(2),
    ]);

    downloadPDF(`${selectedSupplierName} Statement - ${period.label}`, headers, rows, filename, [
      { label: "Supplier", value: selectedSupplierName },
      { label: "Statement Period", value: period.label },
      { label: "Total Quantity", value: totals.totalQty.toFixed(2) },
      { label: "Total Amount", value: formatSAR(totals.totalItems) },
      { label: "Payment Paid", value: formatSAR(totals.totalPaid) },
      { label: "Current Balance", value: formatSAR(totals.endingBalance) },
    ]);
    toast({ title: "PDF Downloaded", description: `${selectedSupplierName} statement saved.` });
  };

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto w-full space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Supplier Statements</h1>
            <p className="text-sm text-[#8faac3]">Filter one supplier by yearly, monthly, custom, or all-time duration</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportExcel} disabled={statementRows.length === 0} variant="outline"
            className="gap-2 border-emerald-700 text-emerald-400 hover:bg-emerald-900/30 bg-transparent font-bold">
            <Download className="w-4 h-4" /> Export Excel
          </Button>
          <Button onClick={exportPDF} disabled={statementRows.length === 0} variant="outline"
            className="gap-2 border-red-700 text-red-400 hover:bg-red-900/30 bg-transparent font-bold">
            <FileText className="w-4 h-4" /> Export PDF
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-10 h-10 animate-spin text-[#3b82f6]" />
        </div>
      ) : (
        <>
          <div className="bg-[#121e36] border border-[#1e3464] rounded-xl p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="md:col-span-2 relative">
              <label className="text-xs font-bold text-[#8faac3] uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                <UserRound className="w-3.5 h-3.5" /> Supplier
              </label>
              <Input
                value={supplierSearch}
                onChange={(e) => {
                  setSupplierSearch(e.target.value);
                  setIsSupplierMenuOpen(true);
                  if (e.target.value.trim().length === 0) {
                    setSupplierFilter("all");
                  }
                }}
                onFocus={() => setIsSupplierMenuOpen(true)}
                onBlur={() => window.setTimeout(() => setIsSupplierMenuOpen(false), 120)}
                placeholder="Type supplier name..."
                className="h-10 bg-[#0d1526] border-[#1e3464] text-[#e2e8f0] placeholder-[#8faac3]"
              />
              {isSupplierMenuOpen && (
                <div className="absolute z-10 left-0 right-0 mt-1 max-h-64 overflow-auto rounded-lg border border-[#1e3464] bg-[#0d1526] shadow-2xl">
                  <button
                    type="button"
                    onClick={() => {
                      setSupplierFilter("all");
                      setSupplierSearch("");
                      setIsSupplierMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm font-semibold text-[#e2e8f0] hover:bg-[#162040] border-b border-[#1e3464]"
                  >
                    All Suppliers
                  </button>
                  {filteredSuppliers.length > 0 ? (
                    filteredSuppliers.map((supplier) => (
                      <button
                        key={supplier.id}
                        type="button"
                        onClick={() => {
                          setSupplierFilter(supplier.id);
                          setSupplierSearch(supplier.name);
                          setIsSupplierMenuOpen(false);
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-[#e2e8f0] hover:bg-[#162040] border-b border-[#1e3464] last:border-b-0"
                      >
                        <span className="block font-medium">{supplier.name}</span>
                        {supplier.material_type ? <span className="text-xs text-[#8faac3]">{supplier.material_type}</span> : null}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-3 text-sm text-[#8faac3]">No suppliers match this search.</div>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="text-xs font-bold text-[#8faac3] uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                <Calendar className="w-3.5 h-3.5" /> Duration
              </label>
              <select value={periodType} onChange={(e) => setPeriodType(e.target.value as "all" | "year" | "month" | "custom")}
                className="w-full h-10 bg-[#0d1526] border border-[#1e3464] rounded-lg px-3 text-sm text-[#e2e8f0] outline-none focus:border-[#3b82f6]">
                <option value="year">Yearly</option>
                <option value="month">Monthly</option>
                <option value="custom">Custom Duration</option>
                <option value="all">All Time</option>
              </select>
            </div>
            {(periodType === "year" || periodType === "month") && (
              <div>
                <label className="text-xs font-bold text-[#8faac3] uppercase tracking-wider mb-1.5 block">Year</label>
                <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full h-10 bg-[#0d1526] border border-[#1e3464] rounded-lg px-3 text-sm text-[#e2e8f0] outline-none focus:border-[#3b82f6]">
                  {years.map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
              </div>
            )}
            {periodType === "month" && (
              <div>
                <label className="text-xs font-bold text-[#8faac3] uppercase tracking-wider mb-1.5 block">Month</label>
                <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full h-10 bg-[#0d1526] border border-[#1e3464] rounded-lg px-3 text-sm text-[#e2e8f0] outline-none focus:border-[#3b82f6]">
                  {months.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}
                </select>
              </div>
            )}
            {periodType === "custom" && (
              <>
                <div>
                  <label className="text-xs font-bold text-[#8faac3] uppercase tracking-wider mb-1.5 block">Start Date</label>
                  <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
                    className="h-10 bg-[#0d1526] border-[#1e3464] text-[#e2e8f0]" />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#8faac3] uppercase tracking-wider mb-1.5 block">End Date</label>
                  <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
                    className="h-10 bg-[#0d1526] border-[#1e3464] text-[#e2e8f0]" />
                </div>
              </>
            )}
            <div className="md:col-span-5">
              <Input placeholder="Search item, supplier, payment method..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="h-10 bg-[#0d1526] border-[#1e3464] text-[#e2e8f0] placeholder-[#8faac3]" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-[#121e36] border border-[#1e3464] rounded-xl p-5">
              <div className="text-xs font-bold text-[#8faac3] uppercase tracking-wider">Total Entries</div>
              <div className="text-2xl font-bold text-white mt-2">{statementRows.length}</div>
            </div>
            <div className="bg-[#121e36] border border-[#1e3464] rounded-xl p-5">
              <div className="text-xs font-bold text-[#8faac3] uppercase tracking-wider">Total Quantity</div>
              <div className="text-2xl font-bold text-white mt-2">{totals.totalQty.toFixed(2)}</div>
            </div>
            <div className="bg-[#121e36] border border-[#1e3464] rounded-xl p-5">
              <div className="text-xs font-bold text-[#8faac3] uppercase tracking-wider">Total Amount</div>
              <div className="text-2xl font-bold text-[#3b82f6] mt-2">{formatSAR(totals.totalItems)}</div>
            </div>
            <div className="bg-[#121e36] border border-[#1e3464] rounded-xl p-5">
              <div className="text-xs font-bold text-[#8faac3] uppercase tracking-wider">Payment Paid</div>
              <div className="text-2xl font-bold text-emerald-400 mt-2">{formatSAR(totals.totalPaid)}</div>
            </div>
          </div>

          <div className="bg-[#121e36] border border-[#1e3464] rounded-xl overflow-hidden shadow-xl">
            <div className="px-5 py-4 bg-[#0a1422] border-b border-[#1e3464] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="font-bold text-white flex items-center gap-2">
                <Package className="w-4 h-4 text-[#3b82f6]" /> {selectedSupplierName} - {period.label}
              </h2>
              <div className="text-sm text-[#8faac3]">
                Current Balance: <span className="font-bold text-white">{formatSAR(totals.endingBalance)}</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              {statementRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <BarChart3 className="w-10 h-10 text-[#1e3464] mb-3" />
                  <p className="text-[#8faac3] text-sm">No supplier statement entries found.</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1e3464]">
                      <th className="text-left px-4 py-3 text-xs font-bold text-[#8faac3] uppercase">S.No.</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-[#8faac3] uppercase">Date</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-[#8faac3] uppercase">Supplier</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-[#8faac3] uppercase">Item Description</th>
                      <th className="text-right px-4 py-3 text-xs font-bold text-[#8faac3] uppercase">Qty</th>
                      <th className="text-right px-4 py-3 text-xs font-bold text-[#8faac3] uppercase">Unit Price</th>
                      <th className="text-right px-4 py-3 text-xs font-bold text-[#8faac3] uppercase">Total Amount</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-[#8faac3] uppercase">Payment</th>
                      <th className="text-right px-4 py-3 text-xs font-bold text-[#8faac3] uppercase">Payment Amt</th>
                      <th className="text-right px-4 py-3 text-xs font-bold text-[#8faac3] uppercase">Running Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statementRows.map((row, index) => (
                      <tr key={row.id} className="border-b border-[#1e3464]/50 hover:bg-[#162040] transition-colors">
                        <td className="px-4 py-3 text-[#8faac3] text-xs">{index + 1}</td>
                        <td className="px-4 py-3 text-[#8faac3] whitespace-nowrap">{formatDate(row.date)}</td>
                        <td className="px-4 py-3 font-semibold text-white">{row.supplier_name}</td>
                        <td className="px-4 py-3 text-[#e2e8f0]">{row.item}</td>
                        <td className="px-4 py-3 text-right text-[#e2e8f0]">{row.quantity ? `${row.quantity} ${row.unit}` : ""}</td>
                        <td className="px-4 py-3 text-right font-mono text-[#8faac3]">{row.unit_price ? row.unit_price.toFixed(2) : ""}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-[#3b82f6]">{row.total_amount ? formatSAR(row.total_amount) : ""}</td>
                        <td className="px-4 py-3 text-[#8faac3]">{row.payment_method}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">{row.payment_amount ? formatSAR(row.payment_amount) : ""}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-white">{formatSAR(row.running_balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {statementRows.length > 0 && (
              <div className="px-5 py-3 bg-[#0a1422] border-t border-[#1e3464] flex flex-col sm:flex-row sm:items-center justify-end gap-5">
                <span className="text-sm"><span className="text-[#8faac3]">Total Amount: </span><span className="font-bold text-[#3b82f6]">{formatSAR(totals.totalItems)}</span></span>
                <span className="text-sm"><span className="text-[#8faac3]">Payment Paid: </span><span className="font-bold text-emerald-400">{formatSAR(totals.totalPaid)}</span></span>
                <span className="text-sm"><span className="text-[#8faac3]">Current Balance: </span><span className="font-bold text-white">{formatSAR(totals.endingBalance)}</span></span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
