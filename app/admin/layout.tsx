import AmplifyProvider from "@/app/organiser/AmplifyProvider";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AmplifyProvider>{children}</AmplifyProvider>;
}
