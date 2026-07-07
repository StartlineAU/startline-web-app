"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, Lock, LogIn, Plus, UserRound } from "lucide-react";
import SignInModal from "@/components/SignInModal";
import ParticipantFormSection from "@/components/registration/ParticipantFormSection";
import SharedEmergencyContactSection from "@/components/registration/SharedEmergencyContactSection";
import GuestEmailVerificationStep from "@/components/registration/GuestEmailVerificationStep";
import { useAuthContext } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import {
  splitFullName,
  validateParticipants,
  formatPhoneForDisplay,
  createEmptyParticipant,
  MAX_REGISTRATION_PARTICIPANTS,
  type ParticipantFormErrors,
  type RegistrationFormData,
  type RegistrationFormField,
  type EmergencyContact,
  type EmergencyContactErrors,
  getEmailsRequiringVerification,
} from "@/lib/registration-form";

const StripePaymentSection = dynamic(() => import("./stripe-payment"), { ssr: false });

interface Wave {
  label: string;
  price: string;
  qty?: number;
  date?: string;
}

interface EventData {
  id: string;
  title: string;
  eventDate: string;
  venue: string;
  city: string;
  state: string;
  waves: Wave[];
  feeStructure: string;
  registrationType: string;
  coverImageUrl: string | null;
  organiser: {
    id: string;
    orgName: string | null;
    logoUrl: string | null;
  };
}

type CheckoutStep = "auth" | "details" | "verify-email" | "payment";
type RegistrationMode = "self" | "someone-else" | "multiple";

interface ProfilePrefill {
  email: string;
  firstName: string;
  lastName: string;
  mobile: string;
  dateOfBirth: string;
}

const REGISTRATION_MODE_OPTIONS: {
  value: RegistrationMode;
  label: string;
  description: string;
}[] = [
  {
    value: "self",
    label: "I am registering for myself",
    description: "One ticket in your name. Sign in to prefill your details.",
  },
  {
    value: "someone-else",
    label: "I am registering for someone else",
    description: "One ticket for another participant. Enter their details below.",
  },
  {
    value: "multiple",
    label: "I am registering for multiple people",
    description: "Add each participant separately. One shared emergency contact for the group.",
  },
];

export default function RegisterPage() {
  return <RegisterContent />;
}

function RegisterContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const eventId = params.id as string;
  const preselectedWave = searchParams.get("wave") ?? "";
  const { status, user } = useAuthContext();

  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<ParticipantFormErrors>({});
  const [waveError, setWaveError] = useState("");
  const [registrationModeError, setRegistrationModeError] = useState("");
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [guestMode, setGuestMode] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [profileData, setProfileData] = useState<ProfilePrefill | null>(null);
  const [registrationMode, setRegistrationMode] = useState<RegistrationMode | null>(null);
  const [participants, setParticipants] = useState<RegistrationFormData[]>(() => [createEmptyParticipant()]);
  const [sharedEmergencyContact, setSharedEmergencyContact] = useState<EmergencyContact>({ name: "", phone: "" });
  const [emergencyContactErrors, setEmergencyContactErrors] = useState<EmergencyContactErrors>({});

  const [selectedWave, setSelectedWave] = useState(preselectedWave);
  const [clientSecret, setClientSecret] = useState("");
  const [processing, setProcessing] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>("auth");

  const isGroupRegistration = registrationMode === "multiple";

  useEffect(() => {
    fetch(`/api/events`)
      .then((r) => r.json())
      .then((events: EventData[]) => {
        const found = events.find((e) => e.id === eventId);
        if (found) setEvent(found);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [eventId]);

  useEffect(() => {
    if (status === "loading") return;

    if (status === "authenticated") {
      setCheckoutStep("details");
      return;
    }

    if (guestMode) {
      setCheckoutStep("details");
      return;
    }

    setCheckoutStep("auth");
  }, [status, guestMode]);

  useEffect(() => {
    if (status !== "authenticated" || profileLoaded) return;

    fetch("/api/user/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((profile: {
        email?: string;
        name?: string | null;
        mobile?: string | null;
        dateOfBirth?: string | null;
      } | null) => {
        if (!profile) return;
        const { firstName, lastName } = splitFullName(profile.name);
        setProfileData({
          email: profile.email ?? "",
          firstName,
          lastName,
          mobile: profile.mobile ? formatPhoneForDisplay(profile.mobile) : "",
          dateOfBirth: profile.dateOfBirth ?? "",
        });
      })
      .catch(() => {})
      .finally(() => setProfileLoaded(true));
  }, [status, profileLoaded]);

  const selectedWaveData = event?.waves?.find((w) => w.label === selectedWave);
  const ticketPrice = selectedWaveData ? parseFloat(selectedWaveData.price || "0") : 0;
  const platformFeePercent = 0.0395;
  const platformFeeFixed = 1.45;
  const perTicketPlatformFee = event?.feeStructure === "athlete"
    ? ticketPrice * platformFeePercent + platformFeeFixed
    : 0;
  const perTicketTotal = event?.feeStructure === "athlete"
    ? ticketPrice + perTicketPlatformFee
    : ticketPrice;
  const participantCount = participants.length;
  const platformFee = perTicketPlatformFee * participantCount;
  const totalPrice = perTicketTotal * participantCount;

  const emailsToVerify = useMemo(
    () => getEmailsRequiringVerification(
      participants.map((participant) => participant.email),
      status === "authenticated" ? user?.email : null
    ),
    [participants, status, user?.email]
  );

  const requiresEmailVerification = emailsToVerify.length > 0;

  const buildSelfParticipant = useCallback((): RegistrationFormData => {
    if (!profileData) return createEmptyParticipant();
    return {
      ...createEmptyParticipant(),
      email: profileData.email,
      firstName: profileData.firstName,
      lastName: profileData.lastName,
      mobile: profileData.mobile,
      dateOfBirth: profileData.dateOfBirth,
    };
  }, [profileData]);

  useEffect(() => {
    if (registrationMode !== "self" || !profileData) return;
    setParticipants([buildSelfParticipant()]);
  }, [registrationMode, profileData, buildSelfParticipant]);

  const handleRegistrationModeChange = (mode: RegistrationMode) => {
    setRegistrationMode(mode);
    setRegistrationModeError("");
    setFieldErrors({});
    setEmergencyContactErrors({});
    setSharedEmergencyContact({ name: "", phone: "" });

    if (mode === "self") {
      setParticipants([buildSelfParticipant()]);
      return;
    }

    setParticipants([createEmptyParticipant()]);
  };

  const clearFieldError = (index: number, field: RegistrationFormField) => {
    setFieldErrors((prev) => {
      const current = prev[index];
      if (!current?.[field]) return prev;
      const next = { ...prev, [index]: { ...current } };
      delete next[index][field];
      if (Object.keys(next[index]).length === 0) delete next[index];
      return next;
    });
  };

  const updateParticipant = (
    index: number,
    field: keyof RegistrationFormData,
    value: string | boolean
  ) => {
    setParticipants((prev) =>
      prev.map((participant, i) =>
        i === index ? { ...participant, [field]: value } : participant
      )
    );
    if (typeof value === "boolean" || typeof value === "string") {
      clearFieldError(index, field as RegistrationFormField);
    }
  };

  const addParticipant = () => {
    if (participants.length >= MAX_REGISTRATION_PARTICIPANTS) return;
    setParticipants((prev) => [...prev, createEmptyParticipant()]);
  };

  const removeParticipant = (index: number) => {
    if (index === 0 || participants.length <= 1) return;
    setParticipants((prev) => prev.filter((_, i) => i !== index));
    setFieldErrors({});
  };

  const updateSharedEmergencyContact = (field: "name" | "phone", value: string) => {
    setSharedEmergencyContact((prev) => ({ ...prev, [field]: value }));
    setEmergencyContactErrors((prev) => {
      const key = field === "name" ? "emergencyContactName" : "emergencyContactPhone";
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const getParticipantTitle = (index: number) => {
    if (registrationMode === "self") return "Your details";
    if (registrationMode === "someone-else") return "Participant details";
    return `Participant ${index + 1}`;
  };

  const handleGoToPayment = useCallback(async () => {
    const nextRegistrationModeError = registrationMode
      ? ""
      : "Please choose who you are registering before continuing.";
    const nextWaveError = registrationMode && !selectedWave ? "Please select a ticket tier." : "";
    const { errors: nextFieldErrors, emergencyContactErrors: nextEmergencyContactErrors } = registrationMode
      ? validateParticipants(
          participants,
          isGroupRegistration ? { groupRegistration: true, sharedEmergencyContact } : undefined
        )
      : { errors: {}, emergencyContactErrors: {} };

    setRegistrationModeError(nextRegistrationModeError);
    setWaveError(nextWaveError);
    setFieldErrors(nextFieldErrors);
    setEmergencyContactErrors(nextEmergencyContactErrors);

    if (
      nextRegistrationModeError ||
      nextWaveError ||
      Object.keys(nextFieldErrors).length > 0 ||
      Object.keys(nextEmergencyContactErrors).length > 0
    ) {
      setError(nextRegistrationModeError || "Please fix the highlighted fields below.");
      requestAnimationFrame(() => {
        document.querySelector("[data-invalid]")?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return;
    }

    setError("");
    if (requiresEmailVerification) {
      setCheckoutStep("verify-email");
      return;
    }

    setProcessing(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          waveLabel: selectedWave,
          participants,
          ...(isGroupRegistration && {
            groupRegistration: true,
            emergencyContact: sharedEmergencyContact,
          }),
        }),
      });
      const data = await res.json() as { clientSecret?: string; error?: string };
      if (!res.ok || !data.clientSecret) {
        setError(data.error ?? "Failed to create payment.");
        setProcessing(false);
        return;
      }
      setClientSecret(data.clientSecret);
      setCheckoutStep("payment");
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setProcessing(false);
  }, [
    eventId,
    selectedWave,
    participants,
    registrationMode,
    isGroupRegistration,
    sharedEmergencyContact,
    requiresEmailVerification,
  ]);

  const proceedToCheckout = useCallback(async () => {
    setError("");
    setProcessing(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          waveLabel: selectedWave,
          participants,
          ...(isGroupRegistration && {
            groupRegistration: true,
            emergencyContact: sharedEmergencyContact,
          }),
        }),
      });
      const data = await res.json() as { clientSecret?: string; error?: string };
      if (!res.ok || !data.clientSecret) {
        setError(data.error ?? "Failed to create payment.");
        setProcessing(false);
        return;
      }
      setClientSecret(data.clientSecret);
      setCheckoutStep("payment");
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setProcessing(false);
  }, [eventId, selectedWave, participants, isGroupRegistration, sharedEmergencyContact]);

  if (loading || status === "loading") {
    return (
      <div className="min-h-screen bg-dark-darker flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-dark-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-dark-darker flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-headline text-2xl font-black italic text-light mb-2">Event not found</h1>
          <Link href="/events" className="font-headline text-xs uppercase tracking-widest text-primary hover:text-primary/80">Back to events</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-darker">
      <div className="max-w-[600px] mx-auto px-4 py-8">
        <Link href={`/events/${eventId}`} className="inline-flex items-center gap-2 font-headline text-xs font-medium uppercase tracking-widest text-muted hover:text-primary transition-colors mb-6">
          <ArrowLeft className="w-3 h-3" /> Back to event
        </Link>

        <div className="mb-6">
          <h1 className="font-headline text-[28px] font-black italic tracking-tighter text-light leading-none mb-2">
            Register
          </h1>
          <p className="text-[13px] text-muted">{event.title}</p>
        </div>

        {error && (
          <div className="mb-4 bg-red-900/30 border border-red-500/30 rounded-lg px-4 py-3 text-[13px] text-red-300">
            {error}
          </div>
        )}

        {checkoutStep === "auth" && (
          <div className="bg-dark rounded-xl p-6 space-y-4">
            <h2 className="font-headline text-xs font-medium uppercase tracking-widest text-primary mb-1">
              How would you like to register?
            </h2>
            <p className="text-[13px] text-muted leading-relaxed">
              Sign in to prefill your details, or continue as a guest and enter your information manually.
            </p>
            <button
              type="button"
              onClick={() => setIsSignInOpen(true)}
              className="w-full py-4 rounded-md font-headline text-[13px] font-bold uppercase tracking-widest bg-primary text-dark hover:bg-primary/90 transition-colors inline-flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" /> Sign in
            </button>
            <button
              type="button"
              onClick={() => setGuestMode(true)}
              className="w-full py-4 rounded-md font-headline text-[13px] font-bold uppercase tracking-widest border border-dark-border text-light hover:border-primary hover:text-primary transition-colors inline-flex items-center justify-center gap-2"
            >
              <UserRound className="w-4 h-4" /> Continue as guest
            </button>
          </div>
        )}

        {checkoutStep === "details" && (
          <div className="space-y-6">
            <div
              className={cn(
                "bg-dark rounded-xl p-5",
                registrationModeError && "ring-1 ring-red-500/50"
              )}
              data-invalid={registrationModeError ? "registration-mode" : undefined}
            >
              <h2 className="font-headline text-xs font-medium uppercase tracking-widest text-primary mb-1">
                Who are you registering?
              </h2>
              <p className="text-[13px] text-muted leading-relaxed mb-4">
                Select one option before entering ticket and participant details.
              </p>
              <div className="space-y-2">
                {REGISTRATION_MODE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleRegistrationModeChange(option.value)}
                    className={cn(
                      "w-full px-4 py-3 rounded-lg border transition-colors text-left",
                      registrationMode === option.value
                        ? "border-primary bg-primary/10"
                        : registrationModeError
                          ? "border-red-500/40 hover:border-red-500/60"
                          : "border-dark-border hover:border-dark-border/60"
                    )}
                  >
                    <p className="font-headline text-sm font-bold text-light">{option.label}</p>
                    <p className="text-[12px] text-muted leading-relaxed mt-1">{option.description}</p>
                  </button>
                ))}
              </div>
              {registrationModeError && (
                <p className="mt-3 font-headline text-[11px] font-medium text-red-400">{registrationModeError}</p>
              )}
            </div>

            {registrationMode && (
              <>
                <div
                  className={cn(
                    "bg-dark rounded-xl p-5",
                    waveError && "ring-1 ring-red-500/50"
                  )}
                  data-invalid={waveError ? "wave" : undefined}
                >
                  <h2 className="font-headline text-xs font-medium uppercase tracking-widest text-primary mb-4">Ticket selection</h2>
                  <div className="space-y-2">
                    {event.waves?.map((wave) => (
                      <button
                        key={wave.label}
                        type="button"
                        onClick={() => {
                          setSelectedWave(wave.label);
                          setWaveError("");
                          if (error === "Please fix the highlighted fields below.") setError("");
                        }}
                        className={cn(
                          "w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-colors text-left",
                          selectedWave === wave.label
                            ? "border-primary bg-primary/10"
                            : waveError
                              ? "border-red-500/40 hover:border-red-500/60"
                              : "border-dark-border hover:border-dark-border/60"
                        )}
                      >
                        <div>
                          <p className="font-headline text-sm font-bold text-light">{wave.label}</p>
                          {wave.date && <p className="text-[11px] text-muted uppercase tracking-widest mt-0.5">Until {wave.date}</p>}
                        </div>
                        <span className="font-headline text-lg font-black italic text-primary">${parseFloat(wave.price || "0").toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                  {waveError && (
                    <p className="mt-3 font-headline text-[11px] font-medium text-red-400">{waveError}</p>
                  )}
                </div>

                {participants.map((participant, index) => (
                  <ParticipantFormSection
                    key={index}
                    index={index}
                    title={getParticipantTitle(index)}
                    eventTitle={event.title}
                    participant={participant}
                    errors={fieldErrors[index]}
                    hideEmergencyContact={isGroupRegistration}
                    showRemove={isGroupRegistration && index > 0}
                    onRemove={() => removeParticipant(index)}
                    onChange={(field, value) => updateParticipant(index, field, value)}
                  />
                ))}

                {isGroupRegistration && (
                  <SharedEmergencyContactSection
                    name={sharedEmergencyContact.name}
                    phone={sharedEmergencyContact.phone}
                    errors={emergencyContactErrors}
                    onChange={updateSharedEmergencyContact}
                  />
                )}

                {isGroupRegistration && participants.length < MAX_REGISTRATION_PARTICIPANTS && (
                  <button
                    type="button"
                    onClick={addParticipant}
                    className="w-full py-3 rounded-md font-headline text-[12px] font-bold uppercase tracking-widest border border-dashed border-dark-border text-muted hover:border-primary hover:text-primary transition-colors inline-flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Add another participant
                  </button>
                )}

                {selectedWave && (
                  <div className="bg-dark rounded-xl p-5">
                    <h2 className="font-headline text-xs font-medium uppercase tracking-widest text-primary mb-3">Order summary</h2>
                    <div className="space-y-2 text-[13px]">
                      <div className="flex justify-between text-muted">
                        <span>
                          {participantCount > 1
                            ? `${participantCount} × Ticket (${selectedWave})`
                            : `Ticket (${selectedWave})`}
                        </span>
                        <span>${(ticketPrice * participantCount).toFixed(2)}</span>
                      </div>
                      {event.feeStructure === "athlete" && (
                        <div className="flex justify-between text-muted">
                          <span>
                            {participantCount > 1
                              ? `Service fee (${participantCount} × 3.95% + $1.45)`
                              : "Service fee (3.95% + $1.45)"}
                          </span>
                          <span>${platformFee.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="border-t border-dark-border pt-2 flex justify-between text-light font-bold">
                        <span>Total</span>
                        <span className="font-headline text-lg font-black italic text-primary">${totalPrice.toFixed(2)}</span>
                      </div>
                      {event.feeStructure === "organiser" && (
                        <div className="text-[11px] text-muted mt-1">Service fee (3.95% + $1.45) is covered by the organiser.</div>
                      )}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleGoToPayment}
                  disabled={processing}
                  className="w-full py-4 rounded-md font-headline text-[13px] font-bold uppercase tracking-widest bg-primary text-dark hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
                >
                  {processing ? (
                    <><span className="w-4 h-4 border-2 border-dark/40 border-t-dark rounded-full animate-spin" /> Processing…</>
                  ) : (
                    <>Continue{requiresEmailVerification ? "" : " to payment"} <Lock className="w-3 h-3" /></>
                  )}
                </button>
              </>
            )}
          </div>
        )}

        {checkoutStep === "verify-email" && (
          <GuestEmailVerificationStep
            eventId={eventId}
            eventTitle={event.title}
            emails={emailsToVerify}
            onBack={() => {
              setError("");
              setCheckoutStep("details");
            }}
            onComplete={proceedToCheckout}
          />
        )}

        {checkoutStep === "payment" && clientSecret && (
          <StripePaymentSection
            clientSecret={clientSecret}
            eventId={eventId}
            totalPrice={totalPrice}
            onError={setError}
          />
        )}
      </div>

      <SignInModal
        isOpen={isSignInOpen}
        onClose={() => setIsSignInOpen(false)}
        onSuccess={() => {
          setGuestMode(false);
          setCheckoutStep("details");
        }}
      />
    </div>
  );
}
