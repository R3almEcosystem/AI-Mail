"use client";

import type { ComponentType } from "react";
import {
  Bot,
  Boxes,
  Inbox,
  LayoutDashboard,
  LogOut,
  MailCheck,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import type { SessionUser, UserRole } from "@/lib/types";
import { webPath } from "@/lib/web-path";

export type DashboardSection = "overview" | "inbox" | "ai" | "accounts" | "settings";

type IconComponent = ComponentType<{ size?: number; strokeWidth?: number }>;

const navItems: Array<{ id: DashboardSection; label: string; icon: IconComponent }> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "ai", label: "AI Rules", icon: Bot },
  { id: "accounts", label: "Accounts", icon: Boxes },
  { id: "settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  section,
  onSectionChange,
  unread,
  user,
}: {
  section: DashboardSection;
  onSectionChange: (section: DashboardSection) => void;
  unread: number;
  user: SessionUser;
}) {
  async function logout() {
    await fetch(webPath("/api/auth/logout"), { method: "POST" });
    window.location.assign(webPath("/login"));
  }

  return (
    <aside className="sidebar">
      <div className="brand-lockup">
        <span className="brand-mark" aria-hidden="true">r3</span>
        <span>
          <strong>r3alm</strong>
          <small>AI-MAIL</small>
        </span>
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        <p className="sidebar-label">WORKSPACE</p>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              className={section === item.id ? "nav-button nav-button--active" : "nav-button"}
              type="button"
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              aria-current={section === item.id ? "page" : undefined}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{item.label}</span>
              {item.id === "inbox" && unread > 0 ? <b>{unread}</b> : null}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-system-card">
        <span className="system-card-icon"><MailCheck size={18} /></span>
        <div>
          <strong>Mail operations</strong>
          <span>Console online</span>
        </div>
        <i aria-hidden="true" />
      </div>

      <div className="sidebar-bottom">
        {(user.role === "admin" || user.role === "super_admin") ? (
          <button type="button" className="nav-button nav-button--admin" onClick={() => window.location.assign(webPath("/admin"))}>
            <ShieldCheck size={18} strokeWidth={1.8} />
            <span>Admin Console</span>
          </button>
        ) : null}
        <button type="button" className="nav-button" onClick={() => onSectionChange("settings")}>
          <SlidersHorizontal size={18} strokeWidth={1.8} />
          <span>Configuration</span>
        </button>
        <button type="button" className="nav-button" onClick={logout}>
          <LogOut size={18} strokeWidth={1.8} />
          <span>Sign out</span>
        </button>
        <div className="profile-chip">
          <span className="avatar">{user.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span>
          <span><strong>{user.name}</strong><small>{({ super_admin: "Super Admin", admin: "Administrator", manager: "Manager", member: "Member", viewer: "Viewer" } satisfies Record<UserRole, string>)[user.role]}</small></span>
          <span className="profile-status" title="Online" />
        </div>
      </div>
    </aside>
  );
}
