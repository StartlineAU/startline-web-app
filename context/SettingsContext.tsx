"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

// One settings menu for the whole account. The first list belongs to the
// person ("alerts" is their athlete notifications, "cookies" is site-wide);
// the second belongs to their active organisation and is only offered to
// someone who owns or manages one.
export const ACCOUNT_SECTIONS = ["profile", "details", "alerts", "security", "cookies"] as const;
export const ORGANISATION_SECTIONS = ["organisation", "members", "notifications", "payments"] as const;

export type SettingsSection =
  | (typeof ACCOUNT_SECTIONS)[number]
  | (typeof ORGANISATION_SECTIONS)[number];

export function isSettingsSection(value: string | null): value is SettingsSection {
  return value !== null && ([...ACCOUNT_SECTIONS, ...ORGANISATION_SECTIONS] as string[]).includes(value);
}

export function isOrganisationSection(section: SettingsSection): boolean {
  return (ORGANISATION_SECTIONS as readonly string[]).includes(section);
}

interface SettingsCtx {
  isOpen:     boolean;
  section:    SettingsSection;
  // Phones show the section list and the section itself one at a time.
  menuOpen:   boolean;
  // With a section, opens straight onto it. Without one, opens on the portal's
  // default section, and on a phone shows the list first.
  open:       (section?: SettingsSection) => void;
  close:      () => void;
  setSection: (s: SettingsSection) => void;
  showMenu:   () => void;
  // bumped each time a profile is saved, so the navbars re-fetch the name and photo they show
  profileSavedAt:     number;
  notifyProfileSaved: () => void;
}

const Ctx = createContext<SettingsCtx | null>(null);

export function SettingsProvider({
  children,
  defaultSection = "profile",
}: {
  children: React.ReactNode;
  defaultSection?: SettingsSection;
}) {
  const [isOpen,         setIsOpen]         = useState(false);
  const [section,        setSectionState]   = useState<SettingsSection>(defaultSection);
  const [menuOpen,       setMenuOpen]       = useState(false);
  const [profileSavedAt, setProfileSavedAt] = useState(0);

  const open = useCallback((s?: SettingsSection) => {
    setSectionState(s ?? defaultSection);
    setMenuOpen(s === undefined);
    setIsOpen(true);
  }, [defaultSection]);
  const close      = useCallback(() => setIsOpen(false), []);
  const setSection = useCallback((s: SettingsSection) => { setSectionState(s); setMenuOpen(false); }, []);
  const showMenu   = useCallback(() => setMenuOpen(true), []);
  const notifyProfileSaved = useCallback(() => setProfileSavedAt(Date.now()), []);

  const value = useMemo(
    () => ({ isOpen, section, menuOpen, open, close, setSection, showMenu, profileSavedAt, notifyProfileSaved }),
    [isOpen, section, menuOpen, open, close, setSection, showMenu, profileSavedAt, notifyProfileSaved],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

const NO_PROVIDER: SettingsCtx = {
  isOpen: false, section: "profile", menuOpen: false,
  open: () => {}, close: () => {}, setSection: () => {}, showMenu: () => {},
  profileSavedAt: 0, notifyProfileSaved: () => {},
};

export function useSettings(): SettingsCtx {
  return useContext(Ctx) ?? NO_PROVIDER;
}
