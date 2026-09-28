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

// On-prem LLM track (2-month curriculum, track='onprem').
const onprem = fs.readFileSync('supabase/seed/seed_onprem.sql', 'utf8');
const oskills = ['Linux and NVIDIA Foundations', 'Docker and GPU Containers', 'Ollama and Hugging Face Basics', 'vLLM and Model APIs', 'RAG and Vector Databases', 'Monitoring and Basic Optimization', 'Server and GPU Infrastructure Prep', 'Model Evaluation: Kimi vs GLM vs DeepSeek', 'Production Model Deployment', 'Enterprise RAG', 'Security, Guardrails and Access', 'Observability and Performance', 'Production Hardening and Final Project'];
for (const s of oskills) {
  if (!onprem.includes(s)) { console.error('MISSING onprem skill:', s); ok = false; }
}
if (!onprem.includes("track = 'onprem'") || !onprem.includes('seed_onprem_roadmap')) {
  console.error('onprem seed missing track scoping or function'); ok = false;
}
if (!ok) process.exit(1);
console.log('onprem seed check OK: all skills present, lines =', onprem.split('\n').length);
