import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { seedRoadmap, TRACKS, type SeedTrack } from '@/services/roadmap';
import { supabase } from '@/lib/supabase/client';

export default function Settings() {
  const { user, signOut } = useAuth();
  const qc = useQueryClient();
  const [msg, setMsg] = useState<string | null>(null);
  const [start, setStart] = useState(localStorage.getItem('planStart') ?? '');
  return (
    <div>
      <h1 className="text-lg font-semibold">Settings</h1>
      <div className="card p-4 mt-4 space-y-3">
        <div className="text-sm">Signed in as <span className="text-muted">{user?.email}</span></div>
        <div>
          <label className="label">Plan start date (drives Today’s auto schedule)</label>
          <input type="date" className="input" value={start} onChange={(e) => setStart(e.target.value)} />
          <button className="btn mt-2" onClick={() => { localStorage.setItem('planStart', start); setMsg('Start date saved.'); }}>Save start date</button>
        </div>
        <div>
          <div className="text-sm font-medium">Curriculum seed</div>
          <p className="text-xs text-muted mb-2">Idempotent per track. Never overwrites progress.</p>
          <div className="flex flex-wrap gap-2">
            {(['aiops', 'onprem'] as SeedTrack[]).map((t) => (
              <button key={t} className="btn" onClick={async () => {
                try { await seedRoadmap(t); await qc.invalidateQueries(); setMsg(`${TRACKS[t].label} track seeded.`); }
                catch (e: any) { setMsg(e.message); }
              }}>Re-run {TRACKS[t].label} seed</button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-sm font-medium">Change password</div>
          <button className="btn" onClick={async () => {
            if (!user?.email) return;
            await supabase.auth.resetPasswordForEmail(user.email, { redirectTo: window.location.origin + '/login' });
            setMsg('Reset email sent.');
          }}>Send reset email</button>
        </div>
        <button className="btn" onClick={signOut}>Log out</button>
        {msg && <p className="text-xs text-accent">{msg}</p>}
      </div>
      <div className="card p-4 mt-3 text-xs text-muted leading-relaxed">
        Owner lockdown: Supabase Dashboard → Authentication → Sign In / Sign Ups → turn OFF “Allow new users to sign up” after creating the owner account.
        Auth redirect URLs must include your Netlify domain and http://localhost:5173. Never expose service-role keys.
      </div>
    </div>
  );
}
