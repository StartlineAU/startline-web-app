import { getAdminSession, getOrganiserSession, getUserSession } from "@/lib/amplify-server";
import type { UploadType } from "@/lib/upload-limits";

/**
 * Who may upload what, and the id their objects are filed under.
 *
 * An avatar is a person's own, so any signed-in account may upload one, filed
 * under their user id. Everything else (organisation logo and cover, event
 * photos and PDFs) belongs to an organisation's listings, so it needs an
 * organiser session that is not suspended, or an admin, and is filed under the
 * organisation (or admin) id. Before this, any account could upload any type,
 * which made the CDN a free host for anyone with a login.
 */
export async function uploadOwner(type: UploadType): Promise<{ sub: string } | null> {
  if (type === "avatar") {
    const user = await getUserSession();
    return user ? { sub: user.sub } : null;
  }

  const organiser = await getOrganiserSession();
  if (organiser && organiser.status !== "SUSPENDED") return { sub: organiser.sub };

  const admin = await getAdminSession();
  return admin ? { sub: admin.sub } : null;
}

/** Objects wait here until /api/upload/complete has checked them. Not served. */
export const PENDING_PREFIX = "pending";
/** Verified objects. The only prefix the CDN can read. */
export const SERVED_PREFIX = "uploads";

export function pendingKey(sub: string, type: UploadType, filename: string): string {
  return `${PENDING_PREFIX}/${sub}/${type}/${filename}`;
}

/** The served key a verified pending object is copied to. */
export function servedKeyFor(pending: string): string {
  return `${SERVED_PREFIX}/${pending.slice(PENDING_PREFIX.length + 1)}`;
}
