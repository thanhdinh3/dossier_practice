import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import type { AuthUser, Listing } from '../types';
import { MapView } from './MapView';

export function Feed({ user }: { user: AuthUser }) {
  const [items, setItems] = useState<Listing[]>([]);
  const [reason, setReason] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api
      .feed()
      .then((res) => {
        setItems(res.items);
        setReason(res.reason);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load(), [load]);

  async function act(listingId: string, direction: 'LEFT' | 'RIGHT') {
    setBusy(true);
    try {
      await api.swipe(listingId, direction);
      setItems((prev) => prev.filter((l) => l.id !== listingId));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="card">Loading feed…</div>;

  if (reason === 'NO_LISTINGS')
    return (
      <div className="card muted">
        You have no listings yet. Matching uses <strong>all your listings</strong> combined —
        create at least one to see the matching feed.
      </div>
    );

  if (items.length === 0)
    return (
      <div className="card">
        <div className="muted">No more matches right now.</div>
        <button className="secondary" style={{ marginTop: 12 }} onClick={load}>
          Reload feed
        </button>
      </div>
    );

  return (
    <>
      <div className="muted" style={{ marginBottom: 12 }}>
        {items.length} matching listing(s). Geometric match = employer's radius
        circle intersects candidate's region.
      </div>
      {items.map((l) => {
        const showEmployerCard = l.role === 'EMPLOYER';
        return (
          <div className="card" key={l.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>{l.title}</strong>
              <span className={`pill role-${l.role}`}>{l.role}</span>
            </div>
            <div className="muted" style={{ marginTop: 6 }}>
              {l.fieldOfActivity} · {l.contractType} · age {l.ageMin}–{l.ageMax}
            </div>
            {l.matchedWithListingIds && (
              <div style={{ marginTop: 8 }}>
                <span className="badge-match">
                  matched with {l.matchedWithListingIds.length} of your listing(s)
                </span>
              </div>
            )}

            {showEmployerCard && l.point ? (
              <>
                <div className="muted" style={{ marginTop: 6 }}>
                  📍 radius {l.radiusKm} km
                </div>
                <MapView point={l.point} radiusKm={l.radiusKm} />
              </>
            ) : l.cityPolygon ? (
              <>
                <div className="muted" style={{ marginTop: 6 }}>
                  🗺️ {l.cityLabel}
                </div>
                <MapView polygon={l.cityPolygon} />
              </>
            ) : null}

            <div className="feed-actions">
              <button
                className="red"
                disabled={busy}
                onClick={() => act(l.id, 'LEFT')}
              >
                ✕ Pass
              </button>
              <button
                className="green"
                disabled={busy}
                onClick={() => act(l.id, 'RIGHT')}
              >
                ♥ Interested
              </button>
            </div>
          </div>
        );
      })}
    </>
  );
}
