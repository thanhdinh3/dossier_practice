// Shared domain shapes for the JSON columns stored via Prisma.

export interface LatLng {
  lat: number;
  lng: number;
}

// GeoJSON Polygon | MultiPolygon geometry.
export interface GeoJsonGeometry {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: any;
}

export interface Contact {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}
