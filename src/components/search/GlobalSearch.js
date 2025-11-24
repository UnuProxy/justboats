import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { Loader2, Search, Ship, User } from 'lucide-react';
import { db } from '../../firebase/firebaseConfig';

const recordTypes = {
  client: {
    label: 'Client',
    icon: User,
    pathBuilder: (record) =>
      `/clients?search=${encodeURIComponent(record.searchValue)}&clientId=${record.id}`,
  },
  boat: {
    label: 'Boat',
    icon: Ship,
    pathBuilder: (record) =>
      `/boats?search=${encodeURIComponent(record.searchValue)}&boatId=${record.id}`,
  },
};

const GlobalSearch = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialised, setInitialised] = useState(false);
  const [records, setRecords] = useState([]);
  const [error, setError] = useState('');

  const hydrateRecords = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [clientSnapshot, boatSnapshot] = await Promise.all([
        getDocs(collection(db, 'clients')),
        getDocs(collection(db, 'boats')),
      ]);

      const clientRecords = clientSnapshot.docs.map((docSnap) => {
        const data = docSnap.data() || {};
        const name = data.name || 'Unnamed client';
        const email = data.email || '';
        const phone = data.phone || '';
        const searchKey = email || phone || name;
        return {
          id: docSnap.id,
          type: 'client',
          name,
          secondary: email || phone,
          metadata: {
            email,
            phone,
            totalBookings: data.totalBookings ?? data.bookings?.length ?? 0,
          },
          searchValue: searchKey,
        };
      });

      const boatRecords = boatSnapshot.docs.map((docSnap) => {
        const data = docSnap.data() || {};
        const name = data.name || 'Unnamed boat';
        const searchKey = name;
        const capacity = data.capacity ? `${data.capacity} guests` : null;
        return {
          id: docSnap.id,
          type: 'boat',
          name,
          secondary: capacity || data.category || '',
          metadata: {
            homePort: data.homePort || '',
            visible: data.visible !== false,
          },
          searchValue: searchKey,
        };
      });

      setRecords([...clientRecords, ...boatRecords]);
      setInitialised(true);
    } catch (fetchError) {
      console.error('Global search load failed:', fetchError);
      setError('Unable to load search data. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    hydrateRecords();
  }, [hydrateRecords]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const term = query.trim().toLowerCase();
    return records
      .filter((record) => {
        const bank = [
          record.name,
          record.secondary,
          record.metadata?.email,
          record.metadata?.phone,
          record.metadata?.homePort,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return bank.includes(term);
      })
      .slice(0, 8);
  }, [records, query]);

  const handleSelect = (record) => {
    setQuery('');
    const config = recordTypes[record.type];
    if (!config) return;
    navigate(config.pathBuilder(record));
  };

  return (
    <div className="relative w-full max-w-xl">
      <div className="flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-2 shadow-sm focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-100">
        <Search className="h-4 w-4 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search clients or boats"
          className="w-full border-none bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
          aria-label="Search clients or boats"
        />
        {loading && (
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
        )}
      </div>

      {error && !loading && (
        <div className="absolute z-40 mt-2 w-full rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600 shadow-lg">
          {error}
        </div>
      )}

      {query && !loading && !error && (
        <div className="absolute z-40 mt-2 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          {results.length === 0 ? (
            <div className="px-4 py-5 text-sm text-slate-500">
              {initialised
                ? 'No matches found.'
                : 'Syncing your data… please try again in a moment.'}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {results.map((record) => {
                const config = recordTypes[record.type];
                const Icon = config?.icon ?? Search;
                return (
                  <li key={`${record.type}-${record.id}`}>
                    <button
                      onClick={() => handleSelect(record)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
                    >
                      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="truncate text-sm font-semibold text-slate-800">
                            {record.name}
                          </p>
                          <span className="ml-3 inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                            {config?.label}
                          </span>
                        </div>
                        {record.secondary && (
                          <p className="truncate text-xs text-slate-500">{record.secondary}</p>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default GlobalSearch;
