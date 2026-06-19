import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as turf from '@turf/turf';
import { GeoJsonGeometry, LatLng } from '../types';

export interface Suggestion {
  placeId: string;
  label: string;
  lat: number;
  lon: number;
}

// Employer point suggestion (Google Places): only a placeId up front,
// coordinates are resolved via Place Details.
export interface PlaceSuggestion {
  placeId: string;
  label: string;
  needsDetails: boolean;
}

export interface CityPolygonResult {
  label: string;
  center: LatLng;
  polygon: GeoJsonGeometry;
}

@Injectable()
export class GeoService {
  private get apiKey(): string {
    return (process.env.GEOAPIFY_API_KEY || '').trim();
  }

  private get googleKey(): string {
    return (process.env.GOOGLE_MAPS_API_KEY || '').trim();
  }

  // ===== Candidate region: Geoapify Geocoding autocomplete =====
  async autocomplete(text: string): Promise<Suggestion[]> {
    if (!text || !text.trim()) return [];
    if (!this.apiKey) {
      throw new InternalServerErrorException('GEOAPIFY_API_KEY is not configured.');
    }

    const url =
      `https://api.geoapify.com/v1/geocode/autocomplete` +
      `?text=${encodeURIComponent(text)}` +
      `&type=city&format=json&limit=6&apiKey=${this.apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new InternalServerErrorException(
        `Geoapify autocomplete failed (${res.status}).`,
      );
    }
    const data: any = await res.json();
    return (data.results || []).map((r: any) => ({
      placeId: r.place_id,
      label: r.formatted,
      lat: r.lat,
      lon: r.lon,
    }));
  }

  // ===== Employer location: Google Places Autocomplete (a specific point) =====
  // WBS 2.4.5 specifies Google Maps Platform for the employer company location.
  // The key stays on the server.
  async placesAutocomplete(text: string): Promise<PlaceSuggestion[]> {
    if (!text || !text.trim()) return [];
    if (!this.googleKey) {
      throw new InternalServerErrorException(
        'GOOGLE_MAPS_API_KEY is not configured.',
      );
    }

    const url =
      `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
      `?input=${encodeURIComponent(text)}&key=${this.googleKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new InternalServerErrorException(`Google Places ${res.status}.`);
    }
    const data: any = await res.json();
    // Legacy API returns HTTP 200 with a status field for logical errors.
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      throw new InternalServerErrorException(
        `Google Places ${data.status}: ${data.error_message || ''}`,
      );
    }
    return (data.predictions || []).map((p: any) => ({
      placeId: p.place_id,
      label: p.description,
      needsDetails: true,
    }));
  }

  // Resolve a Google placeId to coordinates via Place Details.
  async placeDetails(
    placeId: string,
  ): Promise<{ lat: number; lng: number; label: string }> {
    if (!this.googleKey) {
      throw new InternalServerErrorException(
        'GOOGLE_MAPS_API_KEY is not configured.',
      );
    }
    const url =
      `https://maps.googleapis.com/maps/api/place/details/json` +
      `?place_id=${encodeURIComponent(placeId)}` +
      `&fields=geometry,formatted_address&key=${this.googleKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new InternalServerErrorException(`Google Place Details ${res.status}.`);
    }
    const data: any = await res.json();
    if (data.status !== 'OK') {
      throw new InternalServerErrorException(
        `Google Place Details ${data.status}: ${data.error_message || ''}`,
      );
    }
    const loc = data.result?.geometry?.location;
    return {
      lat: loc?.lat,
      lng: loc?.lng,
      label: data.result?.formatted_address || 'Selected place',
    };
  }

  // ===== Candidate region polygon: Geoapify Place Details API =====
  // Driven by the place_id of the autocomplete-selected place. The `details`
  // feature returns the place's boundary geometry (Polygon/MultiPolygon).
  async cityPolygon(
    placeId: string,
    label?: string,
    lat?: number,
    lon?: number,
  ): Promise<CityPolygonResult> {
    if (!this.apiKey) {
      throw new InternalServerErrorException('GEOAPIFY_API_KEY is not configured.');
    }
    if (!placeId) {
      throw new InternalServerErrorException(
        'A place_id from autocomplete is required for the region polygon.',
      );
    }

    const url =
      `https://api.geoapify.com/v2/place-details` +
      `?id=${encodeURIComponent(placeId)}` +
      `&features=details&apiKey=${this.apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new InternalServerErrorException(
        `Geoapify place-details failed (${res.status}).`,
      );
    }
    const fc: any = await res.json();
    const feature = this.pickCityFeature(fc?.features || []);
    if (!feature) {
      throw new InternalServerErrorException(
        'No boundary polygon found for the selected place.',
      );
    }
    const props = feature.properties || {};
    const center: LatLng =
      lat != null && lon != null
        ? { lat, lng: lon }
        : { lat: props.lat, lng: props.lon };
    return {
      label: label || props.formatted || props.name || 'Selected area',
      center,
      polygon: feature.geometry as GeoJsonGeometry,
    };
  }

  /**
   * Place Details may return several features; we want the boundary, i.e. the
   * smallest Polygon/MultiPolygon feature (ignores any Point feature).
   */
  private pickCityFeature(features: any[]): any | null {
    let best: any = null;
    let bestArea = Number.POSITIVE_INFINITY;
    for (const f of features) {
      const t = f?.geometry?.type;
      if (t !== 'Polygon' && t !== 'MultiPolygon') continue;
      let area: number;
      try {
        area = turf.area(f);
      } catch {
        continue;
      }
      if (area > 0 && area < bestArea) {
        bestArea = area;
        best = f;
      }
    }
    return best;
  }
}
