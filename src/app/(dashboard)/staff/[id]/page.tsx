"use client";

import React, { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { useEmployeeDetail } from "@/hooks/use-staff-data";
import { SalaryTransaction } from "@/types";
import { formatSAR, downloadPDF } from "@/lib/format-utils";
import {
  Loader2,
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  UserCheck,
  Wallet,
  TrendingUp,
  TrendingDown,
  Calendar,
  FileText,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ─── Month name helper ───────────────────────────────────────
const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function EmployeeDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { data, isLoading, mutate } = useEmployeeDetail(id as string);

  // ─── State ─────────────────────────────────────────────────
  const [isTxnModalOpen, setIsTxnModalOpen] = useState(false);
  const [editingTxn, setEditingTxn] = useState<SalaryTransaction | null>(null);
  const [deleteTxnConfirm, setDeleteTxnConfirm] = useState<{ id: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // Filter by month
  const [filterMonth, setFilterMonth] = useState<number>(0);  // 0 = all
  const [filterYear, setFilterYear] = useState<number>(0);    // 0 = all

  const [txnForm, setTxnForm] = useState({
    date: new Date().toISOString().split("T")[0],
    type: "advance" as "advance" | "payment",
    amount: "",
    note: "",
    salary_month_id: "",
  });
  const [txnFormErrors, setTxnFormErrors] = useState<Record<string, boolean>>({});

  // ─── Derived data ─────────────────────────────────────────
  const employee = data?.employee ?? null;
  const salaryMonths = useMemo(() => data?.salaryMonths ?? [], [data?.salaryMonths]);
  const transactions = useMemo(() => data?.transactions ?? [], [data?.transactions]);

  // Current month context
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Current month's salary record
  const currentMonthRecord = useMemo(
    () => salaryMonths.find((sm) => sm.month === currentMonth && sm.year === currentYear),
    [salaryMonths, currentMonth, currentYear]
  );

  // Overall totals across all months
  const overallTotals = useMemo(() => {
    const totalBase = salaryMonths.reduce((a, sm) => a + sm.base_salary, 0);
    const totalPaid = salaryMonths.reduce((a, sm) => a + sm.total_paid, 0);
    return { totalBase, totalPaid, balance: totalBase - totalPaid };
  }, [salaryMonths]);

  // Available years from salary months for filter
  const availableYears = useMemo(
    () => Array.from(new Set(salaryMonths.map((sm) => sm.year))).sort((a, b) => b - a),
    [salaryMonths]
  );

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((txn) => {
      if (filterMonth === 0 && filterYear === 0) return true;
      const sm = salaryMonths.find((m) => m.id === txn.salary_month_id);
      if (!sm) return true;
      if (filterYear !== 0 && sm.year !== filterYear) return false;
      if (filterMonth !== 0 && sm.month !== filterMonth) return false;
      return true;
    });
  }, [transactions, filterMonth, filterYear, salaryMonths]);

  // ─── Transaction form validation ──────────────────────────
  const validateTxnForm = () => {
    const errors: Record<string, boolean> = {};
    if (!txnForm.amount || Number(txnForm.amount) <= 0) errors.amount = true;
    if (!txnForm.salary_month_id) errors.salary_month_id = true;
    if (!txnForm.date) errors.date = true;
    setTxnFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ─── Save Transaction (Add / Edit) ────────────────────────
  const handleSaveTxn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateTxnForm() || !employee) return;
    setSaving(true);

    const payload = {
      employee_id: employee.id,
      salary_month_id: txnForm.salary_month_id,
      date: txnForm.date,
      type: txnForm.type,
      amount: Number(txnForm.amount),
      note: txnForm.note.trim() || null,
    };

    try {
      if (editingTxn) {
        const { error } = await supabase
          .from("salary_transactions")
          .update(payload)
          .eq("id", editingTxn.id);
        if (error) throw new Error(error.message);
        toast({ title: "Updated", description: "Transaction updated." });
      } else {
        const { error } = await supabase.from("salary_transactions").insert(payload);
        if (error) throw new Error(error.message);
        toast({ title: "Success", description: "Transaction recorded." });
      }
      closeTxnModal();
      mutate();
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: (error as Error)?.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // ─── Delete Transaction ───────────────────────────────────
  const handleDeleteTxn = async () => {
    if (!deleteTxnConfirm) return;
    try {
      const { error } = await supabase
        .from("salary_transactions")
        .delete()
        .eq("id", deleteTxnConfirm.id);
      if (error) throw error;
      toast({ title: "Deleted", description: "Transaction removed." });
      mutate();
      setDeleteTxnConfirm(null);
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: (error as Error)?.message || "Failed to delete",
        variant: "destructive",
      });
    }
  };

  // ─── Modal helpers ────────────────────────────────────────
  const openAddTxnModal = () => {
    setEditingTxn(null);
    setTxnForm({
      date: new Date().toISOString().split("T")[0],
      type: "advance",
      amount: "",
      note: "",
      salary_month_id: currentMonthRecord?.id || (salaryMonths.length > 0 ? salaryMonths[0].id : ""),
    });
    setTxnFormErrors({});
    setIsTxnModalOpen(true);
  };

  const openEditTxnModal = (txn: SalaryTransaction) => {
    setEditingTxn(txn);
    setTxnForm({
      date: txn.date,
      type: txn.type,
      amount: String(txn.amount),
      note: txn.note || "",
      salary_month_id: txn.salary_month_id,
    });
    setTxnFormErrors({});
    setIsTxnModalOpen(true);
  };

  const closeTxnModal = () => {
    setIsTxnModalOpen(false);
    setEditingTxn(null);
    setTxnForm({ date: "", type: "advance", amount: "", note: "", salary_month_id: "" });
    setTxnFormErrors({});
  };

  // ─── Export to PDF ────────────────────────────────────────
  const exportPDF = () => {
    if (!employee) return;
    const headers = ["#", "Date", "Month", "Type", "Amount", "Note"];
    const rows = filteredTransactions.map((txn, index) => {
      const sm = salaryMonths.find((m) => m.id === txn.salary_month_id);
      return [
        index + 1,
        txn.date,
        sm ? `${MONTH_NAMES[sm.month]} ${sm.year}` : "-",
        txn.type === "advance" ? "Advance" : "Payment",
        formatSAR(txn.amount),
        txn.note || "-",
      ];
    });

    const title = `Transactions - ${employee.name}`;
    const filename = `Transactions_${employee.name.replace(/\s+/g, "_")}`;

    const totalTransactions = filteredTransactions.reduce((a, t) => a + t.amount, 0);

    downloadPDF(title, headers, rows, filename, [
      { label: "Employee Name", value: employee.name },
      { label: "Total Transactions", value: String(filteredTransactions.length) },
      { label: "Total Amount", value: formatSAR(totalTransactions) },
    ]);
    
    toast({
      title: "PDF Downloaded",
      description: "Transactions list saved successfully.",
    });
  };

  // ─── Loading state ────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#3b82f6]" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <UserCheck className="w-16 h-16 text-[#1e3464]" />
        <p className="text-[#8faac3] text-lg">Employee not found</p>
        <Link href="/staff">
          <Button variant="outline" className="border-[#1e3464] text-[#e2e8f0] hover:bg-[#1e3464] bg-transparent">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Staff
          </Button>
        </Link>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1400px] mx-auto w-full">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/staff")}
            className="w-10 h-10 rounded-xl bg-[#1e3464] hover:bg-[#3b82f6] text-[#8faac3] hover:text-white flex items-center justify-center transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] flex items-center justify-center text-white text-xl font-bold">
            {employee.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{employee.name}</h1>
            <div className="flex items-center gap-3 text-sm text-[#8faac3]">
              {employee.job_title && <span>{employee.job_title}</span>}
              {employee.iqama_no && (
                <>
                  <span className="text-[#1e3464]">•</span>
                  <span className="font-mono text-xs">{employee.iqama_no}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={exportPDF}
            disabled={filteredTransactions.length === 0}
            variant="outline"
            className="gap-2 border-[#1e3464] text-[#8faac3] hover:text-white hover:bg-[#1e3464] bg-transparent font-bold"
          >
            <FileText className="w-4 h-4" /> Export PDF
          </Button>
          <Button
            onClick={openAddTxnModal}
            disabled={salaryMonths.length === 0}
            className="bg-gradient-to-r from-[#3b82f6] to-[#2563eb] hover:from-[#2563eb] hover:to-[#1d4ed8] text-white font-bold gap-2 shadow-lg"
            title={salaryMonths.length === 0 ? "Create a month in Payroll first" : ""}
          >
            <Plus className="w-4 h-4" /> New Transaction
          </Button>
        </div>
      </div>

      {/* ── Summary Cards ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Base Salary */}
        <div className="bg-[#121e36] border border-[#1e3464] rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-[#8faac3] uppercase tracking-wider">Base Salary</span>
            <div className="w-9 h-9 rounded-lg bg-[#1e3464] flex items-center justify-center">
              <Wallet className="w-4 h-4 text-[#3b82f6]" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white truncate">
            {formatSAR(employee.base_salary_sar)}
          </div>
          <div className="text-xs text-[#8faac3] mt-1">per month</div>
        </div>

        {/* This Month Paid */}
        <div className="bg-[#121e36] border border-[#1e3464] rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-[#8faac3] uppercase tracking-wider">
              {MONTH_NAMES[currentMonth]} Paid
            </span>
            <div className="w-9 h-9 rounded-lg bg-amber-900/40 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-amber-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-400 truncate">
            {currentMonthRecord ? formatSAR(currentMonthRecord.total_paid) : "—"}
          </div>
          <div className="text-xs text-[#8faac3] mt-1">
            {currentMonthRecord ? "total paid this month" : "no month record yet"}
          </div>
        </div>

        {/* Current Balance */}
        <div
          className={cn(
            "bg-[#121e36] border rounded-xl p-5 shadow-sm",
            currentMonthRecord && currentMonthRecord.balance < 0
              ? "border-red-900/40"
              : "border-[#1e3464]"
          )}
        >
          <div className="flex items-center justify-between mb-3">
            <span
              className={cn(
                "text-xs font-bold uppercase tracking-wider",
                currentMonthRecord && currentMonthRecord.balance < 0
                  ? "text-red-400"
                  : "text-[#8faac3]"
              )}
            >
              {MONTH_NAMES[currentMonth]} Balance
            </span>
            <div
              className={cn(
                "w-9 h-9 rounded-lg flex items-center justify-center",
                currentMonthRecord && currentMonthRecord.balance < 0
                  ? "bg-red-900/40"
                  : "bg-emerald-900/40"
              )}
            >
              <TrendingDown
                className={cn(
                  "w-4 h-4",
                  currentMonthRecord && currentMonthRecord.balance < 0
                    ? "text-red-400"
                    : "text-emerald-400"
                )}
              />
            </div>
          </div>
          <div
            className={cn(
              "text-2xl font-bold truncate",
              currentMonthRecord
                ? currentMonthRecord.balance > 0
                  ? "text-emerald-400"
                  : currentMonthRecord.balance < 0
                  ? "text-red-400"
                  : "text-[#8faac3]"
                : "text-[#8faac3]"
            )}
          >
            {currentMonthRecord ? formatSAR(currentMonthRecord.balance) : "—"}
          </div>
          <div className="text-xs text-[#8faac3] mt-1">
            {currentMonthRecord
              ? currentMonthRecord.balance > 0
                ? "company owes employee"
                : currentMonthRecord.balance < 0
                ? "employee owes company"
                : "fully settled"
              : "no month record yet"}
          </div>
        </div>
      </div>

      {/* ── Overall Summary (all months) ───────────────────── */}
      {salaryMonths.length > 0 && (
        <div className="bg-[#121e36] border border-[#1e3464] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-[#3b82f6]" />
            <span className="text-xs font-bold text-[#8faac3] uppercase tracking-wider">
              All-Time Summary ({salaryMonths.length} months)
            </span>
          </div>
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-[#8faac3]">Total Base: </span>
              <span className="font-bold text-white">{formatSAR(overallTotals.totalBase)}</span>
            </div>
            <div>
              <span className="text-[#8faac3]">Total Paid: </span>
              <span className="font-bold text-amber-400">{formatSAR(overallTotals.totalPaid)}</span>
            </div>
            <div>
              <span className="text-[#8faac3]">Overall Balance: </span>
              <span
                className={cn(
                  "font-bold",
                  overallTotals.balance > 0
                    ? "text-emerald-400"
                    : overallTotals.balance < 0
                    ? "text-red-400"
                    : "text-[#8faac3]"
                )}
              >
                {formatSAR(overallTotals.balance)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Salary Months Table ────────────────────────────── */}
      {salaryMonths.length > 0 && (
        <div className="bg-[#121e36] border border-[#1e3464] rounded-xl overflow-hidden shadow-xl">
          <div className="px-5 py-4 bg-[#0a1422] border-b border-[#1e3464]">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#3b82f6]" /> Monthly Breakdown
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e3464]">
                  <th className="text-left px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">Period</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">Base Salary</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">Total Paid</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">Balance</th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {salaryMonths.map((sm) => (
                  <tr key={sm.id} className="border-b border-[#1e3464]/50 hover:bg-[#162040] transition-colors">
                    <td className="px-4 py-3 text-white font-medium">
                      {MONTH_NAMES[sm.month]} {sm.year}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[#e2e8f0]">
                      {formatSAR(sm.base_salary)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-amber-400">
                      {formatSAR(sm.total_paid)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold">
                      <span
                        className={
                          sm.balance > 0
                            ? "text-emerald-400"
                            : sm.balance < 0
                            ? "text-red-400"
                            : "text-[#8faac3]"
                        }
                      >
                        {formatSAR(sm.balance)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={cn(
                          "text-xs font-bold px-2.5 py-1 rounded-full",
                          sm.status === "open"
                            ? "bg-[#1e3464] text-[#3b82f6]"
                            : "bg-emerald-900/60 text-emerald-400"
                        )}
                      >
                        {sm.status === "open" ? "Open" : "Closed"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Transactions Table ─────────────────────────────── */}
      <div className="bg-[#121e36] border border-[#1e3464] rounded-xl overflow-hidden shadow-xl">
        <div className="px-5 py-4 bg-[#0a1422] border-b border-[#1e3464] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Wallet className="w-4 h-4 text-[#3b82f6]" /> Transactions
            </h2>
            <span className="text-xs text-[#8faac3] bg-[#1e3464] px-2 py-0.5 rounded-full">
              {filteredTransactions.length}
            </span>
          </div>
          {/* Month/Year filter */}
          <div className="flex items-center gap-2">
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(Number(e.target.value))}
              className="bg-[#0d1526] border border-[#1e3464] rounded-lg px-3 py-1.5 text-sm text-[#e2e8f0] outline-none focus:border-[#3b82f6]"
            >
              <option value={0}>All Months</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{MONTH_NAMES[m]}</option>
              ))}
            </select>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(Number(e.target.value))}
              className="bg-[#0d1526] border border-[#1e3464] rounded-lg px-3 py-1.5 text-sm text-[#e2e8f0] outline-none focus:border-[#3b82f6]"
            >
              <option value={0}>All Years</option>
              {availableYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          {filteredTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Wallet className="w-12 h-12 text-[#1e3464] mb-3" />
              <p className="text-[#8faac3] font-medium">No transactions yet</p>
              <p className="text-[#8faac3] text-sm mt-1">
                {salaryMonths.length === 0
                  ? "Create a month in Payroll first, then add transactions."
                  : "Click 'New Transaction' to record an advance or payment."}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e3464]">
                  <th className="text-left px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">#</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">Month</th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">Type</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">Amount</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">Note</th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((txn, idx) => {
                  // Lookup the month for display
                  const sm = salaryMonths.find((m) => m.id === txn.salary_month_id);
                  return (
                    <tr key={txn.id} className="border-b border-[#1e3464]/50 hover:bg-[#162040] transition-colors">
                      <td className="px-4 py-3.5 text-[#8faac3] text-xs">{idx + 1}</td>
                      <td className="px-4 py-3.5 text-[#e2e8f0] font-mono text-xs">{txn.date}</td>
                      <td className="px-4 py-3.5 text-[#8faac3] text-xs">
                        {sm ? `${MONTH_NAMES[sm.month]} ${sm.year}` : "—"}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={cn(
                            "text-xs font-bold px-2.5 py-1 rounded-full",
                            txn.type === "advance"
                              ? "bg-amber-900/60 text-amber-400"
                              : "bg-emerald-900/60 text-emerald-400"
                          )}
                        >
                          {txn.type === "advance" ? "Advance" : "Payment"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-white">
                        {formatSAR(txn.amount)}
                      </td>
                      <td className="px-4 py-3.5 text-[#8faac3] text-xs max-w-[200px] truncate">
                        {txn.note || "—"}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openEditTxnModal(txn)}
                            className="w-8 h-8 rounded-lg bg-[#1e3464] hover:bg-[#2563eb] text-[#8faac3] hover:text-white transition-all flex items-center justify-center"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTxnConfirm({ id: txn.id })}
                            className="w-8 h-8 rounded-lg bg-red-900/30 hover:bg-red-600 text-red-400 hover:text-white transition-all flex items-center justify-center"
                            title="Delete"
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

        {/* Footer */}
        {filteredTransactions.length > 0 && (
          <div className="px-5 py-3 bg-[#0a1422] border-t border-[#1e3464] flex items-center justify-between">
            <span className="text-xs text-[#8faac3]">
              Showing <span className="text-white font-bold">{filteredTransactions.length}</span> transactions
            </span>
            <div className="text-right">
              <span className="text-xs text-[#8faac3]">Total: </span>
              <span className="text-sm font-bold text-white">
                {formatSAR(filteredTransactions.reduce((a, t) => a + t.amount, 0))}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Add/Edit Transaction Dialog ──────────────────── */}
      <Dialog open={isTxnModalOpen} onOpenChange={(open) => !open && closeTxnModal()}>
        <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden border-none shadow-2xl bg-[#121e36]">
          <div className="bg-gradient-to-r from-[#0a1422] to-[#121e36] p-5 border-b border-[#1e3464]">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-white">
                {editingTxn ? "Edit Transaction" : "New Transaction"}
              </DialogTitle>
              <p className="text-[#8faac3] text-sm mt-1">
                Record an advance or salary payment for {employee.name}.
              </p>
            </DialogHeader>
          </div>
          <form onSubmit={handleSaveTxn} className="p-5 space-y-4">
            {/* Salary Month */}
            <div className="space-y-1.5">
              <Label className="text-[#e2e8f0] text-sm font-medium">Salary Month *</Label>
              <Select
                value={txnForm.salary_month_id}
                onValueChange={(v) => {
                  setTxnForm({ ...txnForm, salary_month_id: v });
                  if (txnFormErrors.salary_month_id) setTxnFormErrors((p) => ({ ...p, salary_month_id: false }));
                }}
              >
                <SelectTrigger
                  className={cn(
                    "h-11 bg-[#0d1526] text-[#e2e8f0]",
                    txnFormErrors.salary_month_id ? "border-red-500" : "border-[#1e3464]"
                  )}
                >
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent className="bg-[#121e36] border-[#1e3464]">
                  {salaryMonths
                    .filter((sm) => sm.status === "open")
                    .map((sm) => (
                      <SelectItem key={sm.id} value={sm.id} className="text-[#e2e8f0] focus:bg-[#1e3464]">
                        {MONTH_NAMES[sm.month]} {sm.year}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date + Type */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[#e2e8f0] text-sm font-medium">Date *</Label>
                <Input
                  type="date"
                  value={txnForm.date}
                  onChange={(e) => {
                    setTxnForm({ ...txnForm, date: e.target.value });
                    if (txnFormErrors.date) setTxnFormErrors((p) => ({ ...p, date: false }));
                  }}
                  className={cn(
                    "h-11 bg-[#0d1526] border text-[#e2e8f0]",
                    txnFormErrors.date ? "border-red-500" : "border-[#1e3464] focus:border-[#3b82f6]"
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[#e2e8f0] text-sm font-medium">Type</Label>
                <Select
                  value={txnForm.type}
                  onValueChange={(v) => setTxnForm({ ...txnForm, type: v as "advance" | "payment" })}
                >
                  <SelectTrigger className="h-11 bg-[#0d1526] border-[#1e3464] text-[#e2e8f0]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#121e36] border-[#1e3464]">
                    <SelectItem value="advance" className="text-[#e2e8f0] focus:bg-[#1e3464]">Advance</SelectItem>
                    <SelectItem value="payment" className="text-[#e2e8f0] focus:bg-[#1e3464]">Payment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Amount */}
            <div className="space-y-1.5">
              <Label className="text-[#e2e8f0] text-sm font-medium">Amount (SAR) *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={txnForm.amount}
                onChange={(e) => {
                  setTxnForm({ ...txnForm, amount: e.target.value });
                  if (txnFormErrors.amount) setTxnFormErrors((p) => ({ ...p, amount: false }));
                }}
                className={cn(
                  "h-11 bg-[#0d1526] border text-[#e2e8f0] placeholder-[#8faac3]",
                  txnFormErrors.amount ? "border-red-500" : "border-[#1e3464] focus:border-[#3b82f6]"
                )}
                placeholder="e.g. 500"
              />
            </div>

            {/* Note */}
            <div className="space-y-1.5">
              <Label className="text-[#e2e8f0] text-sm font-medium">Note (optional)</Label>
              <Textarea
                value={txnForm.note}
                onChange={(e) => setTxnForm({ ...txnForm, note: e.target.value })}
                className="bg-[#0d1526] border-[#1e3464] text-[#e2e8f0] placeholder-[#8faac3] min-h-[80px] focus:border-[#3b82f6]"
                placeholder="e.g. Advance for Eid shopping"
              />
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={closeTxnModal}
                className="flex-1 font-bold h-11 border-[#1e3464] text-[#e2e8f0] hover:bg-[#1e3464] bg-transparent"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="flex-1 bg-gradient-to-r from-[#3b82f6] to-[#2563eb] hover:from-[#2563eb] hover:to-[#1d4ed8] text-white font-bold h-11"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {editingTxn ? "Update" : "Save Transaction"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Transaction Confirmation ──────────────── */}
      <Dialog open={!!deleteTxnConfirm} onOpenChange={(open) => !open && setDeleteTxnConfirm(null)}>
        <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden border-none shadow-2xl bg-[#121e36]">
          <div className="bg-red-900/50 p-5 border-b border-red-800">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-white">Delete Transaction?</DialogTitle>
            </DialogHeader>
          </div>
          <div className="p-5 space-y-4">
            <p className="text-sm text-[#8faac3]">
              This transaction will be permanently removed and the salary month balance will be recalculated.
            </p>
            <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-3 text-sm text-amber-400">
              ⚠️ This action cannot be undone.
            </div>
            <DialogFooter className="pt-2 gap-2">
              <Button
                variant="outline"
                onClick={() => setDeleteTxnConfirm(null)}
                className="flex-1 font-bold h-11 border-[#1e3464] text-[#e2e8f0] hover:bg-[#1e3464] bg-transparent"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteTxn}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold h-11"
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
