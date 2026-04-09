import {
  FormField,
  PageHeader,
  SurfaceCard,
  inputClassName,
  primaryButtonClassName,
} from "@/components/stafless/foundation";
import { requireAdminSession } from "@/lib/admin-auth";
import { createTenantAction } from "@/lib/tenant-actions";

type CreateTenantPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function CreateTenantPage({
  searchParams,
}: CreateTenantPageProps) {
  await requireAdminSession();
  const { error } = await searchParams;

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        eyebrow="New tenant"
        title="Create business customer"
        description="Define the business identity, default timezone, and slug that future invites, client setup, and agent records will attach to."
      />
      <SurfaceCard
        title="Tenant basics"
        description="This is the operator-owned record that anchors client access and all future channels, integrations, and agent drafts."
      >
        <form action={createTenantAction} className="space-y-5">
          <FormField
            label="Name"
            hint="Use the client-facing business name that should appear across admin and client surfaces."
          >
            <input
              className={inputClassName}
              name="name"
              placeholder="Myndful Films"
              required
              type="text"
            />
          </FormField>
          <FormField
            label="Slug"
            hint="Optional. Leave blank to let the system derive a stable slug from the business name."
          >
            <input
              className={inputClassName}
              name="slug"
              placeholder="myndful-films"
              type="text"
            />
          </FormField>
          <FormField
            label="Timezone"
            hint="Use the client’s real operating timezone so scheduling and lead handling stay consistent later."
          >
            <input
              className={inputClassName}
              defaultValue="UTC"
              name="timezone"
              required
              type="text"
            />
          </FormField>
          {error ? (
            <div className="rounded-[20px] border border-[#efc4c1] bg-[#fff0ef] px-4 py-3 text-sm text-destructive">
              Could not create tenant. Check the values and try again.
            </div>
          ) : null}
          <button className={primaryButtonClassName} type="submit">
            Create tenant
          </button>
        </form>
      </SurfaceCard>
    </div>
  );
}
