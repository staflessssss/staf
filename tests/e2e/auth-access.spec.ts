import { expect, test } from "@playwright/test";

const publicPages = [
  { path: "/", text: "Behalfy" },
  { path: "/login", text: "Sign in" },
  { path: "/privacy", text: "Privacy Policy" },
  { path: "/terms", text: "Terms of Service" },
  { path: "/data-deletion", text: "Data Deletion" },
] as const;

const protectedPaths = [
  "/admin",
  "/admin/clients",
  "/admin/tenants",
  "/admin/tenants/new",
  "/admin/tenants/test-id",
  "/client",
  "/client/overview",
] as const;

const protectedApiRequests = [
  { method: "GET", path: "/api/admin/overview" },
  { method: "GET", path: "/api/admin/tenants" },
  { method: "POST", path: "/api/admin/tenants", data: { name: "Test Tenant" } },
  { method: "GET", path: "/api/admin/tenants/test-tenant" },
  { method: "PATCH", path: "/api/admin/tenants/test-tenant", data: { name: "Renamed" } },
  { method: "POST", path: "/api/admin/tenants/test-tenant/invite", data: { email: "client@example.com" } },
  { method: "GET", path: "/api/admin/tenants/test-tenant/agents" },
  { method: "POST", path: "/api/admin/tenants/test-tenant/agents", data: { name: "Agent" } },
  { method: "GET", path: "/api/admin/tenants/test-tenant/agents/test-agent" },
  { method: "PATCH", path: "/api/admin/tenants/test-tenant/agents/test-agent", data: { name: "Agent" } },
  { method: "GET", path: "/api/admin/tenants/test-tenant/agents/test-agent/deploy" },
  { method: "POST", path: "/api/admin/tenants/test-tenant/agents/test-agent/deploy" },
  { method: "GET", path: "/api/admin/tenants/test-tenant/connections" },
  { method: "POST", path: "/api/admin/tenants/test-tenant/connections", data: { type: "GMAIL" } },
  { method: "GET", path: "/api/admin/tenants/test-tenant/integrations/test-integration/google-sheets/catalog" },
  { method: "GET", path: "/api/admin/tenants/test-tenant/integrations/test-integration/google-sheets/inspect" },
  { method: "PATCH", path: "/api/client/agents/test-agent/status", data: { status: "ACTIVE" } },
  { method: "POST", path: "/api/client/agents/test-agent/test-chat", data: { message: "Hello" } },
] as const;

test.describe("identity and access boundaries", () => {
  for (const publicPage of publicPages) {
    test(`allows anonymous visitors to open ${publicPage.path}`, async ({ page }) => {
      const response = await page.goto(publicPage.path);

      expect(response?.status(), publicPage.path).toBeLessThan(400);
      expect(new URL(page.url()).pathname).toBe(publicPage.path);
      await expect(page.locator("body")).toBeVisible();
      await expect(page.getByText(publicPage.text).first()).toBeVisible();
    });
  }

  for (const path of protectedPaths) {
    test(`redirects anonymous visitors from ${path} to login`, async ({ page }) => {
      await page.goto(path);

      const url = new URL(page.url());
      expect(url.pathname).toBe("/login");
      expect(url.searchParams.get("callbackUrl")).toBe(path);
      await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    });
  }

  for (const apiRequest of protectedApiRequests) {
    test(`rejects anonymous ${apiRequest.method} ${apiRequest.path} before business logic`, async ({ request }) => {
      const response = await request.fetch(apiRequest.path, {
        method: apiRequest.method,
        data: "data" in apiRequest ? apiRequest.data : undefined,
      });

      expect(response.status()).toBe(401);
      await expect(response.json()).resolves.toEqual({
        error: "Authentication required.",
      });
    });
  }
});
