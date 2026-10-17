import type { Metadata } from "next";
import { LegalDocument, MailLink, TextLink, type LegalSection } from "@/components/legal/LegalDocument";
import { COOKIES_LAST_UPDATED, LEGAL_CONTACT_EMAIL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description:
    "The cookies and browser storage Startline uses, and why. Essential only, no analytics or advertising.",
  openGraph: {
    title: "Cookie Policy | Startline",
    description:
      "The cookies and browser storage Startline uses, and why.",
    url: "/cookies",
  },
  alternates: {
    canonical: "/cookies",
  },
};

type Row = { name: string; purpose: string; lasts: string };

/** Cookies Startline itself sets. Keep in step with AmplifyProvider and the switch-org route. */
const COOKIES: Row[] = [
  {
    name: "CognitoIdentityServiceProvider.*",
    purpose: "Keeps you signed in. Shared across startlineau.com and its organiser and admin portals, so one sign-in covers all three.",
    lasts: "Until you sign out or your session expires",
  },
  {
    name: "startline_active_org",
    purpose: "Remembers which organisation you are working in on the organiser portal.",
    lasts: "1 year",
  },
];

/** Browser storage Startline uses. None of it leaves your device unless noted. */
const STORAGE: Row[] = [
  {
    name: "startline_registered_interest",
    purpose: "Remembers the events you have registered interest in, so the button shows the right state.",
    lasts: "Until you clear it (local storage)",
  },
  {
    name: "startline.cognito-cookie-domain.v1",
    purpose: "Records that an old sign-in cookie format has been tidied up, so it only happens once.",
    lasts: "Until you clear it (local storage)",
  },
  {
    name: "startline_pending_*, startline_intent_organiser",
    purpose: "Carries your details between the steps of signing up, and whether you started from Become an organiser.",
    lasts: "Until you close the tab (session storage)",
  },
  {
    name: "Page history",
    purpose: "Remembers the previous page so back buttons take you to the right place.",
    lasts: "Until you close the tab (session storage)",
  },
];

/** Third parties whose code runs on some pages and may store their own cookies or data. */
const THIRD_PARTIES: { name: string; where: string; why: string; policy: string }[] = [
  {
    name: "Stripe",
    where: "Checkout",
    why: "Processes your payment and sets cookies to detect and prevent fraud.",
    policy: "https://stripe.com/privacy",
  },
  {
    name: "Cloudflare Turnstile",
    where: "Contact, feedback and review forms",
    why: "Checks that a person, not a bot, is filling in the form.",
    policy: "https://www.cloudflare.com/privacypolicy/",
  },
  {
    name: "Mapbox",
    where: "Event maps and address search",
    why: "Shows maps and may store data in your browser to load them faster.",
    policy: "https://www.mapbox.com/legal/privacy",
  },
];

const th = "px-4 py-2.5 font-headline text-[11px] font-bold uppercase tracking-widest text-light";
const td = "px-4 py-2.5";

function Table({ rows }: { rows: Row[] }) {
  return (
    <div className="overflow-x-auto rounded-[12px] border border-dark-lighter">
      <table className="w-full text-left text-[13.5px]">
        <thead className="bg-dark">
          <tr>
            <th className={th}>Name</th>
            <th className={th}>What it does</th>
            <th className={th}>How long</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-t border-dark-lighter align-top">
              <td className={`${td} text-light font-mono text-[12.5px] break-all`}>{r.name}</td>
              <td className={td}>{r.purpose}</td>
              <td className={td}>{r.lasts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const SECTIONS: LegalSection[] = [
  {
    id: "what",
    n: 1,
    title: "What cookies are",
    body: (
      <p>
        Cookies are small files a website stores in your browser. Websites can also keep small
        amounts of data in your browser’s local storage, which stays until you clear it, or session
        storage, which is cleared when you close the tab. This policy covers all three.
      </p>
    ),
  },
  {
    id: "essential",
    n: 2,
    title: "Essential only",
    body: (
      <p>
        Everything Startline stores is needed for the platform to work: keeping you signed in,
        remembering where you are, and getting you through sign-up. We do not use analytics,
        advertising or tracking cookies. Because of that, there is nothing to switch on or off, and
        the cookie setting in Settings, under Privacy, shows essential cookies as always on.
      </p>
    ),
  },
  {
    id: "cookies",
    n: 3,
    title: "Cookies we set",
    body: <Table rows={COOKIES} />,
  },
  {
    id: "storage",
    n: 4,
    title: "Browser storage we use",
    body: <Table rows={STORAGE} />,
  },
  {
    id: "third-parties",
    n: 5,
    title: "Third-party services",
    body: (
      <>
        <p>
          Some pages load services from other companies, which may set their own cookies or store
          data under their own policies. They only load on the pages listed.
        </p>
        <div className="overflow-x-auto rounded-[12px] border border-dark-lighter">
          <table className="w-full text-left text-[13.5px]">
            <thead className="bg-dark">
              <tr>
                <th className={th}>Service</th>
                <th className={th}>Where</th>
                <th className={th}>Why</th>
              </tr>
            </thead>
            <tbody>
              {THIRD_PARTIES.map((t) => (
                <tr key={t.name} className="border-t border-dark-lighter align-top">
                  <td className={`${td} whitespace-nowrap`}>
                    <a href={t.policy} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      {t.name}
                    </a>
                  </td>
                  <td className={td}>{t.where}</td>
                  <td className={td}>{t.why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    ),
  },
  {
    id: "managing",
    n: 6,
    title: "Managing cookies",
    body: (
      <p>
        You can block or delete cookies and browser storage in your browser’s settings. If you block
        Startline’s cookies you will not be able to sign in, and if you block Stripe’s you may not be
        able to pay. Signing out removes the sign-in cookies.
      </p>
    ),
  },
  {
    id: "changes",
    n: 7,
    title: "Changes",
    body: (
      <p>
        If we start using a cookie that is not essential, such as for analytics, we will update this
        policy and ask for your consent before setting it. How we handle personal information more
        generally is in our <TextLink href="/privacy">Privacy Policy</TextLink>.
      </p>
    ),
  },
  {
    id: "contact",
    n: 8,
    title: "Contact",
    body: (
      <p>
        For questions about cookies, contact us at <MailLink email={LEGAL_CONTACT_EMAIL} />.
      </p>
    ),
  },
];

export default function CookiesPage() {
  return (
    <LegalDocument
      title="Cookie"
      accent="Policy"
      updated={COOKIES_LAST_UPDATED}
      sections={SECTIONS}
      summary={
        <p>
          Startline only uses the cookies and browser storage it needs to work, mainly to keep you
          signed in. No analytics, no advertising, no tracking.
        </p>
      }
    />
  );
}
