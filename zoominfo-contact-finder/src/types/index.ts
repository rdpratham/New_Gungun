export interface Contact {
  name: string;
  title: string;
  company: string;
  email: string;
  phone: string;
  mobile: string;
  companyPhone: string;
  location: string;
  linkedinUrl: string;
  zoominfoUrl: string;
}

export interface CandidateMatch {
  contact: Contact;
  confidence: number; // 0-100
  matchReasons: string[];
  zoominfoPersonId: string | null;
}

export type FindContactErrorCode =
  | "invalid_linkedin_url"
  | "not_found"
  | "multiple_matches"
  | "auth_expired"
  | "rate_limited"
  | "network_error"
  | "upstream_error";

export interface FindContactError {
  code: FindContactErrorCode;
  message: string;
  candidates?: CandidateMatch[];
}

export interface FindContactSuccess {
  success: true;
  contact: Contact;
  confidence: number;
  matchReasons: string[];
}

export interface FindContactFailure {
  success: false;
  error: FindContactError;
}

export type FindContactResult = FindContactSuccess | FindContactFailure;

export interface SearchHistoryEntry {
  id: string;
  linkedinUrl: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  searchDate: string; // ISO timestamp
  matchConfidence: number;
}
