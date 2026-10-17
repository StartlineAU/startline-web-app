import type { Metadata } from "next";
import { Bullets, Clause, LegalDocument, MailLink, TextLink, type LegalSection } from "@/components/legal/LegalDocument";
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_ENTITY_ABN,
  LEGAL_ENTITY_NAME,
  PRIVACY_LAST_UPDATED,
} from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Startline collects, uses, shares and protects your personal information.",
  openGraph: {
    title: "Privacy Policy | Startline",
    description:
      "How Startline collects, uses, shares and protects your personal information.",
    url: "/privacy",
  },
  alternates: {
    canonical: "/privacy",
  },
};

/** The services that handle personal information for us, and where. */
const PROVIDERS: { name: string; does: string; where: string }[] = [
  { name: "Amazon Web Services", does: "Hosting, sign-in (Amazon Cognito) and uploaded images", where: "Sydney, Australia" },
  { name: "Neon", does: "Our database", where: "Sydney, Australia" },
  { name: "Stripe", does: "Payments, refunds and organiser payouts", where: "Australia and the United States" },
  { name: "Resend", does: "Sending email", where: "United States" },
  { name: "Mapbox", does: "Maps and address search", where: "United States" },
  { name: "Cloudflare", does: "Bot checks on forms (Turnstile)", where: "Worldwide network, including the United States" },
];

