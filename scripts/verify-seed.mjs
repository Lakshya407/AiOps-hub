// Verifies seed.sql covers all 18 skills without needing credentials.
import fs from 'node:fs';
const seed = fs.readFileSync('supabase/seed/seed.sql', 'utf8');
const skills = ['Linux', 'Networking', 'IT Troubleshooting', 'Python', 'Git/GitLab', 'Docker', 'Kubernetes', 'AWS', 'Terraform', 'CI/CD', 'ArgoCD/GitOps', 'Prometheus', 'Grafana', 'Elastic Stack', 'OpenTelemetry', 'LLMs', 'Agentic AI', 'AIOps'];
let ok = true;
for (const s of skills) {
  if (!seed.includes(s)) { console.error('MISSING skill:', s); ok = false; }
}
if (!ok) process.exit(1);
console.log('seed check OK: all skills present, lines =', seed.split('\n').length);
