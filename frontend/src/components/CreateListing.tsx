import { useState } from 'react';
import { api } from '../api';
import {
  CONTRACT_TYPES,
  FIELDS_OF_ACTIVITY,
  type AuthUser,
  type LatLng,
  type Listing,
  type Suggestion,
} from '../types';
import { LocationAutocomplete } from './LocationAutocomplete';
import { PlacesAutocomplete } from './PlacesAutocomplete';
import { MapView } from './MapView';

export function CreateListing({
  user,
  listing,
  onCreated,
  onCancelEdit,
}: {
  user: AuthUser;
  /** When provided, the form edits this listing instead of creating a new one. */
  listing?: Listing | null;
  onCreated: () => void;
  onCancelEdit?: () => void;
}) {
  const editing = !!listing;
  const isEmployer = user.role === 'EMPLOYER';

  const [title, setTitle] = useState(listing?.title ?? '');
  const [field, setField] = useState(
    listing?.fieldOfActivity ?? FIELDS_OF_ACTIVITY[12],
  ); // Information Technology
  const [contract, setContract] = useState(
    listing?.contractType ?? CONTRACT_TYPES[0],
  );
  const [ageMin, setAgeMin] = useState(listing?.ageMin ?? 18);
  const [ageMax, setAgeMax] = useState(listing?.ageMax ?? 65);

  // Employer location
  const [point, setPoint] = useState<LatLng | null>(listing?.point ?? null);
  const [radiusKm, setRadiusKm] = useState(listing?.radiusKm ?? 50);
  const [locationLabel, setLocationLabel] = useState('');

  // Candidate region
  const [region, setRegion] = useState<Suggestion | null>(null);
  const [firstName, setFirstName] = useState(listing?.contact?.firstName ?? '');
  const [lastName, setLastName] = useState(listing?.contact?.lastName ?? '');
  const [email, setEmail] = useState(listing?.contact?.email ?? user.email);
  const [phone, setPhone] = useState(listing?.contact?.phone ?? '');
  // An existing candidate listing has already consented.
  const [consent, setConsent] = useState(editing);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  function onPickEmployer(p: LatLng, label: string) {
    setPoint(p);
    setLocationLabel(label);
  }

  const ready = isEmployer
    ? !!title && !!point
    : !!title &&
      // region only required when creating (edit keeps the stored area)
      (editing || !!region) &&
      !!firstName &&
      !!lastName &&
      !!email &&
      !!phone &&
      consent;

  async function submit() {
    setError('');
    setSuccess('');
    setBusy(true);
    try {
      const base = {
        title,
        fieldOfActivity: field,
        contractType: contract,
        ageMin,
        ageMax,
      };
      let body: Record<string, unknown>;
      if (isEmployer) {
        body = { ...base, point, radiusKm };
      } else {
        body = {
          ...base,
          contact: { firstName, lastName, email, phone },
          consent,
          // Only send region when (re)picked; otherwise keep the stored polygon.
          ...(region
            ? {
                cityLabel: region.label,
                cityLat: region.lat,
                cityLon: region.lon,
                cityPlaceId: region.placeId,
              }
            : {}),
        };
      }
      if (editing) {
        await api.updateListing(listing!.id, body);
        setSuccess('Listing updated!');
      } else {
        await api.createListing(body);
        setSuccess('Listing created!');
        setTitle('');
      }
      onCreated();
    } catch (e: any) {
      setError(e.message || 'Failed to save listing');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>
        {editing ? 'Edit' : 'New'} {isEmployer ? 'Employer' : 'Candidate'} listing
      </h3>

      <label>{isEmployer ? 'Hiring position' : 'Headline'}</label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={isEmployer ? 'Senior Backend Engineer' : 'Backend engineer looking for work'}
      />

      <div className="row">
        <div>
          <label>Field of activity</label>
          <select value={field} onChange={(e) => setField(e.target.value)}>
            {FIELDS_OF_ACTIVITY.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Contract type</label>
          <select value={contract} onChange={(e) => setContract(e.target.value)}>
            {CONTRACT_TYPES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="row">
        <div>
          <label>Age min ({ageMin})</label>
          <input
            type="range"
            min={18}
            max={65}
            value={ageMin}
            onChange={(e) => setAgeMin(Number(e.target.value))}
          />
        </div>
        <div>
          <label>Age max ({ageMax})</label>
          <input
            type="range"
            min={18}
            max={65}
            value={ageMax}
            onChange={(e) => setAgeMax(Number(e.target.value))}
          />
        </div>
      </div>

      {isEmployer ? (
        <>
          <label>Company location (a specific point — Google Places)</label>
          <PlacesAutocomplete
            placeholder="Search an address or place…"
            onSelect={onPickEmployer}
          />
          {locationLabel ? (
            <div className="muted" style={{ marginTop: 6 }}>{locationLabel}</div>
          ) : (
            editing &&
            point && (
              <div className="muted" style={{ marginTop: 6 }}>
                Current point ({point.lat.toFixed(4)}, {point.lng.toFixed(4)}) — search to change.
              </div>
            )
          )}

          <label>Search radius: {radiusKm} km</label>
          <input
            type="range"
            min={1}
            max={200}
            step={1}
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value))}
          />
          {point && <MapView point={point} radiusKm={radiusKm} />}
        </>
      ) : (
        <>
          <label>Preferred work region (a city / area)</label>
          <LocationAutocomplete
            placeholder="Search a city or region…"
            onSelect={(s) => setRegion(s)}
          />
          {region ? (
            <div className="muted" style={{ marginTop: 6 }}>
              Selected: {region.label} — the area polygon will be fetched &amp; stored on save.
            </div>
          ) : (
            editing &&
            listing?.cityLabel && (
              <div className="muted" style={{ marginTop: 6 }}>
                Current region: {listing.cityLabel} — search to change.
              </div>
            )
          )}

          <h4 style={{ marginBottom: 0 }}>Contact (visible to employers)</h4>
          <div className="row">
            <div>
              <label>First name</label>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div>
              <label>Last name</label>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div className="row">
            <div>
              <label>Email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label>Phone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+41 ..." />
            </div>
          </div>
          <div className="checkbox-row">
            <input
              id="consent"
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <label htmlFor="consent">
              I consent to disclose these details to employers.
            </label>
          </div>
        </>
      )}

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <button onClick={submit} disabled={!ready || busy}>
          {busy ? 'Saving…' : editing ? 'Save changes' : 'Create listing'}
        </button>
        {editing && onCancelEdit && (
          <button className="secondary" onClick={onCancelEdit} disabled={busy}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
