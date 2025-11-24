import React, { useState, useEffect } from 'react';
import {
  collection, addDoc, getDocs, deleteDoc, doc, query, 
} from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { Copy, Trash2, Plus, AlertCircle } from 'lucide-react';

export default function CollaboratorManagement() {
  const [collaborators, setCollaborators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', email: '' });
  const [errors, setErrors] = useState({});
  const [copied, setCopied] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [adding, setAdding] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [banner, setBanner] = useState(null);

  const COMMISSION_RATE = 10;
  const BASE_URL = 'https://nautiqibiza.com/catering';

  // Load collaborators on mount
  useEffect(() => {
    fetchCollaborators();
  }, []);

  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(() => setBanner(null), 4000);
    return () => clearTimeout(timer);
  }, [banner]);

  const fetchCollaborators = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'collaborators'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setCollaborators(data);
    } catch (err) {
      console.error('Error fetching collaborators:', err);
    } finally {
      setLoading(false);
    }
  };

  // Convert name to slug (john-smith)
  const nameToSlug = (name) => {
    return name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-');
  };

  // Generate shareable link
  const generateLink = (name) => {
    const slug = nameToSlug(name);
    return `${BASE_URL}?ref=${slug}`;
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};
    if (!form.name.trim()) newErrors.name = 'Name is required';
    if (!form.email.trim()) newErrors.email = 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) newErrors.email = 'Invalid email';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Add collaborator
  const handleAddCollaborator = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setAdding(true);
      const slug = nameToSlug(form.name);
      
      // Check if slug already exists
      const existing = collaborators.find(c => nameToSlug(c.name) === slug);
      if (existing) {
        setErrors({ name: 'A collaborator with this name already exists' });
        setAdding(false);
        return;
      }

      await addDoc(collection(db, 'collaborators'), {
        name: form.name.trim(),
        email: form.email.trim(),
        slug: slug,
        commissionRate: COMMISSION_RATE,
        link: generateLink(form.name),
        createdAt: new Date(),
      });

      setForm({ name: '', email: '' });
      setErrors({});
      await fetchCollaborators();
    } catch (err) {
      console.error('Error adding collaborator:', err);
      setErrors({ submit: 'Failed to add collaborator' });
    } finally {
      setAdding(false);
    }
  };

  // Delete collaborator
  const requestDeleteCollaborator = (collaborator) => {
    setPendingDelete(collaborator);
    setDeleting(null);
  };

  const handleDeleteCollaborator = async () => {
    if (!pendingDelete) return;

    try {
      setDeleting(pendingDelete.id);
      await deleteDoc(doc(db, 'collaborators', pendingDelete.id));
      await fetchCollaborators();
      setBanner({ type: 'success', message: `${pendingDelete.name} was removed.` });
      setPendingDelete(null);
    } catch (err) {
      console.error('Error deleting collaborator:', err);
      setBanner({ type: 'error', message: 'Failed to delete collaborator. Please try again.' });
    } finally {
      setDeleting(null);
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Collaborator Management</h1>
        <p className="text-gray-600">Manage your catering collaborators and generate shareable links</p>
      </div>
      {banner && (
        <div
          className={`mb-6 rounded-md border px-4 py-3 text-sm font-medium ${
            banner.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {banner.message}
        </div>
      )}

      {/* Add Collaborator Form */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8 border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5" /> Add New Collaborator
        </h2>

        <form onSubmit={handleAddCollaborator} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Name Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., John Smith"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition ${
                  errors.name ? 'border-red-500 bg-red-50' : 'border-gray-300'
                }`}
              />
              {errors.name && <p className="text-sm text-red-600 mt-1">{errors.name}</p>}
            </div>

            {/* Email Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="e.g., john@example.com"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition ${
                  errors.email ? 'border-red-500 bg-red-50' : 'border-gray-300'
                }`}
              />
              {errors.email && <p className="text-sm text-red-600 mt-1">{errors.email}</p>}
            </div>
          </div>

          {errors.submit && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              {errors.submit}
            </div>
          )}

          <button
            type="submit"
            disabled={adding}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 font-medium"
          >
            {adding ? 'Adding...' : 'Add Collaborator'}
          </button>
        </form>
      </div>

      {/* Collaborators List */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">
            Collaborators ({collaborators.length})
          </h2>
        </div>

        {collaborators.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-gray-500 text-lg">No collaborators yet. Add one above to get started!</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {collaborators.map((collab) => {
              const link = `${BASE_URL}?ref=${collab.slug || nameToSlug(collab.name)}`;
              const isCopied = copied === collab.id;

              return (
                <div key={collab.id} className="px-6 py-4 hover:bg-gray-50 transition">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start mb-3">
                    {/* Name & Email */}
                    <div>
                      <p className="font-semibold text-gray-900">{collab.name}</p>
                      <p className="text-sm text-gray-600">{collab.email}</p>
                    </div>

                    {/* Commission */}
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Commission</p>
                      <p className="text-lg font-bold text-green-600">{collab.commissionRate || COMMISSION_RATE}%</p>
                    </div>

                    {/* Link */}
                    <div className="md:col-span-2">
                      <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Shareable Link</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={link}
                          readOnly
                          className="flex-1 px-3 py-2 text-sm bg-gray-50 border border-gray-300 rounded text-gray-700"
                        />
                        <button
                          onClick={() => copyToClipboard(link, collab.id)}
                          className={`p-2 rounded transition ${
                            isCopied
                              ? 'bg-green-100 text-green-600'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                          title="Copy to clipboard"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                      {isCopied && <p className="text-xs text-green-600 mt-1">Copied!</p>}
                    </div>
                  </div>

                  {/* Delete Button */}
                  <div className="flex justify-end">
                    <button
                      onClick={() => requestDeleteCollaborator(collab)}
                      disabled={deleting === collab.id}
                      className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition disabled:opacity-50 flex items-center gap-1"
                    >
                      <Trash2 className="w-4 h-4" />
                      {deleting === collab.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" /> How It Works
        </h3>
        <ul className="text-sm text-blue-800 space-y-1 ml-7">
          <li>• Each collaborator gets a unique link with their name (e.g., <code className="bg-blue-100 px-2 py-1 rounded">?ref=john-smith</code>)</li>
          <li>• They share this link with their clients</li>
          <li>• When clients order, you can see which collaborator referred them</li>
          <li>• All collaborators earn <strong>{COMMISSION_RATE}%</strong> commission on each order</li>
          <li>• You can calculate commissions from your orders dashboard by filtering by collaborator</li>
        </ul>
      </div>

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900">Delete {pendingDelete.name}?</h2>
            <p className="mt-2 text-sm text-gray-600">
              This will remove the collaborator and their shareable link. You can re-create it later if needed.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setPendingDelete(null)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                disabled={deleting === pendingDelete.id}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCollaborator}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                disabled={deleting === pendingDelete.id}
              >
                {deleting === pendingDelete.id ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
