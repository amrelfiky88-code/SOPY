// Referral programme settings, shared by server and web so the amount the
// Profile page promises is the amount the ledger credits.
//
// A business earns REFERRAL_REWARD_USD of account credit when a business
// that signed up with its link makes its *first* payment — not at sign-up,
// so throwaway accounts can't farm credit. Credit comes off the next
// payment automatically.
export const REFERRAL_REWARD_USD = 10;

// Letters/digits that can't be confused when read aloud or typed from a
// screenshot (no 0/O, 1/I/L).
export const REFERRAL_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const REFERRAL_CODE_LENGTH = 8;

export const isReferralCodeShape = (code) =>
  typeof code === 'string' && code.length === REFERRAL_CODE_LENGTH && [...code].every((c) => REFERRAL_CODE_ALPHABET.includes(c));
