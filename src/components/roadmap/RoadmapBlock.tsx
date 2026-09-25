import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import ProgressBar from '@/components/progress/ProgressBar';
import type { SkillProgress } from '@/types';

export default function RoadmapBlock({ sp, index }: { sp: SkillProgress; index: number }) {
  const label = sp.total === 1 ? '1 topic' : `${sp.total} topics`;
  return (
    <Link to={`/skill/${sp.skill.id}`}
      className="card block px-5 py-4 hover:border-muted/60 transition group">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] uppercase tracking-widest text-muted">Skill {String(index + 1).padStart(2, '0')}</span>
        <ChevronRight size={16} className="text-muted group-hover:text-text group-hover:translate-x-0.5 transition shrink-0" />
      </div>
      <h3 className="text-xl font-semibold mt-1 truncate">{sp.skill.title}</h3>
      {sp.skill.description
        ? <p className="text-[13px] text-muted mt-0.5 truncate">{sp.skill.description}</p>
        : <p className="text-[13px] text-muted mt-0.5">{label}</p>}
      {sp.skill.description && <p className="text-[12px] text-muted/80 mt-0.5">{label}</p>}
      <div className="mt-3"><ProgressBar percent={sp.percent} /></div>
      <div className="mt-1.5 text-[12px] text-muted">{sp.percent}% complete</div>
    </Link>
  );
}
