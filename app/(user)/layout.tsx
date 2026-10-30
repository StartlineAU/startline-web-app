import NavBar from "@/components/NavBar";
import SiteFooter from "@/components/SiteFooter";
import AmplifyProvider from "@/components/AmplifyProvider";
import { AuthProvider } from "@/context/AuthContext";
import { SettingsProvider } from "@/context/SettingsContext";
import SettingsModal from "@/components/settings/SettingsModal";

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return (
    <AmplifyProvider>
      <AuthProvider>
        <SettingsProvider defaultSection="profile">
          <NavBar />
          {children}
          <SiteFooter />
          <SettingsModal portal="athlete" />
        </SettingsProvider>
      </AuthProvider>
    </AmplifyProvider>
  );
}
