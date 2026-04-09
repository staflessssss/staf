export function getDefaultRedirectForRole(role?: string | null) {
  return role === "ADMIN" ? "/admin" : "/client";
}
