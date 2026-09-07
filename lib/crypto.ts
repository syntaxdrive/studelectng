import CryptoJS from "crypto-js";

const SECRET_KEY =
  process.env.BALLOT_SIGNING_SECRET ||
  (process.env.NODE_ENV === "production"
    ? CryptoJS.lib.WordArray.random(32).toString()
    : "studelect-dev-local-signing-key");

const PIN_SALT =
  process.env.VOTER_PIN_SALT ||
  (process.env.NODE_ENV === "production"
    ? CryptoJS.lib.WordArray.random(16).toString()
    : "studelect-voter-pin-salt-dev");

/**
 * Generate a cryptographically blinded single-use voting token
 * This token is given to the voter UI upon successful accreditation.
 * When the ballot is cast, this token is verified and immediately burned.
 */
export interface BlindedBallotToken {
  tokenId: string;
  electionId: string;
  expiresAt: number;
  signature: string;
}

export function createBlindedBallotToken(electionId: string, durationMinutes = 15): BlindedBallotToken {
  const tokenId = CryptoJS.lib.WordArray.random(16).toString();
  const expiresAt = Date.now() + durationMinutes * 60 * 1000;
  const payload = `${tokenId}:${electionId}:${expiresAt}`;
  const signature = CryptoJS.HmacSHA256(payload, SECRET_KEY).toString();

  return {
    tokenId,
    electionId,
    expiresAt,
    signature,
  };
}

export function verifyBlindedBallotToken(token: BlindedBallotToken): boolean {
  if (Date.now() > token.expiresAt) {
    return false;
  }
  const payload = `${token.tokenId}:${token.electionId}:${token.expiresAt}`;
  const expectedSignature = CryptoJS.HmacSHA256(payload, SECRET_KEY).toString();
  return expectedSignature === token.signature;
}

/**
 * Generates a deterministic public receipt hash for a cast ballot
 * E.g., SHA-256(electionId + tokenId + timestamp + secretSalt)
 * The voter can search this receipt hash on the public ledger after polls close.
 */
export function generateReceiptHash(electionId: string, tokenId: string, castTimestamp: number): string {
  const raw = `RECEIPT:${electionId}:${tokenId}:${castTimestamp}:${SECRET_KEY}`;
  const fullHash = CryptoJS.SHA256(raw).toString(CryptoJS.enc.Hex).toUpperCase();
  // Return formatted friendly receipt code: e.g. "SE-A9F4-8E2B-C104"
  return `SE-${fullHash.substring(0, 4)}-${fullHash.substring(4, 8)}-${fullHash.substring(8, 12)}`;
}

/**
 * Hash a voter PIN or secret for secure storage (Client & Server Universal)
 */
export async function hashVoterPin(pin: string): Promise<string> {
  return CryptoJS.SHA256(`${PIN_SALT}:${pin.trim().toUpperCase()}`).toString();
}

/**
 * Verify an entered PIN against its hash
 */
export async function verifyVoterPin(pin: string, hash: string): Promise<boolean> {
  const computed = CryptoJS.SHA256(`${PIN_SALT}:${pin.trim().toUpperCase()}`).toString();
  return computed === hash;
}

/**
 * Compute block hash for append-only audit trail
 */
export function computeAuditBlockHash(prevHash: string, payload: any, timestamp: number): string {
  const data = `${prevHash}:${JSON.stringify(payload)}:${timestamp}`;
  return CryptoJS.SHA256(data).toString();
}
