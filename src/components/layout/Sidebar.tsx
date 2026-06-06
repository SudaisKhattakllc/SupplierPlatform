"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
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
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const memoizedNavItems = useMemo(() => navItems, []);

  const closeMobile = () => setMobileOpen(false);

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 md:hidden w-10 h-10 rounded-lg bg-[#0a1020] text-white flex items-center justify-center shadow-lg border border-[#1e3464]"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm"
          onClick={closeMobile}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-full w-[220px] bg-[#0a1020] text-white border-r border-[#1e3464] flex flex-col z-40 transition-transform duration-300",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "md:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b border-[#1e3464] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] flex items-center justify-center shadow-lg flex-shrink-0">
              <Package2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-white text-sm leading-tight">SupplierTrack</p>
              <p className="text-[10px] text-[#8faac3] uppercase tracking-widest">KSA Management</p>
            </div>
          </div>
          <button onClick={closeMobile} className="md:hidden text-[#8faac3] hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {memoizedNavItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                prefetch={true}
                onMouseEnter={() => router.prefetch(href)}
                onFocus={() => router.prefetch(href)}
                onClick={closeMobile}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all group min-h-[44px]",
                  active
                    ? "bg-gradient-to-r from-[#3b82f6] to-[#2563eb] text-white shadow-lg shadow-blue-900/30"
                    : "text-[#8faac3] hover:text-white hover:bg-[#162040]"
                )}
              >
                <Icon
                  className={cn(
                    "w-4 h-4 flex-shrink-0",
                    active ? "text-white" : "text-[#8faac3] group-hover:text-white"
                  )}
                />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Footer info */}
        <div className="px-3 pb-5 border-t border-[#1e3464] pt-4">
          <div className="px-3">
            <p className="text-xs font-semibold text-white truncate">SupplierTrack</p>
            <p className="text-[11px] text-[#8faac3] truncate">KSA Management System</p>
          </div>
        </div>
      </aside>
    </>
  );
}
