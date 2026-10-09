import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { api, money, setToken } from '../shared/api';
import { Field, Title } from '../shared/Fields';
import PatientPortalDashboard from './PortalDashboard';
import type { TenantContext } from '../shared/tenant';

type ReadyPanel = 'home' | 'book' | 'billing' | 'forms' | 'messages' | 'activity' | 'account';
const portalPanelPaths: Record<ReadyPanel, string> = { home: '', book: 'appointments', billing: 'billing', forms: 'forms', messages: 'messages', activity: 'activity', account: 'account' };

function portalPanelFromPath(slug: string): ReadyPanel {
  const tail = window.location.pathname.replace(new RegExp(`^/${slug}/portal/?`), '').split('/')[0];
  return (Object.entries(portalPanelPaths).find(([, path]) => path === tail)?.[0] as ReadyPanel | undefined) || 'home';
}

type PortalView =
  | { type: 'login' }
  | { type: 'accept' }
  | { type: 'activate' }
  | { type: 'verify'; challengeToken: string }
  | { type: 'loading' }
  | { type: 'ready'; panel: ReadyPanel }
  | { type: 'error'; message: string };

type Profile = { id: string; first_name: string; last_name: string; location_id: string };
type Appointment = {
  id: string;
  patient_id: string;
  provider_id: string;
  starts_at: string;
  procedure: string;
  status: string;
};
type Invoice = {
  id: string;
  patient_id: string;
  total_cents: number;
  adjustment_cents: number;
  paid_cents: number;
  status: string;
};
type PaymentPlan = {
  id: string;
  invoice_id: string;
  installments: { due: string; amount_cents: number }[];
};
type FormTemplate = { id: string; title: string; version: string; fields: { name: string; label?: string }[] };
type FormBundle = { templates: FormTemplate[]; submissions: { template_id: string; status: string }[] };
type Thread = { id: string; patient_id: string; subject: string; status: string };
type Consent = { id: string; patient_id: string; title: string; status: string };
type PortalMe = {
  patient_id: string;
  organization_id: string;
  organization_name: string;
  name: string;
  email: string;
  branding: Record<string, string>;
};
type Storefront = {
  booking_enabled?: boolean;
  contact_phone?: string;
  contact_email?: string;
  locations: { id: string; name: string; chairs: string[] }[];
  providers: { id: string; name: string; location_ids: string[] }[];
  services: { id: string; name: string; fee_cents: number }[];
};
type Activity = { id: string; kind: string; title: string; detail: string; occurred_at: string; target: 'book' | 'billing' | 'forms' | 'messages' };
type ActivityPage = { page: number; page_size: number; total: number; items: Activity[] };
type PortalSession = { id: string; current: boolean; last_active: number; expires: number };
type PortalData = {
  me: PortalMe;
  profiles: Profile[];
  appointments: Appointment[];
  invoices: Invoice[];
  forms: FormBundle;
  threads: Thread[];
  consents: Consent[];
  plans: PaymentPlan[];
  storefront: Storefront;
  activity: ActivityPage;
  sessions: PortalSession[];
};

const initialData: PortalData | null = null;

function applyBranding(branding: Record<string, string>) {
  Object.entries(branding).forEach(([token, value]) => document.documentElement.style.setProperty(token, value));
}

