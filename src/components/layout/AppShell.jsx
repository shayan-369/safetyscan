import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { startWeeklyRun } from "@/lib/server-fns";
import { pvRoleOf } from "@/lib/pv";
import {
  Activity,
  ClipboardCheck,
  FileBarChart,
  FolderOpen,
  LayoutDashboard,
  Menu,
  Pill,
  ScrollText,
  SearchCheck,
  Settings as SettingsIcon,
  ShieldCheck,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/products", label: "Products & strategies", icon: Pill },
  { to: "/runs", label: "Search runs", icon: SearchCheck },
  { to: "/review", label: "Review queue", icon: ClipboardCheck },
  { to: "/cases", label: "Cases", icon: FolderOpen },
  { to: "/signals", label: "Signals", icon: Activity },
  { to: "/audit", label: "Audit trail", icon: ScrollText },
  { to: "/reports", label: "Reports", icon: FileBarChart },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

const MOBILE_NAV = NAV.slice(0, 4);

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [moreOpen, setMoreOpen] = useState(false);

  const role = pvRoleOf(user);
  const queryClient = useQueryClient();
  const startRun = useServerFn(startWeeklyRun);
  const [starting, setStarting] = useState(false);

  const launchRun = async () => {
    setStarting(true);
    try {
      const result = await startRun({});
      toast.success(`Weekly run started: ${result.totalHits} records, ${result.sentToReview} sent to review.`);
      queryClient.invalidateQueries({ queryKey: ["pv"] });
      navigate({ to: "/runs" });
    } catch (error) {
      toast.error(error?.message || "Could not start the weekly run.");
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="fixed inset-x-0 top-0 z-40 flex h-12 items-center justify-between gap-3 bg-[#0F172A] px-4 text-white">
        <div className="flex min-w-0 items-center gap-3">
          <Link to="/" className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#2DD4BF]" />
            <span className="text-[13px] font-bold tracking-[-0.01em]">SafetyScan</span>
            <span className="rounded border border-white/25 px-1 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-white/70">
              PV
            </span>
          </Link>
          <span className="hidden items-center gap-1.5 rounded border border-teal-400/40 bg-teal-400/10 px-2 py-0.5 text-[10px] font-semibold text-teal-200 md:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-300" />
            Health Canada · 15-day SLA
          </span>
          <span className="hidden items-center gap-1.5 text-[11px] text-white/60 lg:inline-flex">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            All date ranges continuous
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden rounded border border-white/20 px-2 py-0.5 text-[10px] font-semibold text-white/80 sm:inline-block">
            {role}
          </span>
          {role !== "Inspector" && (
            <button
              onClick={launchRun}
              disabled={starting}
              className="hidden rounded bg-[#0D9488] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#0B7F76] disabled:opacity-60 sm:inline-block"
            >
              {starting ? "Searching…" : "Start weekly run"}
            </button>
          )}
          <button
            onClick={() => logout()}
            className="rounded p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <aside className="group fixed bottom-0 left-0 top-12 z-30 hidden w-16 flex-col border-r border-[#E2E8F0] bg-white transition-[width] duration-200 hover:w-60 lg:flex">
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
          {NAV.map((item) => {
            const active = pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex h-10 items-center gap-3 overflow-hidden rounded-md px-2.5 text-[12px] font-medium transition-colors",
                  active
                    ? "bg-teal-50 text-[#0F766E]"
                    : "text-[#64748B] hover:bg-slate-50 hover:text-[#0F172A]",
                )}
              >
                <item.icon className={cn("h-4 w-4 shrink-0", active && "text-[#0D9488]")} />
                <span className="whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="pb-20 pt-12 lg:pb-8 lg:pl-16">
        <div className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6">{children}</div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t border-[#E2E8F0] bg-white lg:hidden">
        {MOBILE_NAV.map((item) => {
          const active = pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to));
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-semibold",
                active ? "text-[#0D9488]" : "text-[#64748B]",
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label.split(" ")[0]}
            </Link>
          );
        })}
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger className="flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-semibold text-[#64748B]">
            <Menu className="h-5 w-5" />
            More
          </SheetTrigger>
          <SheetContent side="bottom" className="pb-8">
            <SheetHeader>
              <SheetTitle className="text-left text-sm">All sections</SheetTitle>
            </SheetHeader>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center gap-2 rounded-md border border-[#E2E8F0] px-3 py-3 text-[12px] font-medium text-[#1E293B]"
                >
                  <item.icon className="h-4 w-4 text-[#0D9488]" />
                  {item.label}
                </Link>
              ))}
            </div>
            <button
              onClick={() => logout()}
              className="mt-3 w-full rounded-md border border-[#E2E8F0] px-3 py-3 text-[12px] font-semibold text-[#64748B]"
            >
              Sign out
            </button>
          </SheetContent>
        </Sheet>
      </nav>
    </div>
  );
}