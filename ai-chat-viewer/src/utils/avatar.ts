export function buildCorpUserAvatar(corpUserId: string): string {
  const normalizedCorpUserId = corpUserId.trim();
  return normalizedCorpUserId ? `https://${normalizedCorpUserId}` : '';
}

export function isRemoteAvatarUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}
