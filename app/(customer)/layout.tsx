import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AmplifyProvider from "@/components/AmplifyProvider";
import { AuthProvider } from "@/context/AuthContext";

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <AmplifyProvider>
      <AuthProvider>
        <Header />
        {children}
        <Footer />
      </AuthProvider>
    </AmplifyProvider>
  );
}
