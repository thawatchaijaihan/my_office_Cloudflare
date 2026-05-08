"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useDashboardAuth } from "./DashboardAuthContext";
import DashboardNav from "./DashboardNav";
import { useDashboardFetch } from "./useDashboardFetch";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "บัตรผ่านยานพาหนะ",
  "/dashboard/personnel": "ข้อมูลรายชื่อกำลังพล",
  "/dashboard/review": "รายการขอบัตรผ่าน",
  "/dashboard/access": "อนุมัติการเข้าถึงแดชบอร์ด",
  "/dashboard/invalid": "ข้อมูลไม่ถูกต้อง",
  "/dashboard/pending-check": "รอการตรวจสอบข้อมูล",
  "/dashboard/pending-send": "รอนำเรียนส่ง ฝขว.พล.ป.",
  "/dashboard/pending-approval": "รออนุมัติจาก ฝขว.พล.ป.",
  "/dashboard/cctv-map": "ข้อมูลกล้องวงจรปิด",
};

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut, skipAuth } = useDashboardAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const dashboardFetch = useDashboardFetch();
  const pageTitle = PAGE_TITLES[pathname] ?? "แดชบอร์ด";

  const [isSyncing, setIsSyncing] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const handleSync = async () => {
    if (isSyncing) return;
    try {
      setIsSyncing(true);
      const res = await dashboardFetch("/api/admin/sync-personnel", { method: "POST" });
      if (!res.ok) throw new Error("Sync failed");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (skipAuth) return;
    if (!loading && !user) {
      router.replace("/");
    }
  }, [user, loading, skipAuth, router]);

  if (!skipAuth && (loading || !user)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <p className="text-slate-500">กำลังโหลด...</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden bg-slate-100">
      <aside
        className={`flex h-full shrink-0 flex-col bg-slate-800 text-white transition-all duration-300 ease-in-out ${
          isSidebarOpen ? "w-64 md:w-56 lg:w-64" : "w-0 overflow-hidden"
        }`}
        aria-label="เมนูด้านข้าง"
      >
        <div className="h-14 shrink-0 border-b border-slate-700 px-4 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-800 overflow-hidden"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-xl font-bold">
              J
            </div>
            <div className={`min-w-0 transition-opacity duration-300 ${isSidebarOpen ? "opacity-100" : "opacity-0"}`}>
              <div className="truncate font-semibold text-sm">ระบบขอบัตรผ่าน</div>
              <div className="text-xs text-slate-400">Jaihan Assistant</div>
            </div>
          </Link>
          {isSidebarOpen && (
            <button
              onClick={handleSync}
              disabled={isSyncing}
              title="ซิงค์ข้อมูลจาก Sheets"
              className={`p-2 rounded-lg transition-all ${
                isSyncing 
                  ? "bg-slate-700 text-slate-500 cursor-not-allowed" 
                  : "text-emerald-400 hover:bg-slate-700 hover:text-emerald-300"
              }`}
            >
              <svg className={`w-5 h-5 ${isSyncing ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
        </div>
        <DashboardNav />
        <div className="shrink-0 border-t border-slate-700 p-3">
          {user && !skipAuth ? (
            <button
              type="button"
              onClick={() => signOut()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 truncate"
            >
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className={isSidebarOpen ? "opacity-100" : "opacity-0"}>ออกจากระบบ</span>
            </button>
          ) : (
            <Link
              href="/"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 truncate"
            >
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className={isSidebarOpen ? "opacity-100" : "opacity-0"}>กลับหน้าหลัก</span>
            </Link>
          )}
        </div>
      </aside>

      <main className="flex min-h-0 flex-1 flex-col bg-slate-100 min-[400px]:min-w-0" role="main">
        {pathname === "/dashboard/cctv-map" ? (
          <div className="min-h-0 flex flex-1 flex-col">
            <header className="flex h-14 shrink-0 items-center gap-4 border-b bg-white px-4 md:px-6">
              <button
                type="button"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border text-slate-500 hover:bg-slate-50 focus:outline-none"
                aria-label={isSidebarOpen ? "ซ่อนเมนู" : "แสดงเมนู"}
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isSidebarOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
              <h1 className="flex-1 text-xl sm:text-2xl font-bold text-slate-700">{pageTitle}</h1>
            </header>
            <div className="min-h-0 flex-1">{children}</div>
          </div>
        ) : (
          <>
            <header className="flex h-14 shrink-0 items-center gap-4 border-b bg-white px-4 md:px-6">
              <button
                type="button"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border text-slate-500 hover:bg-slate-50 focus:outline-none"
                aria-label={isSidebarOpen ? "ซ่อนเมนู" : "แสดงเมนู"}
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isSidebarOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
              <h1 className="flex-1 text-xl sm:text-2xl font-bold text-slate-700">{pageTitle}</h1>
            </header>
            <div className="min-h-0 flex-1 overflow-auto">{children}</div>
          </>
        )}
      </main>

      {/* Global Toast Notification */}
      {showToast && (
        <div className="fixed bottom-6 right-6 z-[100] animate-bounce">
          <div className="bg-emerald-600 text-white px-4 py-2 rounded-lg shadow-xl text-sm font-medium border border-emerald-500 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
            ซิงค์ข้อมูลสำเร็จ! ✨
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardAuthGate({ children }: { children: React.ReactNode }) {
  return (
    <DashboardContent>{children}</DashboardContent>
  );
}
