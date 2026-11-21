export const GENDER_OPTIONS = ['Woman', 'Man', 'Non-binary'] as const;

export const COLLEGE_OPTIONS = [
  'GL Bajaj Institute of Technology & Management',
] as const;

export const BRANCH_OPTIONS = [
  'B.Tech CSE',
  'B.Tech CSE (AI)',
  'B.Tech CSE (AI & ML)',
  'B.Tech CSE (DS)',
  'B.Tech (IT)',
  'B.Tech ECE',
  'B.Tech EEE',
  'B.Tech ME',
  'MCA',
  'MBA',
] as const;

export const YEAR_OPTIONS = [
  '1st Year',
  '2nd Year',
  '3rd Year',
  '4th Year',
] as const;

export const BATCH_YEARS = ['2025', '2026', '2027', '2028', '2029'] as const;

export const LOOKING_FOR_OPTIONS = [
  'Long-term',
  'Study dates',
  'Casual chai & talks',
  'Figuring it out',
] as const;

export const CAMPUS_SPOT_SUGGESTIONS = [
  'Block 3 Labs',
  'Nescafe Canteen',
  'Audi Lawn',
  'Central Library',
  'Design Club Room',
  'Amul Parlour',
] as const;

export const INTEREST_OPTIONS = [
  'Coffee Runs',
  'Indie Rock',
  'Hackathons',
  'Compiler Labs',
  'Late-Night Chai',
  'Photography',
  'UI/UX Design',
  'Music Society',
  'Badminton',
  'Cinema & Film',
  'Cricket',
  'Open Source',
  'Sketching',
  'Stand-up Comedy',
  'Gym & Running',
  'Reading Fiction',
  'Gaming',
  'Food Walks',
] as const;

export const CAMPUS_ICEBREAKERS = [
  'Do you believe in instant connections..?',
  "What's your current favourite song..?",
  "What's your biggest green flag..?",
] as const;

export function buildIcebreakers(_sharedInterests?: string[]): string[] {
  return [...CAMPUS_ICEBREAKERS];
}
