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
  { name: "Amazon Web Services", does: "Hosting, sign-in (Amazon Cognito), uploaded images, address and place search (Amazon Location Service), scheduled event updates and error logs", where: "Sydney, Australia" },
  { name: "Neon", does: "Our database", where: "Sydney, Australia" },
  { name: "Stripe", does: "Payments, refunds and organiser payouts", where: "Australia and the United States" },
  { name: "Resend", does: "Sending email", where: "United States" },
  { name: "Mapbox", does: "Showing maps", where: "United States" },
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
            Cognito, our sign-in provider, and we never see your password. If you turn on the
            authenticator app, we keep a scrambled (hashed) copy of your one-time recovery codes,
            not the codes themselves. We also keep your notification settings and whether your
            profile is public.
          </p>
          <p>
            If you sign in with Google or Apple, that provider gives us your name, your email
            address, whether it has verified that address, and an identifier for your account with
            it. Apple may give us a private relay address instead of your real one. We do not
            receive your Google or Apple password.
          </p>
        </Clause>
        <Clause n="2.2" title="Event entries">
          <p>
            For each person entered into an event: first and last name, email address, mobile
            number, date of birth, gender, emergency contact name and phone number, any medical
            conditions or allergies you tell us about, an estimated finish time if asked, the ticket
            and category chosen, and whether the organiser’s waiver was accepted. For a team ticket we
            also keep the team’s name and who is in it. Afterwards we hold the bib number, start
            wave, check-in time and results the organiser records. If you are signed in, and you
            agree when we ask after checkout, we save your own details (such as your mobile, date of
            birth and emergency contact) so your next entry is filled in for you.
          </p>
        </Clause>
        <Clause n="2.3" title="Accounts for people entered by someone else">
          <p>
            Entries are linked to the email address given for each participant. When someone enters
            you with an email address that has no Startline account yet, we create an account for
            that address with the name given, so the entry shows in Activity when you sign in. We do
            not send a separate email about the account. If the address already has an account, we
            leave that account as it is. You can sign in to the account and delete it in Settings,
            or ask us to delete it.
          </p>
        </Clause>
        <Clause n="2.4" title="Health information">
          <p>
            Medical conditions and allergies are health information, a kind of sensitive
            information. We collect them only when you choose to provide them at entry, and only so
            the organiser can keep you safe at the event. By providing them, you consent to us
            collecting them and passing them to the organiser of that event.
          </p>
        </Clause>
        <Clause n="2.5" title="Organisations">
          <p>
            The organisation’s name, contact name, email address, phone number, ABN, description,
            images and refund policy, and who its owners and managers are. The organisation chooses
            whether its contact name, email address and phone number are shown on its event pages
            (name and email are shown unless it turns them off; phone is hidden unless it turns it
            on). We keep a history of the changes made to each event once it has been submitted,
            including the email address of the person who made each change. To take paid entries we also collect the
            legal name and date of birth of the person responsible, which we need for identity
            checks and for tax reporting to the Australian Taxation Office under the Sharing Economy
            Reporting Regime. Each time an organisation publishes an event it confirms that it holds
            the public liability insurance and permits the event needs, but we do not collect
            insurance documents. We may check an ABN
            against the Australian Business Register.
          </p>
        </Clause>
        <Clause n="2.6" title="Payments">
          <p>
            Card details go directly to Stripe, and we never see or store them. We keep a record of
            each payment and refund: the amount, the booking fee, its status and Stripe’s reference
            for it.
          </p>
        </Clause>
        <Clause n="2.7" title="How you use Startline">
          <p>
            The events you save, the organisers you follow, the reviews you write or report, and the
            notifications we send you.
          </p>
        </Clause>
        <Clause n="2.8" title="Support requests and when you contact us">
          <p>
            Your name, email address and message when you use the contact, feedback or support form,
            and your email address when you join the waitlist. A refund request made on the Refunds page
            also records the event and your reason, and the decisions the organiser and Startline
            make on it.
          </p>
        </Clause>
        <Clause n="2.9" title="Technical and security information">
          <p>
            Your IP address and basic browser information, which we use to limit repeated requests
            and to record suspicious activity such as failed bot checks. Cloudflare Turnstile checks
            that forms are being filled in by a person. When something goes wrong on a page, your
            browser sends us the error message and the page it happened on, so we can fix it. We use
            cookies to keep you signed in and remember your preferences; see the{" "}
            <TextLink href="/cookies">Cookie Policy</TextLink>. We do not use analytics or advertising
            trackers.
          </p>
        </Clause>
        <Clause n="2.10" title="Information from other people">
          <p>
            Someone else may enter you into an event, such as a friend, a team captain or a parent,
            and an organiser may add you to a team in place of another member. Organisers add bib
            numbers, start waves, check-ins and results. Google or Apple tell us who you are if you
            sign in with them (2.1). Stripe tells us whether an organiser’s payout account is set
            up. If someone gives us your details, we handle them under this policy.
          </p>
        </Clause>
        <Clause n="2.11" title="Staying anonymous">
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
          <li>pass refund requests to the organiser to decide, and step in if they do not respond;</li>
          <li>give organisers what they need to run their events (see 4.1);</li>
          <li>send emails you need, such as entry confirmations, verification codes, changes to an event you have entered, cancellations, refund updates and event approvals;</li>
          <li>tell you when an organiser you follow publishes an event, unless you turn that off;</li>
          <li>show your public profile, reviews and results;</li>
          <li>review new organisations and their events before they are published;</li>
          <li>meet our tax reporting and other legal obligations;</li>
          <li>keep the platform safe, including preventing spam, fraud and abuse;</li>
          <li>answer your questions and improve the platform.</li>
        </Bullets>
        <p>
          We only send marketing emails, such as news about Startline, if you have agreed to them,
          for example by joining the waitlist. Any marketing email we send will have an unsubscribe
          link, and you can ask us to take you off the waitlist at any time by emailing{" "}
          <MailLink email={LEGAL_CONTACT_EMAIL} />.
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
            medical and emergency contact information and, for a team, the team’s name and members,
            so it can run the event and keep you safe. If you ask for a refund, the organiser also
            receives your request and reason so it can decide. The organisation’s owners and
            managers can see all of this. Organisers must use this
            information only for their event (Terms of Service 5.7), and they are responsible for
            how they handle it once they have it.
          </p>
        </Clause>
        <Clause n="4.2" title="Stripe">
          <p>
            Stripe processes payments, refunds and payouts. When an organiser connects Stripe, Stripe
            establishes whether they are an individual or a company and collects the matching identity
            details,
            including the legal name and date of birth of the person responsible, directly from them.
            Organisers also give us the legal name, date of birth and ABN or ACN we need for tax reporting
            (2.5). Where the Stripe account is an individual account, we may pass the legal name and date of
            birth to Stripe so they do not have to enter them twice. Startline does not receive bank account
            details and keeps only a reference to the organiser’s Stripe account.
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
            Anyone can see your public profile, including your username, bio, photo, the events you
            have entered and your results, unless you make it private. Reviews you write are public
            and show your name, or your username if your account has no name. An organisation’s
            profile and events are public once published, along with whichever contact details it
            chooses to show.
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
        Our database, uploaded images and address search are in Sydney. Some of the providers in
        4.3 handle information outside Australia, mainly in the United States: Stripe for payments,
        Resend for email, Mapbox for maps and Cloudflare for bot checks. If you sign in with Google
        or Apple, they handle that sign-in under their own privacy policies, including outside
        Australia. We choose providers that protect
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
          and authenticator app secrets are held by Amazon Cognito, not in our database, and
          recovery codes are stored only in hashed form. Connecting or disconnecting Google or Apple
          on an account with the authenticator app needs your password and a code. Only staff who
          need it can see personal information, and actions in the admin console are logged.
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
          <li>
            Accounts we create for people entered by someone else (2.3): until the person deletes
            the account or asks us to.
          </li>
          <li>Payment and tax records, and refund requests: for as long as tax law requires, usually five years.</li>
          <li>An event’s change history: for as long as the event is kept, so entrants’ questions about a change can be answered.</li>
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
        <li>Unsubscribe from marketing emails using the link in any of them, or leave the waitlist by emailing us.</li>
        <li>Connect or disconnect Google and Apple sign-in in Settings, under Login &amp; security.</li>
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
        this policy, including passing them to the organiser. Give your own email address for a
        child’s entry, so the entry is linked to your account rather than to a new one (2.3).
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
        is significant, we will email you before it takes effect. The date
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
