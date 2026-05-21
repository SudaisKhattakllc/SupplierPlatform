"use client";

import React, { useState } from "react";
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
import { useAppData } from "@/hooks/use-data";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, ShoppingCart, Calendar } from "lucide-react";

const PREDEFINED_BRANCHES = [
  "Al Shifa",
  "Ad Dillam",
  "Mohammadia",
  "Exit 9 Number",
];

const PREDEFINED_ITEMS = [
  "drums",
  "oil",
  "paint Grease",
  "scrap",
  "IBCS different litres type",
  "plastic drums",
];

export default function PurchasesPage() {
  const { data: appData, isLoading: dataLoading, mutate } = useAppData();
  const { suppliers } = appData;
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    supplier_id: "",
    purchase_date: new Date().toISOString().split("T")[0],
    branch: "",
    custom_branch: "",
    payment_amount: "",
    notes: "",
  });

  const [items, setItems] = useState([
    { id: 1, item_name: "", custom_item_name: "", quantity: 1, unit_price: 0 },
  ]);

  const handleItemChange = (index: number, field: string, value: string | number) => {
    const newItems = [...items];
    (newItems[index] as Record<string, string | number>)[field] = value;
    setItems(newItems);
  };

  const addItem = () => {
    setItems([
      ...items,
      { id: Date.now(), item_name: "", custom_item_name: "", quantity: 1, unit_price: 0 },
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      const newItems = [...items];
      newItems.splice(index, 1);
      setItems(newItems);
    }
  };

  const calculateTotalAmount = () => {
    return items.reduce((acc, item) => acc + item.quantity * item.unit_price, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.supplier_id) {
      toast({ title: "Error", description: "Please select a supplier", variant: "destructive" });
      return;
    }

    const finalBranch = formData.branch === "Custom" ? formData.custom_branch : formData.branch;
    if (!finalBranch) {
      toast({ title: "Error", description: "Please specify a branch", variant: "destructive" });
      return;
    }

    // Validate items
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const finalItemName = item.item_name === "Custom" ? item.custom_item_name : item.item_name;
      if (!finalItemName) {
        toast({ title: "Error", description: `Please specify item name for item #${i + 1}`, variant: "destructive" });
        return;
      }
    }

    setIsLoading(true);

    try {
      const totalAmount = calculateTotalAmount();
      const paymentAmount = Number(formData.payment_amount) || 0;

      // 1. Insert Purchase
      const { data: purchaseData, error: purchaseError } = await supabase
        .from("purchases")
        .insert({
          supplier_id: formData.supplier_id,
          branch: finalBranch,
          purchase_date: formData.purchase_date,
          payment_amount: paymentAmount,
          total_amount: totalAmount,
          notes: formData.notes,
        })
        .select()
        .single();

      if (purchaseError) throw purchaseError;

      // 2. Insert Items
      const purchaseItemsData = items.map((item) => {
        const finalItemName = item.item_name === "Custom" ? item.custom_item_name : item.item_name;
        return {
          purchase_id: purchaseData.id,
          item_name: finalItemName,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.quantity * item.unit_price,
        };
      });

      const { error: itemsError } = await supabase
        .from("purchase_items")
        .insert(purchaseItemsData);

      if (itemsError) throw itemsError;

      toast({ title: "Success", description: "Purchase recorded successfully!" });
      mutate();
      
      // Reset form
      setFormData({
        supplier_id: "",
        purchase_date: new Date().toISOString().split("T")[0],
        branch: "",
        custom_branch: "",
        payment_amount: "",
        notes: "",
      });
      setItems([{ id: Date.now(), item_name: "", custom_item_name: "", quantity: 1, unit_price: 0 }]);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to record purchase";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  if (dataLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-10 h-10 animate-spin text-[#f59e0b]" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1000px] mx-auto w-full animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#1a1a2e] tracking-tight flex items-center gap-2">
            <ShoppingCart className="w-8 h-8 text-[#f59e0b]" /> Record Purchase
          </h1>
          <p className="text-sm text-[#64748b] font-medium mt-0.5">
            Add new stock purchases from your suppliers
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl border border-[#e2e8f0] shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1.5">
            <Label className="text-[#1a1a2e] text-sm font-medium">Supplier *</Label>
            <Select
              value={formData.supplier_id}
              onValueChange={(val) => setFormData({ ...formData, supplier_id: val })}
            >
              <SelectTrigger className="border-[#e2e8f0] h-11">
                <SelectValue placeholder="Select a supplier" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-1.5">
            <Label className="text-[#1a1a2e] text-sm font-medium">Purchase Date *</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748b]" />
              <Input
                type="date"
                required
                value={formData.purchase_date}
                onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                className="pl-10 border-[#e2e8f0] h-11"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[#1a1a2e] text-sm font-medium">Branch *</Label>
            <Select
              value={formData.branch}
              onValueChange={(val) => setFormData({ ...formData, branch: val })}
            >
              <SelectTrigger className="border-[#e2e8f0] h-11">
                <SelectValue placeholder="Select Branch" />
              </SelectTrigger>
              <SelectContent>
                {PREDEFINED_BRANCHES.map((b) => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
                <SelectItem value="Custom">Custom / Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.branch === "Custom" && (
            <div className="space-y-1.5">
              <Label className="text-[#1a1a2e] text-sm font-medium">Custom Branch Name *</Label>
              <Input
                required
                placeholder="Enter branch name"
                value={formData.custom_branch}
                onChange={(e) => setFormData({ ...formData, custom_branch: e.target.value })}
                className="border-[#e2e8f0] h-11"
              />
            </div>
          )}
        </div>

        <div className="border-t border-[#e2e8f0] pt-6">
          <div className="flex items-center justify-between mb-4">
            <Label className="text-lg font-bold text-[#1a1a2e]">Items Purchased</Label>
            <Button type="button" onClick={addItem} variant="outline" className="border-[#f59e0b] text-[#f59e0b] hover:bg-amber-50 h-9 gap-1.5">
              <Plus className="w-4 h-4" /> Add Item
            </Button>
          </div>
          
          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={item.id} className="p-4 bg-[#f8fafc] border border-[#e2e8f0] rounded-lg flex flex-col md:flex-row gap-4 items-start md:items-end">
                <div className="flex-1 w-full space-y-1.5">
                  <Label className="text-xs text-[#64748b] font-medium">Item Name *</Label>
                  <Select
                    value={item.item_name}
                    onValueChange={(val) => handleItemChange(index, "item_name", val)}
                  >
                    <SelectTrigger className="bg-white border-[#e2e8f0] h-10">
                      <SelectValue placeholder="Select item" />
                    </SelectTrigger>
                    <SelectContent>
                      {PREDEFINED_ITEMS.map((i) => (
                        <SelectItem key={i} value={i} className="capitalize">{i}</SelectItem>
                      ))}
                      <SelectItem value="Custom">Custom / Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {item.item_name === "Custom" && (
                  <div className="flex-1 w-full space-y-1.5">
                    <Label className="text-xs text-[#64748b] font-medium">Custom Item *</Label>
                    <Input
                      required
                      placeholder="Item name"
                      value={item.custom_item_name}
                      onChange={(e) => handleItemChange(index, "custom_item_name", e.target.value)}
                      className="bg-white border-[#e2e8f0] h-10"
                    />
                  </div>
                )}

                <div className="w-full md:w-[120px] space-y-1.5">
                  <Label className="text-xs text-[#64748b] font-medium">Quantity *</Label>
                  <Input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, "quantity", Number(e.target.value))}
                    className="bg-white border-[#e2e8f0] h-10"
                  />
                </div>

                <div className="w-full md:w-[150px] space-y-1.5">
                  <Label className="text-xs text-[#64748b] font-medium">Unit Price *</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={item.unit_price}
                    onChange={(e) => handleItemChange(index, "unit_price", Number(e.target.value))}
                    className="bg-white border-[#e2e8f0] h-10"
                  />
                </div>
                
                <div className="w-full md:w-[150px] space-y-1.5">
                  <Label className="text-xs text-[#64748b] font-medium">Total</Label>
                  <div className="h-10 flex items-center px-3 bg-white border border-[#e2e8f0] rounded-md text-sm font-bold text-[#1a1a2e]">
                    {(item.quantity * item.unit_price).toFixed(2)}
                  </div>
                </div>

                {items.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => removeItem(index)}
                    className="h-10 w-10 p-0 border-red-200 text-red-500 hover:bg-red-50 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-[#e2e8f0] pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1.5">
            <Label className="text-[#1a1a2e] text-sm font-medium">Payment Made Now (Optional)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={formData.payment_amount}
              onChange={(e) => setFormData({ ...formData, payment_amount: e.target.value })}
              className="border-[#e2e8f0] h-11"
            />
          </div>
          
          <div className="space-y-1.5">
            <Label className="text-[#1a1a2e] text-sm font-medium">Total Purchase Amount</Label>
            <div className="h-11 flex items-center px-4 bg-[#f8fafc] border border-[#e2e8f0] rounded-md text-lg font-bold text-[#1a1a2e]">
              SAR {calculateTotalAmount().toFixed(2)}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button
            type="submit"
            disabled={isLoading}
            className="bg-[#1a1a2e] hover:bg-[#2d2d44] text-white font-bold h-12 px-8 shadow-lg w-full md:w-auto"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Save Purchase Record
          </Button>
        </div>
      </form>
    </div>
  );
}
