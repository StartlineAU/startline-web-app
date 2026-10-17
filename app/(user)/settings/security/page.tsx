import { redirect } from "next/navigation";

// Security settings moved into the settings menu. This address is kept for
// old links and bookmarks, and opens that menu on its security section.
export default function SecuritySettingsPage() {
  redirect("/?settings=security");
}
