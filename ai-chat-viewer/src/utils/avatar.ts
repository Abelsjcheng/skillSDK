export function buildCorpUserAvatar(corpUserId: string): string {
  const normalizedCorpUserId = corpUserId.trim();
  return normalizedCorpUserId ? `https://${normalizedCorpUserId}` : '';
}
