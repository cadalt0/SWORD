"use client";

import { motion } from "motion/react";
import { Banknote, Code2, LayoutDashboard, LogOut, Receipt, Repeat, RotateCcw, Settings, ShieldCheck, ShoppingBag } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { Logo } from "./kit";

export type Section = "overview" | "orders" | "subscriptions" | "pay" | "refunds" | "purchases" | "cashout" | "permission" | "developers" | "account";

type Item = { id: Section; label: string; icon: typeof LayoutDashboard };

const GROUPS: Record<"merchant" | "customer", { label: string; items: Item[] }[]> = {
  merchant: [
    {
      label: "Business",
      items: [
        { id: "overview", label: "Overview", icon: LayoutDashboard },
        { id: "orders", label: "Orders", icon: Receipt },
        { id: "subscriptions", label: "Subscriptions", icon: Repeat },
        { id: "refunds", label: "Refunds", icon: RotateCcw },
        { id: "cashout", label: "Cash out", icon: Banknote },
      ],
    },
    {
      label: "Settings",
      items: [
        { id: "permission", label: "Permission", icon: ShieldCheck },
        { id: "developers", label: "Developers", icon: Code2 },
        { id: "account", label: "Account", icon: Settings },
      ],
    },
  ],
  customer: [
    {
      label: "Wallet",
      items: [
        { id: "overview", label: "Overview", icon: LayoutDashboard },
        { id: "pay", label: "Pay", icon: ShoppingBag },
        { id: "refunds", label: "Refunds", icon: RotateCcw },
        { id: "cashout", label: "Cash out", icon: Banknote },
      ],
    },
    {
      label: "Settings",
      items: [
        { id: "permission", label: "Permission", icon: ShieldCheck },
        { id: "account", label: "Account", icon: Settings },
      ],
    },
  ],
};

/// The app sidebar: navigation for the user's role, and the signed-in user at the bottom.
export function AppSidebar({
  role,
  custodial,
  email,
  name,
  section,
  onSection,
  onSignOut,
}: {
  role: "customer" | "merchant";
  custodial: boolean;
  email: string;
  name?: string | null;
  section: Section;
  onSection: (s: Section) => void;
  onSignOut: () => void;
}) {
  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader className="pb-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="hover:bg-transparent active:bg-transparent" onClick={() => onSection("overview")}>
              <Logo size={32} />
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate text-[15px] font-semibold tracking-tight">Sword</span>
                <span className="truncate text-xs text-muted-foreground">{role === "merchant" ? "Merchant workspace" : "Customer"}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {GROUPS[role].map((group) => {
          const items = group.items.filter((item) => !(custodial && item.id === "permission"));
          if (items.length === 0) return null;
          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel className="text-[11px] uppercase tracking-[0.1em]">{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {items.map((item) => {
                    const active = section === item.id;
                    return (
                      <SidebarMenuItem key={item.id} className="relative">
                        {active && (
                          <motion.span
                            layoutId="sidebar-active"
                            className="absolute inset-0 rounded-md bg-sidebar-accent shadow-[inset_0_0_0_1px_var(--sidebar-border)]"
                            transition={{ type: "spring", stiffness: 500, damping: 40 }}
                          />
                        )}
                        <SidebarMenuButton
                          isActive={active}
                          tooltip={item.label}
                          onClick={() => onSection(item.id)}
                          className={cn("relative h-9 bg-transparent font-medium data-active:bg-transparent", active ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
                        >
                          <item.icon className={cn(active && "text-brand")} />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="Sign out" onClick={onSignOut} className="group/user">
              <Avatar className="size-8 rounded-lg">
                <AvatarFallback className="rounded-lg bg-[linear-gradient(135deg,oklch(0.6_0.2_285),oklch(0.55_0.15_220))] text-xs font-semibold text-white">
                  {(name ?? email).slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{name ?? email.split("@")[0]}</span>
                <span className="truncate text-xs text-muted-foreground">{email}</span>
              </div>
              <LogOut className="ml-auto size-4 text-muted-foreground transition-colors group-hover/user:text-foreground" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
