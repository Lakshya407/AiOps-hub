import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

/** Supabase enforces an hourly email-sending cap (signups, resets). Translate the
 * raw error into actionable guidance instead of a bare "email rate limit exceeded". */
function friendlyAuthError(ex: any): string {
  const msg = String(ex?.message ?? 'Authentication failed');
  if (/rate limit|too many|over_email_send_rate_limit/i.test(msg)) {
    return 'Email sending limit reached on the Supabase project. Wait about an hour and try again. '
      + 'Admin fix: Dashboard → Authentication → Providers → Email → turn OFF “Confirm email” '
      + '(internal apps), or configure a custom SMTP sender to lift the cap for production.';
  }
  return msg;
}

export default function Login() {
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  const go = async (e: React.FormEvent) => {    e.preventDefault(); setErr(null); setMsg(null); setBusy(true);
    try {
      if (mode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Role-based landing: admins keep the existing app home, users go to
        // their personal dashboard. Role comes from profiles (DB-backed).
        try {
          const uid = data.user?.id;
          const { data: prof } = uid
            ? await supabase.from('profiles').select('role').eq('id', uid).maybeSingle()
            : { data: null };
          nav((prof as any)?.role === 'admin' ? '/' : '/dashboard', { replace: true });
        } catch {
          nav('/dashboard', { replace: true });
        }
      } else if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMsg('Account created. If email confirmation is enabled, check your inbox, then log in.');
        setMode('login');
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/login' });
        if (error) throw error;
        setMsg('Password reset email sent. Check your inbox.');
      }
    } catch (ex: any) { setErr(friendlyAuthError(ex)); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold">AIOps Learning Hub</h1>
        <p className="text-sm text-muted mt-1 mb-6">Personal AIOps roadmap (Months 1-3, 4-6). Your progress and documents are private to your account.</p>
        {!isSupabaseConfigured && (
          <div className="card p-3 mb-4 text-xs text-muted">Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env (see .env.example).</div>
        )}
        <form onSubmit={go} className="card p-5 space-y-3">
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          {mode !== 'reset' && (
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
          )}
          {err && <p className="text-xs text-red-300">{err}</p>}
          {msg && <p className="text-xs text-accent">{msg}</p>}
          <button className="btn btn-primary w-full justify-center" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : mode === 'signup' ? 'Sign up' : 'Send reset link'}
          </button>
          <div className="flex justify-between text-xs text-muted pt-1">
            {mode !== 'login' ? <button type="button" onClick={() => setMode('login')}>Log in</button> : <button type="button" onClick={() => setMode('signup')}>Create account</button>}
            {mode !== 'reset' ? <button type="button" onClick={() => setMode('reset')}>Forgot password?</button> : <span />}
          </div>
        </form>
        <p className="text-[11px] text-muted mt-4 leading-relaxed">
          Security: every new account gets the user role. A database administrator promotes
          the first admin directly in Supabase (profiles table). Roles are enforced by
          Postgres RLS, not client code. <Link to="/login" className="underline">Docs in README</Link>.
        </p>
      </div>
    </div>
  );
}
