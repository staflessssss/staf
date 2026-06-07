export function getDefaultRedirectForRole(role?: string | null) {
  return role === "ADMIN" ? "/admin" : "/client";
}

export function normalizeInternalRedirect(
  value: string | null | undefined,
  fallback = "/client",
) {
  const redirectTo = value?.trim() || fallback;

  if (
    !redirectTo.startsWith("/") ||
    redirectTo.startsWith("//") ||
    redirectTo.includes("\\")
  ) {
    return fallback;
  }

  return redirectTo;
}
