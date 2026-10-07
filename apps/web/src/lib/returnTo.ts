// A page that needs sign-in (the assistant consent screen) saves its address here before sending
// the user to /login; the dashboard sends them back once they're in, whichever way they signed in.
const KEY = "dossier.returnTo";

export function saveReturnTo(path: string): void {
  try {
    sessionStorage.setItem(KEY, path);
  } catch {
    // private mode: the user lands on the dashboard instead
  }
}

// Only same-site consent paths are honoured, so nothing else can steer the redirect.
export function takeReturnTo(): string | null {
  try {
    const path = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return path?.startsWith("/connect/") ? path : null;
  } catch {
    return null;
  }
}
