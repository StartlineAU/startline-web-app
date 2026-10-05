import type { Metadata } from "next";
import OrganiserNavBar from "@/components/organiser/OrganiserNavBar";
import PortalFooter from "@/components/PortalFooter";
import AmplifyProvider from "./AmplifyProvider";
import { AuthProvider } from "@/context/AuthContext";
import { SettingsProvider } from "@/context/SettingsContext";
import SettingsModal from "@/components/settings/SettingsModal";

export const metadata: Metadata = {
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  title: { template: "%s | Startline Organiser", default: "Organiser Portal | Startline" },
};

export default function OrganiserLayout({ children }: { children: React.ReactNode }) {
  return (
    <AmplifyProvider>
      <AuthProvider>
        <SettingsProvider defaultSection="organisation">
          <div className="min-h-screen flex flex-col bg-dark-darker">
            <OrganiserNavBar />
            <div className="flex-1">{children}</div>
            <PortalFooter />
          </div>
          <SettingsModal portal="organiser" />
        </SettingsProvider>
      </AuthProvider>
    </AmplifyProvider>
  );
}
