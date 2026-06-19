import type {
  AuthUser,
  Listing,
  PlaceSuggestion,
  Role,
  Suggestion,
} from './types';

const BASE = '/api';

function token(): string | null {
  return localStorage.getItem('seeky_token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  const t = token();
  if (t) headers['Authorization'] = `Bearer ${t}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.message) {
        message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
      }
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  setToken(t: string) {
    localStorage.setItem('seeky_token', t);
  },
  clearToken() {
    localStorage.removeItem('seeky_token');
  },
  hasToken() {
    return !!token();
  },

  register(body: {
    email: string;
    password: string;
    role: Role;
    displayName: string;
  }) {
    return request<{ token: string; user: AuthUser }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  login(body: { email: string; password: string }) {
    return request<{ token: string; user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  me() {
    return request<AuthUser>('/auth/me');
  },

  listUsers() {
    return request<AuthUser[]>('/auth/users');
  },

  quickLogin(userId: string) {
    return request<{ token: string; user: AuthUser }>('/auth/quick-login', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  },

  autocomplete(text: string) {
    return request<Suggestion[]>(
      `/geo/autocomplete?text=${encodeURIComponent(text)}`,
    );
  },

  placesAutocomplete(text: string) {
    return request<PlaceSuggestion[]>(
      `/geo/places/autocomplete?text=${encodeURIComponent(text)}`,
    );
  },

  placeDetails(placeId: string) {
    return request<{ lat: number; lng: number; label: string }>(
      `/geo/places/details?placeId=${encodeURIComponent(placeId)}`,
    );
  },

  createListing(body: Record<string, unknown>) {
    return request<Listing>('/listings', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  updateListing(id: string, body: Record<string, unknown>) {
    return request<Listing>(`/listings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  myListings() {
    return request<Listing[]>('/listings/mine');
  },

  feed() {
    return request<{ items: Listing[]; reason?: string }>('/feed');
  },

  swipe(listingId: string, direction: 'LEFT' | 'RIGHT') {
    return request<{ ok: boolean }>('/swipe', {
      method: 'POST',
      body: JSON.stringify({ listingId, direction }),
    });
  },
};
