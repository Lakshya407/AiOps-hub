export type TopicStatus = 'not_started' | 'in_progress' | 'completed' | 'needs_revision';
export type ProjectStatus = 'not_started' | 'in_progress' | 'completed';

export interface Phase { id: string; owner_id: string; title: string; description: string; month_number: number; sort_order: number; }
export interface Skill { id: string; phase_id: string; owner_id: string; title: string; description: string; sort_order: number; estimated_hours: number; }
export interface Topic { id: string; skill_id: string; parent_topic_id: string | null; owner_id: string; title: string; description: string; sort_order: number; estimated_minutes: number; }
export interface TopicProgress { id: string; owner_id: string; topic_id: string; status: TopicStatus; completed_at: string | null; updated_at: string; }
export interface StudySession { id: string; owner_id: string; topic_id: string | null; started_at: string; ended_at: string | null; duration_minutes: number; notes: string; }
export interface DailyLog { id: string; owner_id: string; log_date: string; summary: string; challenges: string; next_steps: string; mood?: string | null; completed: boolean; }
export interface DocRow { id: string; owner_id: string; skill_id: string | null; topic_id: string | null; project_id: string | null; title: string; description: string; file_path: string; mime_type: string; size_bytes: number; tags: string[]; created_at: string; updated_at: string; }
export interface Note { id: string; owner_id: string; skill_id: string | null; topic_id: string | null; title: string; content_markdown: string; tags: string[]; created_at: string; updated_at: string; }
export interface Resource { id: string; owner_id: string; topic_id: string | null; title: string; url: string; resource_type: string; notes: string; }
export interface Project { id: string; owner_id: string; title: string; description: string; status: ProjectStatus; repository_url: string; demo_url: string; month_number: number | null; started_at: string | null; completed_at: string | null; skill_ids: string[]; }
export interface Milestone { id: string; project_id: string; owner_id: string; title: string; description: string; status: ProjectStatus; sort_order: number; }
export interface RevisionItem { id: string; owner_id: string; topic_id: string; next_revision_at: string; last_revised_at: string | null; revision_count: number; status: string; }
export interface SkillProgress { skill: Skill; total: number; completed: number; percent: number; status: 'Not Started' | 'In Progress' | 'Completed'; }
