import React, { useState, useEffect } from 'react';
import {
  collection,
  query,
  getDocs,
  orderBy,
  doc,
  updateDoc,
  deleteDoc,
  addDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import {
  Phone,
  Mail,
  Book,
  Calendar,
  Edit2,
  X,
  Trash2,
  Plus,
  Search,
  Filter,
  Grid,
  List,
  Download,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  Eye,
  ArrowDownCircle,
  ArrowUpCircle,
  User,
  Bug
} from 'lucide-react';
import _ from 'lodash';

// ===================== CONFIG =====================
// Use the legacy client.bookings[] field for linking? (dangerous if it contains stale/wrong IDs)
const USE_CLIENT_BOOKINGS_ARRAY = true; // TEMPORARILY ENABLE THIS
// If true, we only match bookings by email/phone when that value is UNIQUE across all clients
const REQUIRE_UNIQUE_FOR_CONTACT_MATCH = true;
// Optionally include "contractClients" collection in the list
const INCLUDE_CONTRACT_CLIENTS = false;

// ===================== STRICT LINKING =====================
// Only use the most reliable linking method for now
const USE_STRICT_LINKING = false; // DISABLE STRICT MODE FOR NOW

// ===================== UTILITIES =====================
const modalClasses = {
  overlay:
    'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4',
  container: 'bg-white rounded-lg w-full max-w-md relative max-h-[90vh] overflow-y-auto',
  header: 'sticky top-0 bg-white p-4 border-b',
  content: 'p-4',
  footer: 'sticky bottom-0 bg-white p-4 border-t',
};

// Robust date formatter (Firestore Timestamp | ISO string | Date)
const formatDate = (v) => {
  if (!v) return '';
  const d = v?.toDate ? v.toDate() : new Date(v);
  return isNaN(d) ? '' : d.toLocaleDateString('en-GB');
};

// Normalisers
const strip = (s) => (s || '').toString().trim().toLowerCase();
const isPlaceholder = (s) => {
  const t = strip(s);
  return !t || t === '-' || t === '—' || t === 'n/a' || t === 'na' || t === '--' || t === 'none';
};
const cleanEmail = (s) => strip(s).replace(/^[-_.\s]+/, ''); // remove leading junk like "-" or spaces
const canonicalEmail = (s) => {
  const e = cleanEmail(s);
  const at = e.indexOf('@');
  if (at === -1) return e;
  let local = e.slice(0, at);
  let domain = e.slice(at + 1);
  if (domain === 'googlemail.com') domain = 'gmail.com';
  if (domain === 'gmail.com') {
    local = local.replace(/\./g, '').replace(/\+.*/, '');
  }
  return `${local}@${domain}`;
};
const normPhone = (s) => (s || '').toString().replace(/\D/g, ''); // E.164-ish digits only
const toIso = (v) => {
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (v?.toDate) return v.toDate().toISOString();
  const d = new Date(v);
  return isNaN(d) ? null : d.toISOString();
};
const toNumber = (v) => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[^0-9.-]/g, ''));
    return isNaN(n) ? 0 : n;
  }
  return 0;
};
const getRefId = (ref) => {
  if (!ref) return null;
  if (typeof ref === 'string') {
    const parts = ref.split('/');
    return parts[parts.length - 1] || null;
  }
  if (typeof ref === 'object' && ref.id) return ref.id;
  return null;
};

// Safer groupBy that ignores empty keys
const groupByKey = (arr, keyFn) =>
  arr.reduce((acc, x) => {
    const k = keyFn(x);
    if (!k) return acc;
    if (!acc[k]) acc[k] = [];
    acc[k].push(x);
    return acc;
  }, {});

// ===================== MODALS =====================
const DeleteConfirmModal = ({ client, onClose, onConfirm }) => (
  <div className={modalClasses.overlay} onClick={onClose}>
    <div className={modalClasses.container} onClick={(e) => e.stopPropagation()}>
      <div className={modalClasses.header}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-700">
          <X size={20} />
        </button>
        <h2 className="text-xl font-bold">Delete Client</h2>
      </div>
      <div className={modalClasses.content}>
        <p className="text-gray-600 mb-6">Are you sure you want to delete {client.name}? This action cannot be undone.</p>
      </div>
      <div className={modalClasses.footer}>
        <div className="flex justify-end space-x-3">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600">Delete</button>
        </div>
      </div>
    </div>
  </div>
);

