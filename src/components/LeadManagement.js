import React, { useState, useEffect, useMemo } from 'react';
import { 
  getFirestore, 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  updateDoc 
} from 'firebase/firestore';

const LeadManagement = () => {
  const [leads, setLeads] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const statuses = {
    new: { label: 'New', color: 'blue' },
    contacted: { label: 'Contacted', color: 'green' },
    closed: { label: 'Closed', color: 'gray' },
    noAnswer: { label: 'No Answer', color: 'red' }
  };

  // Fetch leads
  useEffect(() => {
    const db = getFirestore();
    const q = query(collection(db, 'inquiries'), orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const leadData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        status: doc.data().status || 'new'
      }));
      setLeads(leadData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch users from the "users" collection
  useEffect(() => {
    const db = getFirestore();
    const usersCollection = collection(db, 'users');

    const unsubscribeUsers = onSnapshot(usersCollection, (snapshot) => {
      const userData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(userData);
    });

    return () => unsubscribeUsers();
  }, []);

  const updateLeadStatus = async (leadId, newStatus) => {
    const db = getFirestore();
    try {
      await updateDoc(doc(db, 'inquiries', leadId), {
        status: newStatus,
        lastUpdated: new Date()
      });
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const updateLeadAssignment = async (leadId, userId) => {
    const db = getFirestore();
    try {
      await updateDoc(doc(db, 'inquiries', leadId), {
        assignedTo: userId || null, // Set to null if unassigned
        lastUpdated: new Date()
      });
    } catch (error) {
      console.error('Error updating assignment:', error);
    }
  };

  const formatDate = (dateObj) => {
    // Using British English date formatting.
    return new Date(dateObj).toLocaleDateString('en-GB');
  };

  // Memoise filtered leads to avoid unnecessary computations.
  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      const matchesSearch =
        lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (lead.yachtName && lead.yachtName.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStatus = filterStatus ? lead.status === filterStatus : true;
      return matchesSearch && matchesStatus;
    });
  }, [leads, searchTerm, filterStatus]);

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Website Inquiries</h2>

      {/* Search and Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-2 md:space-y-0">
        <input
          type="text"
          placeholder="Search leads..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border rounded px-3 py-2 w-full md:w-1/3"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border rounded px-3 py-2 w-full md:w-1/4"
        >
          <option value="">All Statuses</option>
          {Object.entries(statuses).map(([key, { label }]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="grid gap-4">
          {filteredLeads.length === 0 ? (
            <p>No leads found.</p>
          ) : (
            filteredLeads.map(lead => (
              <div key={lead.id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
                <div className="p-4 border-b">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{lead.yachtName}</h3>
                      <p className="text-sm text-gray-600">
                        {lead.name} • {lead.email}
                      </p>
                    </div>
                    <span className="text-sm font-medium px-2 py-1 rounded bg-blue-50 text-blue-700">
                      {formatDate(lead.timestamp?.toDate())}
                    </span>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  <div className="flex items-center text-gray-600">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                      />
                    </svg>
                    {lead.phone}
                  </div>

                  <div className="flex items-center text-gray-600">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    Requested: {formatDate(lead.date)}
                  </div>

                  {lead.message && <p className="text-gray-700 mt-2">{lead.message}</p>}
                </div>

                <div className="px-4 py-3 bg-gray-50 border-t flex flex-col md:flex-row md:items-center md:justify-between rounded-b-lg space-y-2 md:space-y-0">
                  <div className="flex items-center space-x-4">
                    <span
                      className={`px-2 py-1 rounded text-sm font-medium bg-${statuses[lead.status].color}-100 text-${statuses[lead.status].color}-700`}
                    >
                      {statuses[lead.status].label}
                    </span>
                    {/* Lead Assignment Dropdown */}
                    <select
                      value={lead.assignedTo || ''}
                      onChange={(e) => updateLeadAssignment(lead.id, e.target.value)}
                      className="text-sm border rounded px-2 py-1"
                    >
                      <option value="">Unassigned</option>
                      {users.map(user => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex space-x-2">
                    <select
                      className="text-sm border rounded px-2 py-1"
                      value={lead.status}
                      onChange={(e) => updateLeadStatus(lead.id, e.target.value)}
                    >
                      {Object.entries(statuses).map(([value, { label }]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => updateLeadStatus(lead.id, 'closed')}
                      className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-md"
                    >
                      Archive
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default LeadManagement;

