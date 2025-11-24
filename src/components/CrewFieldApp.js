import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ClipboardCheck, AlertTriangle, Upload, Camera, Loader2 } from 'lucide-react';
import { db, storage } from '../firebase/firebaseConfig';

const STATUS_OPTIONS = [
  { label: 'Ready for departure', value: 'ready' },
  { label: 'Out on charter', value: 'on-charter' },
  { label: 'Needs cleaning', value: 'needs-cleaning' },
  { label: 'Maintenance', value: 'maintenance' }
];

const PRIORITY_BADGES = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-emerald-100 text-emerald-700'
};

const CrewFieldApp = () => {
  const [boats, setBoats] = useState([]);
  const [statusFeed, setStatusFeed] = useState([]);
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusForm, setStatusForm] = useState({
    boatId: '',
    status: STATUS_OPTIONS[0].value,
    note: ''
  });
  const [issueForm, setIssueForm] = useState({
    boatId: '',
    priority: 'medium',
    description: '',
    photo: null
  });
  const [submitState, setSubmitState] = useState({ status: false, issue: false });
  const [feedback, setFeedback] = useState(null);

  const fetchBoats = useCallback(async () => {
    const snapshot = await getDocs(collection(db, 'boats'));
    const data = snapshot.docs.map((doc) => ({
      id: doc.id,
      name: doc.data().name || doc.data().boatName || 'Unnamed boat'
    }));
    setBoats(data);
    if (data.length && !statusForm.boatId) {
      setStatusForm((prev) => ({ ...prev, boatId: data[0].id }));
      setIssueForm((prev) => ({ ...prev, boatId: data[0].id }));
    }
  }, [statusForm.boatId]);

  const fetchStatusFeed = useCallback(async () => {
    const snapshot = await getDocs(
      query(collection(db, 'boatStatusUpdates'), orderBy('createdAt', 'desc'), limit(8))
    );
    setStatusFeed(
      snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }))
    );
  }, []);

  const fetchIssues = useCallback(async () => {
    const snapshot = await getDocs(
      query(collection(db, 'crewIssues'), orderBy('createdAt', 'desc'), limit(8))
    );
    setIssues(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  }, []);

  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      try {
        await Promise.all([fetchBoats(), fetchStatusFeed(), fetchIssues()]);
      } catch (err) {
        console.error('Failed to load crew app data:', err);
        setFeedback({ type: 'error', message: 'Unable to load latest crew activity.' });
      } finally {
        setLoading(false);
      }
    };
    initialize();
  }, [fetchBoats, fetchStatusFeed, fetchIssues]);

  const statusLookup = useMemo(() => {
    return boats.reduce((acc, boat) => {
      acc[boat.id] = boat.name;
      return acc;
    }, {});
  }, [boats]);

  const handleStatusSubmit = async (event) => {
    event.preventDefault();
    if (!statusForm.boatId) {
      setFeedback({ type: 'error', message: 'Select a boat before submitting.' });
      return;
    }
    setSubmitState((prev) => ({ ...prev, status: true }));
    try {
      await addDoc(collection(db, 'boatStatusUpdates'), {
        ...statusForm,
        boatName: statusLookup[statusForm.boatId] || 'Unknown boat',
        createdAt: serverTimestamp()
      });
      setStatusForm((prev) => ({ ...prev, note: '' }));
      setFeedback({ type: 'success', message: 'Status update logged.' });
      fetchStatusFeed();
    } catch (err) {
      console.error('Failed to submit status update:', err);
      setFeedback({ type: 'error', message: 'Could not submit status update.' });
    } finally {
      setSubmitState((prev) => ({ ...prev, status: false }));
    }
  };

  const handleIssueSubmit = async (event) => {
    event.preventDefault();
    if (!issueForm.boatId) {
      setFeedback({ type: 'error', message: 'Select a boat before submitting.' });
      return;
    }
    if (!issueForm.description.trim()) {
      setFeedback({ type: 'error', message: 'Please describe the issue.' });
      return;
    }

    setSubmitState((prev) => ({ ...prev, issue: true }));
    try {
      let photoUrl = '';
      if (issueForm.photo) {
        const storageRef = ref(
          storage,
          `crew-issues/${Date.now()}-${issueForm.photo.name.replace(/\s+/g, '-')}`
        );
        const snapshot = await uploadBytes(storageRef, issueForm.photo);
        photoUrl = await getDownloadURL(snapshot.ref);
      }

      await addDoc(collection(db, 'crewIssues'), {
        boatId: issueForm.boatId,
        boatName: statusLookup[issueForm.boatId] || 'Unknown boat',
        priority: issueForm.priority,
        description: issueForm.description.trim(),
        photoUrl,
        createdAt: serverTimestamp()
      });

      setIssueForm((prev) => ({
        ...prev,
        description: '',
        photo: null
      }));
      setFeedback({ type: 'success', message: 'Issue logged for ops follow-up.' });
      fetchIssues();
    } catch (err) {
      console.error('Failed to submit crew issue:', err);
      setFeedback({ type: 'error', message: 'Could not log issue.' });
    } finally {
      setSubmitState((prev) => ({ ...prev, issue: false }));
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('en-GB', {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="text-center">
        <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Crew Tools</p>
        <h1 className="text-3xl font-semibold text-slate-900">Field Ops App</h1>
        <p className="text-sm text-slate-500">Mobile-first controls for quick status + issue capture</p>
      </header>

      {feedback && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            feedback.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2">
            <form
              onSubmit={handleStatusSubmit}
              className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-full bg-blue-50 p-2 text-blue-600">
                  <ClipboardCheck size={18} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Quick status update</h2>
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-400">90 seconds</p>
                </div>
              </div>
              <label className="mb-3 block text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Boat
              </label>
              <select
                value={statusForm.boatId}
                onChange={(e) => setStatusForm((prev) => ({ ...prev, boatId: e.target.value }))}
                className="mb-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              >
                {boats.map((boat) => (
                  <option key={boat.id} value={boat.id}>
                    {boat.name}
                  </option>
                ))}
              </select>

              <label className="mb-3 block text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Status
              </label>
              <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
                {STATUS_OPTIONS.map((option) => (
                  <button
                    type="button"
                    key={option.value}
                    onClick={() => setStatusForm((prev) => ({ ...prev, status: option.value }))}
                    className={`rounded-lg border px-2 py-2 ${
                      statusForm.status === option.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <textarea
                value={statusForm.note}
                onChange={(e) => setStatusForm((prev) => ({ ...prev, note: e.target.value }))}
                placeholder="Optional note (fuel, guests, handover etc.)"
                className="mb-4 h-24 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              />

              <button
                type="submit"
                disabled={submitState.status}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700 disabled:opacity-50"
              >
                {submitState.status && <Loader2 className="h-4 w-4 animate-spin" />}
                Push update
              </button>
            </form>

            <form
              onSubmit={handleIssueSubmit}
              className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-full bg-amber-50 p-2 text-amber-600">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Report an issue</h2>
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Crew log</p>
                </div>
              </div>

              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Boat
              </label>
              <select
                value={issueForm.boatId}
                onChange={(e) => setIssueForm((prev) => ({ ...prev, boatId: e.target.value }))}
                className="mb-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                {boats.map((boat) => (
                  <option key={boat.id} value={boat.id}>
                    {boat.name}
                  </option>
                ))}
              </select>

              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Priority
              </label>
              <div className="mb-4 flex gap-2 text-xs">
                {['high', 'medium', 'low'].map((priority) => (
                  <button
                    type="button"
                    key={priority}
                    onClick={() => setIssueForm((prev) => ({ ...prev, priority }))}
                    className={`flex-1 rounded-lg border px-2 py-2 ${
                      issueForm.priority === priority
                        ? 'border-amber-500 bg-amber-50 text-amber-700'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    {priority.toUpperCase()}
                  </button>
                ))}
              </div>

              <textarea
                value={issueForm.description}
                onChange={(e) => setIssueForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Describe what happened, include passenger/captain notes."
                className="mb-4 h-28 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              />

              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Photo evidence
              </label>
              <div className="mb-4 flex items-center gap-3 rounded-lg border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-500">
                <Camera size={18} />
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setIssueForm((prev) => ({ ...prev, photo: e.target.files?.[0] ?? null }))}
                />
              </div>

              <button
                type="submit"
                disabled={submitState.issue}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow hover:bg-amber-600 disabled:opacity-50"
              >
                {submitState.issue ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload size={16} />}
                Log issue
              </button>
            </form>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Feed</p>
                  <h3 className="text-lg font-semibold text-slate-900">Latest status pings</h3>
                </div>
              </div>
              <div className="space-y-3">
                {statusFeed.length === 0 ? (
                  <p className="text-sm text-slate-500">No recent updates.</p>
                ) : (
                  statusFeed.map((entry) => (
                    <div key={entry.id} className="rounded-xl border border-slate-100 px-4 py-3">
                      <p className="text-sm font-semibold text-slate-900">{entry.boatName}</p>
                      <p className="text-xs text-slate-500">
                        {entry.status?.replace('-', ' ') || 'status'} · {formatTimestamp(entry.createdAt)}
                      </p>
                      {entry.note && (
                        <p className="mt-2 text-sm text-slate-700">
                          {entry.note}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Issues</p>
                  <h3 className="text-lg font-semibold text-slate-900">Crew log</h3>
                </div>
              </div>
              <div className="space-y-3">
                {issues.length === 0 ? (
                  <p className="text-sm text-slate-500">No open issues 🎉</p>
                ) : (
                  issues.map((issue) => (
                    <div key={issue.id} className="rounded-xl border border-slate-100 px-4 py-3">
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <p className="font-semibold text-slate-900">{issue.boatName}</p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            PRIORITY_BADGES[issue.priority] || PRIORITY_BADGES.low
                          }`}
                        >
                          {issue.priority}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">{formatTimestamp(issue.createdAt)}</p>
                      <p className="mt-2 text-sm text-slate-700">{issue.description}</p>
                      {issue.photoUrl && (
                        <a
                          href={issue.photoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-blue-600"
                        >
                          <Camera size={14} />
                          View photo
                        </a>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default CrewFieldApp;
