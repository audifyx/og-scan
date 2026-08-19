/** Every catalog app shown in the iOS 27 island quick-access grid. */
export function islandQuickAccess<T>(apps: T[], extra: T[] = []): T[] {
  return extra.length ? [...apps, ...extra] : apps;
}

export function groupAppsByLetter<T extends { name: string }>(apps: T[]): { letter: string; apps: T[] }[] {
  const map = new Map<string, T[]>();
  for (const app of [...apps].sort((a, b) => a.name.localeCompare(b.name))) {
    const letter = (app.name[0] || "#").toUpperCase();
    const key = /[A-Z]/.test(letter) ? letter : "#";
    const list = map.get(key) || [];
    list.push(app);
    map.set(key, list);
  }
  return [...map.entries()].map(([letter, grouped]) => ({ letter, apps: grouped }));
}
