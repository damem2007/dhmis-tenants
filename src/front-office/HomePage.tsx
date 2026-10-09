import {
  ArrowRight,
  CalendarCheck,
  Check,
  MapPin,
  Phone,
  Sparkles,
} from "lucide-react";
import { DentalServiceIcon, type DentalServiceIconName } from "../shared/DentalServiceIcon";

export interface Service {
  name: string;
  priceLabel: string;
  description: string;
  icon?: DentalServiceIconName;
}

export interface Location {
  name: string;
  timezone: string;
  address?: string;
  phone?: string;
  email?: string;
  hours?: Record<string, string>;
  closureNote?: string;
  openingHour?: number;
  closingHour?: number;
}

export interface Provider {
  id: string;
  name: string;
  role?: string;
  biography?: string;
  languages?: string[];
  photoUrl?: string;
  photoAlt?: string;
  bookableOnline?: boolean;
}

export interface FrontOfficeHomeProps {
  clinicName: string;
  tagline: string;
  subheading: string;
  phone?: string;
  services?: Service[];
  locations?: Location[];
  providers?: Provider[];
  portalHref?: string;
  staffHref?: string;
  bookingEnabled?: boolean;
  heroPhoto?: { url: string; alt: string };
  onBook?: (providerId?: string) => void;
}

