"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Building2,
  ClipboardList,
  FileCheck2,
  FileInput,
  FileOutput,
  LayoutDashboard,
  Send,
  Settings2,
  Users,
  UsersRound,
} from "lucide-react";
import type { PermissionKey } from "@/lib/auth/permissions";

interface NavigationItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  permission?: PermissionKey;
  enabled: boolean;
}

const navigation: NavigationItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, enabled: true },
  { label: "Incoming Documents", href: "/documents", icon: FileInput, permission: "document:read", enabled: true },
  { label: "Processing Queue", href: "/documents/queue", icon: ClipboardList, permission: "document:read", enabled: true },
  { label: "Outgoing Documents", href: "/outgoing", icon: FileOutput, permission: "document:read", enabled: true },
  { label: "Transmittals", href: "/transmittals", icon: Send, permission: "transmittal:read", enabled: true },
  { label: "Reports", href: "/reports", icon: BarChart3, permission: "report:export", enabled: true },
  { label: "Activity Logs", href: "/activity", icon: Activity, permission: "activity:read", enabled: true },
  { label: "User Management", href: "/admin/users", icon: Users, permission: "user:manage", enabled: true },
  { label: "Roles and Permissions", href: "/admin/roles", icon: Settings2, permission: "user:manage", enabled: true },
  { label: "Office Management", href: "/admin/offices", icon: Building2, permission: "office:manage", enabled: true },
  { label: "Focal Persons", href: "/admin/focal-persons", icon: UsersRound, permission: "focal-person:manage", enabled: true },
  { label: "Settings", href: "/settings", icon: Settings2, permission: "settings:manage", enabled: true },
];

interface SidebarProps {
  permissions: string[];
}

export function Sidebar({ permissions }: SidebarProps) {
  const pathname = usePathname();
  const visible = navigation.filter(
    (item) => item.enabled && (!item.permission || permissions.includes(item.permission)),
  );

  return (
    <aside className="hidden w-64 shrink-0 border-r bg-card md:flex md:flex-col print:hidden">
      <div className="flex h-16 items-center gap-3 border-b px-5">
        <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <FileCheck2 className="size-5" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">Document Tracking</p>
          <p className="text-[11px] text-muted-foreground">Transmittal Management</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {visible.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-4 text-[11px] leading-relaxed text-muted-foreground">
        Focal persons review physical documents and do not have application accounts.
      </div>
    </aside>
  );
}
