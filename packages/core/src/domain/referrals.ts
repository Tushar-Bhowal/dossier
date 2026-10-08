export const CONNECTION_NOTE_LIMIT = 280;
export const REFERRAL_MESSAGE_LIMIT = 900;
export const PITCH_LIMIT = 600;

// Only public profile pages count; anything else from a search result is dropped.
export function isLinkedinProfileUrl(url: string): boolean {
  return /^https:\/\/([a-z]{2,3}\.|www\.)?linkedin\.com\/in\/[A-Za-z0-9\-_%]+\/?$/.test(url);
}

// The fallback that always works: LinkedIn's own people search, opened by the user.
export function linkedinSearchUrl(company: string, role: string): string {
  const keywords = `${company} ${role}`.trim().replace(/\s+/g, " ");
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords)}`;
}
