import { LibraryItem, CATEGORIES } from '../types/minos';

export function searchLibrary(items: Record<string, LibraryItem>, query: string): Array<{ item: LibraryItem; score: number }> {
  const results: Array<{ item: LibraryItem; score: number }> = [];
  const list = Object.values(items);
  if (!list.length) return results;

  const q = query.toLowerCase();
  const words = q.split(/\s+/).filter(w => w.length > 2);
  if (!words.length) return results;

  list.forEach(item => {
    let score = 0;
    const title = (item.title || '').toLowerCase();
    const content = (item.content || '').toLowerCase();
    
    words.forEach(w => {
      if (title.includes(w)) score += 3;
      if (content.includes(w)) score += 1;
    });

    if (score > 0) {
      results.push({ item, score });
    }
  });

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 5);
}

export function buildLibraryContext(items: Record<string, LibraryItem>, query: string): string {
  const found = searchLibrary(items, query);
  if (!found.length) return '';

  let ctx = '\n\n---\nRELEVANT CONTENT FROM YOUR LIBRARY (saved sermons, devotionals, etc.):\n';
  found.forEach((r, i) => {
    const cfg = CATEGORIES[r.item.cat] || CATEGORIES.other;
    ctx += `\n[${i + 1}] "${r.item.title || 'Untitled'}" -- ${cfg.label}`;
    const snippet = (r.item.content || '').slice(0, 400);
    if (snippet) ctx += `\n${snippet}`;
  });
  ctx += '\n---\nUse the library content above where relevant to inform your response.\n';
  return ctx;
}
