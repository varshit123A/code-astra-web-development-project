export interface TeamMember {
  name: string;
  age: string;
  college: string;
}

export type TeamStatus =
  | 'pending'
  | 'approved'
  | 'qualified_round2'
  | 'qualified_round3'
  | 'disqualified_round1'
  | 'disqualified_round2'
  | 'winner_1'
  | 'winner_2'
  | 'winner_3'
  | 'finalist'
  | 'deleted';

export interface Team {
  id: string;
  leaderEmail: string;
  passwordHash: string;
  members: TeamMember[];
  transactionId: string;
  status: TeamStatus;
  disqualificationReason: string | null;
  round1Score: number | null;
  round2Grade: number | null;
  round3Result: '1st' | '2nd' | '3rd' | null;
  round1Submission: Round1Submission | null;
  round2Submission: Round2Submission | null;
}

export interface TestCase {
    input: string;
    output: string;
}

export interface Round1Question {
    type: 'mcq' | 'coding';
    question: string;
    // For MCQ
    options?: string[];
    correctOption?: number;
    // For Coding
    testCases?: TestCase[];
    boilerplate?: { [language: string]: string };
}

export type Round1Answer = number | { language: string; code: string; passed: boolean } | null;

export interface Round1Submission {
    startTime: number;
    endTime: number | null;
    answers: Round1Answer[];
}

export interface Round2Submission {
    startTime: number;
    endTime: number | null;
    repoLink: string | null;
}

export interface AdminState {
  registrations_open: boolean;
  round1_finalized: boolean;
  round2_finalized: boolean;
  round1_started: boolean;
  round1_results_visible: boolean;
  round2_started: boolean;
  round2_results_visible: boolean;
  round3_started: boolean;
  round3_results_visible: boolean;
  round1_questions: Round1Question[];
  round2_problem: string;
  round3_qualifiers_count: number;
}

export interface MockDB {
  teams: Team[];
  adminState: AdminState;
}