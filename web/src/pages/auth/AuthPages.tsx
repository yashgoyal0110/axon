import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Lock, Mail, Sparkles, User, Building2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Button, Card, Field, Input } from '@/components/ui';
import { Backdrop } from '@/components/marketing/Backdrop';
import { Logo } from '@/components/marketing/MarketingLayout';
import { useAuth } from '@/lib/store';
import { ApiError } from '@/lib/api';

function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div className="relative flex min-h-full items-center justify-center px-5 py-12">
      <Backdrop />

      <div className="grid w-full max-w-5xl items-center gap-12 lg:grid-cols-[1fr_1fr]">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="hidden lg:block"
        >
          <Logo />
          <h1 className="mt-8 text-balance font-display text-4xl font-extrabold leading-tight text-white">
            WhatsApp bots you <span className="text-gradient-mint">draw</span>, not code.
          </h1>
          <p className="mt-4 max-w-sm text-pretty leading-relaxed text-slate-400">
            Every workspace starts with a sandbox channel, so you can build and test the whole product before you
            connect a real number.
          </p>

          <ul className="mt-8 space-y-3">
            {[
              'Visual flow builder with eight node types',
              'Gemini handles anything you did not script',
              'Meta Cloud API and Twilio when you go live',
              'Per-node analytics from the first conversation',
            ].map((item, index) => (
              <motion.li
                key={item}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + index * 0.08, duration: 0.5 }}
                className="flex items-center gap-3 text-[14px] text-slate-400"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 text-mint-400" />
                {item}
              </motion.li>
            ))}
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="mb-6 lg:hidden">
            <Logo />
          </div>
          <Card className="ring-glow p-7 sm:p-8">
            <h2 className="font-display text-2xl font-bold text-white">{title}</h2>
            <p className="mt-1.5 text-[13.5px] text-slate-400">{subtitle}</p>
            <div className="mt-7">{children}</div>
            <div className="mt-6 border-t border-white/[0.07] pt-5 text-center text-[13px] text-slate-500">{footer}</div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

export function Login() {
  const { login, status } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === 'authenticated') return <Navigate to="/app" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      toast.success('Welcome back');
      navigate('/app');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const useDemo = () => {
    setEmail('demo@axon.app');
    setPassword('demo1234');
  };

  return (
    <AuthShell
      title="Sign in"
      subtitle="Pick up where you left off."
      footer={
        <>
          New here?{' '}
          <Link to="/register" className="font-semibold text-mint-300 hover:text-mint-200">
            Create a workspace
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email">
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
            <Input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="pl-10"
            />
          </div>
        </Field>

        <Field label="Password">
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
            <Input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="pl-10"
            />
          </div>
        </Field>

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-rose-500/20 bg-rose-500/[0.08] px-3 py-2 text-[13px] text-rose-300"
          >
            {error}
          </motion.p>
        )}

        <Button type="submit" className="w-full" loading={loading} iconRight={ArrowRight}>
          Sign in
        </Button>

        <button
          type="button"
          onClick={useDemo}
          className="flex w-full items-center justify-center gap-1.5 text-[12.5px] text-slate-500 transition-colors hover:text-mint-300"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Fill in the demo account
        </button>
      </form>
    </AuthShell>
  );
}

export function Register() {
  const { register, status } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const template = params.get('template');

  const [form, setForm] = useState({ name: '', email: '', password: '', organizationName: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === 'authenticated') return <Navigate to="/app" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await register({
        name: form.name,
        email: form.email,
        password: form.password,
        organizationName: form.organizationName || undefined,
      });
      toast.success('Workspace created');
      // Carry the chosen template through to the builder.
      navigate(template ? `/app/flows?template=${template}` : '/app');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const field = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <AuthShell
      title="Create your workspace"
      subtitle={template ? `You'll start with the "${template.replace(/_/g, ' ')}" template.` : 'Free forever on the sandbox plan.'}
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-mint-300 hover:text-mint-200">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Your name">
          <div className="relative">
            <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
            <Input required value={form.name} onChange={field('name')} placeholder="Ada Lovelace" className="pl-10" />
          </div>
        </Field>

        <Field label="Work email">
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
            <Input
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={field('email')}
              placeholder="you@company.com"
              className="pl-10"
            />
          </div>
        </Field>

        <Field label="Workspace name" hint="Leave blank and we'll name it after you.">
          <div className="relative">
            <Building2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
            <Input
              value={form.organizationName}
              onChange={field('organizationName')}
              placeholder="Acme Support"
              className="pl-10"
            />
          </div>
        </Field>

        <Field label="Password" hint="At least 8 characters.">
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
            <Input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={form.password}
              onChange={field('password')}
              placeholder="••••••••"
              className="pl-10"
            />
          </div>
        </Field>

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-rose-500/20 bg-rose-500/[0.08] px-3 py-2 text-[13px] text-rose-300"
          >
            {error}
          </motion.p>
        )}

        <Button type="submit" className="w-full" loading={loading} iconRight={ArrowRight}>
          Create workspace
        </Button>
      </form>
    </AuthShell>
  );
}

export function AcceptInvite() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';

  const [form, setForm] = useState({ name: '', password: '' });
  const [needsAccount, setNeedsAccount] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { post } = await import('@/lib/api');
      await post('/org/members/accept', {
        token,
        ...(needsAccount ? { name: form.name, password: form.password } : {}),
      }, { auth: false });
      toast.success('Invitation accepted - sign in to continue');
      navigate('/login');
    } catch (err) {
      if (err instanceof ApiError && err.body?.error === 'AccountRequired') {
        // The invitee has no account yet; collect a name and password.
        setNeedsAccount(true);
        setError(null);
      } else {
        setError(err instanceof ApiError ? err.message : 'That invitation could not be accepted.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Join the workspace"
      subtitle={needsAccount ? 'Set a password to finish creating your account.' : 'Accept your invitation to get started.'}
      footer={
        <Link to="/login" className="font-semibold text-mint-300 hover:text-mint-200">
          Back to sign in
        </Link>
      }
    >
      {!token ? (
        <p className="text-[13.5px] text-rose-300">This link is missing its invitation token.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {needsAccount && (
            <>
              <Field label="Your name">
                <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </Field>
              <Field label="Password" hint="At least 8 characters.">
                <Input
                  type="password"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                />
              </Field>
            </>
          )}

          {error && <p className="text-[13px] text-rose-300">{error}</p>}

          <Button type="submit" className="w-full" loading={loading} iconRight={ArrowRight}>
            {needsAccount ? 'Create account and join' : 'Accept invitation'}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
