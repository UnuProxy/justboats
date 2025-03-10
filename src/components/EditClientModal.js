import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { X } from 'lucide-react';


const modalClasses = {
  overlay: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4",
  container: "bg-white rounded-lg w-full max-w-md relative max-h-[90vh] overflow-y-auto",
  header: "sticky top-0 bg-white p-4 border-b",
  content: "p-4",
  footer: "sticky bottom-0 bg-white p-4 border-t"
};

const EditClientModal = ({ client, onClose, onUpdate }) => {
  const [formData, setFormData] = useState({
    name: client.name || '',
    email: client.email || '',
    phone: client.phone || '',
    passportNumber: client.passportNumber || '',
    dob: client.dob || '',
    notes: client.notes || '',
    clientType: client.clientType || 'Direct',
    source: client.source || 'Manual Entry'
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const clientRef = doc(db, 'clients', client.id);
      
      await updateDoc(clientRef, {
        ...formData,
        lastUpdated: new Date().toISOString()
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
      <div className={modalClasses.container} onClick={e => e.stopPropagation()}>
        <div className={modalClasses.header}>
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
          >
            <X size={20} />
          </button>
          <h2 className="text-xl font-bold">Edit Client Details</h2>
        </div>

        <div className={modalClasses.content}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="mt-1 w-full p-2 border rounded"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="mt-1 w-full p-2 border rounded"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Phone</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="mt-1 w-full p-2 border rounded"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Passport Number</label>
              <input
                type="text"
                name="passportNumber"
                value={formData.passportNumber}
                onChange={handleChange}
                className="mt-1 w-full p-2 border rounded"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
              <input
                type="date"
                name="dob"
                value={formData.dob}
                onChange={handleChange}
                className="mt-1 w-full p-2 border rounded"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Notes</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                className="mt-1 w-full p-2 border rounded"
                rows="3"
                placeholder="Enter client preferences, likes, dislikes, and any special notes..."
              />
            </div>
          </form>
        </div>

        <div className={modalClasses.footer}>
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditClientModal;