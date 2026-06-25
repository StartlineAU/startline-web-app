export interface RegistrationFormData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  email: string;
  mobile: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  waiverAccepted: boolean;
}

export type RegistrationFormField =
  | "firstName"
  | "lastName"
  | "dateOfBirth"
  | "email"
  | "mobile"
  | "emergencyContactName"
  | "emergencyContactPhone"
  | "waiverAccepted";

export type RegistrationFormErrors = Partial<Record<RegistrationFormField, string>>;

export type ParticipantFormErrors = Record<number, RegistrationFormErrors>;

export type EmergencyContactErrors = Partial<
  Pick<RegistrationFormErrors, "emergencyContactName" | "emergencyContactPhone">
>;

export interface EmergencyContact {
  name: string;
  phone: string;
}

export interface ValidateParticipantsOptions {
  groupRegistration?: boolean;
  sharedEmergencyContact?: EmergencyContact;
}

export const MAX_REGISTRATION_PARTICIPANTS = 10;
export const MIN_REGISTRATION_AGE = 18;

export interface CompactParticipant {
  fn: string;
  ln: string;
  dob: string;
  em: string;
  mob: string;
  ecn: string;
  ecp: string;
}

export function splitFullName(name: string | null | undefined): { firstName: string; lastName: string } {
  if (!name?.trim()) return { firstName: "", lastName: "" };
  const parts = name.trim().split(/\s+/);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

/** Convert Cognito E.164 (+614…) to local AU display (04…). */
export function formatPhoneForDisplay(phone: string): string {
  const raw = phone.trim().replace(/[\s\-()]/g, "");
  if (raw.startsWith("+61")) return "0" + raw.slice(3);
  if (raw.startsWith("61") && raw.length > 2) return "0" + raw.slice(2);
  return phone.trim();
}

function parseIsoDateLocal(dateOfBirth: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return null;
  const [year, month, day] = dateOfBirth.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
}

export function calcAgeFromIsoDate(dateOfBirth: string): number {
  const dob = parseIsoDateLocal(dateOfBirth);
  if (!dob) return 0;

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

/** Latest allowed DOB for a minimum age (e.g. 18 → born on or before this date). */
export function maxDateOfBirthForMinAge(minAge: number = MIN_REGISTRATION_AGE): string {
  const latest = new Date();
  latest.setFullYear(latest.getFullYear() - minAge);
  const year = latest.getFullYear();
  const month = String(latest.getMonth() + 1).padStart(2, "0");
  const day = String(latest.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isValidIsoDate(dateOfBirth: string): boolean {
  return parseIsoDateLocal(dateOfBirth) !== null;
}

export function getRegistrationFormErrors(
  data: RegistrationFormData,
  options?: { includeEmergencyContact?: boolean }
): RegistrationFormErrors {
  const errors: RegistrationFormErrors = {};
  const includeEmergencyContact = options?.includeEmergencyContact !== false;

  if (!data.firstName.trim()) errors.firstName = "First name is required.";
  if (!data.lastName.trim()) errors.lastName = "Last name is required.";

  if (!data.dateOfBirth) {
    errors.dateOfBirth = "Date of birth is required.";
  } else if (!isValidIsoDate(data.dateOfBirth)) {
    errors.dateOfBirth = "Enter a valid date of birth.";
  } else if (calcAgeFromIsoDate(data.dateOfBirth) < MIN_REGISTRATION_AGE) {
    errors.dateOfBirth = `Participants must be at least ${MIN_REGISTRATION_AGE} years old.`;
  }

  if (!data.email.trim()) {
    errors.email = "Email is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  if (!data.mobile.trim()) errors.mobile = "Mobile number is required.";

  if (includeEmergencyContact) {
    if (!data.emergencyContactName.trim()) {
      errors.emergencyContactName = "Emergency contact name is required.";
    }
    if (!data.emergencyContactPhone.trim()) {
      errors.emergencyContactPhone = "Emergency contact number is required.";
    }
  }

  if (!data.waiverAccepted) {
    errors.waiverAccepted = "You must accept the event waiver to continue.";
  }

  return errors;
}

function normalizeComparable(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizePhone(value: string): string {
  const raw = value.trim().replace(/[\s\-()+]/g, "");
  if (raw.startsWith("+61")) return "0" + raw.slice(3);
  if (raw.startsWith("61") && raw.length > 2) return "0" + raw.slice(2);
  return raw;
}

function participantFullName(participant: RegistrationFormData): string {
  return `${participant.firstName.trim()} ${participant.lastName.trim()}`.trim();
}

export function getEmergencyContactErrors(
  emergency: EmergencyContact,
  participants: RegistrationFormData[]
): EmergencyContactErrors {
  const errors: EmergencyContactErrors = {};

  if (!emergency.name.trim()) {
    errors.emergencyContactName = "Emergency contact name is required.";
  }
  if (!emergency.phone.trim()) {
    errors.emergencyContactPhone = "Emergency contact number is required.";
  }
  if (Object.keys(errors).length > 0) return errors;

  const emergencyName = normalizeComparable(emergency.name);
  const emergencyPhone = normalizePhone(emergency.phone);

  for (const participant of participants) {
    const participantName = normalizeComparable(participantFullName(participant));
    const participantEmail = normalizeComparable(participant.email);
    const participantMobile = normalizePhone(participant.mobile);

    if (emergencyName === participantName || emergencyName === participantEmail) {
      errors.emergencyContactName = "Emergency contact must be someone other than a participant.";
    }
    if (emergencyPhone && participantMobile && emergencyPhone === participantMobile) {
      errors.emergencyContactPhone = "Emergency contact number must differ from participant mobile numbers.";
    }
    if (errors.emergencyContactName || errors.emergencyContactPhone) break;
  }

  return errors;
}

export function applySharedEmergencyContact(
  participants: RegistrationFormData[],
  emergency: EmergencyContact
): RegistrationFormData[] {
  return participants.map((participant) => ({
    ...participant,
    emergencyContactName: emergency.name.trim(),
    emergencyContactPhone: emergency.phone.trim(),
  }));
}

export function createEmptyParticipant(): RegistrationFormData {
  return {
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    email: "",
    mobile: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    waiverAccepted: false,
  };
}

export function compactParticipant(data: RegistrationFormData): CompactParticipant {
  return {
    fn: data.firstName.trim(),
    ln: data.lastName.trim(),
    dob: data.dateOfBirth,
    em: data.email.trim().toLowerCase(),
    mob: data.mobile.trim(),
    ecn: data.emergencyContactName.trim(),
    ecp: data.emergencyContactPhone.trim(),
  };
}

export function expandCompactParticipant(compact: CompactParticipant): RegistrationFormData {
  return {
    firstName: compact.fn,
    lastName: compact.ln,
    dateOfBirth: compact.dob,
    email: compact.em,
    mobile: compact.mob,
    emergencyContactName: compact.ecn,
    emergencyContactPhone: compact.ecp,
    waiverAccepted: true,
  };
}

export function athleteNameFromParticipant(data: RegistrationFormData | CompactParticipant): string {
  if ("fn" in data) return `${data.fn} ${data.ln}`.trim();
  return `${data.firstName.trim()} ${data.lastName.trim()}`.trim();
}

export function validateParticipants(
  participants: RegistrationFormData[],
  options?: ValidateParticipantsOptions
): {
  errors: ParticipantFormErrors;
  emergencyContactErrors: EmergencyContactErrors;
  firstMessage: string | null;
} {
  const errors: ParticipantFormErrors = {};
  let emergencyContactErrors: EmergencyContactErrors = {};
  let firstMessage: string | null = null;
  const groupRegistration = options?.groupRegistration === true;

  participants.forEach((participant, index) => {
    const fieldErrors = getRegistrationFormErrors(participant, {
      includeEmergencyContact: !groupRegistration,
    });
    if (Object.keys(fieldErrors).length === 0) return;

    errors[index] = fieldErrors;
    if (!firstMessage) {
      firstMessage = Object.values(fieldErrors)[0] ?? null;
    }
  });

  if (groupRegistration && options?.sharedEmergencyContact) {
    emergencyContactErrors = getEmergencyContactErrors(
      options.sharedEmergencyContact,
      participants
    );
    if (!firstMessage) {
      firstMessage =
        emergencyContactErrors.emergencyContactName ??
        emergencyContactErrors.emergencyContactPhone ??
        null;
    }
  }

  return { errors, emergencyContactErrors, firstMessage };
}

export function validateRegistrationForm(data: RegistrationFormData): string | null {
  return validateParticipants([data]).firstMessage;
}
