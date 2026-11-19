// Configurable College Eligibility & Age Verification Rules (Backend Authoritative)

export interface CampusConfig {
  campusName: string;
  campusShortName: string;
  allowedDomains: string[];
  allowAnyGoogleSignIn: boolean;
  allowRollCodeVerification: boolean;
  institutionalEmailRequired: boolean;
  minAge: number;
}

export function getCampusConfig(): CampusConfig {
  const rawDomains = process.env.ALLOWED_COLLEGE_DOMAINS || 'glbitm.ac.in';
  const allowedDomains = rawDomains
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);

  return {
    campusName: 'GL Bajaj Institute of Technology & Management',
    campusShortName: 'GL Bajaj, Greater Noida',
    allowedDomains: allowedDomains.length > 0 ? allowedDomains : ['glbitm.ac.in'],
    // Any Google account can sign in; college affiliation is verified separately (or auto-verified for @glbitm.ac.in)
    allowAnyGoogleSignIn: true,
    allowRollCodeVerification: process.env.DISABLE_CAMPUS_INVITE_FALLBACK !== 'true',
    institutionalEmailRequired: process.env.REQUIRE_INSTITUTIONAL_EMAIL === 'true',
    minAge: 18,
  };
}

export function isAllowedCollegeEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  const emailRegex = /^[a-z0-9._%+-]+@([a-z0-9.-]+\.[a-z]{2,})$/;
  const match = normalized.match(emailRegex);
  if (!match) return false;
  const domain = match[1];
  const { allowedDomains } = getCampusConfig();
  return allowedDomains.includes(domain);
}

export function isValidRollNumber(rollNumber: string): boolean {
  const cleaned = rollNumber.trim().toUpperCase();
  return /^[A-Z0-9/-]{4,24}$/.test(cleaned);
}

/**
 * Calculates exact age in full years on the server from YYYY-MM-DD date of birth.
 * Never trust client-supplied age values.
 */
export function calculateAgeFromDob(dobString: string): number | null {
  const isoDateRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
  const match = dobString.trim().match(isoDateRegex);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const dob = new Date(Date.UTC(year, month - 1, day));
  if (
    dob.getUTCFullYear() !== year ||
    dob.getUTCMonth() !== month - 1 ||
    dob.getUTCDate() !== day
  ) {
    return null;
  }

  const now = new Date();
  const todayYear = now.getUTCFullYear();
  const todayMonth = now.getUTCMonth() + 1;
  const todayDay = now.getUTCDate();

  let age = todayYear - year;
  if (todayMonth < month || (todayMonth === month && todayDay < day)) {
    age -= 1;
  }

  return age;
}

export function validateMinimumAge(dobString: string): {
  valid: boolean;
  age: number | null;
  error?: string;
} {
  const age = calculateAgeFromDob(dobString);
  const { minAge } = getCampusConfig();

  if (age === null) {
    return { valid: false, age: null, error: 'Please enter a valid date of birth.' };
  }
  if (age < minAge) {
    return {
      valid: false,
      age,
      error: `You must be at least ${minAge} years old to join NearU.`,
    };
  }
  if (age > 100) {
    return {
      valid: false,
      age,
      error: 'Please enter a realistic date of birth.',
    };
  }
  return { valid: true, age };
}
