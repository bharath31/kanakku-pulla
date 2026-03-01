"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  FileText,
  Settings,
  LogOut,
  Sparkles,
} from "lucide-react";
import { clearToken } from "@/lib/auth";

const navItems = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Transactions", href: "/transactions", icon: Receipt },
  { title: "Statements", href: "/statements", icon: FileText },
  { title: "Settings", href: "/settings", icon: Settings },
];

export function AppSidebar({ expanded = false }: { expanded?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();

  function handleLogout() {
    clearToken();
    router.replace("/login");
  }

  if (expanded) {
    // Mobile expanded sidebar
    return (
      <div className="w-56 h-full bg-background border-r border-border flex flex-col">
        <div className="px-4 py-5 border-b border-border">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="font-bold text-sm">Kanakku Pulla</span>
          </div>
        </div>
        <nav className="flex-1 py-4 px-2 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.title}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-2">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted w-full transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    );
  }

  // Desktop slim icon rail
  return (
    <div className="w-14 h-full bg-background border-r border-border flex flex-col items-center group hover:w-48 transition-all duration-200 overflow-hidden shrink-0">
      {/* Logo */}
      <div className="w-full px-3 py-4 border-b border-border flex items-center gap-2.5 min-h-[56px]">
        <Sparkles className="h-5 w-5 text-primary shrink-0 ml-0.5" />
        <span className="font-bold text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          Kanakku Pulla
        </span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 w-full py-4 px-2 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.title}
              className={`flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0 ml-0.5" />
              <span className="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                {item.title}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="w-full border-t border-border p-2">
        <button
          onClick={handleLogout}
          title="Sign out"
          className="flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted w-full transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0 ml-0.5" />
          <span className="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            Sign out
          </span>
        </button>
      </div>
    </div>
  );
}
