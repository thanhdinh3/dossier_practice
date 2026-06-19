import { useEffect, useState } from 'react';
import { api } from './api';
import type { AuthUser, Listing } from './types';
import { Auth } from './components/Auth';
import { CreateListing } from './components/CreateListing';
import { MyListings } from './components/MyListings';
import { Feed } from './components/Feed';

type Tab = 'create' | 'mine' | 'feed';

export function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('create');
  const [refreshKey, setRefreshKey] = useState(0);
  const [editing, setEditing] = useState<Listing | null>(null);

  useEffect(() => {
    if (!api.hasToken()) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then(setUser)
      .catch(() => api.clearToken())
      .finally(() => setLoading(false));
  }, []);

  function logout() {
    api.clearToken();
    setUser(null);
  }

  if (loading) return <div className="container">Loading…</div>;

  if (!user)
    return (
      <div className="container">
        <div className="topbar">
          <div className="brand">See<span>ky</span></div>
        </div>
        <Auth onAuthed={setUser} />
      </div>
    );

  return (
    <div className="container">
      <div className="topbar">
        <div className="brand">See<span>ky</span></div>
        <div>
          <span className={`pill role-${user.role}`}>{user.role}</span>
          <span className="muted">{user.displayName}</span>{' '}
          <button className="secondary" onClick={logout}>Log out</button>
        </div>
      </div>

      <div className="tabs">
        <button
          className={`tab ${tab === 'create' ? 'active' : ''}`}
          onClick={() => {
            setEditing(null);
            setTab('create');
          }}
        >
          {editing ? '✎ Edit listing' : '+ Create listing'}
        </button>
        <button className={`tab ${tab === 'mine' ? 'active' : ''}`} onClick={() => setTab('mine')}>
          My listings
        </button>
        <button className={`tab ${tab === 'feed' ? 'active' : ''}`} onClick={() => setTab('feed')}>
          Matching feed
        </button>
      </div>

      {tab === 'create' && (
        <CreateListing
          key={editing?.id ?? 'new'}
          user={user}
          listing={editing}
          onCreated={() => {
            setRefreshKey((k) => k + 1);
            setEditing(null);
            setTab('mine');
          }}
          onCancelEdit={() => {
            setEditing(null);
            setTab('mine');
          }}
        />
      )}
      {tab === 'mine' && (
        <MyListings
          refreshKey={refreshKey}
          onEdit={(l) => {
            setEditing(l);
            setTab('create');
          }}
        />
      )}
      {tab === 'feed' && <Feed user={user} />}
    </div>
  );
}
