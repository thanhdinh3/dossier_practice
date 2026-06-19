import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { LatLng, PlaceSuggestion } from '../types';

/**
 * Employer location picker — backed by Google Places (proxied through the
 * backend). Predictions carry only a placeId, so on select we resolve the
 * exact point via Place Details. (Falls back to Geoapify coords server-side
 * when no Google key is configured.)
 */
export function PlacesAutocomplete({
  placeholder,
  onSelect,
}: {
  placeholder: string;
  onSelect: (point: LatLng, label: string) => void;
}) {
  const [text, setText] = useState('');
  const [items, setItems] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    if (text.trim().length < 2) {
      setItems([]);
      return;
    }
    timer.current = window.setTimeout(async () => {
      try {
        const res = await api.placesAutocomplete(text);
        setItems(res);
        setOpen(true);
      } catch {
        setItems([]);
      }
    }, 250);
    return () => window.clearTimeout(timer.current);
  }, [text]);

  async function pick(s: PlaceSuggestion) {
    setOpen(false);
    setText(s.label);
    if (!s.needsDetails && s.lat != null && s.lon != null) {
      onSelect({ lat: s.lat, lng: s.lon }, s.label);
      return;
    }
    setResolving(true);
    try {
      const d = await api.placeDetails(s.placeId);
      onSelect({ lat: d.lat, lng: d.lng }, d.label);
    } finally {
      setResolving(false);
    }
  }

  return (
    <div className="autocomplete">
      <input
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => items.length && setOpen(true)}
      />
      {resolving && <div className="muted">Resolving location…</div>}
      {open && items.length > 0 && (
        <div className="suggestions">
          {items.map((s) => (
            <div key={s.placeId} className="suggestion" onClick={() => pick(s)}>
              {s.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
