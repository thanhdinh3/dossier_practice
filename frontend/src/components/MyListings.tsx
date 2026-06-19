import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Listing } from '../types';
import { MapView } from './MapView';

export function MyListings({
  refreshKey,
  onEdit,
}: {
  refreshKey: number;
  onEdit: (listing: Listing) => void;
}) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .myListings()
      .then(setListings)
      .finally(() => setLoading(false));
  }, [refreshKey]);

  if (loading) return <div className="card">Loading…</div>;
  if (listings.length === 0)
    return <div className="card muted">No listings yet. Create one to start matching.</div>;

  return (
    <>
      {listings.map((l) => (
        <div className="card" key={l.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>{l.title}</strong>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className={`pill role-${l.role}`}>{l.role}</span>
              <button className="secondary" onClick={() => onEdit(l)}>Edit</button>
            </div>
          </div>
          <div className="muted" style={{ marginTop: 6 }}>
            {l.fieldOfActivity} · {l.contractType} · age {l.ageMin}–{l.ageMax}
          </div>
          {l.role === 'EMPLOYER' && l.point && (
            <>
              <div className="muted" style={{ marginTop: 6 }}>
                📍 point ({l.point.lat.toFixed(4)}, {l.point.lng.toFixed(4)}) · radius {l.radiusKm} km
              </div>
              <MapView point={l.point} radiusKm={l.radiusKm} />
            </>
          )}
          {l.role === 'CANDIDATE' && l.cityPolygon && (
            <>
              <div className="muted" style={{ marginTop: 6 }}>
                🗺️ region: {l.cityLabel}
              </div>
              <MapView polygon={l.cityPolygon} />
            </>
          )}
        </div>
      ))}
    </>
  );
}
