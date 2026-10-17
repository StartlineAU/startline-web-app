import type { Metadata } from "next";
import { Bullets, Clause, LegalDocument, MailLink, TextLink, type LegalSection } from "@/components/legal/LegalDocument";
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_ENTITY_ABN,
  LEGAL_ENTITY_NAME,
  LEGAL_JURISDICTION,
  PLATFORM_FEE_DESCRIPTION,
  TERMS_LAST_UPDATED,
} from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms that apply when you use Startline to find, enter or run fitness events.",
  openGraph: {
    title: "Terms of Service | Startline",
    description:
      "The terms that apply when you use Startline to find, enter or run fitness events.",
    url: "/terms",
  },
  alternates: {
    canonical: "/terms",
  },
};

const SECTIONS: LegalSection[] = [
  {
    id: "about",
    n: 1,
    title: "About these terms",
    body: (
      <>
        <Clause n="1.1" title="Who we are">
          <p>
            Startline is operated by {LEGAL_ENTITY_NAME} (ABN {LEGAL_ENTITY_ABN}) (“Startline”,
            “we”, “us”). These terms apply to the Startline website at startlineau.com, the organiser
            portal at organiser.startlineau.com and any other service we provide under the Startline
            name (together, the “platform”).
          </p>
        </Clause>
        <Clause n="1.2" title="Who they apply to">
          <p>
            These terms apply to everyone who uses the platform: visitors, athletes who enter
            events (including guests who enter without an account), and organisers who list and run
            events. Section 5 sets out extra terms that apply only to organisers.
          </p>
        </Clause>
        <Clause n="1.3" title="Agreeing to these terms">
          <p>
            You agree to these terms when you create an account, enter an event, set up an
            organisation or list an event. If you do not agree, please do not use the platform. Our{" "}
            <TextLink href="/privacy">Privacy Policy</TextLink> and{" "}
            <TextLink href="/cookies">Cookie Policy</TextLink> explain how we handle personal
            information and cookies.
          </p>
        </Clause>
        <Clause n="1.4" title="Changes">
          <p>
            We may update these terms as the platform changes. If a change is significant, we will
            tell you by email or on the platform at least 14 days before it takes effect. If you do
            not agree with a change, you can close your account before then. A change never alters
            the terms of an entry you have already bought.
          </p>
        </Clause>
      </>
    ),
  },
  {
    id: "accounts",
    n: 2,
    title: "Your account",
    body: (
      <>
        <Clause n="2.1" title="Who can have an account">
          <p>
            You must be at least 18 years old to create an account or set up an organisation. A
            parent or guardian can enter a child into an event on the child’s behalf (see 4.6).
          </p>
        </Clause>
        <Clause n="2.2" title="Keeping it accurate and secure">
          <p>
            An account is for one person. Give us accurate details and keep them up to date. Keep
            your password to yourself, and tell us straight away if you think someone else has used
            your account. You are responsible for what happens under your account unless it was
            caused by our failure to keep the platform secure. We recommend turning on the
            authenticator app option in Login &amp; security.
          </p>
        </Clause>
        <Clause n="2.3" title="Your public profile">
          <p>
            Your username, bio, profile photo and race history, including results organisers record
            for you, are shown on your public profile. You can make your profile private in
            Settings. Your full name, contact details, date of birth and other entry details are
            never shown on your profile.
          </p>
        </Clause>
        <Clause n="2.4" title="Closing your account">
          <p>
            You can delete your account at any time in Settings, under Login &amp; security. If you
            are the only owner of an organisation, you will need to hand ownership to someone else
            or delete the organisation first. The entries you made stay with the organisers who ran
            those events, because they are part of the organiser’s records, but they are no longer
            linked to you.
          </p>
        </Clause>
      </>
    ),
  },
  {
    id: "payments",
    n: 3,
    title: "Startline’s role, fees and refunds",
    body: (
      <>
        <Clause n="3.1" title="What Startline does">
          <p>
            Startline is a marketplace. Organisers use it to list events and take entries, and
            athletes use it to find and enter them. The organiser runs the event and is responsible
            for it. When you enter an event, your agreement to take part is with the organiser, not
            with Startline. Some listings send you to the organiser’s own website to enter; those
            entries are handled entirely by the organiser.
          </p>
        </Clause>
        <Clause n="3.2" title="The Startline booking fee">
          <p>
            Startline charges a booking fee of {PLATFORM_FEE_DESCRIPTION} on each paid ticket. Free
            tickets carry no fee. The organiser chooses whether the fee is added to the price you pay
            or taken from the ticket price. Either way, the total you will pay is shown before you
            pay. Prices are in Australian dollars.
          </p>
        </Clause>
        <Clause n="3.3" title="How payment works">
          <p>
            Payments are processed by Stripe. Your card details go directly to Stripe, and
            Startline never sees or stores them. Startline collects entry fees as the organiser’s
            limited payment collection agent. Once your payment to Startline goes through, you have
            paid the organiser for that entry.
          </p>
        </Clause>
        <Clause n="3.4" title="Refunds under an event’s refund policy">
          <p>
            Every paid event shows its refund policy before you pay. The policy says what
            percentage you get back depending on how many days before the event you cancel. That
            percentage applies to the full amount you paid, including the Startline booking fee. You
            can ask for a refund from your entry in your account. Startline processes approved
            refunds back to your original payment method, which usually takes 5 to 10 business
            days. A request outside the policy is up to the organiser.
          </p>
        </Clause>
        <Clause n="3.5" title="Cancelled or changed events">
          <p>
            If an organiser cancels an event, you are entitled to a full refund of everything you
            paid, including the Startline booking fee. If an organiser postpones an event or changes
            its date, location or distance in a significant way, you can choose to keep your entry
            or take a full refund.
          </p>
        </Clause>
        <Clause n="3.6" title="Your rights under Australian Consumer Law">
          <p>
            Nothing in these terms limits any right you have under the Australian Consumer Law,
            including a right to a refund or other remedy when a service has a major failure.
          </p>
        </Clause>
        <Clause n="3.7" title="Payment disputes">
          <p>
            If something has gone wrong with a payment, please contact us before raising a dispute
            with your bank, so we can try to fix it quickly. This does not affect your right to
            dispute a charge.
          </p>
        </Clause>
      </>
    ),
  },
  {
    id: "entering",
    n: 4,
    title: "Entering events",
    body: (
      <>
        <Clause n="4.1" title="Giving accurate details">
          <p>
            The details you give when you enter, including any medical or emergency contact
            information, must be accurate. Organisers rely on them to run the event safely. If you
            enter other people, you confirm that you have their permission and that you have told
            them how their details will be used, as described in our{" "}
            <TextLink href="/privacy">Privacy Policy</TextLink>.
          </p>
        </Clause>
        <Clause n="4.2" title="Your health and safety">
          <p>
            Fitness events are physically demanding and carry a risk of injury. You are responsible
            for deciding whether you are fit to take part and for getting medical advice if you are
            unsure. Follow the organiser’s rules and the instructions of event staff on the day.
          </p>
        </Clause>
        <Clause n="4.3" title="The organiser’s rules">
          <p>
            Organisers may have their own rules, entry conditions or waivers, and you agree to them
            when you enter. They are between you and the organiser. Startline does not write or
            check them.
          </p>
        </Clause>
        <Clause n="4.4" title="Bibs, start waves, check-in and results">
          <p>
            The organiser assigns bib numbers and start waves and records results. Results the
            organiser records may appear on the event page and on your profile.
          </p>
        </Clause>
        <Clause n="4.5" title="Transfers">
          <p>
            An entry is for the person named on it. It cannot be transferred or resold unless the
            organiser allows it.
          </p>
        </Clause>
        <Clause n="4.6" title="Entering a child">
          <p>
            A parent or guardian can enter a child under 18. By doing so, you accept the organiser’s
            rules and any waiver on the child’s behalf, and you are responsible for the child’s
            supervision as the event requires.
          </p>
        </Clause>
      </>
    ),
  },
  {
    id: "organisers",
    n: 5,
    title: "Organiser terms",
    body: (
      <>
        <p>
          This section applies when you set up an organisation or list an event. “You” here means
          the organisation and every person who manages it on Startline.
        </p>
        <Clause n="5.1" title="Your organisation">
          <p>
            Give accurate details about your organisation and keep them up to date. Events from
            organisations Startline has not yet verified are reviewed before they are published. We
            may approve, reject or unpublish any event, and we will tell you why.
          </p>
        </Clause>
        <Clause n="5.2" title="Your listings">
          <p>
            You are responsible for your event and for what your listings say. You must:
          </p>
          <Bullets>
            <li>have the right to run the event, and hold every permit, approval and venue booking it needs;</li>
            <li>describe the event accurately, including its price, date, location, course and any entry requirements;</li>
            <li>have the rights to every image, logo and piece of text you upload;</li>
            <li>run the event safely and lawfully, with suitable first aid, risk management and staffing;</li>
            <li>keep the listing up to date and tell entrants promptly about any significant change.</li>
          </Bullets>
        </Clause>
        <Clause n="5.3" title="Insurance">
          <p>
            You must hold public liability insurance for each event you list, at the level required
            by the council, venue, landowner and any permit for that event, covering the full
            duration of the event. Many councils ask for cover of $20 million or more, so check what
            yours requires. Startline does not set its own minimum and does not collect or check
            certificates of insurance. You declare that you hold this cover, and you are responsible
            for that declaration being true.
          </p>
        </Clause>
        <Clause n="5.4" title="Payments and payouts">
          <p>
            To take paid entries you must connect a Stripe Express account and accept Stripe’s
            Connected Account Agreement. Stripe collects and holds your bank account and identity
            details; Startline stores only a reference to your Stripe account. The Startline booking
            fee (3.2) is deducted at the time of each sale. Once your event has finished, the ticket
            amounts from confirmed entries, less any refunds, are paid out to your nominated bank
            account.
          </p>
        </Clause>
        <Clause n="5.5" title="Tax reporting">
          <p>
            To take paid entries you must give us your legal name, date of birth and, if you have
            one, your ABN. Startline reports transactions made through the platform to the
            Australian Taxation Office under the Sharing Economy Reporting Regime where the law
            requires it. You are responsible for your own tax and GST obligations.
          </p>
        </Clause>
        <Clause n="5.6" title="Refunds you owe">
          <p>
            Every paid event must have a refund policy, and you must honour it. If you cancel an
            event, you must refund every entrant in full, including the Startline booking fee, and
            if you postpone it or change it significantly you must offer a full refund (3.5).
            Startline processes these refunds from the event’s takings. If a refund or a payment
            dispute arises after you have been paid out, we may recover the amount from your future
            payouts or ask you to repay it.
          </p>
        </Clause>
        <Clause n="5.7" title="Entrants’ personal information">
          <p>
            You receive your entrants’ personal information, which can include health information
            and emergency contacts. You must:
          </p>
          <Bullets>
            <li>use it only to run the event, keep entrants safe and tell them about the event;</li>
            <li>not sell it, and not use it for marketing unless the entrant has separately agreed;</li>
            <li>keep it secure, share it only with people who need it to run the event, and delete it when you no longer need it;</li>
            <li>handle it in line with the Privacy Act 1988 (Cth) wherever it applies to you.</li>
          </Bullets>
        </Clause>
        <Clause n="5.8" title="Your team">
          <p>
            Owners can add other people to the organisation as owners or managers. Owners are
            responsible for what the people they add do on the organisation’s behalf.
          </p>
        </Clause>
        <Clause n="5.9" title="Community standards and reviews">
          <p>
            You must welcome all athletes, whatever their background, ability, age or experience,
            and run events that are free from discrimination. Athletes can review your organisation.
            You cannot remove a review, offer anything in return for one, or post reviews of your
            own events. If you think a review breaks these terms, report it and we will look at it.
          </p>
        </Clause>
      </>
    ),
  },
  {
    id: "content",
    n: 6,
    title: "Content and conduct",
    body: (
      <>
        <Clause n="6.1" title="Content you post">
          <p>
            You keep ownership of what you post, such as photos, event listings and reviews. You
            give Startline a non-exclusive, royalty-free, worldwide licence to host, display, copy
            and format that content so we can run and promote the platform, for example by featuring
            a published event. The licence ends when you remove the content, except for copies we
            need to keep for legal reasons or that others have already shared.
          </p>
        </Clause>
        <Clause n="6.2" title="Reviews">
          <p>
            Reviews must be honest and based on your own experience of the event. We may remove a
            review that breaks these terms.
          </p>
        </Clause>
        <Clause n="6.3" title="What you must not do">
          <p>You must not use the platform to:</p>
          <Bullets>
            <li>break the law, or help anyone else to;</li>
            <li>harass, threaten, abuse or discriminate against anyone;</li>
            <li>post false, misleading, offensive or infringing content;</li>
            <li>pretend to be someone else, or enter someone without their permission;</li>
            <li>scrape, copy or harvest data from the platform, including other people’s details;</li>
            <li>upload malware, probe for weaknesses, get around security or rate limits, or interfere with how the platform runs;</li>
            <li>list events you do not have the right to run, or take entries for events that will not go ahead.</li>
          </Bullets>
        </Clause>
        <Clause n="6.4" title="Startline’s own material">
          <p>
            The Startline name, logo, design and software belong to us. You may not copy or use
            them except to use the platform as intended.
          </p>
        </Clause>
        <Clause n="6.5" title="Feedback">
          <p>
            If you send us ideas or suggestions, we can use them without owing you anything.
          </p>
        </Clause>
      </>
    ),
  },
  {
    id: "liability",
    n: 7,
    title: "Liability",
    body: (
      <>
        <Clause n="7.1" title="Consumer guarantees">
          <p>
            Our services come with guarantees that cannot be excluded under the Australian Consumer
            Law. Nothing in this section excludes, restricts or changes those guarantees or any
            other right that the law says cannot be excluded.
          </p>
        </Clause>
        <Clause n="7.2" title="The platform">
          <p>
            We work to keep the platform available, accurate and secure, but we cannot promise it
            will always be uninterrupted or free of errors. Apart from the guarantees in 7.1, we
            give no other promises about the platform.
          </p>
        </Clause>
        <Clause n="7.3" title="Events">
          <p>
            Organisers run their events, and Startline does not. To the extent the law allows,
            Startline is not responsible for how an event is run, for what happens at it, or for
            anything an organiser says in a listing.
          </p>
        </Clause>
        <Clause n="7.4" title="Limits on our liability">
          <p>
            Where the law allows us to limit our liability for failing to meet a consumer guarantee,
            our liability is limited to supplying the service again or paying the cost of having it
            supplied again. Otherwise, and to the extent the law allows, Startline is not liable for
            any indirect or consequential loss, or for lost profits or revenue, and our total
            liability to you is limited to the greater of the booking fees you paid Startline in the
            12 months before the claim and A$100. These limits do not apply to loss caused by our
            fraud or wilful misconduct, or to death or personal injury caused by our negligence.
          </p>
        </Clause>
        <Clause n="7.5" title="Organiser indemnity">
          <p>
            Organisers agree to compensate Startline for any claim, loss or cost (including
            reasonable legal costs) arising from their events, their listings, their use of
            entrants’ information, or their breach of these terms or of the law, except to the
            extent Startline caused it.
          </p>
        </Clause>
      </>
    ),
  },
  {
    id: "suspension",
    n: 8,
    title: "Suspending or ending access",
    body: (
      <>
        <Clause n="8.1">
          <p>
            We may suspend or close an account or organisation, or unpublish an event, if it breaks
            these terms, puts other people at risk, or if the law requires it. Where we reasonably
            can, we will tell you why first and give you a chance to fix the problem.
          </p>
        </Clause>
        <Clause n="8.2">
          <p>
            If we close an organisation, its obligations to refund entrants for events that will
            not go ahead still apply. Sections 3.4 to 3.7, 5.6, 5.7, 7 and 9 continue after an
            account closes.
          </p>
        </Clause>
      </>
    ),
  },
  {
    id: "general",
    n: 9,
    title: "General",
    body: (
      <>
        <Clause n="9.1" title="Governing law">
          <p>
            These terms are governed by the law of {LEGAL_JURISDICTION}, Australia. You and Startline
            agree that the courts of {LEGAL_JURISDICTION}, and the courts that hear appeals from
            them, can hear any dispute about these terms.
          </p>
        </Clause>
        <Clause n="9.2" title="Disputes with Startline">
          <p>
            If you have a complaint, contact us first and we will try to resolve it within 30 days.
            This does not stop you going to a consumer protection agency, tribunal or court.
          </p>
        </Clause>
        <Clause n="9.3" title="Disputes with an organiser">
          <p>
            Questions about an event are best raised with its organiser. If you cannot resolve a
            problem with an organiser, tell us and we will see whether we can help.
          </p>
        </Clause>
        <Clause n="9.4" title="Other terms">
          <p>
            If a court finds part of these terms cannot be enforced, the rest still applies. If we
            do not enforce a term straight away, we can still enforce it later. We may transfer our
            rights and obligations under these terms to a business that takes over the platform,
            and we will tell you if we do. These terms, together with the Privacy Policy and Cookie
            Policy, are the whole agreement between you and Startline about the platform.
          </p>
        </Clause>
        <Clause n="9.5" title="Notices">
          <p>
            We will send notices to the email address on your account. You can send notices to us
            at <MailLink email={LEGAL_CONTACT_EMAIL} />.
          </p>
        </Clause>
      </>
    ),
  },
  {
    id: "contact",
    n: 10,
    title: "Contact",
    body: (
      <p>
        For questions about these terms, contact us at <MailLink email={LEGAL_CONTACT_EMAIL} />.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalDocument
      title="Terms of"
      accent="Service"
      updated={TERMS_LAST_UPDATED}
      sections={SECTIONS}
      summary={
        <>
          <p>
            Startline is where organisers list fitness events and athletes enter them. The
            organiser runs the event; we run the platform and process payments.
          </p>
          <p>
            Each paid event shows its refund policy before you pay. A cancelled event is refunded in
            full, booking fee included.
          </p>
          <p>
            This summary is here to help. The numbered terms below are what apply.
          </p>
        </>
      }
    />
  );
}