const EditClientModal = ({ client, onClose, onUpdate }) => {
  const [formData, setFormData] = useState({
    name: client.name || '',
    email: client.email || '',
    phone: client.phone || '',
    passportNumber: client.passportNumber || '',
    dob: client.dob || '',
    notes: client.notes || '',
    clientType: client.clientType || 'Direct',
    source: client.source || 'Manual Entry',
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const clientRef = doc(db, 'clients', client.id);
      await updateDoc(clientRef, {
        ...formData,
        email: cleanEmail(formData.email),
        lastUpdated: new Date().toISOString(),
      });
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error updating client:', error);
      alert('Error updating client details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={modalClasses.overlay} onClick={onClose}>
      <div className={modalClasses.container} onClick={(e) => e.stopPropagation()}>
        <div className={modalClasses.header}>
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
          <h2 className="text-xl font-bold">Edit Client Details</h2>
        </div>
        <div className={modalClasses.content}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} className="mt-1 w-full p-2 border rounded" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} className="mt-1 w-full p-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Phone</label>
              <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="mt-1 w-full p-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Passport Number</label>
              <input type="text" name="passportNumber" value={formData.passportNumber} onChange={handleChange} className="mt-1 w-full p-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
              <input type="date" name="dob" value={formData.dob} onChange={handleChange} className="mt-1 w-full p-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Client Type</label>
              <select name="clientType" value={formData.clientType} onChange={handleChange} className="mt-1 w-full p-2 border rounded">
                <option value="Direct">Direct</option>
                <option value="Hotel">Hotel</option>
                <option value="Collaborator">Collaborator</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Notes</label>
              <textarea name="notes" value={formData.notes} onChange={handleChange} className="mt-1 w-full p-2 border rounded" rows="3" placeholder="Enter client preferences, likes, dislikes, and any special notes..." />
            </div>
          </form>
        </div>
        <div className={modalClasses.footer}>
          <div className="flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
            <button onClick={handleSubmit} disabled={loading} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50">{loading ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const AddClientModal = ({ onClose, onAdd }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    dob: '',
    notes: '',
    clientType: 'Direct',
    source: 'Manual Entry',
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const email = cleanEmail(formData.email);
      const clientsRef = collection(db, 'clients');

      if (email && !isPlaceholder(email)) {
        const q = query(clientsRef, where('email', '==', email));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const existing = snap.docs[0];
          const existingData = existing.data();
          await updateDoc(doc(db, 'clients', existing.id), {
            ...formData,
            email,
            bookings: Array.from(new Set([...(existingData.bookings || [])])),
            lastUpdated: new Date().toISOString(),
          });
          onAdd();
          onClose();
          setLoading(false);
          return;
        }
      }

      await addDoc(clientsRef, {
        ...formData,
        email,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      });

      onAdd();
      onClose();
    } catch (error) {
      console.error('Error adding/updating client:', error);
      alert('Error saving client. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={modalClasses.overlay} onClick={onClose}>
      <div className={modalClasses.container} onClick={(e) => e.stopPropagation()}>
        <div className={modalClasses.header}>
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
          <h2 className="text-xl font-bold">Add New Client</h2>
        </div>
        <div className={modalClasses.content}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} className="mt-1 w-full p-2 border rounded" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} className="mt-1 w-full p-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Phone</label>
              <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="mt-1 w-full p-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Client Type</label>
              <select name="clientType" value={formData.clientType} onChange={handleChange} className="mt-1 w-full p-2 border rounded">
                <option value="Direct">Direct</option>
                <option value="Hotel">Hotel</option>
                <option value="Collaborator">Collaborator</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
              <input type="date" name="dob" value={formData.dob} onChange={handleChange} className="mt-1 w-full p-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Notes</label>
              <textarea name="notes" value={formData.notes} onChange={handleChange} className="mt-1 w-full p-2 border rounded" rows="3" placeholder="Enter client preferences, likes, dislikes, and any special notes..." />
            </div>
          </form>
        </div>
        <div className={modalClasses.footer}>
          <div className="flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
            <button onClick={handleSubmit} disabled={loading} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50">{loading ? 'Adding...' : 'Add Client'}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ===================== MAIN COMPONENT =====================
