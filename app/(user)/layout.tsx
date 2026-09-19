import NavBar from "@/components/NavBar";
import SiteFooter from "@/components/SiteFooter";
import AmplifyProvider from "@/components/AmplifyProvider";
import { AuthProvider } from "@/context/AuthContext";

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return (
    <AmplifyProvider>
      <AuthProvider>
        <NavBar />
        {children}
        <SiteFooter />
      </AuthProvider>
    </AmplifyProvider>
  );
}
