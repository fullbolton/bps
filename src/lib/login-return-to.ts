/** Accept only internal paths, both before and after URL normalization. */
export function safeLoginReturnTo(value: string | null): string {
  const fallback = "/dashboard";
  if (!value?.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) {
    return fallback;
  }
  try {
    const base = "https://bps.invalid";
    const url = new URL(value, base);
    // Dot segments can turn an internal-looking path into a // prefix.
    // Returning that prefix to router.push would reinterpret it as a host.
    if (url.origin !== base || url.pathname.startsWith("//")) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
