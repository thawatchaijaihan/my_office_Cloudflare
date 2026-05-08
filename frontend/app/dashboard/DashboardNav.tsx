"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDashboardAuth } from "./DashboardAuthContext";
import { NAV_ITEMS, type NavItem } from "./navData";
import { useDashboardFetch } from "./useDashboardFetch";
import { useState } from "react";

const APPROVER_EMAIL = (process.env.NEXT_PUBLIC_DASHBOARD_APPROVER_EMAIL ?? "").trim().toLowerCase();

const iconClass = "w-5 h-5 shrink-0";

function NavIcon({ icon }: { icon: NavItem["icon"] }) {
  switch (icon) {
    case "dashboard":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      );
    case "personnel":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      );
    case "review":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      );
    case "pending-check":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      );
    case "pending-send":
      return (
        <svg className={`${iconClass} rotate-90`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      );
    case "pending-approval":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "invalid":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    case "cctv":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      );
    default:
      return null;
  }
}

export default function DashboardNav() {
  const pathname = usePathname();
  const { user } = useDashboardAuth();
  const dashboardFetch = useDashboardFetch();
  const isApprover = APPROVER_EMAIL && user?.email?.toLowerCase() === APPROVER_EMAIL;
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const visibleItems = NAV_ITEMS;

  const groupedHrefs = new Set([
    "/dashboard",
    "/dashboard/review",
    "/dashboard/pass-request",
    "/dashboard/pending-check",
    "/dashboard/pending-send",
    "/dashboard/pending-approval",
    "/dashboard/invalid",
    "/dashboard/personnel",
    "/dashboard/cctv-map",
  ]);

  const itemByHref = new Map(visibleItems.map((item) => [item.href, item]));
  const resolveItems = (hrefs: string[]) =>
    hrefs
      .map((href) => itemByHref.get(href))
      .filter((item): item is NavItem => Boolean(item));

  const menuGroups: Array<{ key: string; label?: string; items: NavItem[] }> = [
    {
      key: "main",
      items: resolveItems([
        "/dashboard",
        "/dashboard/personnel",
        "/dashboard/cctv-map",
        "/dashboard/review",
        "/dashboard/pass-request",
        "/dashboard/pending-check",
        "/dashboard/pending-send",
        "/dashboard/pending-approval",
        "/dashboard/invalid",
      ]),
    },
  ];

  const adminItems = visibleItems.filter((item) => !groupedHrefs.has(item.href));
  if (adminItems.length > 0) {
    menuGroups.push({ key: "admin", label: "ผู้ดูแลระบบ", items: adminItems });
  }

  const nonEmptyGroups = menuGroups.filter((group) => group.items.length > 0);

  return (
    <nav className="flex-1 overflow-y-auto p-3" aria-label="เมนูหลัก">
      <div className="space-y-3">
        {nonEmptyGroups.map((group, groupIndex) => (
          <section
            key={group.key}
            className={groupIndex === 0 ? "" : "pt-3"}
          >
            {group.label ? (
              <h3 className="mb-2 px-3 text-[11px] font-semibold tracking-wide text-slate-400">{group.label}</h3>
            ) : null}
            <ul className="space-y-1" role="list">
              {group.items.map((item) => {
                let isActive = item.exact
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(item.href + "/");
                
                if (item.href === "/dashboard" && (pathname === "/dashboard/personnel" || pathname === "/dashboard/cctv-map")) {
                  isActive = false;
                }

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                        isActive
                          ? "bg-emerald-600/90 text-white font-medium"
                          : "text-slate-300 hover:bg-slate-700/50 hover:text-white"
                      }`}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <NavIcon icon={item.icon} />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {/* Sync Button at Bottom */}
      <div className="mt-6 pt-6 border-t border-slate-700/50 px-3">
        <button
          onClick={async () => {
            if (isSyncing) return;
            try {
              setIsSyncing(true);
              const res = await dashboardFetch("/api/admin/sync-personnel", { method: "POST" });
              if (!res.ok) throw new Error("Sync failed");
              setShowToast(true);
              setTimeout(() => setShowToast(false), 3000);
              // We don't have an easy way to refresh the child page's internal state here,
              // but we can trigger a hard refresh if we really want, or just rely on the toast.
              // For now, let's just show the toast.
            } catch (e: any) {
              alert("Error: " + e.message);
            } finally {
              setIsSyncing(false);
            }
          }}
          disabled={isSyncing}
          className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
            isSyncing
              ? "bg-slate-800 text-slate-500 cursor-not-allowed"
              : "text-emerald-400 hover:bg-slate-700/50 hover:text-emerald-300 border border-emerald-900/30"
          }`}
        >
          <svg className={`w-5 h-5 ${isSyncing ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>{isSyncing ? "กำลังซิงค์..." : "ซิงค์ข้อมูลจาก Sheets"}</span>
        </button>
      </div>

      {/* Mini Toast */}
      {showToast && (
        <div className="fixed bottom-6 left-6 z-[60] animate-bounce">
          <div className="bg-emerald-600 text-white px-4 py-2 rounded-lg shadow-xl text-xs font-medium border border-emerald-500">
            ซิงค์ข้อมูลสำเร็จ! ✨
          </div>
        </div>
      )}
    </nav>
  );
}