function initials(name: string) {
  return name
    .replace(/^Dr\.?\s+/i, "")
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatHour(hour?: number) {
  if (hour === undefined) return "Contact clinic";
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:00 ${suffix}`;
}

export function FrontOfficeHome({
  clinicName,
  tagline,
  subheading,
  phone = "",
  services = [],
  locations = [],
  providers = [],
  portalHref,
  staffHref,
  bookingEnabled = false,
  heroPhoto,
  onBook,
}: FrontOfficeHomeProps) {
  const primaryLocation = locations[0];
  const phoneHref = phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : undefined;

  return (
    <div className="fo-site">
      <header className="fo-header">
        <div className="fo-wrap fo-header-inner">
          <a className="fo-logo" href="#top" aria-label={`${clinicName} home`}>
            <span className="fo-logo-mark"><Sparkles size={17} /></span>
            {clinicName}
          </a>
          <nav className="fo-nav" aria-label="Clinic website">
            {services.length > 0 && <a href="#services">Services</a>}
            {providers.length > 0 && <a href="#team">Our team</a>}
            {locations.length > 0 && <a href="#locations">Locations</a>}
            <a href="#contact">Contact</a>
          </nav>
          {phoneHref && <a className="fo-phone" href={phoneHref}>{phone}</a>}
          {portalHref && <a className="fo-button fo-button-small" href={portalHref}>Client Portal</a>}
          {bookingEnabled && onBook && <button className="fo-button fo-button-primary fo-button-small" onClick={() => onBook()}>Book appointment</button>}
        </div>
      </header>

      <main id="top">
        <section className="fo-hero">
          <div className="fo-wrap fo-hero-grid">
            <div>
              <p className="fo-eyebrow">Welcome to {clinicName}</p>
              <h1>{tagline}</h1>
              <p className="fo-lead">{subheading}</p>
              <div className="fo-actions">
                {bookingEnabled && onBook && <button className="fo-button fo-button-primary" onClick={() => onBook()}>Book your visit <ArrowRight size={16} /></button>}
                {phoneHref && <a className="fo-button" href={phoneHref}><Phone size={16} /> Call {phone}</a>}
              </div>
              <ul className="fo-highlights" aria-label="Clinic benefits">
                <li><Check size={15} /> Current clinic fees</li>
                <li><Check size={15} /> Live appointment schedule</li>
                <li><Check size={15} /> Secure Client Portal</li>
              </ul>
            </div>

            {primaryLocation && (
              <div className="fo-hero-visual">
                {heroPhoto ? <img className="fo-photo-placeholder" src={heroPhoto.url} alt={heroPhoto.alt} /> : <div className="fo-photo-placeholder" role="img" aria-label={`${clinicName} clinic welcome area`}><Sparkles size={38} /><span>Care designed around you</span></div>}
                <aside className="fo-today-card" aria-label={`Today at ${primaryLocation.name}`}>
                  <p className="fo-open"><span /> Appointment booking available</p>
                  <h2>{primaryLocation.name}</h2>
                  <p className="fo-muted"><MapPin size={14} /> {primaryLocation.timezone}</p>
                  <div className="fo-hours">
                    <span>Clinic hours</span>
                    <strong>{formatHour(primaryLocation.openingHour)} – {formatHour(primaryLocation.closingHour)}</strong>
                  </div>
                  {bookingEnabled && onBook && <button className="fo-button fo-button-primary fo-button-wide" onClick={() => onBook()}>Find an appointment</button>}
                </aside>
              </div>
            )}
          </div>
        </section>

        {services.length > 0 && (
          <section className="fo-section" id="services">
            <div className="fo-wrap">
              <p className="fo-eyebrow">Transparent care</p>
              <h2>Services &amp; fees</h2>
              <p className="fo-section-copy">Current fees published by the clinic. Insurance coverage varies by plan.</p>
              <div className="fo-card-grid">
                {services.map((service) => (
                    <article className="fo-card fo-service-card" key={service.name}>
                      <span className={`fo-service-icon ${service.icon === 'emergency' ? 'is-emergency' : ''}`}><DentalServiceIcon name={service.icon || 'consult'} /></span>
                      <h3>{service.name}</h3>
                      <p>{service.description}</p>
                      <div><strong>{service.priceLabel}</strong>{bookingEnabled && onBook && <button onClick={() => onBook()}>Book <ArrowRight size={14} /></button>}</div>
                    </article>
                ))}
              </div>
            </div>
          </section>
        )}

        {providers.length > 0 && (
          <section className="fo-section fo-section-muted" id="team">
            <div className="fo-wrap">
              <p className="fo-eyebrow">Your care team</p>
              <h2>Meet your providers</h2>
              <p className="fo-section-copy">Choose an available provider when you book online.</p>
              <div className="fo-card-grid">
                {providers.map((provider) => (
                  <article className="fo-card fo-provider-card" key={provider.id}>
                    {provider.photoUrl ? <img className="fo-avatar" src={provider.photoUrl} alt={provider.photoAlt || ''} /> : <span className="fo-avatar" aria-hidden="true">{initials(provider.name)}</span>}
                    <h3>{provider.name}</h3>
                    <p>{provider.role || 'Dental care provider'}</p>
                    {provider.biography && <p>{provider.biography}</p>}
                    {provider.languages?.length ? <p>{provider.languages.join(' · ')}</p> : null}
                    {bookingEnabled && provider.bookableOnline && onBook && <button onClick={() => onBook(provider.id)}>Book with {provider.name} <ArrowRight size={14} /></button>}
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="fo-section">
          <div className="fo-wrap">
            <p className="fo-eyebrow">Simple online booking</p>
            <h2>How it works</h2>
            <ol className="fo-steps">
              <li><span>1</span><div><h3>Pick a service</h3><p>Review the clinic’s current services and fees.</p></div></li>
              <li><span>2</span><div><h3>Choose a time</h3><p>See openings from the same schedule used by clinic staff.</p></div></li>
              <li><span>3</span><div><h3>Get confirmation</h3><p>Your appointment is saved directly to the clinic record.</p></div></li>
            </ol>
            {phoneHref && <div className="fo-emergency"><div><strong>Dental emergency?</strong><p>Call the clinic for urgent scheduling guidance.</p></div><a className="fo-button fo-button-primary" href={phoneHref}><Phone size={16} /> Call now</a></div>}
          </div>
        </section>

        {locations.length > 0 && (
          <section className="fo-section fo-section-muted" id="locations">
            <div className="fo-wrap">
              <p className="fo-eyebrow">Clinic locations</p>
              <h2>Visit us</h2>
              <div className="fo-location-list">
                {locations.map((location) => (
                  <article className="fo-location-section" key={location.name}>
                    <div className="fo-location-details"><h3>{location.name}</h3><p>{location.address || location.timezone}<br />{location.phone}{location.email ? ` · ${location.email}` : ''}</p>
                    {location.hours && Object.keys(location.hours).length > 0 ? <dl>{Object.entries(location.hours).map(([day, hours]) => <div key={day}><dt>{day[0].toUpperCase() + day.slice(1)}</dt><dd>{hours}</dd></div>)}</dl> : <dl><div><dt>Opens</dt><dd>{formatHour(location.openingHour)}</dd></div><div><dt>Closes</dt><dd>{formatHour(location.closingHour)}</dd></div></dl>}
                    {location.closureNote && <p className="cms-warning">{location.closureNote}</p>}
                    <div className="fo-actions">{bookingEnabled && onBook && <button className="fo-button fo-button-primary" onClick={() => onBook()}>Book here</button>}{location.address && <a className="fo-button" href={`https://maps.google.com/?q=${encodeURIComponent(location.address)}`}>Get directions</a>}</div></div>
                    <div className="fo-map-placeholder" role="img" aria-label={`Map placeholder for ${location.name}`}><MapPin size={24} /><span>Map</span><small>Interactive map coming in the next phase</small></div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="fo-footer" id="contact">
        <div className="fo-wrap fo-footer-grid">
          <div><strong>{clinicName}</strong><p>Dental care that fits your life.</p></div>
          <div><h3>Clients</h3>{portalHref && <a href={portalHref}>Client Portal</a>}{bookingEnabled && onBook && <button onClick={() => onBook()}>Book appointment</button>}</div>
          <div><h3>Clinic</h3>{staffHref && <a href={staffHref}>Staff sign in</a>}{phoneHref && <a href={phoneHref}>{phone}</a>}</div>
          <p className="fo-footer-base">© {new Date().getFullYear()} {clinicName}<span>Powered by DHMIS</span></p>
        </div>
      </footer>

      {(phoneHref || (bookingEnabled && onBook)) && <div className="fo-mobile-actions">{phoneHref && <a className="fo-button" href={phoneHref}><Phone size={16} /> Call</a>}{bookingEnabled && onBook && <button className="fo-button fo-button-primary" onClick={() => onBook()}><CalendarCheck size={16} /> Book</button>}</div>}
    </div>
  );
}

export default FrontOfficeHome;
