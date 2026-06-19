import { useEffect } from 'react';
import {
  Circle,
  GeoJSON,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import type { GeoJsonGeometry, LatLng } from '../types';

// Fix default marker icons (Leaflet can't resolve them under bundlers).
const icon = L.icon({
  iconUrl:
    'data:image/svg+xml;base64,' +
    btoa(
      `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="40" viewBox="0 0 26 40">
        <path d="M13 0C5.8 0 0 5.8 0 13c0 9.7 13 27 13 27s13-17.3 13-27C26 5.8 20.2 0 13 0z" fill="#6366f1"/>
        <circle cx="13" cy="13" r="5" fill="#fff"/>
      </svg>`,
    ),
  iconSize: [26, 40],
  iconAnchor: [13, 40],
});

function FitBounds({
  point,
  radiusKm,
  polygon,
}: {
  point?: LatLng | null;
  radiusKm?: number | null;
  polygon?: GeoJsonGeometry | null;
}) {
  const map = useMap();
  useEffect(() => {
    try {
      if (polygon) {
        const layer = L.geoJSON(polygon as any);
        map.fitBounds(layer.getBounds(), { padding: [20, 20] });
      } else if (point && radiusKm) {
        const c = L.latLng(point.lat, point.lng);
        const circle = L.circle(c, { radius: radiusKm * 1000 });
        map.fitBounds(circle.getBounds(), { padding: [20, 20] });
      } else if (point) {
        map.setView([point.lat, point.lng], 12);
      }
    } catch {
      /* ignore */
    }
  }, [map, point, radiusKm, polygon]);
  return null;
}

export function MapView({
  point,
  radiusKm,
  polygon,
  // optional overlays to show a match (employer circle + candidate polygon together)
  overlayPoint,
  overlayRadiusKm,
  overlayPolygon,
}: {
  point?: LatLng | null;
  radiusKm?: number | null;
  polygon?: GeoJsonGeometry | null;
  overlayPoint?: LatLng | null;
  overlayRadiusKm?: number | null;
  overlayPolygon?: GeoJsonGeometry | null;
}) {
  const center: [number, number] = point
    ? [point.lat, point.lng]
    : polygon
    ? [47.37, 8.54]
    : [47.37, 8.54];

  return (
    <div className="map">
      <MapContainer center={center} zoom={11} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {point && <Marker position={[point.lat, point.lng]} icon={icon} />}
        {point && radiusKm != null && (
          <Circle
            center={[point.lat, point.lng]}
            radius={radiusKm * 1000}
            pathOptions={{ color: '#6366f1', fillColor: '#6366f1', fillOpacity: 0.15 }}
          />
        )}
        {polygon && (
          <GeoJSON
            data={polygon as any}
            style={{ color: '#22c55e', fillColor: '#22c55e', fillOpacity: 0.2 }}
          />
        )}

        {overlayPoint && overlayRadiusKm != null && (
          <Circle
            center={[overlayPoint.lat, overlayPoint.lng]}
            radius={overlayRadiusKm * 1000}
            pathOptions={{ color: '#6366f1', fillColor: '#6366f1', fillOpacity: 0.15 }}
          />
        )}
        {overlayPolygon && (
          <GeoJSON
            data={overlayPolygon as any}
            style={{ color: '#22c55e', fillColor: '#22c55e', fillOpacity: 0.2 }}
          />
        )}

        <FitBounds point={point} radiusKm={radiusKm} polygon={polygon} />
      </MapContainer>
    </div>
  );
}
