"use client";

import { Calendar } from "lucide-react";
import { format } from "date-fns";

interface NavbarProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function Navbar({ title, subtitle, actions }: NavbarProps) {
  return (
    <header className="h-16 bg-card border-b border-border flex items-center px-6 sticky top-0 z-20">
      <div className="flex-1">
        <h1 className="text-lg font-semibold text-foreground leading-tight">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {actions}
        <div className="flex items-center gap-1.5 text-muted-foreground text-xs bg-muted/50 px-3 py-1.5 rounded-lg border border-border">
          <Calendar className="w-3.5 h-3.5" />
          {format(new Date(), "dd MMM yyyy")}
        </div>
      </div>
    </header>
  );
}
