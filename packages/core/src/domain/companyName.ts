// Shared so the name shown in the kit and the name used in the public-discussion search query
// cannot drift apart — searching for something other than what the kit claims is a silent bug.
export function deriveCompanyName(companyUrl: string): string {
  try {
    const hostname = new URL(companyUrl).hostname.replace(/^www\./, '');
    const label = hostname.split('.')[0] ?? hostname;
    return label.charAt(0).toUpperCase() + label.slice(1);
  } catch {
    return 'Unknown company';
  }
}
