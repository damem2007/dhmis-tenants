import { useEffect, useState, type FormEvent } from "react";
import { api, money } from "../shared/api";
import { Field, Title } from "../shared/Fields";
import FrontOfficeHome, { type Service as ServiceCard } from "./HomePage";
import type { TenantContext } from "../shared/tenant";
import { isDentalServiceIconName } from "../shared/DentalServiceIcon";

type Storefront = {
  organization_id: string;
  name: string;
  branding: Record<string, string>;
  content: {
    headline?: string;
    introduction?: string;
    contact_email?: string;
    contact_phone?: string;
    services?: { id: string; title: string; description: string; fee_mode: 'from' | 'free' | 'contact'; fee_cents: number | null; icon: string; visible: boolean; order: number }[];
    dentists?: { id: string; name: string; role: string; biography: string; languages: string[]; photo_key: string; visible: boolean; bookable_online: boolean; order: number }[];
    media?: { key: string; file_url: string; alt_text: string; kind: string; visible: boolean }[];
  };
  services: { id: string; code: string; name: string; fee_cents: number; fee_mode?: 'from' | 'free' | 'contact'; description?: string; icon?: string }[];
  locations: {
    id: string;
    name: string;
    timezone: string;
    chairs: string[];
    opening_hour: number;
    closing_hour: number;
    address?: string;
    phone?: string;
    email?: string;
    hours?: Record<string, string>;
    closure_note?: string;
  }[];
  providers: { id: string; name: string; location_ids: string[] }[];
};
type Slot = { starts_at: string; ends_at: string };
type BookingResult = {
  appointment_id: string;
  status: string;
};
type PublicView =
  | { type: "loading" }
  | { type: "error"; message: string }
  | { type: "home" }
  | {
      type: "booking";
      slots: Slot[];
      loadingSlots: boolean;
      buttonLoader: boolean;
      appointment?: BookingResult;
    };

