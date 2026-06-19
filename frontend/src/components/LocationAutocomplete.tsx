import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { Suggestion } from '../types';

export function LocationAutocomplete({
  placeholder,
  onSelect,
}: {
  placeholder: string;
  onSelect: (s: Suggestion) => void;
}) {
  const [text, setText] = useState('');
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    if (text.trim().length < 2) {
      setItems([]);
      return;
    }
    timer.current = window.setTimeout(async () => {
      try {
        const res = await api.autocomplete(text);
        setItems(res);
        setOpen(true);
      } catch {
        setItems([]);
      }
    }, 250);
    return () => window.clearTimeout(timer.current);
  }, [text]);

  return (
    <div className="autocomplete">
      <input
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => items.length && setOpen(true)}
      />
      {open && items.length > 0 && (
        <div className="suggestions">
          {items.map((s) => (
            <div
              key={s.placeId}
              className="suggestion"
              onClick={() => {
                onSelect(s);
                setText(s.label);
                setOpen(false);
              }}
            >
              {s.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