export default function PatientPortalApp({ tenant }: { tenant: TenantContext }) {
  const [view, setView] = useState<PortalView>({ type: 'login' });
  const [data, setData] = useState<PortalData | null>(initialData);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [activityKind, setActivityKind] = useState('');

  const load = useCallback(async () => {
    const me = await api<PortalMe>('/portal/me');
    const [profiles, appointments, invoices, forms, threads, consents, storefront, activity, sessions] = await Promise.all([
      api<Profile[]>('/portal/profiles'),
      api<Appointment[]>('/portal/appointments'),
      api<Invoice[]>('/portal/invoices'),
      api<FormBundle>('/portal/forms'),
      api<Thread[]>('/portal/threads'),
      api<Consent[]>('/portal/consents'),
      api<Storefront>('/portal/context'),
      api<ActivityPage>('/portal/activity?page=1&page_size=5'),
      api<PortalSession[]>('/portal/auth/sessions'),
    ]);
    const statements = await Promise.all(
      profiles.map((profile) =>
        api<{ payment_plans: PaymentPlan[] }>(`/portal/statements/${profile.id}`),
      ),
    );
    const plans = statements.flatMap((statement) => statement.payment_plans);
    applyBranding(me.branding);
    setData({ me, profiles, appointments, invoices, forms, threads, consents, plans, storefront, activity, sessions });
    setView({ type: 'ready', panel: portalPanelFromPath(tenant.slug) });
  }, [tenant.slug]);

  function navigate(panel: ReadyPanel, historyMode: 'push' | 'replace' | 'none' = 'push') {
    const suffix = portalPanelPaths[panel];
    const target = `/${tenant.slug}/portal${suffix ? `/${suffix}` : ''}`;
    if (historyMode !== 'none' && window.location.pathname !== target) window.history[historyMode === 'replace' ? 'replaceState' : 'pushState']({}, '', target);
    setView({ type: 'ready', panel });
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setNotice('');
    try {
      await action();
      setNotice('Saved to your clinic record.');
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const response = await api<{ access_token: string }>('/portal/auth/login', {
        tenant_slug: tenant.slug,
        email: form.get('email'),
        password: form.get('password'),
      });
      setToken(response.access_token);
      setView({ type: 'loading' });
      await load();
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'Sign in failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleAccept(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run(async () => {
      await api('/portal/auth/accept', {
        tenant_slug: tenant.slug,
        token: form.get('token'),
        password: form.get('password'),
      });
      setView({ type: 'login' });
      setNotice('Account created. Sign in with your email and password.');
    });
  }

  async function handleActivation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const result = await api<{ challenge_token: string }>('/portal/auth/verification/request', {
        tenant_slug: tenant.slug,
        email: form.get('email'),
        appointment_reference: form.get('appointment_reference'),
      });
      setView({ type: 'verify', challengeToken: result.challenge_token });
      setNotice('If the details match an active appointment, a verification code has been sent.');
    } catch (reason) { setNotice(reason instanceof Error ? reason.message : 'Verification request failed'); }
    finally { setBusy(false); }
  }

  async function handleVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (view.type !== 'verify') return;
    const form = new FormData(event.currentTarget); setBusy(true);
    try {
      const result = await api<{ access_token: string }>('/portal/auth/verification/verify', {
        tenant_slug: tenant.slug, challenge_token: view.challengeToken, code: form.get('code'),
      });
      setToken(result.access_token); setView({ type: 'loading' }); await load();
    } catch (reason) { setNotice(reason instanceof Error ? reason.message : 'Verification failed'); }
    finally { setBusy(false); }
  }

  async function handleLogout() {
    await run(async () => {
      await api('/portal/auth/logout', {});
      setToken('');
      setData(null);
      setView({ type: 'login' });
      window.history.replaceState({}, '', `/${tenant.slug}/portal`);
    });
  }

  async function handleBook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    const form = new FormData(event.currentTarget);
    const startsAt = new Date(String(form.get('starts_at')));
    await run(async () => {
      await api('/portal/appointments', {
        patient_id: form.get('patient_id'),
        location_id: form.get('location_id'),
        provider_id: form.get('provider_id'),
        chair: form.get('chair'),
        starts_at: startsAt.toISOString(),
        ends_at: new Date(startsAt.getTime() + 30 * 60 * 1000).toISOString(),
        procedure: form.get('procedure'),
      });
      await load();
    });
  }

  async function handlePayment(event: FormEvent<HTMLFormElement>, invoice: Invoice) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run(async () => {
      await api(`/portal/invoices/${invoice.id}/payments`, {
        amount_cents: Math.round(Number(form.get('amount')) * 100),
        idempotency_key: crypto.randomUUID(),
        payment_method_token: form.get('payment_method_token') || null,
      });
      await load();
    });
  }

  async function handlePlan(event: FormEvent<HTMLFormElement>, invoice: Invoice) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run(async () => {
      await api(`/portal/invoices/${invoice.id}/payment-plan`, {
        installments: Number(form.get('installments')),
        first_due: form.get('first_due'),
      });
      await load();
    });
  }

  async function handleForm(event: FormEvent<HTMLFormElement>, template: FormTemplate) {
    event.preventDefault();
    if (!data) return;
    const form = new FormData(event.currentTarget);
    const responses = Object.fromEntries(template.fields.map((field) => [field.name, String(form.get(field.name) ?? '')]));
    await run(async () => {
      await api(`/portal/forms/${template.id}`, {
        patient_id: form.get('patient_id'),
        responses,
      });
      await load();
    });
  }

  async function handleMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run(async () => {
      await api('/portal/threads', {
        patient_id: form.get('patient_id'),
        subject: form.get('subject'),
        body: form.get('body'),
      });
      await load();
    });
  }

  async function handleConsent(identifier: string) {
    await run(async () => {
      await api(`/portal/consents/${identifier}/sign`, {});
      await load();
    });
  }

  async function loadActivity(page = 1, kind = activityKind) {
    const query = new URLSearchParams({ page: String(page), page_size: '5' });
    if (kind) query.set('kind', kind);
    const activity = await api<ActivityPage>(`/portal/activity?${query}`);
    setData((current) => current ? { ...current, activity } : current);
  }

  async function revokeOtherSessions() {
    await run(async () => {
      await api('/portal/auth/sessions/revoke-others', {});
      const sessions = await api<PortalSession[]>('/portal/auth/sessions');
      setData((current) => current ? { ...current, sessions } : current);
    });
  }

  async function handlePasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setNotice('');
    try {
      await api('/portal/auth/password', {
        current_password: form.get('current_password'),
        new_password: form.get('new_password'),
      });
      setToken('');
      setData(null);
      setView({ type: 'login' });
      setNotice('Password changed. Sign in again with your new password.');
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'Password change failed');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const unauthorized = () => {
      setToken('');
      setData(null);
      setView({ type: 'login' });
      setNotice('Your portal session expired. Please sign in again.');
    };
    window.addEventListener('dhmis:unauthorized', unauthorized);
    return () => window.removeEventListener('dhmis:unauthorized', unauthorized);
  }, []);

  useEffect(() => {
    const restoreRoute = () => {
      if (view.type === 'ready') navigate(portalPanelFromPath(tenant.slug), 'none');
    };
    window.addEventListener('popstate', restoreRoute);
    return () => window.removeEventListener('popstate', restoreRoute);
  }, [view.type, tenant.slug]);

  function renderPanel(): ReactNode {
    if (!data || view.type !== 'ready') return null;
    switch (view.panel) {
      case 'home':
        return null;
      case 'book':
        if (!tenant.features.booking) return <section className="panel mx-auto mt-5 max-w-xl"><Title title="Online booking unavailable" description="Contact the clinic to schedule or change an appointment." /></section>;
        return (
          <section className="panel mx-auto mt-5 max-w-xl">
            <Title title="Book an appointment" description="Bookings use the clinic's conflict and cancellation policies." />
            <form className="grid gap-3" onSubmit={handleBook}>
              <Field label="Patient"><select className="field" name="patient_id">{data.profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.first_name} {profile.last_name}</option>)}</select></Field>
              <Field label="Location"><select className="field" name="location_id">{data.storefront.locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></Field>
              <Field label="Provider"><select className="field" name="provider_id">{data.storefront.providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</select></Field>
              <Field label="Chair"><select className="field" name="chair">{data.storefront.locations.flatMap((location) => location.chairs).filter((chair, index, all) => all.indexOf(chair) === index).map((chair) => <option key={chair}>{chair}</option>)}</select></Field>
              <Field label="Date and time"><input className="field" name="starts_at" type="datetime-local" required /></Field>
              <Field label="Reason"><input className="field" name="procedure" required /></Field>
              <button className="btn" disabled={busy}>Book visit</button>
            </form>
          </section>
        );
      case 'billing':
        return (
          <section className="panel mx-auto mt-5 max-w-xl">
            <Title title="Bills and payments" description="Payments post to the same patient ledger used by the clinic." />
            {data.invoices.map((invoice) => {
              const balance = invoice.total_cents + invoice.adjustment_cents - invoice.paid_cents;
              const plan = data.plans.find((item) => item.invoice_id === invoice.id);
              return <div key={invoice.id} className="mb-4 rounded-lg border border-[var(--border)] p-3">
                <p><strong>{money(balance)}</strong> due · {invoice.status}</p>
                {balance > 0 && <form className="mt-2 grid gap-2 sm:grid-cols-2" onSubmit={(event) => void handlePayment(event, invoice)}><Field label="Amount (CAD)"><input className="field" name="amount" type="number" min="0.01" max={(balance / 100).toFixed(2)} step="0.01" required /></Field><Field label="Payment token"><input className="field" name="payment_method_token" placeholder="Optional sandbox token" /></Field><button className="btn" disabled={busy}>Pay</button></form>}
                {plan ? <ul className="mt-3 text-sm">{plan.installments.map((item) => { const due = new Date(`${item.due}T00:00:00`); const days = Math.ceil((due.getTime() - Date.now()) / 86400000); return <li key={item.due} className={days < 0 ? 'text-[var(--danger)]' : days <= 3 ? 'text-[var(--amber)]' : ''}>{item.due} · {money(item.amount_cents)}{days < 0 ? ' · overdue' : days <= 3 ? ' · due soon' : ''}</li>; })}</ul> : balance > 0 && <form className="mt-3 grid gap-2 sm:grid-cols-2" onSubmit={(event) => void handlePlan(event, invoice)}><Field label="Installments"><input className="field" name="installments" type="number" min="2" max="24" required /></Field><Field label="First due"><input className="field" name="first_due" type="date" required /></Field><button className="btn-secondary" disabled={busy}>Create payment plan</button></form>}
              </div>;
            })}
          </section>
        );
      case 'forms':
        return (
          <section className="panel mx-auto mt-5 max-w-xl">
            <Title title="Forms and consents" description="Responses retain the exact template version used." />
            {data.forms.templates.map((template) => <form key={template.id} className="mb-5 space-y-3 border-b border-[var(--border)] pb-5" onSubmit={(event) => void handleForm(event, template)}><h3 className="font-semibold">{template.title} · v{template.version}</h3><Field label="Patient"><select className="field" name="patient_id">{data.profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.first_name} {profile.last_name}</option>)}</select></Field>{template.fields.map((field) => <Field key={field.name} label={field.label || field.name}><input className="field" name={field.name} /></Field>)}<button className="btn-secondary" disabled={busy}>Submit form</button></form>)}
            {data.consents.map((consent) => <div key={consent.id} className="mb-2 flex items-center justify-between rounded-lg border border-[var(--border)] p-3"><span>{consent.title} · {consent.status}</span>{['requested', 'awaiting_signature'].includes(consent.status) && <button className="btn-secondary" disabled={busy} onClick={() => void handleConsent(consent.id)}>Sign</button>}</div>)}
          </section>
        );
      case 'messages':
        return (
          <section className="panel mx-auto mt-5 max-w-xl">
            <Title title="Secure messages" description="Message bodies are encrypted before database storage." />
            {data.threads.map((thread) => <p key={thread.id} className="mb-2 rounded-lg border border-[var(--border)] p-3">{thread.subject} · {thread.status}</p>)}
            <form className="mt-5 space-y-3" onSubmit={handleMessage}><Field label="Patient"><select className="field" name="patient_id">{data.profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.first_name} {profile.last_name}</option>)}</select></Field><Field label="Subject"><input className="field" name="subject" required minLength={3} /></Field><Field label="Message"><textarea className="field" name="body" required /></Field><button className="btn" disabled={busy}>Send securely</button></form>
          </section>
        );
      case 'activity':
        return (
          <section className="panel mx-auto mt-5 max-w-3xl">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <Title title="Activity" description="Appointments, billing, forms, and secure messages across profiles on this account." />
              <Field label="Show">
                <select className="field" value={activityKind} onChange={(event) => { const kind = event.target.value; setActivityKind(kind); void loadActivity(1, kind); }}>
                  <option value="">All activity</option><option value="appointment">Appointments</option><option value="billing">Billing</option><option value="form">Forms</option><option value="message">Messages</option>
                </select>
              </Field>
            </div>
            <div className="space-y-2">{data.activity.items.map((item) => <button key={`${item.kind}-${item.id}`} type="button" className="block w-full rounded-lg border border-[var(--border)] p-3 text-left" onClick={() => navigate(item.target)}><strong className="block text-sm">{item.title}</strong><span className="muted text-xs">{item.detail} · {new Date(item.occurred_at).toLocaleString()}</span></button>)}</div>
            {!data.activity.items.length && <p className="muted py-6 text-center text-sm">No activity matches this filter.</p>}
            <div className="mt-4 flex items-center justify-between text-sm"><button type="button" className="btn-secondary" disabled={busy || data.activity.page <= 1} onClick={() => void loadActivity(data.activity.page - 1)}>Previous</button><span>{data.activity.total ? `${(data.activity.page - 1) * data.activity.page_size + 1}–${Math.min(data.activity.page * data.activity.page_size, data.activity.total)} of ${data.activity.total}` : '0 items'}</span><button type="button" className="btn-secondary" disabled={busy || data.activity.page * data.activity.page_size >= data.activity.total} onClick={() => void loadActivity(data.activity.page + 1)}>Next</button></div>
          </section>
        );
      case 'account':
        return (
          <section className="mx-auto mt-5 grid max-w-3xl gap-5 md:grid-cols-2">
            <div className="panel"><Title title="My details" description="The identity connected to this Client Portal account." /><dl className="space-y-3 text-sm"><div><dt className="muted">Name</dt><dd className="font-medium">{data.me.name}</dd></div><div><dt className="muted">Email</dt><dd className="font-medium">{data.me.email}</dd></div><div><dt className="muted">Clinic</dt><dd className="font-medium">{data.me.organization_name}</dd></div><div><dt className="muted">Patient profiles</dt><dd className="font-medium">{data.profiles.map((profile) => `${profile.first_name} ${profile.last_name}`).join(', ')}</dd></div></dl></div>
            <form className="panel space-y-3" onSubmit={handlePasswordChange}><Title title="Security & password" description="Changing your password signs this account out on every device." /><Field label="Current password"><input className="field" name="current_password" type="password" required /></Field><Field label="New password"><input className="field" name="new_password" type="password" minLength={12} required /></Field><button className="btn-secondary" disabled={busy}>Change password</button></form>
            <div className="panel md:col-span-2"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">Signed-in sessions</h2><p className="muted text-sm">Review active sessions and sign out other devices.</p></div><button type="button" className="btn-secondary" disabled={busy || data.sessions.length <= 1} onClick={() => void revokeOtherSessions()}>Sign out other devices</button></div><ul className="mt-3 divide-y divide-[var(--border)]">{data.sessions.map((session) => <li key={session.id} className="flex justify-between gap-3 py-3 text-sm"><span>{session.current ? 'This device' : 'Another device'}</span><span className="muted">Active {new Date(session.last_active * 1000).toLocaleString()}</span></li>)}</ul></div>
          </section>
        );
    }
  }

  if (view.type === 'loading') return <p className="p-8">Loading Client Portal…</p>;
  if (view.type === 'error') return <p className="p-8" role="alert">{view.message}</p>;
  if (view.type === 'login' || view.type === 'accept' || view.type === 'activate' || view.type === 'verify') {
    const title = view.type === 'login' ? 'Client Portal' : view.type === 'accept' ? 'Use a clinic invitation' : view.type === 'activate' ? 'Activate or access your account' : 'Enter verification code';
    return <main className="mx-auto max-w-md px-5 py-16"><div className="panel"><Title title={title} description={`${tenant.name} · Your Client Portal account is separate from staff access.`} />{notice && <p role="status" className="mb-3 text-sm">{notice}</p>}{view.type === 'login' && <form className="space-y-3" onSubmit={handleLogin}><Field label="Email"><input className="field" name="email" type="email" required /></Field><Field label="Password"><input className="field" name="password" type="password" required /></Field><button className="btn w-full" disabled={busy}>Sign in</button></form>}{view.type === 'accept' && <form className="space-y-3" onSubmit={handleAccept}><Field label="Invitation token"><input className="field" name="token" required /></Field><Field label="Choose password"><input className="field" name="password" type="password" minLength={12} required /></Field><button className="btn w-full" disabled={busy}>Create account</button></form>}{view.type === 'activate' && <form className="space-y-3" onSubmit={handleActivation}><Field label="Appointment reference (required for first activation)"><input className="field" name="appointment_reference" /></Field><Field label="Email used for booking"><input className="field" name="email" type="email" required /></Field><button className="btn w-full" disabled={busy}>Send verification code</button></form>}{view.type === 'verify' && <form className="space-y-3" onSubmit={handleVerification}><Field label="Six-digit verification code"><input className="field" name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required /></Field><button className="btn w-full" disabled={busy}>Verify and continue</button></form>}<div className="mt-4 flex flex-wrap gap-3 text-sm"><button className="underline" onClick={() => setView({ type: 'login' })}>Password sign in</button><button className="underline" onClick={() => setView({ type: 'activate' })}>Email verification</button><button className="underline" onClick={() => setView({ type: 'accept' })}>Use invitation</button></div></div></main>;
  }
  if (!data) return null;
  const balance = data.invoices.reduce((sum, invoice) => sum + invoice.total_cents + invoice.adjustment_cents - invoice.paid_cents, 0);
  const upcoming = data.appointments.filter((item) => item.status === 'confirmed' && new Date(item.starts_at) > new Date()).map((item) => ({ dateLabel: new Date(item.starts_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }), timeLabel: new Date(item.starts_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }), providerName: data.storefront.providers.find((provider) => provider.id === item.provider_id)?.name || 'Clinic provider', reason: item.procedure }));
  return <>{notice && <p className="mx-auto max-w-3xl px-5 pt-4 text-sm" role="status">{notice}</p>}<PatientPortalDashboard clinicName={data.me.organization_name} patientFirstName={data.me.name.split(' ')[0]} locationName={data.storefront.locations.find((location) => location.id === data.profiles[0]?.location_id)?.name || data.me.organization_name} upcomingAppointments={upcoming} balanceDue={balance / 100} unreadMessages={data.threads.length} documentCount={data.forms.submissions.length + data.consents.length} contactPhone={data.storefront.contact_phone} contactEmail={data.storefront.contact_email} recentActivity={data.activity.items.slice(0, 5).map((item) => ({ id: item.id, title: item.title, detail: item.detail, occurredAt: item.occurred_at, target: item.target }))} activePanel={view.panel} bookingEnabled={tenant.features.booking} clinicWebsiteHref={tenant.features.front_office ? `/${tenant.slug}` : undefined} onNavigate={navigate} onLogout={() => void handleLogout()} onReschedule={() => tenant.features.booking && navigate('book')} onPay={() => navigate('billing')} onBook={() => tenant.features.booking && navigate('book')} onUpdateForms={() => navigate('forms')} onMessage={() => navigate('messages')} onOpenActivity={navigate} onViewAllActivity={() => { setActivityKind(''); void loadActivity(1, ''); navigate('activity'); }} panelContent={renderPanel()} /></>;
}