const SECTIONS: LegalSection[] = [
  {
    id: "about",
    n: 1,
    title: "About this policy",
    body: (
      <>
        <p>
          This policy explains how {LEGAL_ENTITY_NAME} (ABN {LEGAL_ENTITY_ABN}) (“Startline”, “we”,
          “us”) handles personal information when you use startlineau.com, the organiser portal or
          any other Startline service. It covers athletes, guests who enter without an account,
          organisers and their team members, and anyone who contacts us.
        </p>
        <p>
          We handle personal information in line with the Privacy Act 1988 (Cth) and the Australian
          Privacy Principles. Words such as “personal information”, “sensitive information” and
          “health information” have the meaning they have in that Act.
        </p>
      </>
    ),
  },
  {
    id: "collect",
    n: 2,
    title: "What we collect",
    body: (
      <>
        <Clause n="2.1" title="Your account">
          <p>
            Your email address, name, username, and anything you add to your profile, such as a bio,
            photo, city and state. Your password and authenticator app setup are held by Amazon
            Cognito, our sign-in provider, and we never see your password. We also keep your
            notification settings and whether your profile is public.
          </p>
        </Clause>
        <Clause n="2.2" title="Event entries">
          <p>
            For each person entered into an event: first and last name, email address, mobile
            number, date of birth, gender, emergency contact name and phone number, any medical
            conditions or allergies you tell us about, an estimated finish time if asked, the ticket
            and category chosen, and whether the organiser’s waiver was accepted. Afterwards we hold
            the bib number, start wave, check-in time and results the organiser records. If you are
            signed in, we can save your own details so your next entry is filled in for you.
          </p>
        </Clause>
        <Clause n="2.3" title="Health information">
          <p>
            Medical conditions and allergies are health information, a kind of sensitive
            information. We collect them only when you choose to provide them at entry, and only so
            the organiser can keep you safe at the event. By providing them, you consent to us
            collecting them and passing them to the organiser of that event.
          </p>
        </Clause>
        <Clause n="2.4" title="Organisations">
          <p>
            The organisation’s name, contact name, email address, phone number, ABN, description and
            images, and who its owners and managers are. To take paid entries we also collect the
            legal name and date of birth of the person responsible, which we need for identity
            checks and for tax reporting to the Australian Taxation Office under the Sharing Economy
            Reporting Regime. We record whether the organisation has declared that it holds public
            liability insurance, but we do not collect insurance documents. We may check an ABN
            against the Australian Business Register.
          </p>
        </Clause>
        <Clause n="2.5" title="Payments">
          <p>
            Card details go directly to Stripe, and we never see or store them. We keep a record of
            each payment and refund: the amount, the booking fee, its status and Stripe’s reference
            for it.
          </p>
        </Clause>
        <Clause n="2.6" title="How you use Startline">
          <p>
            The events you save, the organisers you follow, the reviews you write or report, and the
            notifications we send you.
          </p>
        </Clause>
        <Clause n="2.7" title="When you contact us">
          <p>
            Your email address and message when you use the contact or feedback form, or join the
            waitlist.
          </p>
        </Clause>
        <Clause n="2.8" title="Technical and security information">
          <p>
            Your IP address and basic browser information, which we use to limit repeated requests
            and to record suspicious activity such as failed bot checks. Cloudflare Turnstile checks
            that forms are being filled in by a person. We use cookies to keep you signed in and
            remember your preferences; see the <TextLink href="/cookies">Cookie Policy</TextLink>.
            We do not use analytics or advertising trackers.
          </p>
        </Clause>
        <Clause n="2.9" title="Information from other people">
          <p>
            Someone else may enter you into an event, such as a friend, a team captain or a parent.
            Organisers add bib numbers, start waves and results. Stripe tells us whether an
            organiser’s payout account is set up. If someone gives us your details, we handle them
            under this policy.
          </p>
        </Clause>
        <Clause n="2.10" title="Staying anonymous">
          <p>
            You can browse events without an account or telling us who you are. To enter an event
            or run one, we need the details above.
          </p>
        </Clause>
      </>
    ),
  },
  {
    id: "use",
    n: 3,
    title: "How we use it",
    body: (
      <>
        <p>We use personal information to:</p>
        <Bullets>
          <li>create and secure your account, including sign-in codes and the authenticator app;</li>
          <li>process entries, payments, refunds and organiser payouts;</li>
          <li>give organisers what they need to run their events (see 4.1);</li>
          <li>send emails you need, such as entry confirmations, verification codes, start wave changes, refund updates and event approvals;</li>
          <li>tell you when an organiser you follow publishes an event, unless you turn that off;</li>
          <li>show your public profile, reviews and results;</li>
          <li>review new organisations and their events before they are published;</li>
          <li>meet our tax reporting and other legal obligations;</li>
          <li>keep the platform safe, including preventing spam, fraud and abuse;</li>
          <li>answer your questions and improve the platform.</li>
        </Bullets>
        <p>
          We only send marketing emails, such as news about Startline, if you have agreed to them,
          for example by joining the waitlist. Every marketing email has an unsubscribe link.
        </p>
      </>
    ),
  },
  {
    id: "share",
    n: 4,
    title: "Who we share it with",
    body: (
      <>
        <Clause n="4.1" title="Organisers of the events you enter">
          <p>
            When you enter an event, the organiser receives your entry details, including any
            medical and emergency contact information, so it can run the event and keep you safe.
            The organisation’s owners and managers can see them. Organisers must use this
            information only for their event (Terms of Service 5.7), and they are responsible for
            how they handle it once they have it.
          </p>
        </Clause>
        <Clause n="4.2" title="Stripe">
          <p>
            Stripe processes payments, refunds and payouts. Organisers give their bank account and
            identity details directly to Stripe, which handles them under its own privacy policy.
            Startline keeps only a reference to the organiser’s Stripe account.
          </p>
        </Clause>
        <Clause n="4.3" title="Service providers">
          <p>These providers handle personal information for us so the platform can run:</p>
          <div className="overflow-x-auto rounded-[12px] border border-dark-lighter">
            <table className="w-full text-left text-[13.5px]">
              <thead className="bg-dark">
                <tr>
                  <th className="px-4 py-2.5 font-headline text-[11px] font-bold uppercase tracking-widest text-light">Provider</th>
                  <th className="px-4 py-2.5 font-headline text-[11px] font-bold uppercase tracking-widest text-light">What for</th>
                  <th className="px-4 py-2.5 font-headline text-[11px] font-bold uppercase tracking-widest text-light">Where</th>
                </tr>
              </thead>
              <tbody>
                {PROVIDERS.map((p) => (
                  <tr key={p.name} className="border-t border-dark-lighter align-top">
                    <td className="px-4 py-2.5 text-light whitespace-nowrap">{p.name}</td>
                    <td className="px-4 py-2.5">{p.does}</td>
                    <td className="px-4 py-2.5">{p.where}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Clause>
        <Clause n="4.4" title="The Australian Taxation Office">
          <p>
            We report organisers’ details and the payments made to them to the ATO under the Sharing
            Economy Reporting Regime, where the law requires it.
          </p>
        </Clause>
        <Clause n="4.5" title="Other people on Startline">
          <p>
            Anyone can see your public profile, including your username, bio, photo, race history
            and results, unless you make it private. Reviews you write show your username. An
            organisation’s profile and events are public once published.
          </p>
        </Clause>
        <Clause n="4.6" title="When the law requires it">
          <p>
            We may share information with police, regulators or courts when the law requires or
            allows it, or to protect someone’s safety. If Startline is sold or merges with another
            business, personal information may pass to the new owner, who must handle it under this
            policy.
          </p>
        </Clause>
        <Clause n="4.7" title="We do not sell it">
          <p>We never sell personal information or share it with advertisers.</p>
        </Clause>
      </>
    ),
  },
  {
    id: "overseas",
    n: 5,
    title: "Information sent overseas",
    body: (
      <p>
        Our database and uploaded images are stored in Sydney. Some of the providers in 4.3 handle
        information outside Australia, mainly in the United States: Stripe for payments, Resend for
        email, Mapbox for maps and Cloudflare for bot checks. We choose providers that protect
        personal information to a standard comparable with the Australian Privacy Principles and
        that are bound by contract to do so.
      </p>
    ),
  },
  {
    id: "security",
    n: 6,
    title: "How we protect it",
    body: (
      <>
        <p>
          Information is encrypted when it travels between your browser and Startline. Passwords
          and authenticator app secrets are held by Amazon Cognito, not in our database. Only staff
          who need it can see personal information, and actions in the admin console are logged.
          Uploaded files are checked to make sure they are what they claim to be.
        </p>
        <p>
          No system is perfectly secure. If a data breach is likely to cause you serious harm, we
          will tell you and the Office of the Australian Information Commissioner, as the Notifiable
          Data Breaches scheme requires.
        </p>
      </>
    ),
  },
  {
    id: "retention",
    n: 7,
    title: "How long we keep it",
    body: (
      <>
        <Bullets>
          <li>Your account and profile: until you delete your account.</li>
          <li>
            Event entries: these are the organiser’s records, so they stay with the organiser after
            you delete your account, without the link to it.
          </li>
          <li>Payment and tax records: for as long as tax law requires, usually five years.</li>
          <li>Security records: only as long as we need them to keep the platform safe.</li>
          <li>Email verification codes: they expire shortly after they are sent.</li>
        </Bullets>
        <p>
          When we no longer need information, we delete it or remove anything that identifies you.
        </p>
      </>
    ),
  },
  {
    id: "rights",
    n: 8,
    title: "Seeing and correcting your information",
    body: (
      <>
        <p>
          You can see and change most of your information in Settings, and delete your account under
          Login &amp; security. To ask for a copy of what we hold about you, or to have something
          corrected, email <MailLink email={LEGAL_CONTACT_EMAIL} />. We will answer within 30 days
          and will not charge you. If the law allows us to refuse a request, we will tell you why.
        </p>
        <p>
          To correct details on an entry the organiser holds, contact the organiser, or tell us and
          we will pass the request on.
        </p>
      </>
    ),
  },
  {
    id: "choices",
    n: 9,
    title: "Your choices",
    body: (
      <Bullets>
        <li>Make your profile private in Settings.</li>
        <li>Turn off emails about new events from organisers you follow in Settings. Emails about your own entries are always sent.</li>
        <li>Unsubscribe from marketing emails using the link in any of them.</li>
        <li>Manage cookies in Settings, under Privacy.</li>
        <li>Leave the medical conditions field empty when you enter, unless the organiser needs it.</li>
      </Bullets>
    ),
  },
  {
    id: "children",
    n: 10,
    title: "Children",
    body: (
      <p>
        Accounts are for people aged 18 and over. A parent or guardian can enter a child into an
        event, and in doing so gives us the child’s details and consents to how we handle them under
        this policy, including passing them to the organiser.
      </p>
    ),
  },
  {
    id: "complaints",
    n: 11,
    title: "Complaints",
    body: (
      <p>
        If you think we have mishandled your personal information, email{" "}
        <MailLink email={LEGAL_CONTACT_EMAIL} />. We will look into it and reply within 30 days. If
        you are not satisfied with our answer, you can complain to the Office of the Australian
        Information Commissioner at{" "}
        <a href="https://www.oaic.gov.au" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
          oaic.gov.au
        </a>{" "}
        or on 1300 363 992.
      </p>
    ),
  },
  {
    id: "changes",
    n: 12,
    title: "Changes to this policy",
    body: (
      <p>
        We will update this policy when the way we handle personal information changes. If a change
        is significant, we will tell you by email or on the platform before it takes effect. The date
        at the top shows when it was last updated.
      </p>
    ),
  },
  {
    id: "contact",
    n: 13,
    title: "Contact",
    body: (
      <p>
        For anything about privacy, contact us at <MailLink email={LEGAL_CONTACT_EMAIL} />.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Privacy"
      accent="Policy"
      updated={PRIVACY_LAST_UPDATED}
      sections={SECTIONS}
      summary={
        <>
          <p>
            We collect what we need to run your account and your event entries. When you enter an
            event, the organiser gets your entry details, including any medical and emergency
            contact information, so it can keep you safe.
          </p>
          <p>
            We never sell your information or share it with advertisers. You can see, change or
            delete it from Settings.
          </p>
        </>
      }
    />
  );
}
