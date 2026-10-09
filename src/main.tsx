import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import FrontOfficeApp from './front-office/FrontOfficeApp';
import PatientPortalApp from './patient-portal/PatientPortalApp';
import { setTenantSlug } from './shared/api';
import { hostedRoute, tenantPath, type Surface, type TenantContext } from './shared/tenant';
import { installFormEnhancements } from './formEnhancements';
import './styles/global.css';

installFormEnhancements();

function TenantWeb() {
  const path = window.location.pathname;
  const [tenant, setTenant] = useState<TenantContext | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const legacyPortal = /^\/portal(?:\/|$)/.test(path);
    const legacyPublic = /^\/public(?:\/|$)/.test(path);
    const route = legacyPortal || legacyPublic ? null : hostedRoute(path);
    const params = new URLSearchParams(window.location.search);
    const configured = import.meta.env.VITE_DEFAULT_TENANT_SLUG as string | undefined;
    const surface: Surface = route?.surface || (legacyPortal ? 'portal' : 'public');
    const query = new URLSearchParams({ surface });
    const organization = params.get('organization');
    if (organization) query.set('organization_id', organization);
    else if (route?.slug) query.set('slug', route.slug);
    else if (configured) query.set('slug', configured);
    else query.set('hostname', window.location.hostname);
    fetch(`${(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')}/v1/tenants/resolve?${query}`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Clinic route was not found or is not enabled.');
        const result = await response.json();
        const context: TenantContext = {
          organizationId: result.organization_id,
          slug: result.slug,
          name: result.name,
          source: result.source,
          domain: result.domain || undefined,
          surface: (result.surface || surface) as Surface,
          features: result.features,
          branding: result.branding,
        };
        setTenantSlug(context.slug);
        setTenant(context);
        if (route?.legacy) window.history.replaceState({}, '', route.canonicalPath);
        else if (!route && configured) window.history.replaceState({}, '', tenantPath(context, context.surface));
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Tenant resolution failed'));
  }, [path]);

  if (error) return <main className="mx-auto max-w-lg p-8"><div className="panel"><h1 className="text-xl font-semibold">DHMIS clinic route unavailable</h1><p className="mt-2 text-sm">{error}</p></div></main>;
  if (!tenant) return <p className="p-8">Resolving clinic…</p>;
  return tenant.surface === 'portal' ? <PatientPortalApp tenant={tenant} /> : <FrontOfficeApp tenant={tenant} />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><TenantWeb /></React.StrictMode>);
