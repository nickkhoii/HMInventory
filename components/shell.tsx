"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  FlaskConical,
  LayoutDashboard,
  Package,
  Tags,
  MapPin,
  ArrowDownToLine,
  ArrowUpFromLine,
  SlidersHorizontal,
  TriangleAlert,
  Search,
  Trash2,
  History,
  FileChartColumn,
  ClipboardList,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from "lucide-react";
import { api, label } from "./ui";
const nav = [
  ["dashboard", "Dashboard", LayoutDashboard],
  ["inventory", "Inventory", Package],
  ["categories", "Categories", Tags],
  ["locations", "Locations", MapPin],
  ["borrow-items", "Borrow Items", ArrowUpFromLine],
  ["return-items", "Return Items", ArrowDownToLine],
  ["borrowing-history", "Borrowing History", History],
  ["stock-in", "Stock In", ArrowDownToLine],
  ["stock-out", "Stock Out", ArrowUpFromLine],
  ["adjustments", "Adjustments", SlidersHorizontal],
  ["damaged", "Damaged Items", TriangleAlert],
  ["lost", "Lost / Missing", Search],
  ["disposal", "Disposal", Trash2],
  ["transactions", "Transactions", History],
  ["reports", "Reports", FileChartColumn],
  ["activity", "Activity Logs", ClipboardList],
  ["settings", "Settings", Settings],
] as const;
export function Shell({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  useEffect(() => {
    const expired = () => {
      router.replace("/login");
      router.refresh();
    };
    window.addEventListener("hm:session-expired", expired);
    return () => window.removeEventListener("hm:session-expired", expired);
  }, [router]);
  const path = usePathname(),
    [open, setOpen] = useState(false),
    [error, setError] = useState("");
  const section = path.split("/")[1];
  async function signOut() {
    try {
      await api("auth/logout", "POST", {});
      router.push("/login");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="app-shell">
      {open && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <Link href="/dashboard" className="brand">
          <span className="brand-icon">
            <FlaskConical size={22} />
          </span>
          <div>
            <strong>HM LABORATORY</strong>
            <small>Inventory Management</small>
          </div>
        </Link>
        <button
          className="mobile-close icon-button"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        >
          <X />
        </button>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {nav.map(([slug, title, Icon], index) => (
            <div key={slug}>
              {index === 4 && <div className="nav-label">STOCK & RECORDS</div>}
              {index === 10 && <div className="nav-label">ADMINISTRATION</div>}
              <Link
                className={section === slug ? "active" : ""}
                href={`/${slug}`}
                onClick={() => setOpen(false)}
              >
                <Icon size={18} />
                {title}
                {section === slug && <span className="active-dot" />}
              </Link>
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="avatar">{name.slice(0, 1)}</span>
          <div>
            <strong>{name}</strong>
            <small>Administrator</small>
          </div>
          <button
            className="icon-button"
            aria-label="Log out"
            onClick={signOut}
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            <button
              className="mobile-menu icon-button"
              onClick={() => setOpen(true)}
              aria-label="Open navigation"
            >
              <Menu />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>
              {nav.find((n) => n[0] === section)?.[1] ?? label(section)}
            </strong>
          </div>
          <span className="admin-status">
            <span /> Administrator
          </span>
        </header>
        <main>
          {error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
          {children}
        </main>
        <footer className="page-footer">
          HM Laboratory Inventory Management System{" "}
          <span>Organized inventory. Better operations.</span>
        </footer>
      </div>
    </div>
  );
}