export default function FrontOfficeApp({ tenant }: { tenant: TenantContext }) {
  const [storefront, setStorefront] = useState<Storefront | null>(null);
  const [view, setView] = useState<PublicView>({ type: "loading" });
  const [notice, setNotice] = useState("");
  const [selection, setSelection] = useState({
    locationId: "",
    providerId: "",
  });
  async function load() {
    try {
      const previewToken = new URLSearchParams(window.location.search).get('cms_preview');
      let result: Storefront;
      if (previewToken) {
        const response = await fetch(`/v1/cms/preview/${encodeURIComponent(previewToken)}`);
        if (!response.ok) throw new Error('This signed preview is invalid or has expired.');
        result = await response.json() as Storefront;
      } else {
        result = await api<Storefront>(`/public/tenants/${tenant.slug}`);
      }
      Object.entries(result.branding).forEach(([token, value]) =>
        document.documentElement.style.setProperty(token, value),
      );
      setStorefront(result);
      setView({ type: "home" });
    } catch (reason) {
      setView({
        type: "error",
        message:
          reason instanceof Error ? reason.message : "Clinic unavailable",
      });
    }
  }

  async function handleAvailability(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!storefront) return;
    const form = new FormData(event.currentTarget);
    const locationId = String(form.get("location_id"));
    const providerId = String(form.get("provider_id"));
    setSelection({ locationId, providerId });
    setView({
      type: "booking",
      slots: [],
      loadingSlots: true,
      buttonLoader: false,
    });
    try {
      const slots = await api<Slot[]>(
        `/booking/tenants/${tenant.slug}/availability?location_id=${encodeURIComponent(locationId)}&provider_id=${encodeURIComponent(providerId)}&day=${encodeURIComponent(String(form.get("day")))}`,
      );
      setView({
        type: "booking",
        slots,
        loadingSlots: false,
        buttonLoader: false,
      });
    } catch (reason) {
      setNotice(
        reason instanceof Error
          ? reason.message
          : "Availability could not be loaded",
      );
      setView({
        type: "booking",
        slots: [],
        loadingSlots: false,
        buttonLoader: false,
      });
    }
  }

  async function handleBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!storefront) return;
    if (view.type !== "booking") return;
    if (view.buttonLoader) return;
    const form = new FormData(event.currentTarget);
    const location = storefront.locations.find(
      (row) => row.id === selection.locationId,
    );
    const selectedSlot = String(form.get("slot")).split("|");
    setView({ ...view, buttonLoader: true });
    try {
      const result = await api<BookingResult>(
        `/booking/tenants/${tenant.slug}/appointments`,
        {
          first_name: form.get("first_name"),
          last_name: form.get("last_name"),
          birth_date: form.get("birth_date"),
          email: form.get("email"),
          phone: form.get("phone"),
          location_id: selection.locationId,
          provider_id: selection.providerId,
          chair: location?.chairs[0] || "Op 1",
          starts_at: selectedSlot[0],
          ends_at: selectedSlot[1],
          procedure: form.get("procedure"),
        },
      );
      // setNotice(
      //   `Appointment ${result.status}. Reference: ${result.appointment_id}`,
      //);
      setView({ ...view, appointment: result, buttonLoader: false });
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Booking failed");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (view.type === "loading") return <div className="tenant-loading-screen" role="status" aria-label="Loading clinic"><img src="/assets/dhmis-logo-v2/svg/dhmis-loader-light.svg" alt="" /></div>;
  if (view.type === "error")
    return (
      <p className="p-8" role="alert">
        {view.message}
      </p>
    );
  if (!storefront) return null;

  const services: ServiceCard[] = storefront.services.map((service) => {
    const icon = service.icon || '';
    return {
      name: service.name,
      priceLabel: service.fee_mode === 'free' ? 'Free' : service.fee_mode === 'contact' ? 'Contact us' : `from ${money(service.fee_cents)}`,
      description: service.description || `${service.code} · Current clinic fee`,
      icon: isDentalServiceIconName(icon) ? icon : 'consult',
    };
  });
  const media = Object.fromEntries((storefront.content.media || []).filter((asset) => asset.visible).map((asset) => [asset.key, asset]));
  const contentProviders = (storefront.content.dentists || []).filter((provider) => provider.visible).sort((a, b) => a.order - b.order);
  const displayProviders = contentProviders.length > 0 ? contentProviders.map((provider) => ({
    id: provider.id,
    name: provider.name,
    role: provider.role,
    biography: provider.biography,
    languages: provider.languages,
    photoUrl: media[provider.photo_key]?.file_url,
    photoAlt: media[provider.photo_key]?.alt_text,
    bookableOnline: provider.bookable_online,
  })) : storefront.providers;
  return (
    <>
      {notice && (
        <p
          className="bg-[var(--sage-tint)] px-6 py-3 text-center text-sm"
          role="status"
        >
          {notice}
        </p>
      )}
      <FrontOfficeHome
        clinicName={storefront.name}
        tagline={
          storefront.content.headline || "Dental care that fits your life."
        }
        subheading={
          storefront.content.introduction ||
          "Review current fees and reserve a visit online."
        }
        phone={storefront.content.contact_phone || ""}
        services={services}
        locations={storefront.locations.map((location) => ({
          name: location.name,
          timezone: location.timezone,
          openingHour: location.opening_hour,
          closingHour: location.closing_hour,
          address: location.address,
          phone: location.phone,
          email: location.email,
          hours: location.hours,
          closureNote: location.closure_note,
        }))}
        providers={displayProviders}
        heroPhoto={media.hero ? { url: media.hero.file_url, alt: media.hero.alt_text } : undefined}
        portalHref={tenant.features.patient_portal ? `/${tenant.slug}/portal` : undefined}
        staffHref={`/${tenant.slug}/admin`}
        bookingEnabled={tenant.features.booking}
        onBook={
          tenant.features.booking
            ? (providerId) => {
                if (providerId) setSelection((current) => ({ ...current, providerId }));
                setView({
                  type: "booking",
                  slots: [],
                  loadingSlots: false,
                  buttonLoader: false,
                });
              }
            : undefined
        }
      />
      {view.type === "booking" && (
        <div className="fixed inset-0 z-20 overflow-auto bg-black/40 p-4">
          <section className="panel mx-auto my-8 max-w-xl">
            <div className="flex items-start justify-between gap-4">
              <Title
                title="Book an appointment"
                description="Choose a clinic, provider, and available 30-minute time."
              />
              <button
                className="btn-secondary"
                onClick={() => setView({ type: "home" })}
              >
                Close
              </button>
            </div>
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={handleAvailability}
            >
              <Field label="Location">
                <select className="field" name="location_id" defaultValue={selection.locationId || storefront.locations[0]?.id}>
                  {storefront.locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Provider">
                <select className="field" name="provider_id" defaultValue={selection.providerId || storefront.providers[0]?.id}>
                  {storefront.providers.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Date">
                <input
                  className="field"
                  name="day"
                  type="date"
                  min={new Date().toISOString().slice(0, 10)}
                  required
                />
              </Field>
              <button
                className="btn-secondary self-end"
                disabled={view.loadingSlots}
              >
                Check availability
              </button>
            </form>
            {view.loadingSlots && (
              <p className="mt-4 text-sm">Loading available times…</p>
            )}
            {view.slots.length > 0 && (
              <form
                className="mt-6 grid gap-3 sm:grid-cols-2"
                onSubmit={handleBooking}
              >
                <Field label="First name">
                  <input className="field" name="first_name" required />
                </Field>
                <Field label="Last name">
                  <input className="field" name="last_name" required />
                </Field>
                <Field label="Date of birth">
                  <input
                    className="field"
                    name="birth_date"
                    type="date"
                    required
                  />
                </Field>
                <Field label="Email">
                  <input className="field" name="email" type="email" required />
                </Field>
                <Field label="Phone">
                  <input className="field" name="phone" />
                </Field>
                <Field label="Service">
                  <select className="field" name="procedure">
                    {storefront.services.map((service) => (
                      <option key={service.id} value={service.name}>
                        {service.name} · {money(service.fee_cents)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Time">
                  <select className="field" name="slot">
                    {view.slots.map((slot) => (
                      <option
                        key={slot.starts_at}
                        value={`${slot.starts_at}|${slot.ends_at}`}
                      >
                        {new Date(slot.starts_at).toLocaleTimeString(
                          undefined,
                          { hour: "numeric", minute: "2-digit" },
                        )}
                      </option>
                    ))}
                  </select>
                </Field>
                <button className="btn self-end" disabled={view.buttonLoader}>
                  {" "}
                  {view.buttonLoader ? "Booking..." : "Confirm booking"}
                </button>
              </form>
            )}
            {!view.loadingSlots && view.slots.length === 0 && (
              <p className="mt-4 text-sm text-[var(--ink-muted)]">
                Choose a date to see current availability.
              </p>
            )}
            {view.appointment && (
              <div className="mt-6">
                <Title
                  title="Appointment booked"
                  description="Your appointment has been successfully created."
                />

                <div className="mt-6">
                  <p>Status: {view.appointment.status}</p>

                  <p>Reference: {view.appointment.appointment_id}</p>
                </div>

                <button
                  className="btn mt-6"
                  onClick={() => setView({ type: "home" })}
                >
                  Done
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
