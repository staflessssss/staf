import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function getCurrentSession() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const currentUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      role: true,
      tenantId: true,
    },
  });

  if (!currentUser) {
    return null;
  }

  return {
    ...session,
    user: {
      ...session.user,
      id: currentUser.id,
      role: currentUser.role,
      tenantId: currentUser.tenantId,
    },
  };
}
