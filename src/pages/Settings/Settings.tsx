import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { seedRoadmap, TRACKS, type SeedTrack } from '@/services/roadmap';
import { supabase } from '@/lib/supabase/client';
import { loadObsidianSettings, saveObsidianSettings } from '@/lib/obsidian';

export default function Settings() {
  const { user, signOut } = useAuth();
  const qc = useQueryClient();
  const [msg, setMsg] = useState<string | null>(null);
  const [start, setStart] = useState(localStorage.getItem('planStart') ?? '');
  const [obs, setObs] = useState(loadObsidianSettings);
  const [obsMsg, setObsMsg] = useState<string | null>(null);
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
      <div className="card p-4 mt-3 space-y-3">
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium">Obsidian integration</div>
          <span className={`badge ${obs.enabled ? '!text-text !border-accent' : ''}`}>{obs.enabled ? 'Enabled' : 'Disabled'}</span>
        </div>
        <p className="text-xs text-muted leading-relaxed">
          Open or create notes in your <span className="text-text">local Obsidian vault</span> via Obsidian’s official
          <span className="text-text"> obsidian:// </span> links. Requires Obsidian installed on this device and a vault
          with the exact name below. There is <span className="text-text">no two-way sync</span> — the browser editor
          and your vault files stay independent unless you export/import manually.
        </p>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={obs.enabled} onChange={(e) => setObs({ ...obs, enabled: e.target.checked })} className="accent-[#7fb685] w-4 h-4" />
          Enable Obsidian integration
        </label>
        <div>
          <label className="label">Obsidian vault name (must already exist in Obsidian)</label>
          <input className="input" placeholder="e.g. MyVault" value={obs.vault} onChange={(e) => setObs({ ...obs, vault: e.target.value })} />
        </div>
        <div>
          <label className="label">Base folder inside the vault (default: LearnHub)</label>
          <input className="input" placeholder="LearnHub" value={obs.baseFolder} onChange={(e) => setObs({ ...obs, baseFolder: e.target.value })} />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="btn btn-primary" onClick={() => {
            if (obs.enabled && !obs.vault.trim()) { setObsMsg('Set your vault name first (it must already exist in Obsidian).'); return; }
            saveObsidianSettings(obs);
            setObsMsg('Obsidian settings saved on this device.');
          }}>Save Obsidian settings</button>
          <button className="btn" onClick={() => {
            const d = { enabled: false, vault: '', baseFolder: 'LearnHub' };
            setObs(d); saveObsidianSettings(d); setObsMsg('Obsidian integration disabled.');
          }}>Disable</button>
        </div>
        {obsMsg && <p className="text-xs text-accent">{obsMsg}</p>}
        <p className="text-xs text-muted leading-relaxed">
          How it works: <span className="text-text">Export .md</span> downloads a UTF-8 file with YAML frontmatter ·{' '}
          <span className="text-text">Open in Obsidian</span> opens the existing vault file (unsaved browser edits are NOT included) ·{' '}
          <span className="text-text">Send to Obsidian</span> creates a new vault note (long notes should be exported as a file instead).
        </p>
      </div>
      <div className="card p-4 mt-3 text-xs text-muted leading-relaxed">
        Owner lockdown: Supabase Dashboard → Authentication → Sign In / Sign Ups → turn OFF “Allow new users to sign up” after creating the owner account.
        Auth redirect URLs must include your Netlify domain and http://localhost:5173. Never expose service-role keys.
      </div>
    </div>
  );
}
