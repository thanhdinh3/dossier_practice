export type Role = 'EMPLOYER' | 'CANDIDATE';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  displayName: string;
}

export interface Suggestion {
  placeId: string;
  label: string;
  lat: number;
  lon: number;
}

// Employer point suggestion (Google Places). Coords may need a details lookup.
export interface PlaceSuggestion {
  placeId: string;
  label: string;
  lat?: number;
  lon?: number;
  needsDetails: boolean;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface GeoJsonGeometry {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: any;
}

export interface Listing {
  id: string;
  role: Role;
  title: string;
  fieldOfActivity: string;
  contractType: string;
  ageMin: number;
  ageMax: number;
  point?: LatLng | null;
  radiusKm?: number | null;
  cityLabel?: string | null;
  cityCenter?: LatLng | null;
  cityPolygon?: GeoJsonGeometry | null;
  contact?: Contact | null;
  owner?: ListingOwner;
  matchedWithListingIds?: string[];
}

export interface ListingOwner {
  id: string;
  displayName: string;
  email: string;
}

export interface Contact {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export const FIELDS_OF_ACTIVITY = [
  'Agriculture & Farming',
  'Architecture & Planning',
  'Arts & Entertainment',
  'Automotive',
  'Banking & Finance',
  'Construction',
  'Consulting',
  'Education & Training',
  'Energy & Utilities',
  'Engineering',
  'Healthcare & Medical',
  'Hospitality & Tourism',
  'Information Technology',
  'Legal',
  'Logistics & Transport',
  'Manufacturing',
  'Marketing & Communications',
  'Real Estate',
  'Retail & Sales',
  'Social Services & Non-Profit',
];

export const CONTRACT_TYPES = [
  'Full-time',
  'Part-time',
  'Temporary',
  'Internship',
  'Freelance / Contract',
  'Apprenticeship',
];
