import React, { useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  AlertCircle,
  Bell,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Circle,
  Edit2,
  Mail,
  Link2,
  Phone,
  Plus,
  Search,
  Ship,
  Trash2,
  User,
} from 'lucide-react';
import { db } from '../firebase/firebaseConfig';
import { useAuth } from '../context/AuthContext';

const reminderTypes = [
  { value: 'meeting', label: 'Meeting or call' },
  { value: 'business', label: 'Business plan' },
  { value: 'birthday', label: 'Birthday or celebration' },
  { value: 'relationship', label: 'People & networking' },
  { value: 'client', label: 'Client follow-up' },
  { value: 'task', label: 'Internal to-do' },
];

const defaultFormState = {
  title: '',
  people: '',
  relationship: '',
  location: '',
  link: '',
  notifyEmail: true,
  notifySms: false,
  notificationEmail: '',
  notificationPhone: '',
  notifyMinutesBefore: 120,
  dueTime: '',
  type: 'client',
  dueDate: '',
  relatedClient: '',
  relatedBoat: '',
  notes: '',
};

const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value?.toDate) return value.toDate();
  return new Date(value);
};

const toInputDate = (value) => {
  const date = toDate(value);
  if (!date || Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getStatusMeta = (reminder) => {
  if (reminder.completed) {
    return { label: 'Completed', tone: 'completed' };
  }

  const due = toDate(reminder.dueDate);
  if (!due || Number.isNaN(due.getTime())) {
    return { label: 'No due date', tone: 'neutral' };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = due.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { label: 'Overdue', tone: 'overdue' };
  }
  if (diffDays === 0) {
    return { label: 'Due today', tone: 'today' };
  }
  if (diffDays <= 3) {
    return { label: `Due in ${diffDays} day${diffDays === 1 ? '' : 's'}`, tone: 'soon' };
  }
  return { label: `Due ${due.toLocaleDateString('en-GB')}`, tone: 'upcoming' };
};

const typeStyles = {
  client: 'bg-sky-50 text-sky-700 border border-sky-100',
  task: 'bg-slate-50 text-slate-700 border border-slate-200',
  meeting: 'bg-violet-50 text-violet-700 border border-violet-100',
  business: 'bg-amber-50 text-amber-700 border border-amber-100',
  birthday: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  relationship: 'bg-indigo-50 text-indigo-700 border border-indigo-100',
};

const statusStyles = {
  completed: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  overdue: 'bg-rose-50 text-rose-700 border border-rose-100',
  today: 'bg-amber-50 text-amber-700 border border-amber-100',
  soon: 'bg-blue-50 text-blue-700 border border-blue-100',
  upcoming: 'bg-slate-100 text-slate-600 border border-slate-200',
  neutral: 'bg-slate-50 text-slate-500 border border-slate-200',
};

const formatDueDateLabel = (value) => {
  const date = toDate(value);
  if (!date || Number.isNaN(date.getTime())) return 'No due date';
  const dateLabel = date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const timeLabel = date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${dateLabel} • ${timeLabel}`;
};

const RemindersBoard = () => {
  const { user } = useAuth();
  const [reminders, setReminders] = useState([]);
  const [formState, setFormState] = useState(defaultFormState);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'reminders'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const nextReminders = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setReminders(nextReminders);
        setLoading(false);
      },
      (err) => {
        console.error('Error loading reminders:', err);
        setError('Unable to load reminders right now. Please try again.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user?.email) {
      setFormState((prev) => {
        if (prev.notificationEmail) return prev;
        return { ...prev, notificationEmail: user.email };
      });
    }
  }, [user]);

  const resetForm = () => {
    setFormState(defaultFormState);
    setEditingId(null);
    setError('');
  };

  const handleFieldChange = (field, value) => {
    setFormState((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!formState.title.trim()) {
      setError('Give the reminder a short title so it is easy to scan.');
      return;
    }

    const dueDateTime = formState.dueDate
      ? new Date(`${formState.dueDate}T${formState.dueTime || '09:00'}`)
      : null;

    const notificationMinutes = Number.isFinite(Number(formState.notifyMinutesBefore))
      ? Number(formState.notifyMinutesBefore)
      : 120;

    const notificationEmail = (formState.notificationEmail || user?.email || '').trim();
    const notificationPhone = (formState.notificationPhone || '').trim();
    const notificationPrefs = {
      email: Boolean(formState.notifyEmail),
      sms: Boolean(formState.notifySms),
      notificationEmail: notificationEmail || null,
      notificationPhone: notificationPhone || null,
      minutesBefore: notificationMinutes,
    };

    const shouldNotify = Boolean(dueDateTime) && (notificationPrefs.email || notificationPrefs.sms);
    const nextNotificationAt =
      shouldNotify && dueDateTime
        ? new Date(dueDateTime.getTime() - notificationMinutes * 60 * 1000)
        : null;

    setSubmitting(true);
    try {
      const payload = {
        title: formState.title.trim(),
        type: formState.type,
        dueDate: dueDateTime ? Timestamp.fromDate(dueDateTime) : null,
        dueTime: formState.dueTime || null,
        relatedClient: formState.relatedClient.trim() || null,
        relatedBoat: formState.relatedBoat.trim() || null,
        people: formState.people.trim() || null,
        relationship: formState.relationship.trim() || null,
        location: formState.location.trim() || null,
        link: formState.link.trim() || null,
        notificationPreferences: notificationPrefs,
        notifyMinutesBefore: notificationMinutes,
        shouldNotify,
        nextNotificationAt: nextNotificationAt ? Timestamp.fromDate(nextNotificationAt) : null,
        source: 'reminders_board',
        notificationStatus: shouldNotify ? { state: 'pending' } : null,
        notes: formState.notes.trim(),
        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        await updateDoc(doc(db, 'reminders', editingId), payload);
      } else {
        await addDoc(collection(db, 'reminders'), {
          ...payload,
          completed: false,
          notificationStatus: shouldNotify ? { state: 'pending' } : null,
          createdAt: serverTimestamp(),
        });
      }

      resetForm();
    } catch (submissionError) {
      console.error('Error saving reminder:', submissionError);
      setError('We could not save this reminder. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleComplete = async (reminder) => {
    try {
      await updateDoc(doc(db, 'reminders', reminder.id), {
        completed: !reminder.completed,
        completedAt: reminder.completed ? null : serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (toggleError) {
      console.error('Error updating reminder:', toggleError);
      setError('Unable to update the reminder. Please try again.');
    }
  };

  const handleDelete = async (reminderId) => {
    if (!window.confirm('Delete this reminder? This cannot be undone.')) return;
    try {
      await deleteDoc(doc(db, 'reminders', reminderId));
      if (editingId === reminderId) {
        resetForm();
      }
    } catch (deleteError) {
      console.error('Error deleting reminder:', deleteError);
      setError('Unable to delete this reminder right now.');
    }
  };

  const handleEdit = (reminder) => {
    setEditingId(reminder.id);
    setFormState({
      title: reminder.title || '',
      type: reminder.type || 'client',
      dueDate: toInputDate(reminder.dueDate),
      dueTime: reminder.dueTime || '',
      relatedClient: reminder.relatedClient || '',
      relatedBoat: reminder.relatedBoat || '',
      notes: reminder.notes || '',
      people: reminder.people || '',
      relationship: reminder.relationship || '',
      location: reminder.location || '',
      link: reminder.link || '',
      notifyEmail: reminder.notificationPreferences?.email ?? true,
      notifySms: reminder.notificationPreferences?.sms ?? false,
      notificationEmail:
        reminder.notificationPreferences?.notificationEmail ||
        reminder.notificationEmail ||
        user?.email ||
        '',
      notificationPhone:
        reminder.notificationPreferences?.notificationPhone ||
        reminder.notificationPhone ||
        '',
      notifyMinutesBefore:
        reminder.notificationPreferences?.minutesBefore ||
        reminder.notifyMinutesBefore ||
        120,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filteredReminders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    const byType = reminders.filter((reminder) => {
      if (filterType === 'all') return true;
      return reminder.type === filterType;
    });

    const bySearch = term
      ? byType.filter((reminder) => {
          const haystack = [
            reminder.title,
            reminder.notes,
            reminder.relatedClient,
            reminder.relatedBoat,
            reminder.people,
            reminder.relationship,
            reminder.location,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return haystack.includes(term);
        })
      : byType;

    return [...bySearch].sort((a, b) => {
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }

      const dateA = toDate(a.dueDate);
      const dateB = toDate(b.dueDate);
      const timeA = dateA ? dateA.getTime() : Number.MAX_SAFE_INTEGER;
      const timeB = dateB ? dateB.getTime() : Number.MAX_SAFE_INTEGER;

      if (timeA !== timeB) {
        return timeA - timeB;
      }

      const createdA = toDate(a.createdAt)?.getTime() || 0;
      const createdB = toDate(b.createdAt)?.getTime() || 0;
      return createdB - createdA;
    });
  }, [reminders, filterType, searchTerm]);

  const summary = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let open = 0;
    let overdue = 0;
    let dueToday = 0;

    reminders.forEach((reminder) => {
      if (reminder.completed) return;
      open += 1;
      const due = toDate(reminder.dueDate);
      if (!due) return;

      due.setHours(0, 0, 0, 0);

      if (due < today) {
        overdue += 1;
      } else if (due.getTime() === today.getTime()) {
        dueToday += 1;
      }
    });

    return { open, overdue, dueToday };
  }, [reminders]);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Reminders</h1>
          <p className="mt-1 text-sm text-slate-600">
            Keep follow-ups, team tasks, and upcoming meetings organised in one place.
          </p>
        </div>
        <div className="grid w-full gap-3 sm:grid-cols-3 lg:w-auto">
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-left">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Open</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{summary.open}</p>
          </div>
          <div className="rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-left">
            <p className="text-xs font-medium uppercase tracking-wide text-rose-600">Overdue</p>
            <p className="mt-1 text-2xl font-semibold text-rose-600">{summary.overdue}</p>
          </div>
          <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-left">
            <p className="text-xs font-medium uppercase tracking-wide text-amber-600">Due today</p>
            <p className="mt-1 text-2xl font-semibold text-amber-600">{summary.dueToday}</p>
          </div>
        </div>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium text-slate-900">
              {editingId ? 'Update reminder' : 'Add reminder'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Link clients or boats when you need quick context during follow-ups.
            </p>
          </div>
          <CheckSquare className="hidden h-6 w-6 text-slate-300 sm:block" />
        </div>
        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}
        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-700">Title</label>
              <input
                type="text"
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                placeholder="Call client about pending payment"
                value={formState.title}
                onChange={(event) => handleFieldChange('title', event.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Category</label>
              <select
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                value={formState.type}
                onChange={(event) => handleFieldChange('type', event.target.value)}
              >
                {reminderTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-700">Due date</label>
                <input
                  type="date"
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  value={formState.dueDate}
                  onChange={(event) => handleFieldChange('dueDate', event.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Time</label>
                <input
                  type="time"
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  value={formState.dueTime}
                  onChange={(event) => handleFieldChange('dueTime', event.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Location / link</label>
              <input
                type="text"
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                placeholder="Dock 3B • Zoom link • Office"
                value={formState.location}
                onChange={(event) => handleFieldChange('location', event.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">People involved</label>
              <input
                type="text"
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                placeholder="Names, teams, family members"
                value={formState.people}
                onChange={(event) => handleFieldChange('people', event.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Relationship / context</label>
              <input
                type="text"
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                placeholder="Partner lead, investor, crew, family"
                value={formState.relationship}
                onChange={(event) => handleFieldChange('relationship', event.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Client (optional)</label>
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 focus-within:border-sky-500 focus-within:ring-1 focus-within:ring-sky-500">
                <User className="h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  className="w-full border-none bg-transparent text-sm focus:outline-none"
                  placeholder="Client name or ID"
                  value={formState.relatedClient}
                  onChange={(event) => handleFieldChange('relatedClient', event.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Boat (optional)</label>
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 focus-within:border-sky-500 focus-within:ring-1 focus-within:ring-sky-500">
                <Ship className="h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  className="w-full border-none bg-transparent text-sm focus:outline-none"
                  placeholder="Boat name"
                  value={formState.relatedBoat}
                  onChange={(event) => handleFieldChange('relatedBoat', event.target.value)}
                />
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-700">Reference link (docs, deck, CRM)</label>
              <input
                type="text"
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                placeholder="Paste a doc, deck, or CRM link"
                value={formState.link}
                onChange={(event) => handleFieldChange('link', event.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Notes</label>
            <textarea
              rows={3}
              className="mt-2 w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              placeholder="Key details, commitments, or context to remember"
              value={formState.notes}
              onChange={(event) => handleFieldChange('notes', event.target.value)}
            />
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
              <Bell className="h-4 w-4 text-slate-500" />
              Reminder notifications
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Send yourself an email or text before the reminder is due. Emails use your Nautiq sender; SMS is used only if Twilio is configured.
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    checked={formState.notifyEmail}
                    onChange={(event) => handleFieldChange('notifyEmail', event.target.checked)}
                  />
                  Email me
                </label>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    checked={formState.notifySms}
                    onChange={(event) => handleFieldChange('notifySms', event.target.checked)}
                  />
                  Text message
                </label>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Send</span>
                <input
                  type="number"
                  min="5"
                  max="10080"
                  className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  value={formState.notifyMinutesBefore}
                  onChange={(event) => handleFieldChange('notifyMinutesBefore', event.target.value)}
                />
                <span className="text-sm text-slate-600">minutes before</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                <Mail className="h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  className="w-full border-none bg-transparent text-sm focus:outline-none"
                  placeholder="Where should the email go?"
                  value={formState.notificationEmail}
                  onChange={(event) => handleFieldChange('notificationEmail', event.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                <Phone className="h-4 w-4 text-slate-400" />
                <input
                  type="tel"
                  className="w-full border-none bg-transparent text-sm focus:outline-none"
                  placeholder="+34 600 000 000"
                  value={formState.notificationPhone}
                  onChange={(event) => handleFieldChange('notificationPhone', event.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-1"
              disabled={submitting}
            >
              <Plus className="h-4 w-4" />
              <span>{editingId ? 'Save changes' : 'Add reminder'}</span>
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {['all', ...reminderTypes.map((type) => type.value)].map((type) => {
              const isActive = filterType === type;
              const label =
                type === 'all'
                  ? 'All reminders'
                  : reminderTypes.find((item) => item.value === type)?.label;
              return (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`rounded-full border px-3 py-1 text-sm transition ${
                    isActive
                      ? 'border-sky-600 bg-sky-50 text-sky-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-800'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className="flex w-full items-center gap-2 rounded-full border border-slate-300 px-3 py-2 text-sm focus-within:border-sky-500 focus-within:ring-1 focus-within:ring-sky-500 lg:w-64">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search reminders..."
              className="w-full border-none bg-transparent focus:outline-none"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-slate-500">
            Loading reminders...
          </div>
        ) : filteredReminders.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 px-6 py-12 text-center text-sm text-slate-500">
            No reminders found. Adjust your filters or add a new one above.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredReminders.map((reminder) => {
              const statusMeta = getStatusMeta(reminder);
              const statusClass = statusStyles[statusMeta.tone] || statusStyles.neutral;
              const typeClass = typeStyles[reminder.type] || typeStyles.task;
              return (
                <article key={reminder.id} className="flex flex-col gap-4 py-4 md:flex-row md:items-start md:justify-between">
                  <div className="flex flex-1 items-start gap-3">
                    <button
                      onClick={() => handleToggleComplete(reminder)}
                      className="mt-1 flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 text-slate-400 transition hover:border-sky-500 hover:text-sky-500"
                      aria-label={reminder.completed ? 'Mark as open' : 'Mark as complete'}
                    >
                      {reminder.completed ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Circle className="h-5 w-5" />}
                    </button>
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className={`text-base font-medium ${reminder.completed ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                          {reminder.title}
                        </h3>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${typeClass}`}>
                          {reminderTypes.find((type) => type.value === reminder.type)?.label || reminder.type}
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${statusClass}`}>
                          <Calendar className="h-3.5 w-3.5" />
                          {statusMeta.label}
                        </span>
                      </div>
                      {reminder.notes && (
                        <p className="text-sm text-slate-600">{reminder.notes}</p>
                      )}
                      {(reminder.people || reminder.relationship || reminder.location || reminder.link) && (
                        <div className="flex flex-wrap gap-3 text-xs text-slate-600">
                          {reminder.people && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1">
                              <User className="h-3 w-3" />
                              {reminder.people}
                            </span>
                          )}
                          {reminder.relationship && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1">
                              <Circle className="h-3 w-3" />
                              {reminder.relationship}
                            </span>
                          )}
                          {reminder.location && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1">
                              <Calendar className="h-3 w-3" />
                              {reminder.location}
                            </span>
                          )}
                          {reminder.link && (
                            <a
                              href={reminder.link}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-sky-700 underline decoration-sky-400 decoration-2 underline-offset-4"
                            >
                              <Link2 className="h-3 w-3" />
                              Open link
                            </a>
                          )}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                        {reminder.relatedClient && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1">
                            <User className="h-3 w-3" />
                            {reminder.relatedClient}
                          </span>
                        )}
                        {reminder.relatedBoat && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1">
                            <Ship className="h-3 w-3" />
                            {reminder.relatedBoat}
                          </span>
                        )}
                        {reminder.dueDate && (
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDueDateLabel(reminder.dueDate)}
                          </span>
                        )}
                        {reminder.notificationPreferences?.email && reminder.notificationPreferences?.notificationEmail && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1">
                            <Mail className="h-3 w-3" />
                            {reminder.notificationPreferences.notificationEmail}
                          </span>
                        )}
                        {reminder.notificationPreferences?.sms && reminder.notificationPreferences?.notificationPhone && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1">
                            <Phone className="h-3 w-3" />
                            {reminder.notificationPreferences.notificationPhone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 self-end md:self-start">
                    <button
                      onClick={() => handleEdit(reminder)}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(reminder.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:border-rose-300 hover:bg-rose-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default RemindersBoard;
