export interface Supplier {
  id: string
  name: string
  contact_person?: string
  phone?: string
  email?: string
  material_type?: string
  notes?: string
  created_at: string
}

export interface Delivery {
  id: string
  supplier_id: string
  material_name: string
  quantity: number
  unit: string
  unit_price: number
  total_value: number
  delivery_date: string
  notes?: string
  created_at: string
  suppliers?: { name: string }
}

export interface Payment {
  id: string
  supplier_id: string
  amount: number
  payment_method: string
  payment_date: string
  reference_number?: string
  notes?: string
  created_at: string
  suppliers?: { name: string }
}

export interface SupplierSummary {
  id: string
  name: string
  contact_person?: string
  material_type?: string
  phone?: string
  total_delivered: number
  total_paid: number
  balance_due: number
}

export interface Purchase {
  id: string
  supplier_id: string
  branch: string
  purchase_date: string
  payment_amount: number
  total_amount: number
  notes?: string
  created_at: string
  suppliers?: { name: string }
}

export interface PurchaseItem {
  id: string
  purchase_id: string
  item_name: string
  quantity: number
  unit_price: number
  total_price: number
}