const ClientDirectory = () => {
  // Data state
  const [clients, setClients] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [activeType, setActiveType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedClient, setExpandedClient] = useState(null);
  const [editingClient, setEditingClient] = useState(null);
  const [deletingClient, setDeletingClient] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [selectedClients, setSelectedClients] = useState([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'lastUpdated', direction: 'desc' });
  const [showStats, setShowStats] = useState(true);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({ bookingsMin: '', bookingsMax: '', spentMin: '', spentMax: '', dateFrom: '', dateTo: '' });
  const [clientsPerPage, setClientsPerPage] = useState(50); // now adjustable
  const [currentPage, setCurrentPage] = useState(1);
  const [debugLinks, setDebugLinks] = useState(false);

  useEffect(() => { fetchClientsAndBookings(); }, []);

  // Filtering & sorting
  useEffect(() => {
    if (!clients.length) { setFilteredClients([]); return; }
    let result = [...clients];

    if (activeType !== 'all') {
      const isDirectClient = (c) => c.clientType === 'Direct' || ['Website', 'WhatsApp', 'Referral', 'Social Media'].includes(c.source);
      if (activeType === 'direct') result = result.filter(isDirectClient);
      if (activeType === 'hotel') result = result.filter((c) => c.clientType === 'Hotel');
      if (activeType === 'collaborator') result = result.filter((c) => c.clientType === 'Collaborator');
    }

    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      result = result.filter((c) => (c.name && c.name.toLowerCase().includes(s)) || (c.email && c.email.toLowerCase().includes(s)) || (c.phone && c.phone.includes(searchTerm)));
    }

    if (showAdvancedFilters) {
      if (advancedFilters.bookingsMin) result = result.filter((c) => (c.totalBookings ?? 0) >= parseInt(advancedFilters.bookingsMin));
      if (advancedFilters.bookingsMax) result = result.filter((c) => (c.totalBookings ?? 0) <= parseInt(advancedFilters.bookingsMax));
      if (advancedFilters.spentMin) result = result.filter((c) => (c.totalSpent ?? 0) >= parseInt(advancedFilters.spentMin));
      if (advancedFilters.spentMax) result = result.filter((c) => (c.totalSpent ?? 0) <= parseInt(advancedFilters.spentMax));
      if (advancedFilters.dateFrom) result = result.filter((c) => new Date(c.lastUpdated) >= new Date(advancedFilters.dateFrom));
      if (advancedFilters.dateTo) result = result.filter((c) => new Date(c.lastUpdated) <= new Date(advancedFilters.dateTo));
    }

    result = _.orderBy(result, [sortConfig.key], [sortConfig.direction]);
    setFilteredClients(result);
    setCurrentPage(1);
  }, [clients, activeType, searchTerm, sortConfig, advancedFilters, showAdvancedFilters]);

  const totalPages = Math.ceil(filteredClients.length / clientsPerPage);
  const paginatedClients = filteredClients.slice((currentPage - 1) * clientsPerPage, currentPage * clientsPerPage);

  // ----------- Fetch & link robustly -----------
  const fetchClientsAndBookings = async () => {
    try {
      const collections = [{ name: 'clients' }];
      if (INCLUDE_CONTRACT_CLIENTS) collections.push({ name: 'contractClients' });

      // Load clients (and optionally contractClients)
      const clientSnaps = await Promise.all(
        collections.map((c) =>
          getDocs(query(collection(db, c.name), orderBy('lastUpdated', 'desc'))).catch(() => getDocs(collection(db, c.name)))
        )
      );
      const allClientDocs = clientSnaps.flatMap((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() })));

      // Enrich with canonical contact values
      const clientsCanon = allClientDocs.map((c) => ({
        ...c,
        _emailCanon: canonicalEmail(c.email),
        _phoneCanon: normPhone(c.phone),
      }));

      // Build uniqueness indexes over the *clients*
      const emailIndex = new Map();
      const phoneIndex = new Map();
      const pushIdx = (map, key, id) => {
        if (!key || isPlaceholder(key)) return;
        const arr = map.get(key) || [];
        arr.push(id);
        map.set(key, arr);
      };
      clientsCanon.forEach((c) => {
        pushIdx(emailIndex, c._emailCanon, c.id);
        pushIdx(phoneIndex, c._phoneCanon, c.id);
      });
      const uniqueEmail = new Set([...emailIndex.entries()].filter(([, ids]) => ids.length === 1).map(([k]) => k));
      const uniquePhone = new Set([...phoneIndex.entries()].filter(([, ids]) => ids.length === 1).map(([k]) => k));

      // Load all bookings once
      const bookingsSnap = await getDocs(collection(db, 'bookings'));
      const bookings = bookingsSnap.docs.map((d) => {
        const b = d.data();
        const refId = getRefId(b.clientRef);
        const idCandidate = b.clientId || b.client?.id || refId || null;
        return {
          id: d.id,
          ...b,
          _clientIdCandidate: idCandidate,
          _emailCanon: canonicalEmail(b.clientEmail || b.contact?.email || b.email),
          _phoneCanon: normPhone(b.clientPhone || b.contact?.phone || b.phone),
        };
      });

      // Debug logging
      console.log('Total bookings loaded:', bookings.length);
      console.log('Sample booking structure:', bookings[0]);
      console.log('Booking fields with client info:', bookings.slice(0, 3).map(b => ({
        id: b.id,
        clientId: b.clientId,
        clientRef: b.clientRef,
        client: b.client,
        clientEmail: b.clientEmail,
        email: b.email,
        contact: b.contact,
        _clientIdCandidate: b._clientIdCandidate,
        _emailCanon: b._emailCanon
      })));

      // Groupings for fast joins
      const bookingsByClientId = groupByKey(bookings, (b) => b._clientIdCandidate);
      const bookingsByEmail = groupByKey(bookings, (b) => b._emailCanon);
      const bookingsByPhone = groupByKey(bookings, (b) => b._phoneCanon);
      const bookingById = new Map(bookings.map((b) => [b.id, b]));

      // Build final clients with robust linking
      const clientsData = clientsCanon.map((c) => {
        let bookingsForThisClient = [];
        let viaId = [];
        let viaArray = [];
        let viaEmail = [];
        let viaPhone = [];
        
        // Always calculate these for debug info
        const canUseEmail = c._emailCanon && !isPlaceholder(c._emailCanon) && (!REQUIRE_UNIQUE_FOR_CONTACT_MATCH || uniqueEmail.has(c._emailCanon));
        const canUsePhone = c._phoneCanon && !isPlaceholder(c._phoneCanon) && (!REQUIRE_UNIQUE_FOR_CONTACT_MATCH || uniquePhone.has(c._phoneCanon));
        
        if (USE_STRICT_LINKING) {
          // Only use direct ID matching for now to avoid incorrect links
          viaId = bookingsByClientId[c.id] || [];
          bookingsForThisClient = viaId;
        } else {
          // Original complex matching logic
          viaId = bookingsByClientId[c.id] || [];
          viaArray = USE_CLIENT_BOOKINGS_ARRAY && Array.isArray(c.bookings)
            ? c.bookings.map((bid) => bookingById.get(bid)).filter(Boolean)
            : [];
          viaEmail = canUseEmail ? bookingsByEmail[c._emailCanon] || [] : [];
          viaPhone = canUsePhone ? bookingsByPhone[c._phoneCanon] || [] : [];

          bookingsForThisClient = _.uniqBy([...viaId, ...viaArray, ...viaEmail, ...viaPhone], 'id');
        }
        
        // Debug logging for specific problematic clients
        if (c.name === 'Isabella Maria' || c.name === 'Yacht share') {
          console.log(`\n=== DEBUG: ${c.name} (${c.id}) ===`);
          console.log('Client email:', c.email, '-> canonical:', c._emailCanon);
          console.log('Client phone:', c.phone, '-> canonical:', c._phoneCanon);
          console.log('Client bookings array:', c.bookings);
          console.log('Via ID matches:', viaId.length, viaId.map(b => b.id));
          console.log('Via Array matches:', viaArray.length, viaArray.map(b => b.id));
          console.log('Via Email matches:', viaEmail.length, viaEmail.map(b => b.id));
          console.log('Via Phone matches:', viaPhone.length, viaPhone.map(b => b.id));
          console.log('Final bookings:', bookingsForThisClient.length, bookingsForThisClient.map(b => b.id));
        }

        const createdAt = toIso(c.createdAt) || new Date().toISOString();
        const lastUpdated = toIso(c.lastUpdated) || createdAt;

        const totalSpent = bookingsForThisClient.reduce((sum, b) => sum + toNumber(b.pricing?.finalPrice ?? b.finalPrice ?? 0), 0);

        return {
          id: c.id,
          name: c.name || c.email || '—',
          email: cleanEmail(c.email),
          phone: c.phone || '',
          passportNumber: c.passportNumber || '',
          dob: c.dob || '',
          notes: c.notes || '',
          source: c.source || 'Manual Entry',
          clientType: c.clientType || 'Direct',
          createdAt,
          lastUpdated,
          bookings: bookingsForThisClient,
          totalBookings: bookingsForThisClient.length,
          totalSpent,
          _linkHints: {
            byId: viaId.length,
            byArray: viaArray.length,
            byEmail: viaEmail.length,
            byPhone: viaPhone.length,
            uniqueEmail: uniqueEmail.has(c._emailCanon),
            uniquePhone: uniquePhone.has(c._phoneCanon),
            strictMode: USE_STRICT_LINKING,
          },
        };
      });

      setClients(clientsData);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching data:', err);
      setLoading(false);
    }
  };

  // ---------- bulk ops & helpers ----------
  const handleDeleteClient = async (clientId) => {
    try {
      await deleteDoc(doc(db, 'clients', clientId));
      fetchClientsAndBookings();
      setDeletingClient(null);
    } catch (error) {
      console.error('Error deleting client:', error);
      alert('Error deleting client. Please try again.');
    }
  };

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    if (isSelectionMode) setSelectedClients([]);
  };
  const toggleSelectClient = (clientId) => {
    setSelectedClients((prev) => (prev.includes(clientId) ? prev.filter((id) => id !== clientId) : [...prev, clientId]));
  };
  const toggleSelectAll = () => {
    if (selectedClients.length === paginatedClients.length) setSelectedClients([]);
    else setSelectedClients(paginatedClients.map((c) => c.id));
  };

  const exportToCSV = () => {
    if (!selectedClients.length) return;
    const clientsToExport = selectedClients.length ? clients.filter((c) => selectedClients.includes(c.id)) : filteredClients;
    const headers = ['Name', 'Email', 'Phone', 'Client Type', 'Total Bookings', 'Total Spent', 'Last Updated', 'Notes'];
    const csvData = clientsToExport.map((c) => [c.name, c.email, c.phone, c.clientType, c.totalBookings, c.totalSpent, formatDate(c.lastUpdated), (c.notes || '').replace(/,/g, ';')]);
    const csvContent = [headers.join(','), ...csvData.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `clients_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const batchDeleteClients = async () => {
    if (!selectedClients.length || !window.confirm(`Delete ${selectedClients.length} clients? This cannot be undone.`)) return;
    try {
      const promises = selectedClients.map((id) => deleteDoc(doc(db, 'clients', id)));
      await Promise.all(promises);
      fetchClientsAndBookings();
      setSelectedClients([]);
      alert(`Successfully deleted ${selectedClients.length} clients.`);
    } catch (error) {
      console.error('Error deleting clients:', error);
      alert('Error deleting clients. Please try again.');
    }
  };

  const handleSort = (key) => {
    setSortConfig({ key, direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc' });
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setAdvancedFilters((prev) => ({ ...prev, [name]: value }));
  };

  const stats = React.useMemo(() => {
    if (!clients.length) return {};
    const totalClients = clients.length;
    const totalBookings = clients.reduce((sum, c) => sum + (c.totalBookings || 0), 0);
    const totalSpent = clients.reduce((sum, c) => sum + (c.totalSpent || 0), 0);
    const avgSpent = totalSpent / totalClients;
    const directClients = clients.filter((c) => c.clientType === 'Direct').length;
    const hotelClients = clients.filter((c) => c.clientType === 'Hotel').length;
    const collaboratorClients = clients.filter((c) => c.clientType === 'Collaborator').length;
    return { totalClients, totalBookings, totalSpent, avgSpent, directClients, hotelClients, collaboratorClients };
  }, [clients]);

  // ===================== RENDER =====================
  const renderMobileSearch = () => (
    <div className="fixed inset-x-0 top-0 bg-white p-4 shadow z-30">
      <div className="relative">
        <input type="text" placeholder="Search clients..." className="w-full border rounded-lg pl-10 pr-4 py-2" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
        <button onClick={() => setShowMobileSearch(false)} className="absolute right-2 top-2 text-gray-500">
          <X size={20} />
        </button>
      </div>
    </div>
  );

  const renderBookingHistory = (client) => {
    if (!client.bookings?.length) return <p className="text-gray-500 text-sm">No bookings yet</p>;
    return (
      <div className="mt-4 space-y-3">
        <h4 className="font-medium">Booking History</h4>
        {client.bookings.map((booking) => (
          <div key={booking.id} className="bg-gray-50 p-3 rounded-lg text-sm">
            <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
              <div>
                <p className="font-medium">{booking.bookingDetails?.boatName || booking.boatName}</p>
                <div className="flex items-center text-gray-600">
                  <Calendar size={14} className="mr-1" />
                  {formatDate(booking.bookingDetails?.date || booking.bookingDate)}
                </div>
              </div>
              <div className="text-left sm:text-right">
                <p>€{toNumber(booking.pricing?.finalPrice || booking.finalPrice)}</p>
                <span
                  className={`inline-block text-xs px-2 py-1 rounded-full ${
                    (booking.pricing?.paymentStatus || booking.paymentStatus) === 'Completed'
                      ? 'bg-green-100 text-green-800'
                      : (booking.pricing?.paymentStatus || booking.paymentStatus) === 'Partial'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {booking.pricing?.paymentStatus || booking.paymentStatus || 'Pending'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const LinkBadges = ({ hints }) => (
    <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-gray-600">
      {hints.strictMode && <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">STRICT</span>}
      <span className={`px-1.5 py-0.5 rounded bg-gray-100`}>id:{hints.byId}</span>
      <span className={`px-1.5 py-0.5 rounded bg-gray-100`}>arr:{hints.byArray}</span>
      <span className={`px-1.5 py-0.5 rounded ${hints.uniqueEmail ? 'bg-green-100' : 'bg-gray-100'}`}>email:{hints.byEmail}</span>
      <span className={`px-1.5 py-0.5 rounded ${hints.uniquePhone ? 'bg-green-100' : 'bg-gray-100'}`}>phone:{hints.byPhone}</span>
    </div>
  );

  const renderClientCard = (client) => (
    <div key={client.id} className={`bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow relative ${selectedClients.includes(client.id) ? 'ring-2 ring-blue-500' : ''}`}>
      {isSelectionMode && (
        <div className="absolute top-3 right-3 cursor-pointer" onClick={(e) => { e.stopPropagation(); toggleSelectClient(client.id); }}>
          {selectedClients.includes(client.id) ? <CheckSquare size={20} className="text-blue-500" /> : <Square size={20} className="text-gray-400" />}
        </div>
      )}

      <div onClick={() => setExpandedClient(expandedClient === client.id ? null : client.id)}>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
          <div className="flex-grow">
            <h3 className="font-semibold text-lg break-words pr-8">{client.name}</h3>
            <div className="text-sm text-gray-500 mt-1">
              <span className={`inline-block px-2 py-1 rounded-full text-xs my-1 ${client.clientType === 'Direct' ? 'bg-green-100 text-green-800' : client.clientType === 'Hotel' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                {client.clientType}
                {client.clientType === 'Direct' && client.source && ` - ${client.source}`}
                {client.clientType === 'Hotel' && client.hotelName && ` - ${client.hotelName}`}
                {client.clientType === 'Collaborator' && client.collaboratorName && ` - ${client.collaboratorName}`}
              </span>
            </div>
            {debugLinks && <LinkBadges hints={client._linkHints} />}
          </div>

          <div className="flex sm:flex-col items-start sm:items-end gap-4 sm:gap-2">
            <div className="flex space-x-2">
              <button onClick={(e) => { e.stopPropagation(); setEditingClient(client); }} className="p-2 text-gray-500 hover:text-blue-500 bg-gray-50 rounded-full hover:bg-gray-100" title="Edit client">
                <Edit2 size={16} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); setDeletingClient(client); }} className="p-2 text-gray-500 hover:text-red-500 bg-gray-50 rounded-full hover:bg-gray-100" title="Delete client">
                <Trash2 size={16} />
              </button>
            </div>
            <div className="text-sm text-gray-600">
              <div className="flex items-center">
                <Book size={16} className="mr-2" />
                <span className="whitespace-nowrap">Bookings: {client.totalBookings || 0}</span>
              </div>
              <div className="flex items-center mt-1">
                <span className="whitespace-nowrap">Total: €{client.totalSpent || 0}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-2 text-sm">
          <div className="flex items-center break-words">
            <Mail size={16} className="mr-2 flex-shrink-0" />
            <span className="break-all">{client.email || '--'}</span>
          </div>
          <div className="flex items-center">
            <Phone size={16} className="mr-2 flex-shrink-0" />
            <span>{client.phone || '--'}</span>
          </div>
          {client.dob && (
            <div className="flex items-center">
              <Calendar size={16} className="mr-2 flex-shrink-0" />
              <span>DOB: {formatDate(client.dob)}</span>
            </div>
          )}
          {client.notes && (
            <div className="mt-2">
              <p className="font-medium">Notes:</p>
              <p className="text-gray-600 mt-1 break-words">{client.notes}</p>
            </div>
          )}
        </div>

        {expandedClient === client.id && renderBookingHistory(client)}
      </div>
    </div>
  );

  const renderClientRow = (client) => (
    <tr key={client.id} className={`border-b hover:bg-gray-50 ${selectedClients.includes(client.id) ? 'bg-blue-50' : ''}`}>
      {isSelectionMode && (
        <td className="p-3 text-center">
          <div className="cursor-pointer inline-block" onClick={() => toggleSelectClient(client.id)}>
            {selectedClients.includes(client.id) ? <CheckSquare size={18} className="text-blue-500" /> : <Square size={18} className="text-gray-400" />}
          </div>
        </td>
      )}
      <td className="p-3">
        <div className="font-medium">{client.name}</div>
        <div className="text-sm text-gray-500">{client.email}</div>
        {debugLinks && <LinkBadges hints={client._linkHints} />}
      </td>
      <td className="p-3">{client.phone || '--'}</td>
      <td className="p-3">
        <span className={`inline-block px-2 py-1 rounded-full text-xs ${client.clientType === 'Direct' ? 'bg-green-100 text-green-800' : client.clientType === 'Hotel' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>{client.clientType}</span>
      </td>
      <td className="p-3 text-center">{client.totalBookings}</td>
      <td className="p-3 text-right">€{client.totalSpent}</td>
      <td className="p-3 text-right">{formatDate(client.lastUpdated)}</td>
      <td className="p-3 whitespace-nowrap">
        <div className="flex space-x-2 justify-end">
          <button onClick={() => setExpandedClient(expandedClient === client.id ? null : client.id)} className="p-1.5 text-gray-500 hover:text-blue-500 bg-gray-50 rounded-full hover:bg-gray-100" title="View details">
            <Eye size={16} />
          </button>
          <button onClick={() => setEditingClient(client)} className="p-1.5 text-gray-500 hover:text-blue-500 bg-gray-50 rounded-full hover:bg-gray-100" title="Edit client">
            <Edit2 size={16} />
          </button>
          <button onClick={() => setDeletingClient(client)} className="p-1.5 text-gray-500 hover:text-red-500 bg-gray-50 rounded-full hover:bg-gray-100" title="Delete client">
            <Trash2 size={16} />
          </button>
        </div>
      </td>
    </tr>
  );

  const renderStats = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-sm font-medium text-gray-500">Total Clients</h3>
        <div className="mt-1 flex items-center justify-between">
          <div className="text-2xl font-semibold">{stats.totalClients}</div>
          <User size={24} className="text-blue-500" />
        </div>
        <div className="mt-1 text-xs text-gray-500">Direct: {stats.directClients} • Hotel: {stats.hotelClients} • Collaborator: {stats.collaboratorClients}</div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-sm font-medium text-gray-500">Total Bookings</h3>
        <div className="mt-1 flex items-center justify-between">
          <div className="text-2xl font-semibold">{stats.totalBookings}</div>
          <Book size={24} className="text-green-500" />
        </div>
        <div className="mt-1 text-xs text-gray-500">Avg {(stats.totalBookings / stats.totalClients || 0).toFixed(2)} bookings per client</div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-sm font-medium text-gray-500">Total Revenue</h3>
        <div className="mt-1 flex items-center justify-between">
          <div className="text-2xl font-semibold">€{stats.totalSpent?.toLocaleString() || 0}</div>
          <ArrowUpCircle size={24} className="text-indigo-500" />
        </div>
        <div className="mt-1 text-xs text-gray-500">Avg €{(stats.avgSpent || 0).toFixed(2)} per client</div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-sm font-medium text-gray-500">Filtered Results</h3>
        <div className="mt-1 flex items-center justify-between">
          <div className="text-2xl font-semibold">{filteredClients.length}</div>
          <Filter size={24} className="text-amber-500" />
        </div>
        <div className="mt-1 text-xs text-gray-500">{filteredClients.length === clients.length ? 'No filters applied' : 'Based on current filters'}</div>
      </div>
    </div>
  );

  const renderAdvancedFilters = () => (
    <div className={`bg-gray-50 p-4 rounded-lg mb-6 ${showAdvancedFilters ? 'block' : 'hidden'}`}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bookings Range</label>
          <div className="flex space-x-2">
            <input type="number" placeholder="Min" name="bookingsMin" value={advancedFilters.bookingsMin} onChange={handleFilterChange} className="w-full p-2 border rounded text-sm" />
            <input type="number" placeholder="Max" name="bookingsMax" value={advancedFilters.bookingsMax} onChange={handleFilterChange} className="w-full p-2 border rounded text-sm" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Spent Range (€)</label>
          <div className="flex space-x-2">
            <input type="number" placeholder="Min" name="spentMin" value={advancedFilters.spentMin} onChange={handleFilterChange} className="w-full p-2 border rounded text-sm" />
            <input type="number" placeholder="Max" name="spentMax" value={advancedFilters.spentMax} onChange={handleFilterChange} className="w-full p-2 border rounded text-sm" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Last Updated</label>
          <div className="flex space-x-2">
            <input type="date" placeholder="From" name="dateFrom" value={advancedFilters.dateFrom} onChange={handleFilterChange} className="w-full p-2 border rounded text-sm" />
            <input type="date" placeholder="To" name="dateTo" value={advancedFilters.dateTo} onChange={handleFilterChange} className="w-full p-2 border rounded text-sm" />
          </div>
        </div>
      </div>
      <div className="mt-4 flex justify-between items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Bug size={16} />
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" className="accent-blue-600" checked={debugLinks} onChange={(e) => setDebugLinks(e.target.checked)} /> Show link badges (debug)
          </label>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-700">Rows/page</label>
          <select value={clientsPerPage} onChange={(e) => { setClientsPerPage(parseInt(e.target.value, 10)); setCurrentPage(1); }} className="p-1.5 border rounded">
            {[25, 50, 100, 200, 500].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <button onClick={() => setAdvancedFilters({ bookingsMin: '', bookingsMax: '', spentMin: '', spentMax: '', dateFrom: '', dateTo: '' })} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-100">Clear Filters</button>
        </div>
      </div>
    </div>
  );

  const renderPagination = () => (
    <div className="flex justify-between items-center mt-6">
      <div className="text-sm text-gray-500">Showing {paginatedClients.length} of {filteredClients.length} clients</div>
      <div className="flex space-x-1">
        <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="px-3 py-1 border rounded-md text-sm disabled:opacity-50">Previous</button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).slice(Math.max(0, Math.min(currentPage - 3, totalPages - 5)), Math.max(5, Math.min(totalPages, Math.max(currentPage + 2, 5)))).map((page) => (
          <button key={page} onClick={() => setCurrentPage(page)} className={`px-3 py-1 border rounded-md text-sm ${currentPage === page ? 'bg-blue-500 text-white' : 'hover:bg-gray-50'}`}>{page}</button>
        ))}
        <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className="px-3 py-1 border rounded-md text-sm disabled:opacity-50">Next</button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-xl sm:text-2xl font-bold">Client Directory</h1>
          <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
            <div className="hidden sm:block flex-grow sm:flex-grow-0">
              <input type="text" placeholder="Search clients..." className="border rounded-lg px-4 py-2 w-full" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <button onClick={() => setShowMobileSearch(true)} className="sm:hidden p-2 text-gray-600 hover:text-gray-800"><Search size={24} /></button>
            <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
              <Plus size={20} />
              <span className="hidden sm:inline">Add Client</span>
            </button>
          </div>
        </div>

        {/* Stats */}
        <div>
          <button onClick={() => setShowStats(!showStats)} className="flex items-center text-sm font-medium text-gray-700 mb-2">
            {showStats ? <ChevronUp size={16} className="mr-1" /> : <ChevronDown size={16} className="mr-1" />}
            {showStats ? 'Hide Stats' : 'Show Stats'}
          </button>
          {showStats && renderStats()}
        </div>

        {/* Filter & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex flex-wrap items-center gap-3 overflow-x-auto">
            <div className="flex space-x-2 min-w-max">
              {['all', 'direct', 'hotel', 'collaborator'].map((type) => (
                <button key={type} onClick={() => setActiveType(type)} className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${activeType === type ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
            <div className="min-w-max">
              <button onClick={() => setShowAdvancedFilters(!showAdvancedFilters)} className="flex items-center px-3 py-1.5 border rounded-lg hover:bg-gray-50">
                <Filter size={16} className="mr-2" />
                {showAdvancedFilters ? 'Hide Filters' : 'Advanced Filters'}
              </button>
            </div>
            <div className="min-w-max hidden sm:flex items-center gap-2 text-sm text-gray-600">
              <Bug size={16} />
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" className="accent-blue-600" checked={debugLinks} onChange={(e) => setDebugLinks(e.target.checked)} /> Show link badges
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 min-w-max">
            <div className="flex border rounded-lg overflow-hidden">
              <button onClick={() => setViewMode('grid')} className={`p-2 ${viewMode === 'grid' ? 'bg-gray-100' : 'bg-white'}`} title="Grid view"><Grid size={18} /></button>
              <button onClick={() => setViewMode('list')} className={`p-2 ${viewMode === 'list' ? 'bg-gray-100' : 'bg-white'}`} title="List view"><List size={18} /></button>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-700">Rows/page</label>
              <select value={clientsPerPage} onChange={(e) => { setClientsPerPage(parseInt(e.target.value, 10)); setCurrentPage(1); }} className="p-1.5 border rounded">
                {[25, 50, 100, 200, 500].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <button onClick={toggleSelectionMode} className={`px-3 py-1.5 border rounded-lg ${isSelectionMode ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'}`}>{isSelectionMode ? 'Cancel Selection' : 'Select Clients'}</button>
            {isSelectionMode && (
              <>
                <button onClick={toggleSelectAll} className="px-3 py-1.5 border rounded-lg hover:bg-gray-50">{selectedClients.length === paginatedClients.length ? 'Deselect All' : 'Select All'}</button>
                <button onClick={exportToCSV} disabled={!selectedClients.length} className={`px-3 py-1.5 border rounded-lg ${selectedClients.length ? 'text-green-700 border-green-200 bg-green-50 hover:bg-green-100' : 'opacity-50 cursor-not-allowed'}`}>
                  <Download size={16} className="inline-block mr-1" /> Export
                </button>
                <button onClick={batchDeleteClients} disabled={!selectedClients.length} className={`px-3 py-1.5 border rounded-lg ${selectedClients.length ? 'text-red-700 border-red-200 bg-red-50 hover:bg-red-100' : 'opacity-50 cursor-not-allowed'}`}>
                  <Trash2 size={16} className="inline-block mr-1" /> Delete
                </button>
              </>
            )}
          </div>
        </div>

        {/* Advanced filters */}
        {renderAdvancedFilters()}

        {/* Selected counter */}
        {isSelectionMode && selectedClients.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex justify-between items-center">
            <span className="font-medium text-blue-700">{selectedClients.length} client{selectedClients.length !== 1 ? 's' : ''} selected</span>
            <button onClick={() => setSelectedClients([])} className="text-blue-700 text-sm hover:underline">Clear selection</button>
          </div>
        )}

        {/* Empty state */}
        {filteredClients.length === 0 && !loading && (
          <div className="bg-white border rounded-lg p-8 text-center">
            <div className="text-gray-400 mb-3"><User size={48} className="mx-auto" /></div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No clients found</h3>
            <p className="text-gray-500 mb-4">Try adjusting your search or filters</p>
            <button onClick={() => { setSearchTerm(''); setActiveType('all'); setAdvancedFilters({ bookingsMin: '', bookingsMax: '', spentMin: '', spentMax: '', dateFrom: '', dateTo: '' }); }} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">Clear All Filters</button>
          </div>
        )}

        {/* Grid view */}
        {viewMode === 'grid' && filteredClients.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{paginatedClients.map((client) => renderClientCard(client))}</div>
        )}

        {/* List view */}
        {viewMode === 'list' && filteredClients.length > 0 && (
          <div className="overflow-x-auto border rounded-lg bg-white">
            <table className="w-full">
              <thead className="bg-gray-50 text-gray-700 text-sm">
                <tr>
                  {isSelectionMode && <th className="p-3 text-center w-10"></th>}
                  <th className="p-3 text-left">
                    <button onClick={() => handleSort('name')} className="flex items-center font-medium hover:text-blue-600">
                      Name & Email
                      {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? <ArrowUpCircle size={14} className="ml-1" /> : <ArrowDownCircle size={14} className="ml-1" />)}
                    </button>
                  </th>
                  <th className="p-3 text-left">Phone</th>
                  <th className="p-3 text-left">Type</th>
                  <th className="p-3 text-center">
                    <button onClick={() => handleSort('totalBookings')} className="flex items-center justify-center font-medium hover:text-blue-600">
                      Bookings
                      {sortConfig.key === 'totalBookings' && (sortConfig.direction === 'asc' ? <ArrowUpCircle size={14} className="ml-1" /> : <ArrowDownCircle size={14} className="ml-1" />)}
                    </button>
                  </th>
                  <th className="p-3 text-right">
                    <button onClick={() => handleSort('totalSpent')} className="flex items-center justify-end font-medium hover:text-blue-600">
                      Total Spent
                      {sortConfig.key === 'totalSpent' && (sortConfig.direction === 'asc' ? <ArrowUpCircle size={14} className="ml-1" /> : <ArrowDownCircle size={14} className="ml-1" />)}
                    </button>
                  </th>
                  <th className="p-3 text-right">
                    <button onClick={() => handleSort('lastUpdated')} className="flex items-center justify-end font-medium hover:text-blue-600">
                      Last Updated
                      {sortConfig.key === 'lastUpdated' && (sortConfig.direction === 'asc' ? <ArrowUpCircle size={14} className="ml-1" /> : <ArrowDownCircle size={14} className="ml-1" />)}
                    </button>
                  </th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>{paginatedClients.map((client) => renderClientRow(client))}</tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {filteredClients.length > clientsPerPage && renderPagination()}
      </div>

      {/* Mobile search overlay */}
      {showMobileSearch && renderMobileSearch()}

      {/* Batch ops bar (mobile) */}
      {isSelectionMode && selectedClients.length > 0 && (
        <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white shadow-lg p-3 border-t z-20">
          <div className="flex justify-between items-center">
            <div className="text-sm font-medium">{selectedClients.length} selected</div>
            <div className="flex space-x-2">
              <button onClick={exportToCSV} className="px-3 py-1.5 bg-green-100 text-green-700 rounded">
                <Download size={16} className="inline-block" />
              </button>
              <button onClick={batchDeleteClients} className="px-3 py-1.5 bg-red-100 text-red-700 rounded">
                <Trash2 size={16} className="inline-block" />
              </button>
              <button onClick={() => setSelectedClients([])} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded">Clear</button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showAddModal && (
        <AddClientModal
          onClose={() => setShowAddModal(false)}
          onAdd={() => {
            fetchClientsAndBookings();
            setShowAddModal(false);
          }}
        />
      )}
      {editingClient && (
        <EditClientModal
          client={editingClient}
          onClose={() => setEditingClient(null)}
          onUpdate={() => {
            fetchClientsAndBookings();
            setEditingClient(null);
          }}
        />
      )}
      {deletingClient && (
        <DeleteConfirmModal
          client={deletingClient}
          onClose={() => setDeletingClient(null)}
          onConfirm={() => handleDeleteClient(deletingClient.id)}
        />
      )}
    </div>
  );
};

export default ClientDirectory;

/*
=========================================================
ONE-OFF REPAIR (run separately with firebase-admin):
- Goal: write canonical booking.clientId and clean client.bookings[]
- Pseudocode outline:

import admin from 'firebase-admin';
admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore();

const strip = s => (s||'').trim().toLowerCase();
const canonicalEmail = ... // same as above
const normPhone = s => (s||'').replace(/\D/g, '');

async function main(){
  const clientsSnap = await db.collection('clients').get();
  const clients = clientsSnap.docs.map(d => ({ id: d.id, ...d.data(), _email: canonicalEmail(d.data().email), _phone: normPhone(d.data().phone) }));
  const byEmail = new Map(); const byPhone = new Map();
  for (const c of clients){ if(c._email) byEmail.set(c._email, [...(byEmail.get(c._email)||[]), c.id]); if(c._phone) byPhone.set(c._phone, [...(byPhone.get(c._phone)||[]), c.id]); }
  const uniqueEmail = new Set([...byEmail.entries()].filter(([,ids])=>ids.length===1).map(([k])=>k));
  const uniquePhone = new Set([...byPhone.entries()].filter(([,ids])=>ids.length===1).map(([k])=>k));

  const bookingsSnap = await db.collection('bookings').get();
  const batch = db.batch();
  let updates = 0;
  for (const bDoc of bookingsSnap.docs){
    const b = bDoc.data();
    let target = b.clientId || b.client?.id || (b.clientRef && b.clientRef.id);
    const e = canonicalEmail(b.clientEmail || b.contact?.email);
    const p = normPhone(b.clientPhone || b.contact?.phone);
    if(!target && e && uniqueEmail.has(e)) target = (byEmail.get(e)||[])[0];
    if(!target && p && uniquePhone.has(p)) target = (byPhone.get(p)||[])[0];
    if(target && target !== b.clientId){ batch.update(bDoc.ref, { clientId: target }); updates++; }
  }
  await batch.commit();
  console.log('Updated bookings:', updates);
}
main();
=========================================================
*/

