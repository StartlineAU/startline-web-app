"use client";

import Image from "next/image";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";

interface Props {
  orgName?: string;
  initial?: string;
}

export default function OrganiserTopBar({ orgName = "My Organisation", initial = "O" }: Props) {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/organiser/auth/logout", { method: "POST" });
    router.push("/organiser");
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 h-16 bg-dark border-b border-dark-lighter flex items-center">
      <div className="max-w-[1440px] w-full mx-auto px-6 flex items-center justify-between">
        <Link href="/organiser/dashboard" className="flex items-center gap-2">
          <Image src="/images/logo-title.svg" alt="Startline" width={140} height={36} className="h-8 w-auto" />
        </Link>

        <div className="flex items-center gap-3">
          <button className="text-muted hover:text-primary transition-colors">
            <Bell className="w-5 h-5" />
          </button>
          <button onClick={handleLogout} className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-full bg-primary text-dark font-headline font-black italic text-sm flex items-center justify-center">
              {initial.toUpperCase()}
            </div>
            <span className="font-headline text-[13px] font-bold uppercase tracking-tight text-light group-hover:text-primary hidden md:inline transition-colors">
              {orgName.length > 16 ? orgName.slice(0, 16) + "…" : orgName}
            </span>
          </button>
        </div>
      </div>
    </nav>
  );
}
