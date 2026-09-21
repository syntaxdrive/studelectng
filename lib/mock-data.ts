export interface MockInstitution {
  id: string;
  name: string;
  slug: string;
  code: string;
  tagline: string;
  logoUrl?: string;
  coverImageUrl?: string;
}

export interface MockCandidate {
  id: string;
  postId: string;
  fullName: string;
  nickname?: string;
  matricNo: string;
  level: number;
  department: string;
  photoUrl: string;
  manifesto: string;
  slogan: string;
  votes: number;
}

export interface MockPost {
  id: string;
  electionId: string;
  title: string;
  description: string;
  maxSelections: number;
  allowedLevels: number[];
  allowedDepartments: string[];
  candidates: MockCandidate[];
}

export interface MockElection {
  id: string;
  orgId: string;
  orgName: string;
  orgType: "SUG" | "FACULTY" | "DEPARTMENT" | "HALL";
  title: string;
  academicSession: string;
  description: string;
  status: "LIVE" | "ACCREDITATION_OPEN" | "SCHEDULED" | "CONCLUDED";
  resultsVisibility: "LIVE" | "SEALED_UNTIL_CLOSE";
  authMode: "PIN_SLIP" | "EMAIL_OTP" | "SECRET_MATCH";
  requireDuesPayment: boolean;
  requireFullTimeOnly: boolean;
  requireGoodDisciplinaryStanding: boolean;
  startsAt: string;
  endsAt: string;
  totalRegisteredVoters: number;
  totalAccreditedVoters: number;
  totalBallotsCast: number;
  posts: MockPost[];
}

export interface MockStudent {
  matricNo: string;
  normalizedMatric: string;
  fullName: string;
  faculty: string;
  department: string;
  level: number;
  programType: "FULL_TIME" | "PART_TIME" | "DLI" | "SANDWICH";
  isRegisteredSession: boolean;
  duesPaid: boolean;
  disciplinaryStatus: "GOOD_STANDING" | "PROBATION" | "SUSPENDED" | "EXPELLED";
  hallOfResidence: string;
  portalPin: string;
  email: string;
  isAdmin?: boolean;
}

// Clean Production Stores (All data dynamically managed in PostgreSQL / Supabase)
export const MOCK_INSTITUTIONS: MockInstitution[] = [];
export const MOCK_STUDENTS: MockStudent[] = [];
export const MOCK_ELECTIONS: MockElection[] = [];
