// UserManagement.js
import React, { useState, useEffect } from 'react';
import { db } from '../firebase/firebaseConfig';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { addApprovedUser, removeApprovedUser } from '../utils/userManagement';
import { Trash2, UserPlus, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';


const UserManagement = () => {
  const { isAdmin, loading } = useAuth();
  const [approvedUsers, setApprovedUsers] = useState([]);
  const [activeUsers, setActiveUsers] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    name: '',
    role: 'staff'
  });
  const [error, setError] = useState('');

  const admin = isAdmin();

  useEffect(() => {
    if (loading) {
      console.log('Auth loading...');
      return;
    }

    if (!admin) {
      console.log('User is not admin. Skipping Firestore listener.');
      return;
    }

    console.log('Setting up Firestore listeners.');

    // Listen for approved users
    const approvedUsersQuery = query(collection(db, 'approvedUsers'));
    const unsubscribeApproved = onSnapshot(approvedUsersQuery, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setApprovedUsers(usersData);
      console.log('Fetched Approved Users:', usersData);
    });

    // Listen for active users
    const activeUsersQuery = query(collection(db, 'users'));
    const unsubscribeActive = onSnapshot(activeUsersQuery, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setActiveUsers(usersData);
      console.log('Fetched Active Users:', usersData);
    });

    return () => {
      console.log('Unsubscribing Firestore listeners.');
      unsubscribeApproved();
      unsubscribeActive();
    };
  }, [admin, loading]);

  const handleAddUser = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!newUser.email || !newUser.email.endsWith('@gmail.com')) {
      setError('Only Gmail addresses are allowed');
      return;
    }

    if (!newUser.name || newUser.name.trim() === '') {
      setError('Name is required');
      return;
    }

    try {
      const userData = {
        email: newUser.email.trim(),
        name: newUser.name.trim(),
        role: newUser.role,
        createdAt: new Date()
      };
      
      const result = await addApprovedUser(userData);

      if (result.success) {
        setShowAddForm(false);
        setNewUser({ email: '', name: '', role: 'staff' });
        alert(result.message || 'User added successfully.');
      } else {
        setError(result.error || 'Failed to add user');
      }
    } catch (err) {
      console.error('Error adding user:', err);
      setError(err.message || 'Failed to add user');
    }
  };

  const handleRemoveApprovedUser = async (email) => {
    if (window.confirm('Are you sure you want to remove this approved user?')) {
      try {
        const result = await removeApprovedUser(email);
        if (!result.success) {
          setError(result.error || 'Failed to remove approved user');
        }
      } catch (err) {
        setError('Failed to remove approved user');
      }
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!admin) {
    return <div>Access Denied</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">User Management</h2>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <UserPlus size={20} />
          Add New User
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Active Users Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <h3 className="px-6 py-3 text-lg font-semibold">Active Users</h3>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Active</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {activeUsers.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{user.displayName}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">{user.email}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {user.role || 'user'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {user.lastLogin ? new Date(user.lastLogin.toDate()).toLocaleString() : 'N/A'}
              </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Approved Users Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <h3 className="px-6 py-3 text-lg font-semibold">Approved Users</h3>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {approvedUsers.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{user.name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">{user.email}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.createdAt ? user.createdAt.toDate().toLocaleDateString() : 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => handleRemoveApprovedUser(user.email)}
                    className="text-red-600 hover:text-red-900"
                  >
                    <Trash2 size={20} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add User Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Add New User</h3>
              <button onClick={() => setShowAddForm(false)} className="text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  placeholder="Enter user's name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Gmail Address</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  placeholder="user@gmail.com"
                  pattern=".*@gmail\.com$"
                  title="Please enter a valid Gmail address"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                >
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Add User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;

