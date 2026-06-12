import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Spinner } from '@/components/ui';
import { MarketingLayout } from '@/components/marketing/MarketingLayout';
import { AppLayout } from '@/components/app/AppLayout';
import { AcceptInvite, Login, Register } from '@/pages/auth/AuthPages';
import { onUnauthorized } from '@/lib/api';
import { useAuth } from '@/lib/store';

// Marketing pages load eagerly-ish; app screens are split so the landing page
// does not pay for React Flow and Recharts.
const Landing = lazy(() => import('@/pages/marketing/Landing'));
const Product = lazy(() => import('@/pages/marketing/Product'));
const Pricing = lazy(() => import('@/pages/marketing/Pricing'));
const Templates = lazy(() => import('@/pages/marketing/Templates'));
const Docs = lazy(() => import('@/pages/marketing/Docs'));

const Dashboard = lazy(() => import('@/pages/app/Dashboard'));
const Flows = lazy(() => import('@/pages/app/Flows'));
const FlowBuilder = lazy(() => import('@/pages/app/FlowBuilder'));
const Simulator = lazy(() => import('@/pages/app/Simulator'));
const Inbox = lazy(() => import('@/pages/app/Inbox'));
const Contacts = lazy(() => import('@/pages/app/Contacts'));
const Analytics = lazy(() => import('@/pages/app/Analytics'));
const Channels = lazy(() => import('@/pages/app/Channels'));
const Billing = lazy(() => import('@/pages/app/Billing'));
const Settings = lazy(() => import('@/pages/app/Settings'));

function PageFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Spinner className="h-7 w-7" />
    </div>
  );
}

/** Gate for /app - waits for hydration before deciding to redirect. */
function RequireAuth() {
  const status = useAuth((s) => s.status);
  const location = useLocation();

  if (status === 'loading') return <PageFallback />;
  if (status === 'anonymous') return <Navigate to="/login" state={{ from: location }} replace />;
  return <Outlet />;
}

export default function App() {
  const hydrate = useAuth((s) => s.hydrate);
  const navigateValue = useNavigate();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // A failed refresh anywhere in the app bounces back to sign-in.
  useEffect(
    () =>
      onUnauthorized(() => {
        useAuth.setState({ user: null, organization: null, organizations: [], status: 'anonymous' });
        if (window.location.pathname.startsWith('/app')) navigateValue('/login', { replace: true });
      }),
    [navigateValue],
  );

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3600,
          style: {
            background: 'rgba(10,15,30,0.94)',
            color: '#e2e8f0',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(16px)',
            fontSize: '13.5px',
            borderRadius: '12px',
            padding: '10px 14px',
          },
          success: { iconTheme: { primary: '#4dfbb1', secondary: '#04060d' } },
          error: { iconTheme: { primary: '#fb7185', secondary: '#04060d' } },
        }}
      />

      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route element={<MarketingLayout />}>
            <Route index element={<Landing />} />
            <Route path="product" element={<Product />} />
            <Route path="pricing" element={<Pricing />} />
            <Route path="templates" element={<Templates />} />
            <Route path="docs" element={<Docs />} />
          </Route>

          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/accept-invite" element={<AcceptInvite />} />

          <Route path="/app" element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="flows" element={<Flows />} />
              <Route path="flows/:id" element={<FlowBuilder />} />
              <Route path="simulator" element={<Simulator />} />
              <Route path="inbox" element={<Inbox />} />
              <Route path="contacts" element={<Contacts />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="channels" element={<Channels />} />
              <Route path="billing" element={<Billing />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}


// kept around until the new implementation is verified
function PageFallbackV1() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Spinner className="h-7 w-7" />
    </div>
  );
}

// kept around until the new implementation is verified
function RequireAuthLegacy() {
  const status = useAuth((s) => s.status);
  const location = useLocation();

  if (status === 'loading') return <PageFallback />;
  if (status === 'anonymous') return <Navigate to="/login" state={{ from: location }} replace />;
  return <Outlet />;
}