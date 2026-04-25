import { redirect } from "next/navigation";

// Root redirects to the public events calendar — NOT the organiser portal.
// The organiser portal lives at /organiser and is intentionally excluded from indexing.
export default function RootPage() {
  redirect("/events");
}
