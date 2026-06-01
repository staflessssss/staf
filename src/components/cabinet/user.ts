export type CabinetUser = {
  email?: string | null;
  name?: string | null;
};

export function getCabinetUserName(user: CabinetUser) {
  return user.name ?? user.email ?? "Client";
}

export function getInitials(value: string) {
  const cleaned = value.includes("@") ? value.split("@")[0] : value;
  const parts = cleaned
    .replace(/[^a-zA-Z0-9\s._-]/g, " ")
    .split(/[\s._-]+/)
    .filter(Boolean);

  return (parts[0]?.[0] ?? "C").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
}
