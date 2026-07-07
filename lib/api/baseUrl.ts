export function getApiBaseUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_API_URL;
  if (configuredUrl) return configuredUrl.replace(/\/$/, "");

  if (typeof window === "undefined") {
    const internalUrl = process.env.GOALIX_INTERNAL_API_URL;
    if (internalUrl) return internalUrl.replace(/\/$/, "");
    return "http://127.0.0.1:3000";
  }

  return "";
}

export function getSocketBaseUrl() {
  const configuredSocketUrl =
    process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_API_URL;
  if (configuredSocketUrl) return configuredSocketUrl.replace(/\/$/, "");

  if (typeof window !== "undefined") {
    if (process.env.NODE_ENV === "development") {
      return `${window.location.protocol}//${window.location.hostname}:3000`;
    }
    return window.location.origin;
  }

  return "http://127.0.0.1:3000";
}
