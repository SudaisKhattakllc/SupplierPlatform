"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Package, CreditCard, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickUpdatePopupProps {
  isOpen: boolean;
  onClose: () => void;
  supplierId: string;
  supplierName: string;
  currentBalance: number;
  defaultTab?: "stock" | "payment";
  onSuccess?: () => void;
}

export default function QuickUpdatePopup({
  isOpen,
  onClose,
  supplierId,
  supplierName,
  currentBalance,
  defaultTab = "stock",
  onSuccess,
}: QuickUpdatePopupProps) {
  const [activeTab, setActiveTab] = useState<"stock" | "payment">(defaultTab);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  // Stock Form State
  const [materialName, setMaterialName] = useState("");
  const [quantity, setQuantity] = useState<number | "">("");
  const [unit, setUnit] = useState("units");
  const [pricePerUnit, setPricePerUnit] = useState<number | "">("");
  const [stockDate, setStockDate] = useState(new Date().toISOString().split("T")[0]);

  // Payment Form State
  const [amount, setAmount] = useState<number | "">("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [reference, setReference] = useState("");

  // Reset form when opened
  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
      setMaterialName("");
      setQuantity("");
      setUnit("units");
      setPricePerUnit("");
      setStockDate(new Date().toISOString().split("T")[0]);
      setAmount("");
      setPaymentMethod("Cash");
      setPaymentDate(new Date().toISOString().split("T")[0]);
      setReference("");
      setErrors({});
    }
  }, [isOpen, defaultTab]);

  const qtyNum = typeof quantity === "number" ? quantity : 0;
  const priceNum = typeof pricePerUnit === "number" ? pricePerUnit : 0;
  const amountNum = typeof amount === "number" ? amount : 0;

  const totalStockValue = qtyNum * priceNum;
  const remainingBalance = Math.max(0, currentBalance - amountNum);

  const formatSAR = (n: number) =>
    new Intl.NumberFormat("en-SA", {
      style: "currency",
      currency: "SAR",
      minimumFractionDigits: 2,
    }).format(n);

  const validateStock = () => {
    const newErrors: Record<string, boolean> = {};
    if (!materialName.trim()) newErrors.materialName = true;
    if (!quantity || qtyNum <= 0) newErrors.quantity = true;
    if (!pricePerUnit || priceNum <= 0) newErrors.pricePerUnit = true;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePayment = () => {
    const newErrors: Record<string, boolean> = {};
    if (!amount || amountNum <= 0) newErrors.amount = true;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveStock = async () => {
    if (!validateStock()) {
      toast({
        title: "Please fill required fields",
        description: "Material, quantity, and price are required.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("deliveries").insert({
        supplier_id: supplierId,
        material_name: materialName.trim(),
        quantity: qtyNum,
        unit,
        unit_price: priceNum,
        total_value: totalStockValue,
        delivery_date: stockDate,
      });

      if (error) throw error;

      toast({
        title: "Stock saved!",
        description: `Added ${qtyNum} ${unit} of ${materialName}.`,
      });

      onSuccess?.();
      onClose();
    } catch (error: unknown) {
      toast({
        title: "Error saving stock",
        description: (error as Error)?.message || "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSavePayment = async () => {
    if (!validatePayment()) {
      toast({
        title: "Please enter a valid amount",
        description: "Payment amount must be greater than 0.",
        variant: "destructive",
      });
      return;
    }

    // Validate payment doesn't exceed balance
    if (amountNum > currentBalance) {
      toast({
        title: "Payment exceeds balance",
        description: `You cannot pay more than the due amount of ${formatSAR(currentBalance)}. Please enter a smaller amount.`,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("payments").insert({
        supplier_id: supplierId,
        amount: amountNum,
        payment_method: paymentMethod,
        payment_date: paymentDate,
        reference_number: reference.trim() || undefined,
      });

      if (error) throw error;

      toast({
        title: "Payment saved!",
        description: `Balance updated. Remaining: ${formatSAR(remainingBalance)}`,
      });

      onSuccess?.();
      onClose();
    } catch (error: unknown) {
      toast({
        title: "Error saving payment",
        description: (error as Error)?.message || "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden border-none shadow-2xl max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-[#1a1a2e] p-5 text-white">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-lg font-bold text-white">
                  {supplierName}
                </DialogTitle>
                <p className="text-sm text-slate-400 mt-1">
                  Current Balance: <span className="text-white font-semibold">{formatSAR(currentBalance)}</span>
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </DialogHeader>

          {/* Tabs */}
          <div className="flex bg-[#2d2d44] p-1 rounded-lg mt-5">
            <button
              onClick={() => setActiveTab("stock")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-md transition-all min-h-[44px]",
                activeTab === "stock"
                  ? "bg-[#f59e0b] text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              )}
            >
              <Package className="w-4 h-4" />
              Add Stock
            </button>
            <button
              onClick={() => setActiveTab("payment")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-md transition-all min-h-[44px]",
                activeTab === "payment"
                  ? "bg-[#10b981] text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              )}
            >
              <CreditCard className="w-4 h-4" />
              Add Payment
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 bg-white space-y-4">
          {activeTab === "stock" ? (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="space-y-1.5">
                <Label htmlFor="material" className="text-[#1a1a2e] text-sm font-medium">
                  What material?
                </Label>
                <Input
                  id="material"
                  placeholder="White Marble Slab"
                  value={materialName}
                  onChange={(e) => {
                    setMaterialName(e.target.value);
                    if (errors.materialName) setErrors((p) => ({ ...p, materialName: false }));
                  }}
                  className={cn(
                    "border h-11 text-base",
                    errors.materialName ? "border-red-400 ring-1 ring-red-400" : "border-[#e2e8f0]"
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="quantity" className="text-[#1a1a2e] text-sm font-medium">
                    How many units?
                  </Label>
                  <Input
                    id="quantity"
                    type="number"
                    min={0}
                    value={quantity}
                    onChange={(e) => {
                      setQuantity(e.target.value === "" ? "" : Number(e.target.value));
                      if (errors.quantity) setErrors((p) => ({ ...p, quantity: false }));
                    }}
                    className={cn(
                      "border h-11 text-base",
                      errors.quantity ? "border-red-400 ring-1 ring-red-400" : "border-[#e2e8f0]"
                    )}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="unit" className="text-[#1a1a2e] text-sm font-medium">
                    Unit
                  </Label>
                  <Select value={unit} onValueChange={setUnit}>
                    <SelectTrigger className="border-[#e2e8f0] h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="units">units</SelectItem>
                      <SelectItem value="drums">drums</SelectItem>
                      <SelectItem value="boxes">boxes</SelectItem>
                      <SelectItem value="kg">kg</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="price" className="text-[#1a1a2e] text-sm font-medium">
                  Price per unit (SAR)
                </Label>
                <Input
                  id="price"
                  type="number"
                  min={0}
                  value={pricePerUnit}
                  onChange={(e) => {
                    setPricePerUnit(e.target.value === "" ? "" : Number(e.target.value));
                    if (errors.pricePerUnit) setErrors((p) => ({ ...p, pricePerUnit: false }));
                  }}
                  className={cn(
                    "border h-11 text-base",
                    errors.pricePerUnit ? "border-red-400 ring-1 ring-red-400" : "border-[#e2e8f0]"
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="stock-date" className="text-[#1a1a2e] text-sm font-medium">
                  Date received
                </Label>
                <Input
                  id="stock-date"
                  type="date"
                  value={stockDate}
                  onChange={(e) => setStockDate(e.target.value)}
                  className="border border-[#e2e8f0] h-11"
                />
              </div>

              <div className="pt-2 space-y-3">
                <div className="flex justify-between items-center p-3 bg-[#f8fafc] rounded-lg border border-[#e2e8f0]">
                  <span className="text-sm text-[#64748b] font-medium">Total:</span>
                  <span className="text-lg font-bold text-[#1a1a2e]">{formatSAR(totalStockValue)}</span>
                </div>
                <Button
                  onClick={handleSaveStock}
                  disabled={loading}
                  className="w-full bg-[#f59e0b] hover:bg-amber-600 text-white font-bold h-12 text-base min-h-[44px]"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Package className="w-4 h-4 mr-2" />}
                  Save Stock Entry
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="space-y-1.5">
                <Label htmlFor="amount" className="text-[#1a1a2e] text-sm font-medium">
                  How much paid? (SAR)
                </Label>
                <div className="relative">
                  <Input
                    id="amount"
                    type="number"
                    min={0}
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value === "" ? "" : Number(e.target.value));
                      if (errors.amount) setErrors((p) => ({ ...p, amount: false }));
                    }}
                    className={cn(
                      "border h-14 text-2xl font-bold text-center pr-12",
                      errors.amount ? "border-red-400 ring-1 ring-red-400" : "border-[#e2e8f0]"
                    )}
                    placeholder="0.00"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#64748b] font-bold text-sm">
                    SAR
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[#1a1a2e] text-sm font-medium">Payment method</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("Cash")}
                    className={cn(
                      "py-3 px-4 rounded-lg border text-sm font-semibold transition-all min-h-[44px]",
                      paymentMethod === "Cash"
                        ? "bg-[#10b981]/10 border-[#10b981] text-[#10b981]"
                        : "border-[#e2e8f0] text-[#64748b] hover:bg-[#f8fafc]"
                    )}
                  >
                    Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("Bank Transfer")}
                    className={cn(
                      "py-3 px-4 rounded-lg border text-sm font-semibold transition-all min-h-[44px]",
                      paymentMethod === "Bank Transfer"
                        ? "bg-[#10b981]/10 border-[#10b981] text-[#10b981]"
                        : "border-[#e2e8f0] text-[#64748b] hover:bg-[#f8fafc]"
                    )}
                  >
                    Bank Transfer
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pay-date" className="text-[#1a1a2e] text-sm font-medium">
                  Date
                </Label>
                <Input
                  id="pay-date"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="border border-[#e2e8f0] h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ref" className="text-[#1a1a2e] text-sm font-medium">
                  Reference / Note (optional)
                </Label>
                <Input
                  id="ref"
                  placeholder="TXN-9988"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="border border-[#e2e8f0] h-11"
                />
              </div>

              <div className="pt-2 space-y-3">
                <div className="p-3 bg-[#f8fafc] rounded-lg border border-[#e2e8f0]">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[#64748b] uppercase font-bold">After this payment:</span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-sm text-[#64748b]">Remaining balance</span>
                    <span className="text-lg font-bold text-[#1a1a2e]">{formatSAR(remainingBalance)}</span>
                  </div>
                </div>
                <Button
                  onClick={handleSavePayment}
                  disabled={loading}
                  className="w-full bg-[#10b981] hover:bg-emerald-600 text-white font-bold h-12 text-base min-h-[44px]"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CreditCard className="w-4 h-4 mr-2" />}
                  Save Payment
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
