import * as turf from '@turf/turf';
import { Listing } from '@prisma/client';
import { GeoJsonGeometry, LatLng } from '../types';

/**
 * Business rule (WBS 2.4.3, Priority 1 = Location):
 * an Employer listing (a point + radius) matches a Candidate listing
 * (a desired region polygon) when the employer's hiring circle
 * geometrically intersects the candidate's region.
 */
export function listingsMatch(
  employer: Listing,
  candidate: Listing,
): boolean {
  const point = employer.point as unknown as LatLng | null;
  const region = candidate.cityPolygon as unknown as GeoJsonGeometry | null;
  if (!point || employer.radiusKm == null) return false;
  if (!region) return false;

  try {
    const circle = turf.circle([point.lng, point.lat], employer.radiusKm, {
      steps: 64,
      units: 'kilometers',
    });
    const regionFeature = turf.feature(region as any);
    return turf.booleanIntersects(circle, regionFeature);
  } catch {
    return false;
  }
}
