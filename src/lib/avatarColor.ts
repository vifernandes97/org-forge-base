// Generates a stable HSL color pair from a string id.
// Uses a fixed palette of 8 muted hues for consistency.
const HUES = [210, 250, 280, 320, 0, 25, 145, 175];

export function avatarColorFromId(id: string | undefined | null) {
  if (!id) return { bg: 'hsl(var(--muted))', fg: 'hsl(var(--muted-foreground))' };
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  const hue = HUES[hash % HUES.length];
  return {
    bg: `hsl(${hue} 70% 92%)`,
    fg: `hsl(${hue} 55% 32%)`,
  };
}
