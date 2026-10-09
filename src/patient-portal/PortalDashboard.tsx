"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  Calendar,
  FileText,
  Mail,
  Folder,
  Bell,
  CheckCircle2,
  Home,
  CreditCard,
  ClipboardList,
  MessageSquare,
  Phone,
  LogOut,
  ChevronDown,
  UserRound,
  ShieldCheck,
  LifeBuoy,
} from "lucide-react";
import { supportDestination, supportEmail } from "../shared/environment";

/**
 * Patient Portal self-service dashboard.
 * Import into the Patient Portal (Next.js or Vite) app, e.g.:
 *   import PortalDashboard from "@/components/patient-portal/PortalDashboard";
 * and import "../tokens/tokens.css" once at your app root.
 */

export interface Appointment {
  dateLabel: string;
  timeLabel: string;
  providerName: string;
  reason: string;
}

export interface TreatmentPlanProgress {
  label: string;
  completedSteps: number;
  totalSteps: number;
}

export interface RecentActivity {
  id: string;
  title: string;
  detail: string;
  occurredAt: string;
  target: "book" | "billing" | "forms" | "messages";
}

export interface PatientPortalDashboardProps {
  clinicName: string;
  patientFirstName: string;
  locationName: string;
  dateLabel?: string;
  upcomingAppointments?: Appointment[];
  balanceDue?: number;
  treatmentPlan?: TreatmentPlanProgress;
  unreadMessages?: number;
  documentCount?: number;
  contactPhone?: string;
  contactEmail?: string;
  recentActivity?: RecentActivity[];
  onReschedule?: () => void;
  onPay?: () => void;
  onBook?: () => void;
  onUpdateForms?: () => void;
  onMessage?: () => void;
  onOpenActivity?: (target: RecentActivity["target"]) => void;
  onViewAllActivity?: () => void;
  activePanel?: "home" | "book" | "billing" | "forms" | "messages" | "activity" | "account";
  bookingEnabled?: boolean;
  clinicWebsiteHref?: string;
  onNavigate?: (panel: "home" | "book" | "billing" | "forms" | "messages" | "activity" | "account") => void;
  onLogout?: () => void;
  panelContent?: ReactNode;
}

const DEFAULT_APPOINTMENTS: Appointment[] = [
  {
    dateLabel: "Tue, Oct 14",
    timeLabel: "2:30pm",
    providerName: "Dr. Chen",
    reason: "Cleaning & exam",
  },
  {
    dateLabel: "Wed, Dec 3",
    timeLabel: "10:00am",
    providerName: "Dr. Chen",
    reason: "Invisalign check-in",
  },
];

