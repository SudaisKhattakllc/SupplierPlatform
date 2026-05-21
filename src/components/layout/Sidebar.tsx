"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  Package,
  CreditCard,
  BarChart3,
  Package2,
  Menu,
  X,
  ShoppingCart,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/suppliers", label: "Suppliers", icon: Users },
  { href: "/purchases", label: "Purchases", icon: ShoppingCart },
  { href: "/stock", label: "Stock", icon: Package },
  { href: "/payments", label: "Payments", icon: CreditCard },
  { href: "/reports", label: "Reports", icon: BarChart3 },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = () => setMobileOpen(false);

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 md:hidden w-10 h-10 rounded-lg bg-[#1a1a2e] text-white flex items-center justify-center shadow-lg"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={closeMobile}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-full w-[220px] bg-[#1a1a2e] text-white border-r border-[#2d2d44] flex flex-col z-40 transition-transform duration-300",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "md:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b border-[#2d2d44] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#f59e0b] flex items-center justify-center shadow-lg flex-shrink-0">
              <Package2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-white text-sm leading-tight">SupplierTrack</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest">KSA Management</p>
            </div>
          </div>
          <button onClick={closeMobile} className="md:hidden text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                onClick={closeMobile}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all group min-h-[44px]",
                  active
                    ? "bg-[#f59e0b] text-white shadow-md"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                )}
              >
                <Icon className={cn("w-4 h-4 flex-shrink-0", active ? "text-white" : "text-slate-400 group-hover:text-white")} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Footer info */}
        <div className="px-3 pb-5 border-t border-[#2d2d44] pt-4">
          <div className="px-3">
            <p className="text-xs font-semibold text-white truncate">SupplierTrack</p>
            <p className="text-[11px] text-slate-400 truncate">KSA Management System</p>
          </div>
        </div>
      </aside>
    </>
  );
}
