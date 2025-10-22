export function selectWorks(
  allWorks: any[],
  targetTotal: number = 12,
  firstChunk: number = 6,
) {
  const safeAll = Array.isArray(allWorks) ? allWorks : [];
  if (safeAll.length === 0) return [];

  const maxResults = Math.min(targetTotal, safeAll.length);
  const firstPart = safeAll.slice(0, Math.min(firstChunk, safeAll.length));
  const firstIds = new Set(firstPart.map((w: any) => w?.workId));
  const hasAbstract = (w: any) => w?.abstract?.[0]?.length > 0;

  const needAfterFirst = Math.max(0, targetTotal - firstPart.length);
  const abstractFill = safeAll
    .filter((w: any) => hasAbstract(w) && !firstIds.has(w?.workId))
    .slice(0, needAfterFirst);

  const includedIds = new Set([
    ...firstIds,
    ...abstractFill.map((w: any) => w?.workId),
  ]);

  let selected: any[] = [...firstPart, ...abstractFill];
  if (selected.length < maxResults) {
    const remainder = safeAll
      .filter((w: any) => !includedIds.has(w?.workId))
      .slice(0, maxResults - selected.length);
    selected = [...selected, ...remainder];
  }

  return selected;
}