export function PatientPortalDashboard({
  clinicName,
  patientFirstName,
  locationName,
  dateLabel = "Thursday, October 9",
  upcomingAppointments = DEFAULT_APPOINTMENTS,
  balanceDue = 86.4,
  treatmentPlan,
  unreadMessages = 1,
  documentCount = 4,
  contactPhone = "",
  contactEmail = "",
  recentActivity = [],
  onReschedule,
  onPay,
  onBook,
  onUpdateForms,
  onMessage,
  onOpenActivity,
  onViewAllActivity,
  activePanel = "home",
  bookingEnabled = true,
  clinicWebsiteHref,
  onNavigate,
  onLogout,
  panelContent,
}: PatientPortalDashboardProps) {
  const [accountOpen, setAccountOpen] = useState(false);
  const [supportMessage, setSupportMessage] = useState("");
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const [nextAppointment, ...laterAppointments] = upcomingAppointments;
  const progressPct = treatmentPlan
    ? Math.round((treatmentPlan.completedSteps / treatmentPlan.totalSteps) * 100)
    : 0;
  const supportHref = supportDestination || (supportEmail ? `mailto:${supportEmail}` : "");
  const clinicPhoneHref = contactPhone ? `tel:${contactPhone.replace(/[^\d+]/g, "")}` : "";

  useEffect(() => {
    if (!accountOpen) return;
    const closeOutside = (event: MouseEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) setAccountOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAccountOpen(false);
        accountMenuRef.current?.querySelector<HTMLButtonElement>("[aria-haspopup='menu']")?.focus();
      }
    };
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [accountOpen]);

  function chooseAccountAction(action: () => void) {
    setAccountOpen(false);
    action();
  }

  return (
    <div className="min-h-screen bg-[var(--paper)] font-[var(--font-ui)] text-[var(--ink)]">
      {/* Top bar */}
      <header className="portal-topbar">
        <div className="portal-brand"><span>{clinicName}</span><small>Client Portal</small></div>
        <nav className="portal-desktop-nav" aria-label="Client Portal">
          <button aria-current={activePanel === "home" ? "page" : undefined} onClick={() => onNavigate?.("home")}>Home</button>
          {bookingEnabled && <button aria-current={activePanel === "book" ? "page" : undefined} onClick={() => onNavigate?.("book")}>Appointments</button>}
          <button aria-current={activePanel === "billing" ? "page" : undefined} onClick={() => onNavigate?.("billing")}>Billing</button>
          <button aria-current={activePanel === "forms" ? "page" : undefined} onClick={() => onNavigate?.("forms")}>Forms</button>
          <button aria-current={activePanel === "messages" ? "page" : undefined} onClick={() => onNavigate?.("messages")}>Messages</button>
        </nav>
        <div className="flex items-center gap-3">
          {contactPhone && <a className="portal-call" href={clinicPhoneHref}><Phone size={15} /> Call clinic</a>}
          <button
            type="button"
            aria-label="Notifications"
            onClick={onMessage}
            className="relative rounded-md p-2 text-[var(--ink-muted)] hover:bg-[var(--paper)]"
          >
            <Bell size={17} aria-hidden="true" />
            {unreadMessages > 0 && (
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[var(--danger)]" />
            )}
          </button>
          <div className="portal-account" ref={accountMenuRef}>
            <button type="button" aria-label="Account menu" aria-haspopup="menu" aria-expanded={accountOpen} onClick={() => setAccountOpen((open) => !open)} className="flex items-center gap-1.5 rounded-md py-1 pl-1 pr-1.5 hover:bg-[var(--paper)]"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--sage-tint)] text-xs font-medium text-[var(--sage-deep)]">{patientFirstName.charAt(0)}</span><ChevronDown size={14} className="text-[var(--ink-faint)]" aria-hidden="true" /></button>
            {accountOpen && <div className="portal-account-menu" role="menu">
              <button role="menuitem" onClick={() => chooseAccountAction(() => onNavigate?.("account"))}><UserRound size={15} /> My details</button>
              <button role="menuitem" onClick={() => chooseAccountAction(() => onNavigate?.("account"))}><ShieldCheck size={15} /> Security & password</button>
              <button role="menuitem" onClick={() => chooseAccountAction(() => onNavigate?.("forms"))}><Folder size={15} /> Forms & documents</button>
              {clinicPhoneHref && <a role="menuitem" href={clinicPhoneHref} onClick={() => setAccountOpen(false)}><Phone size={15} /> Call clinic</a>}
              {contactEmail && <a role="menuitem" href={`mailto:${contactEmail}`} onClick={() => setAccountOpen(false)}><Mail size={15} /> Email clinic</a>}
              {supportHref ? <a role="menuitem" href={supportHref} onClick={() => setAccountOpen(false)}><LifeBuoy size={15} /> Contact DHMIS Support</a> : <button role="menuitem" onClick={() => setSupportMessage("DHMIS support can help with portal access. Do not include health information in a support request.")}><LifeBuoy size={15} /> Contact DHMIS Support</button>}
              {supportMessage && <span className="muted block px-2 py-1 text-xs" role="status">{supportMessage}</span>}
              <button role="menuitem" onClick={() => chooseAccountAction(() => onLogout?.())}><LogOut size={15} /> Sign out</button>
            </div>}
          </div>
        </div>
      </header>

      {activePanel === "home" && <main className="mx-auto max-w-3xl px-5 py-8">
        {clinicWebsiteHref && <a className="mb-5 inline-block text-xs text-[var(--sage-deep)] underline" href={clinicWebsiteHref}>Visit clinic website</a>}
        <p className="text-lg font-medium">Welcome back, {patientFirstName}</p>
        <p className="mb-6 text-sm text-[var(--ink-muted)]">
          {locationName} · {dateLabel}
        </p>

        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <Calendar
                size={18}
                className="text-[var(--sage)]"
                aria-hidden="true"
              />
              <span className="text-sm font-medium">Next appointment</span>
            </div>
            {nextAppointment ? (
              <>
                <p className="text-sm">
                  {nextAppointment.dateLabel} · {nextAppointment.timeLabel}
                </p>
                <p className="mb-3 text-xs text-[var(--ink-muted)]">
                  {nextAppointment.providerName} · {nextAppointment.reason}
                </p>
                <button
                  type="button"
                  onClick={onReschedule}
                  className="rounded-md border border-[var(--border-strong)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--paper)]"
                >
                  Reschedule
                </button>
              </>
            ) : (
              <p className="text-sm text-[var(--ink-muted)]">No upcoming appointment.</p>
            )}
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <FileText
                size={18}
                className="text-[var(--sage)]"
                aria-hidden="true"
              />
              <span className="text-sm font-medium">Balance due</span>
            </div>
            <p className="mb-3 text-xl font-medium">${balanceDue.toFixed(2)}</p>
            <button
              type="button"
              onClick={onPay}
              className="rounded-md bg-[var(--amber)] px-3 py-1.5 text-xs font-medium text-white hover:brightness-95"
            >
              Pay now
            </button>
          </div>
        </div>

        {/* Treatment plan progress */}
        {treatmentPlan && <div className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">{treatmentPlan.label}</span>
            <span className="text-xs text-[var(--ink-muted)]">
              {treatmentPlan.completedSteps} of {treatmentPlan.totalSteps}{" "}
              visits
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--sage-tint)]">
            <div
              className="h-full rounded-full bg-[var(--sage)]"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {laterAppointments.length > 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--ink-muted)]">
              <CheckCircle2
                size={13}
                className="text-[var(--sage)]"
                aria-hidden="true"
              />
              Next check-in: {laterAppointments[0].dateLabel}
            </p>
          )}
        </div>}

        <div className="mb-5 grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 text-sm">
            <Mail size={16} aria-hidden="true" />
            Messages
            {unreadMessages > 0 && (
              <span className="ml-auto rounded-md bg-[var(--sage-tint)] px-2 py-0.5 text-xs text-[var(--sage-deep)]">
                {unreadMessages} new
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 text-sm">
            <Folder size={16} aria-hidden="true" /> Documents
            <span className="ml-auto text-xs text-[var(--ink-muted)]">
              {documentCount}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onBook}
            className="rounded-md border border-[var(--border-strong)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--surface)]"
          >
            Book appointment{" "}
          </button>
          <button
            type="button"
            onClick={onUpdateForms}
            className="rounded-md border border-[var(--border-strong)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--surface)]"
          >
            Update forms{" "}
          </button>
          <button
            type="button"
            onClick={onMessage}
            className="rounded-md border border-[var(--border-strong)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--surface)]"
          >
            Message clinic{" "}
          </button>
          {contactPhone && <a href={`tel:${contactPhone}`} className="rounded-md border border-[var(--border-strong)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--surface)]">Call clinic</a>}
        </div>
        {recentActivity.length > 0 && <section className="mt-6"><div className="mb-2 flex items-center justify-between gap-3"><h2 className="text-sm font-medium">Recent activity</h2><button type="button" className="text-xs font-medium text-[var(--sage-deep)] underline" onClick={onViewAllActivity}>View all activity</button></div><div className="space-y-2">{recentActivity.map((item) => <button key={`${item.target}-${item.id}`} type="button" className="block w-full rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 text-left" onClick={() => onOpenActivity?.(item.target)}><span className="text-sm font-medium">{item.title}</span><span className="muted block text-xs">{item.detail} · {new Date(item.occurredAt).toLocaleDateString()}</span></button>)}</div></section>}
      </main>}
      {activePanel !== "home" && panelContent}
      <nav className="portal-mobile-nav" aria-label="Client Portal sections">
        <button aria-current={activePanel === "home" ? "page" : undefined} onClick={() => onNavigate?.("home")}><Home size={18} />Home</button>
        {bookingEnabled && <button aria-current={activePanel === "book" ? "page" : undefined} onClick={() => onNavigate?.("book")}><Calendar size={18} />Visits</button>}
        <button aria-current={activePanel === "billing" ? "page" : undefined} onClick={() => onNavigate?.("billing")}><CreditCard size={18} />Billing</button>
        <button aria-current={activePanel === "messages" ? "page" : undefined} onClick={() => onNavigate?.("messages")}><MessageSquare size={18} />Messages</button>
        {clinicPhoneHref ? <a href={clinicPhoneHref} aria-label="Call clinic"><Phone size={18} />Call</a> : <button aria-current={activePanel === "forms" ? "page" : undefined} onClick={() => onNavigate?.("forms")}><ClipboardList size={18} />Forms</button>}
      </nav>
    </div>
  );
}

export default PatientPortalDashboard;
