import { differenceInMinutes, differenceInHours, differenceInDays } from 'date-fns';

export function formatStageTime(stageEnteredAt: string): string {
  const now = new Date();
  const entered = new Date(stageEnteredAt);
  const mins = differenceInMinutes(now, entered);
  if (mins < 60) return `${Math.max(1, mins)}min`;
  const hours = differenceInHours(now, entered);
  if (hours < 24) return `${hours}h`;
  const days = differenceInDays(now, entered);
  return `${days}d`;
}
