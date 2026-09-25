import { describe, it, expect } from 'vitest';
import { leafTopics, progressOf } from '../src/lib/utils/progress';

const t = (id: string, parent: string | null = null, skill = 's1') => ({ id, skill_id: skill, parent_topic_id: parent, owner_id: 'o', title: id, description: '', sort_order: 0, estimated_minutes: 30 });

describe('leafTopics', () => {
  it('excludes parents to avoid double counting', () => {
    const topics = [t('a'), t('b', 'a'), t('c', 'a'), t('d')];
    expect(leafTopics(topics).map((x) => x.id).sort()).toEqual(['b', 'c', 'd']);
  });
});

describe('progressOf', () => {
  it('computes skill progress from leaf topics only', () => {
    const topics = [t('a'), t('b', 'a'), t('c', 'a')];
    const map = new Map([['b', { status: 'completed' } as any]]);
    const p = progressOf(topics, map);
    expect(p.total).toBe(2); expect(p.completed).toBe(1); expect(p.percent).toBe(50); expect(p.status).toBe('In Progress');
  });
  it('empty topics => Not Started, 0%', () => {
    const p = progressOf([], new Map());
    expect(p.percent).toBe(0); expect(p.status).toBe('Not Started');
  });
  it('all completed => Completed', () => {
    const topics = [t('x'), t('y')];
    const map = new Map([['x', { status: 'completed' } as any], ['y', { status: 'completed' } as any]]);
    expect(progressOf(topics, map).status).toBe('Completed');
  });
});
