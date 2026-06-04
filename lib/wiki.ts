import type { ProjectWiki, WikiCategory } from '@/types';
import { WIKI_CATEGORIES } from '@/types';

export const WIKI_CATEGORY_LABELS: Record<WikiCategory, string> = {
  architecture: 'Architecture',
  patterns: 'Patterns to follow',
  gotchas: 'Gotchas',
  decisions: 'Recent decisions',
  stack: 'Tech stack',
  files: 'Key files',
};

type WikiEntry = Pick<ProjectWiki, 'content' | 'category' | 'created_by' | 'created_at'>;

/**
 * Render wiki entries as a markdown digest grouped by category, in the fixed
 * category order. This is what agents and the brief writer read as context, so
 * it must be stable and skimmable. Returns '' when there are no entries.
 */
export function wikiToMarkdown(entries: WikiEntry[]): string {
  if (entries.length === 0) return '';

  const byCategory = new Map<WikiCategory, WikiEntry[]>();
  for (const e of entries) {
    const list = byCategory.get(e.category) ?? [];
    list.push(e);
    byCategory.set(e.category, list);
  }

  const sections: string[] = [];
  for (const category of WIKI_CATEGORIES) {
    const list = byCategory.get(category);
    if (!list?.length) continue;
    // Oldest first within a category so the running history reads top-to-bottom.
    const sorted = [...list].sort((a, b) =>
      a.created_at.localeCompare(b.created_at)
    );
    const bullets = sorted.map((e) => `- ${e.content.trim()}`).join('\n');
    sections.push(`### ${WIKI_CATEGORY_LABELS[category]}\n${bullets}`);
  }

  return sections.join('\n\n');
}
