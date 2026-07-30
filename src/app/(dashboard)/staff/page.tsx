"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useStaffData } from "@/hooks/use-staff-data";
import { Employee } from "@/types";
import { formatSAR, downloadPayslipsPDF } from "@/lib/format-utils";
import {
  Loader2,
  Plus,
  Search,
  Edit2,
  Eye,
  Trash2,
  UserCheck,
  Filter,
  Calendar as CalendarIcon,
  FileText,
  Lock,
  Banknote,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ─── Month name helper ───────────────────────────────────────
const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function StaffPage() {
  const { data, isLoading, mutate } = useStaffData();
  const { employees, salaryMonths } = data;
  const { toast } = useToast();

  // ─── State ─────────────────────────────────────────────────
  const now = useMemo(() => new Date(), []);
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  
  const [searchTerm, setSearchTerm] = useState("");
  const [filterBalance, setFilterBalance] = useState<"all" | "company_owes" | "employee_owes">("all");
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  
  const [showCreateConfirm, setShowCreateConfirm] = useState(false);
  const [closeConfirm, setCloseConfirm] = useState<{ id: string; name: string } | null>(null);
  
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);

const [formData, setFormData] = useState({
    name: "",
    iqama_no: "",
    job_title: "",
    phone: "",
    base_salary_sar: "",
    status: "active" as "active" | "inactive",
  });
  const [formErrors, setFormErrors] = useState<Record<string, boolean>>({});

  // ─── State for Transactions ────────────────────────────────
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [selectedTxEmployee, setSelectedTxEmployee] = useState<Record<string, unknown> | null>(null);
  const [txFormData, setTxFormData] = useState({ type: "advance", amount: "", note: "" });
  const [savingTx, setSavingTx] = useState(false);

  // ─── Build employee summaries with selected month's data ─────
  const employeeSummaries = useMemo(() => {
    return employees.map((emp) => {
      // Find salary_month for selected period
      const thisMonth = salaryMonths.find(
        (sm) => sm.employee_id === emp.id && sm.month === selectedMonth && sm.year === selectedYear
      );
      return {
        ...emp,
        thisMonthRecordId: thisMonth?.id,
        thisMonthPaid: thisMonth?.total_paid ?? 0,
        thisMonthBalance: thisMonth?.balance ?? emp.base_salary_sar,
        hasMonthRecord: !!thisMonth,
        monthStatus: thisMonth?.status || "none",
      };
    });
  }, [employees, salaryMonths, selectedMonth, selectedYear]);

// ─── Active employees without a record for selected month ────
  const activeEmployeesWithoutMonth = useMemo(() => {
    return employeeSummaries.filter((e) => e.status === "active" && !e.hasMonthRecord);
  }, [employeeSummaries]);

  // ─── Current Month Transactions ────────────────────────────
  const currentMonthTransactions = useMemo(() => {
    const currentMonthIds = employeeSummaries.map(e => e.thisMonthRecordId).filter(Boolean);
    return data.transactions.filter(t => currentMonthIds.includes(t.salary_month_id));
  }, [data.transactions, employeeSummaries]);

  // ─── Year options (2024 to current + 1) ──────────────────────
  const yearOptions = useMemo(() => {
    const years: number[] = [];
    for (let y = 2024; y <= now.getFullYear() + 1; y++) years.push(y);
    return years;
  }, [now]);

  // ─── Filter + Search ──────────────────────────────────────
  const filteredEmployees = useMemo(() => {
    return employeeSummaries.filter((emp) => {
      const matchesSearch =
        emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (emp.iqama_no?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
        (emp.job_title?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
        (emp.phone?.toLowerCase() || "").includes(searchTerm.toLowerCase());

      if (filterBalance === "company_owes") return matchesSearch && emp.thisMonthBalance > 0;
      if (filterBalance === "employee_owes") return matchesSearch && emp.thisMonthBalance < 0;
      return matchesSearch;
    });
  }, [employeeSummaries, searchTerm, filterBalance]);

  // ─── Form validation ──────────────────────────────────────
  const validateForm = () => {
    const errors: Record<string, boolean> = {};
    if (!formData.name.trim()) errors.name = true;
    if (!formData.base_salary_sar || Number(formData.base_salary_sar) <= 0) errors.base_salary_sar = true;
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ─── Save Employee (Add / Edit) ───────────────────────────
  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setSaving(true);

    const payload = {
      name: formData.name.trim(),
      iqama_no: formData.iqama_no.trim() || null,
      job_title: formData.job_title.trim() || null,
      phone: formData.phone.trim() || null,
      base_salary_sar: Number(formData.base_salary_sar),
      status: formData.status,
    };

    try {
      if (editingEmployee) {
        const { error } = await supabase
          .from("employees")
          .update(payload)
          .eq("id", editingEmployee.id);
        if (error) throw new Error(error.message);
        toast({ title: "Updated", description: "Employee updated successfully." });
      } else {
        const { error } = await supabase.from("employees").insert(payload);
        if (error) throw new Error(error.message);
        toast({ title: "Success", description: "New employee added." });
      }
      closeModal();
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

  // ─── Delete Employee ──────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      const { error } = await supabase
        .from("employees")
        .delete()
        .eq("id", deleteConfirm.id);
      if (error) throw error;
      toast({ title: "Deleted", description: `${deleteConfirm.name} removed.` });
      mutate();
      setDeleteConfirm(null);
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: (error as Error)?.message || "Failed to delete",
        variant: "destructive",
      });
    }
  };

  // ─── Create New Month ─────────────────────────────────────
  const handleCreateMonth = async () => {
    if (activeEmployeesWithoutMonth.length === 0) {
      toast({
        title: "Nothing to create",
        description: "All active employees already have records for this month.",
      });
      setShowCreateConfirm(false);
      return;
    }

    setCreating(true);
    try {
      const rows = activeEmployeesWithoutMonth.map((emp) => ({
        employee_id: emp.id,
        month: selectedMonth,
        year: selectedYear,
        base_salary: emp.base_salary_sar,
        total_paid: 0,
        status: "open",
      }));

      const { error } = await supabase.from("salary_months").insert(rows);
      if (error) throw new Error(error.message);

      toast({
        title: "Created",
        description: `Salary records created for ${rows.length} employees for ${MONTH_NAMES[selectedMonth]} ${selectedYear}.`,
      });
      setShowCreateConfirm(false);
      mutate();
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: (error as Error)?.message || "Failed to create month records",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  // ─── Close a salary month ────────────────────────────────
  const handleCloseMonth = async () => {
    if (!closeConfirm) return;
    try {
      const { error } = await supabase
        .from("salary_months")
        .update({ status: "closed" })
        .eq("id", closeConfirm.id);
      if (error) throw error;
      toast({
        title: "Closed",
        description: `${closeConfirm.name}'s month has been closed.`,
      });
      mutate();
      setCloseConfirm(null);
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: (error as Error)?.message || "Failed to close month",
        variant: "destructive",
      });
    }
  };

// ─── Save Transaction ──────────────────────────────────────
  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txFormData.amount || Number(txFormData.amount) <= 0) {
      toast({ title: "Error", description: "Enter a valid amount", variant: "destructive" });
      return;
    }
    setSavingTx(true);
    try {
      const { error } = await supabase.from("salary_transactions").insert({
        employee_id: selectedTxEmployee?.id as string,
        salary_month_id: selectedTxEmployee?.thisMonthRecordId as string,
        date: new Date().toISOString().split("T")[0],
        type: txFormData.type,
        amount: Number(txFormData.amount),
        note: txFormData.note || null,
      });
      if (error) throw new Error(error.message);
      toast({ title: "Success", description: "Transaction added successfully." });
      setIsTxModalOpen(false);
      mutate();
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: (error as Error).message || "Failed to add transaction",
        variant: "destructive",
      });
    } finally {
      setSavingTx(false);
    }
  };

  // ─── Modal helpers ────────────────────────────────────────
  const openAddModal = () => {
    setEditingEmployee(null);
    setFormData({ name: "", iqama_no: "", job_title: "", phone: "", base_salary_sar: "", status: "active" });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (emp: Employee) => {
    setEditingEmployee(emp);
    setFormData({
      name: emp.name,
      iqama_no: emp.iqama_no || "",
      job_title: emp.job_title || "",
      phone: emp.phone || "",
      base_salary_sar: String(emp.base_salary_sar),
      status: emp.status,
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingEmployee(null);
    setFormData({ name: "", iqama_no: "", job_title: "", phone: "", base_salary_sar: "", status: "active" });
    setFormErrors({});
  };

  // ─── Export to PDF ────────────────────────────────────────
  const exportPDF = () => {
    if (filteredEmployees.length === 0) return;
    
    // We export payslips for all filtered employees for this month
    downloadPayslipsPDF(filteredEmployees, data.transactions, selectedMonth, selectedYear);
    
    toast({
      title: "PDF Downloaded",
      description: "Payslips exported successfully.",
    });
  };

  // ─── Render ───────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1400px] mx-auto w-full">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] flex items-center justify-center">
            <UserCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Staff &amp; Payroll</h1>
            <p className="text-sm text-[#8faac3]">
              Manage employee details and monthly salaries
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8faac3]" />
            <input
              placeholder="Search staff..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-[#121e36] border border-[#1e3464] rounded-lg text-sm text-[#e2e8f0] placeholder-[#8faac3] outline-none focus:border-[#3b82f6] w-[200px]"
            />
          </div>
          <Button
            onClick={exportPDF}
            disabled={filteredEmployees.length === 0}
            variant="outline"
            className="font-bold gap-2 border-[#1e3464] text-[#8faac3] hover:text-white hover:bg-[#1e3464] bg-transparent"
          >
            <FileText className="w-4 h-4" /> Export Month
          </Button>
          <Button
            onClick={() => setShowCreateConfirm(true)}
            variant="outline"
            className="font-bold gap-2 border-[#1e3464] text-[#e2e8f0] hover:bg-[#1e3464] bg-transparent"
          >
            <CalendarIcon className="w-4 h-4" /> Create New Month
          </Button>
          <Button
            onClick={openAddModal}
            className="bg-gradient-to-r from-[#3b82f6] to-[#2563eb] hover:from-[#2563eb] hover:to-[#1d4ed8] text-white font-bold gap-2 shadow-lg"
          >
            <Plus className="w-4 h-4" /> Add Employee
          </Button>
        </div>
      </div>

      {/* ── Filters Bar (Month / Year / Status) ────────────── */}
      <div className="flex flex-col sm:flex-row items-center gap-4 bg-[#121e36] p-3 rounded-xl border border-[#1e3464]">
        {/* Month + Year selects */}
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-[#8faac3]" />
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="bg-[#0d1526] border border-[#1e3464] rounded-lg px-3 py-1.5 text-sm text-[#e2e8f0] outline-none focus:border-[#3b82f6]"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{MONTH_NAMES[m]}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-[#0d1526] border border-[#1e3464] rounded-lg px-3 py-1.5 text-sm text-[#e2e8f0] outline-none focus:border-[#3b82f6]"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div className="h-6 w-px bg-[#1e3464] hidden sm:block"></div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[#8faac3]" />
          <div className="flex bg-[#0d1526] rounded-lg border border-[#1e3464] p-0.5 gap-0.5">
            {([
              { key: "all", label: "All" },
              { key: "company_owes", label: "Company Owes" },
              { key: "employee_owes", label: "Employee Owes" },
            ] as const).map((f) => (
              <button
                key={f.key}
                onClick={() => setFilterBalance(f.key)}
                className={cn(
                  "px-3 py-1.5 text-xs font-bold rounded-md transition-all",
                  filterBalance === f.key
                    ? f.key === "company_owes"
                      ? "bg-emerald-600 text-white"
                      : f.key === "employee_owes"
                      ? "bg-red-600 text-white"
                      : "bg-[#3b82f6] text-white"
                    : "text-[#8faac3] hover:text-white"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="ml-auto text-sm text-[#8faac3]">
          <span className="font-bold text-white">{filteredEmployees.length}</span> employees
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────── */}
      <div className="bg-[#121e36] border border-[#1e3464] rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          {isLoading && employees.length === 0 ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-[#3b82f6]" />
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <UserCheck className="w-12 h-12 text-[#1e3464] mb-3" />
              <p className="text-[#8faac3] font-medium">No employees found for this month</p>
              <p className="text-[#8faac3] text-sm mt-1">
                Try adjusting your search or add a new employee.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#0a1422] border-b border-[#1e3464]">
                  <th className="text-left px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">#</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">Job Title / Phone</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">Base Salary</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">This Month Paid</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">Balance</th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">Month Status</th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp, idx) => (
                  <tr
                    key={emp.id}
                    className="border-b border-[#1e3464]/50 hover:bg-[#162040] transition-colors"
                  >
                    <td className="px-4 py-3.5 text-[#8faac3] text-xs">{idx + 1}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {emp.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-semibold text-white block">{emp.name}</span>
                          {emp.iqama_no && <span className="text-[10px] text-[#8faac3] font-mono block">Iqama: {emp.iqama_no}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="text-xs">
                        {emp.job_title ? <span className="text-[#e2e8f0] font-medium">{emp.job_title}</span> : <span className="text-[#8faac3]">—</span>}
                        {emp.phone && <span className="text-[#8faac3] block mt-0.5">{emp.phone}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-[#e2e8f0]">
                      {formatSAR(emp.base_salary_sar)}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-amber-400">
                      {emp.hasMonthRecord ? formatSAR(emp.thisMonthPaid) : "—"}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold">
                      {emp.hasMonthRecord ? (
                        <span
                          className={
                            emp.thisMonthBalance > 0
                              ? "text-emerald-400"
                              : emp.thisMonthBalance < 0
                              ? "text-red-400"
                              : "text-[#8faac3]"
                          }
                        >
                          {formatSAR(emp.thisMonthBalance)}
                        </span>
                      ) : (
                        <span className="text-[#8faac3]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={cn(
                          "text-xs font-bold px-2.5 py-1 rounded-full",
                          emp.monthStatus === "open"
                            ? "bg-[#1e3464] text-[#3b82f6]"
                            : emp.monthStatus === "closed"
                            ? "bg-emerald-900/60 text-emerald-400"
                            : "bg-[#1e3464]/30 text-[#8faac3]"
                        )}
                      >
                        {emp.monthStatus === "open" ? "Open" : emp.monthStatus === "closed" ? "Closed" : "No Record"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-center gap-1.5">
                        <Link href={`/staff/${emp.id}`}>
                          <button
                            className="w-8 h-8 rounded-lg bg-[#1e3464] hover:bg-[#3b82f6] text-[#8faac3] hover:text-white transition-all flex items-center justify-center"
                            title="View Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </Link>
                        {emp.monthStatus === "open" && emp.thisMonthRecordId && (
                          <button
                            onClick={() =>
                              setCloseConfirm({
                                id: emp.thisMonthRecordId as string,
                                name: emp.name,
                              })
                            }
                            className="w-8 h-8 rounded-lg bg-amber-900/40 hover:bg-amber-600 text-amber-400 hover:text-white transition-all flex items-center justify-center"
                            title="Close Month"
                          >
                            <Lock className="w-3.5 h-3.5" />
                          </button>
                        )}
{emp.monthStatus === "open" && emp.thisMonthRecordId && (
                          <button
                            onClick={() => {
                              setSelectedTxEmployee(emp);
                              setTxFormData({ type: "advance", amount: "", note: "" });
                              setIsTxModalOpen(true);
                            }}
                            className="w-8 h-8 rounded-lg bg-emerald-900/40 hover:bg-emerald-600 text-emerald-400 hover:text-white transition-all flex items-center justify-center"
                            title="Add Transaction"
                          >
                            <Banknote className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => openEditModal(emp)}
                          className="w-8 h-8 rounded-lg bg-[#1e3464] hover:bg-[#2563eb] text-[#8faac3] hover:text-white transition-all flex items-center justify-center"
                          title="Edit Employee"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm({ id: emp.id, name: emp.name })}
                          className="w-8 h-8 rounded-lg bg-red-900/30 hover:bg-red-600 text-red-400 hover:text-white transition-all flex items-center justify-center"
                          title="Delete Employee"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Footer Totals ──────────────────────────────── */}
        {filteredEmployees.length > 0 && (
          <div className="px-5 py-3 bg-[#0a1422] border-t border-[#1e3464] flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs text-[#8faac3]">
              Showing <span className="text-white font-bold">{filteredEmployees.length}</span> employees
            </span>
            <div className="flex gap-6">
              <div className="text-right">
                <span className="text-xs text-[#8faac3]">Total Base: </span>
                <span className="text-sm font-bold text-white">
                  {formatSAR(filteredEmployees.reduce((a, e) => a + e.base_salary_sar, 0))}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs text-[#8faac3]">Total Paid: </span>
                <span className="text-sm font-bold text-amber-400">
                  {formatSAR(
                    filteredEmployees
                      .filter((e) => e.hasMonthRecord)
                      .reduce((a, e) => a + e.thisMonthPaid, 0)
                  )}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs text-[#8faac3]">Total Balance: </span>
                <span className="text-sm font-bold text-emerald-400">
                  {formatSAR(
                    filteredEmployees
                      .filter((e) => e.hasMonthRecord)
                      .reduce((a, e) => a + e.thisMonthBalance, 0)
                  )}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Monthly Ledger ─────────────────────────────────── */}
      <div className="mt-8">
        <h2 className="text-xl font-bold text-white mb-4">Monthly Ledger ({MONTH_NAMES[selectedMonth]} {selectedYear})</h2>
        <div className="bg-[#121e36] border border-[#1e3464] rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            {currentMonthTransactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <p className="text-[#8faac3] text-sm">No transactions found for this month.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#0a1422] border-b border-[#1e3464]">
                    <th className="text-left px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">Employee</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">Type</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">Amount</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-[#8faac3] uppercase tracking-wider">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {currentMonthTransactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-[#1e3464]/50 hover:bg-[#162040] transition-colors">
                      <td className="px-4 py-3 text-[#e2e8f0]">{new Date(tx.date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 font-medium text-white">{tx.employees?.name}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "text-xs font-bold px-2 py-1 rounded-full",
                          tx.type === "advance" ? "bg-red-900/40 text-red-400" : "bg-emerald-900/40 text-emerald-400"
                        )}>
                          {tx.type === "advance" ? "Advance (Owes)" : "Payment"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-[#e2e8f0]">{formatSAR(tx.amount)}</td>
                      <td className="px-4 py-3 text-[#8faac3]">{tx.note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ── Add Transaction Dialog ─────────────────────── */}
      <Dialog open={isTxModalOpen} onOpenChange={(open) => !open && setIsTxModalOpen(false)}>
        <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden border-none shadow-2xl bg-[#121e36]">
          <div className="bg-gradient-to-r from-[#0a1422] to-[#121e36] p-5 border-b border-[#1e3464]">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-white">Add Transaction</DialogTitle>
              <p className="text-[#8faac3] text-sm mt-1">
                For {selectedTxEmployee?.name as string}
              </p>
            </DialogHeader>
          </div>
          <form onSubmit={handleSaveTransaction} className="p-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[#e2e8f0] text-sm font-medium">Type</Label>
              <Select
                value={txFormData.type}
                onValueChange={(v) => setTxFormData({ ...txFormData, type: v })}
              >
                <SelectTrigger className="h-11 bg-[#0d1526] border-[#1e3464] text-[#e2e8f0]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#121e36] border-[#1e3464]">
                  <SelectItem value="advance" className="text-red-400 focus:bg-[#1e3464]">Advance (Employee Owes)</SelectItem>
                  <SelectItem value="payment" className="text-emerald-400 focus:bg-[#1e3464]">Payment (Company Owes)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[#e2e8f0] text-sm font-medium">Amount (SAR) *</Label>
              <Input
                type="number"
                min="1"
                step="0.01"
                value={txFormData.amount}
                onChange={(e) => setTxFormData({ ...txFormData, amount: e.target.value })}
                className="h-11 bg-[#0d1526] border border-[#1e3464] text-[#e2e8f0] focus:border-[#3b82f6]"
                placeholder="e.g. 500"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[#e2e8f0] text-sm font-medium">Note (Optional)</Label>
              <Input
                value={txFormData.note}
                onChange={(e) => setTxFormData({ ...txFormData, note: e.target.value })}
                className="h-11 bg-[#0d1526] border border-[#1e3464] text-[#e2e8f0] focus:border-[#3b82f6]"
                placeholder="e.g. Medical emergency"
              />
            </div>
            <DialogFooter className="pt-2 gap-2">
              <Button type="button" variant="outline" onClick={() => setIsTxModalOpen(false)} className="flex-1 font-bold h-11 border-[#1e3464] text-[#e2e8f0] hover:bg-[#1e3464] bg-transparent">Cancel</Button>
              <Button type="submit" disabled={savingTx} className="flex-1 bg-gradient-to-r from-[#3b82f6] to-[#2563eb] hover:from-[#2563eb] hover:to-[#1d4ed8] text-white font-bold h-11">
                {savingTx ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Add/Edit Employee Dialog ─────────────────────── */}
      <Dialog open={isModalOpen} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden border-none shadow-2xl bg-[#121e36]">
          <div className="bg-gradient-to-r from-[#0a1422] to-[#121e36] p-5 border-b border-[#1e3464]">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-white">
                {editingEmployee ? "Edit Employee" : "Add New Employee"}
              </DialogTitle>
              <p className="text-[#8faac3] text-sm mt-1">
                Fill in the employee details below.
              </p>
            </DialogHeader>
          </div>
          <form onSubmit={handleSaveEmployee} className="p-5 space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <Label className="text-[#e2e8f0] text-sm font-medium">Employee Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  if (formErrors.name) setFormErrors((p) => ({ ...p, name: false }));
                }}
                className={cn(
                  "h-11 bg-[#0d1526] border text-[#e2e8f0] placeholder-[#8faac3]",
                  formErrors.name ? "border-red-500" : "border-[#1e3464] focus:border-[#3b82f6]"
                )}
                placeholder="e.g. Ahmed Al-Farsi"
              />
            </div>

            {/* Iqama + Job Title */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[#e2e8f0] text-sm font-medium">Iqama No</Label>
                <Input
                  value={formData.iqama_no}
                  onChange={(e) => setFormData({ ...formData, iqama_no: e.target.value })}
                  className="h-11 bg-[#0d1526] border border-[#1e3464] text-[#e2e8f0] placeholder-[#8faac3] focus:border-[#3b82f6]"
                  placeholder="e.g. 2312345678"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[#e2e8f0] text-sm font-medium">Job Title</Label>
                <Input
                  value={formData.job_title}
                  onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                  className="h-11 bg-[#0d1526] border border-[#1e3464] text-[#e2e8f0] placeholder-[#8faac3] focus:border-[#3b82f6]"
                  placeholder="e.g. Mason"
                />
              </div>
            </div>

            {/* Phone + Base Salary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[#e2e8f0] text-sm font-medium">Phone Number</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="h-11 bg-[#0d1526] border border-[#1e3464] text-[#e2e8f0] placeholder-[#8faac3] focus:border-[#3b82f6]"
                  placeholder="e.g. 050-1234567"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[#e2e8f0] text-sm font-medium">Base Salary (SAR) *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.base_salary_sar}
                  onChange={(e) => {
                    setFormData({ ...formData, base_salary_sar: e.target.value });
                    if (formErrors.base_salary_sar) setFormErrors((p) => ({ ...p, base_salary_sar: false }));
                  }}
                  className={cn(
                    "h-11 bg-[#0d1526] border text-[#e2e8f0] placeholder-[#8faac3]",
                    formErrors.base_salary_sar
                      ? "border-red-500"
                      : "border-[#1e3464] focus:border-[#3b82f6]"
                  )}
                  placeholder="e.g. 3000"
                />
              </div>
            </div>
            
            {/* Status */}
            <div className="space-y-1.5">
              <Label className="text-[#e2e8f0] text-sm font-medium">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(v) => setFormData({ ...formData, status: v as "active" | "inactive" })}
              >
                <SelectTrigger className="h-11 bg-[#0d1526] border-[#1e3464] text-[#e2e8f0]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#121e36] border-[#1e3464]">
                  <SelectItem value="active" className="text-[#e2e8f0] focus:bg-[#1e3464]">Active</SelectItem>
                  <SelectItem value="inactive" className="text-[#e2e8f0] focus:bg-[#1e3464]">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={closeModal}
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
                {editingEmployee ? "Update Employee" : "Save Employee"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Create New Month Dialog ──────────────────────── */}
      <Dialog open={showCreateConfirm} onOpenChange={(open) => !open && setShowCreateConfirm(false)}>
        <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden border-none shadow-2xl bg-[#121e36]">
          <div className="bg-gradient-to-r from-[#0a1422] to-[#121e36] p-5 border-b border-[#1e3464]">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-white">
                Create New Month
              </DialogTitle>
              <p className="text-[#8faac3] text-sm mt-1">
                Generate salary records for {MONTH_NAMES[selectedMonth]} {selectedYear}
              </p>
            </DialogHeader>
          </div>
          <div className="p-5 space-y-4">
            {activeEmployeesWithoutMonth.length === 0 ? (
              <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-4 text-sm text-amber-400">
                All active employees already have salary records for this month.
              </div>
            ) : (
              <>
                <p className="text-sm text-[#8faac3]">
                  This will create salary records for{" "}
                  <strong className="text-white">
                    {activeEmployeesWithoutMonth.length} active employee{activeEmployeesWithoutMonth.length !== 1 ? "s" : ""}
                  </strong>{" "}
                  for <strong className="text-white">{MONTH_NAMES[selectedMonth]} {selectedYear}</strong>.
                </p>
                <div className="bg-[#0d1526] border border-[#1e3464] rounded-lg p-3 max-h-[200px] overflow-y-auto space-y-2">
                  {activeEmployeesWithoutMonth.map((emp) => (
                    <div key={emp.id} className="flex items-center justify-between text-sm">
                      <span className="text-[#e2e8f0]">{emp.name}</span>
                      <span className="text-[#8faac3] font-mono text-xs">{formatSAR(emp.base_salary_sar)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            <DialogFooter className="pt-2 gap-2">
              <Button
                variant="outline"
                onClick={() => setShowCreateConfirm(false)}
                className="flex-1 font-bold h-11 border-[#1e3464] text-[#e2e8f0] hover:bg-[#1e3464] bg-transparent"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateMonth}
                disabled={creating || activeEmployeesWithoutMonth.length === 0}
                className="flex-1 bg-gradient-to-r from-[#3b82f6] to-[#2563eb] hover:from-[#2563eb] hover:to-[#1d4ed8] text-white font-bold h-11"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Create {activeEmployeesWithoutMonth.length} Records
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Close Month Confirmation ─────────────────────── */}
      <Dialog open={!!closeConfirm} onOpenChange={(open) => !open && setCloseConfirm(null)}>
        <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden border-none shadow-2xl bg-[#121e36]">
          <div className="bg-amber-900/50 p-5 border-b border-amber-800">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-white">Close Month?</DialogTitle>
            </DialogHeader>
          </div>
          <div className="p-5 space-y-4">
            <p className="text-sm text-[#8faac3]">
              Close the salary month for{" "}
              <strong className="text-white">{closeConfirm?.name}</strong> for{" "}
              <strong className="text-white">
                {MONTH_NAMES[selectedMonth]} {selectedYear}
              </strong>
              ?
            </p>
            <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-3 text-sm text-amber-400">
              ⚠️ Closing a month prevents further transactions from being added to it.
            </div>
            <DialogFooter className="pt-2 gap-2">
              <Button
                variant="outline"
                onClick={() => setCloseConfirm(null)}
                className="flex-1 font-bold h-11 border-[#1e3464] text-[#e2e8f0] hover:bg-[#1e3464] bg-transparent"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCloseMonth}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold h-11"
              >
                Yes, Close
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ───────────────────── */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden border-none shadow-2xl bg-[#121e36]">
          <div className="bg-red-900/50 p-5 border-b border-red-800">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-white">Delete Employee?</DialogTitle>
            </DialogHeader>
          </div>
          <div className="p-5 space-y-4">
            <p className="text-sm text-[#8faac3]">
              This will permanently delete{" "}
              <strong className="text-white">{deleteConfirm?.name}</strong> and all
              their salary records.
            </p>
            <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-3 text-sm text-amber-400">
              ⚠️ This action cannot be undone.
            </div>
            <DialogFooter className="pt-2 gap-2">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 font-bold h-11 border-[#1e3464] text-[#e2e8f0] hover:bg-[#1e3464] bg-transparent"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDelete}
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
