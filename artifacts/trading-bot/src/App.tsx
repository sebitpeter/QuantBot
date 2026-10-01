import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { Route, Switch, Router as WouterRouter, Redirect, useLocation } from 'wouter';
import { useEffect, useRef } from 'react';
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { Shell } from '@/components/layout/Shell';
import Landing from '@/pages/Landing';
import Dashboard from '@/pages/Dashboard';
import Positions from '@/pages/Positions';
import Signals from '@/pages/Signals';
import Settings from '@/pages/Settings';
import Logs from '@/pages/Logs';

const queryClient = new QueryClient();

// REQUIRED — copy verbatim
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

// REQUIRED — copy verbatim. Empty in dev (intentional), auto-set in prod.
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#18191c',
    colorForeground: '#18191c',
    colorMutedForeground: '#5c6270',
    colorDanger: '#cc1a1a',
    colorBackground: '#f8f9fa',
    colorInput: '#d4d6db',
    colorInputForeground: '#18191c',
    colorNeutral: '#18191c',
    fontFamily: '"Space Mono", monospace',
    borderRadius: '0px',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-white w-[440px] max-w-full overflow-hidden border border-[#d4d6db]',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'font-mono uppercase tracking-widest text-[#18191c]',
    headerSubtitle: 'font-mono text-[#5c6270]',
    socialButtonsBlockButtonText: 'font-mono text-[#18191c]',
    formFieldLabel: 'font-mono text-xs uppercase tracking-wider text-[#18191c]',
    footerActionLink: 'font-mono text-[#18191c] underline',
    footerActionText: 'font-mono text-[#5c6270]',
    dividerText: 'font-mono text-[#5c6270]',
    identityPreviewEditButton: 'font-mono text-[#18191c]',
    formFieldSuccessText: 'font-mono text-green-600',
    alertText: 'font-mono text-[#18191c]',
    logoBox: 'flex justify-center mb-2',
    logoImage: 'h-10 w-10',
    socialButtonsBlockButton: 'border border-[#d4d6db] hover:bg-[#f8f9fa] transition-colors',
    formButtonPrimary: 'bg-[#18191c] hover:bg-[#333] font-mono uppercase tracking-widest',
    formFieldInput: 'border border-[#d4d6db] font-mono bg-white text-[#18191c] focus:border-[#18191c] focus:ring-0',
    footerAction: 'border-t border-[#d4d6db]',
    dividerLine: 'bg-[#d4d6db]',
    alert: 'border border-[#d4d6db]',
    otpCodeFieldInput: 'border border-[#d4d6db] font-mono',
    formFieldRow: '',
    main: '',
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center space-y-4">
      <h1 className="text-4xl font-bold font-mono tracking-tighter">404_</h1>
      <p className="text-muted-foreground font-mono uppercase tracking-widest text-sm">Path not found in routing table</p>
    </div>
  );
}

// Redirects signed-out users to sign-in for any protected route
function ProtectedShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Show when="signed-in">
        <Shell>{children}</Shell>
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}

// Invalidates QueryClient cache when signed-in user changes
function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to your trading dashboard' } },
        signUp: { start: { title: 'Create account', subtitle: 'Start paper trading in seconds' } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <Switch>
          {/* Public */}
          <Route path="/" component={Landing} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          {/* Protected */}
          <Route path="/dashboard">
            <ProtectedShell><Dashboard /></ProtectedShell>
          </Route>
          <Route path="/positions">
            <ProtectedShell><Positions /></ProtectedShell>
          </Route>
          <Route path="/signals">
            <ProtectedShell><Signals /></ProtectedShell>
          </Route>
          <Route path="/settings">
            <ProtectedShell><Settings /></ProtectedShell>
          </Route>
          <Route path="/logs">
            <ProtectedShell><Logs /></ProtectedShell>
          </Route>
          <Route>
            <ProtectedShell><NotFound /></ProtectedShell>
          </Route>
        </Switch>
        <Toaster />
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
