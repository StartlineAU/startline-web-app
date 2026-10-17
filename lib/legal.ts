import { PLATFORM_FEE_FIXED_CENTS, PLATFORM_FEE_PERCENT } from "@/lib/platform-fee";

/**
 * The details the Terms of Service and Privacy Policy state about Startline
 * itself. Kept here so both documents (and anything else that quotes them)
 * name the same company and the same inbox.
 */

/** The company athletes and organisers contract with. */
export const LEGAL_ENTITY_NAME = "Startline Pty Ltd";
export const LEGAL_ENTITY_ABN = "85 775 067 904";

/** The one inbox for legal and privacy enquiries until dedicated ones exist. */
export const LEGAL_CONTACT_EMAIL = "admin@startlineau.com";

/** Governing law and the forum for disputes (Terms of Service §9.1). */
export const LEGAL_JURISDICTION = "Victoria";

export const TERMS_LAST_UPDATED = "17 October 2026";
export const PRIVACY_LAST_UPDATED = "17 October 2026";
export const COOKIES_LAST_UPDATED = "17 October 2026";

/** The booking fee as the documents state it, read from the fee the checkout charges. */
export const PLATFORM_FEE_DESCRIPTION = `${(PLATFORM_FEE_PERCENT * 100).toFixed(2).replace(/\.?0+$/, "")}% of the ticket price plus A$${(PLATFORM_FEE_FIXED_CENTS / 100).toFixed(2)}`;
