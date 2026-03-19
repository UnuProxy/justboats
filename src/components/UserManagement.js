// UserManagement.js
import React, { useState, useEffect } from 'react';
import { auth, db, functions } from '../firebase/firebaseConfig';
import { collection, query, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { addApprovedUser, removeApprovedUser } from '../utils/userManagement';
import { Trash2, UserPlus, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const formatLastLogin = (timestamp) => {
  if (!timestamp) return 'Never';
  
  try {
    const date = timestamp.toDate();
    const now = new Date();
    const diff = now - date;
    
    // Less than 24 hours
    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diff / (60 * 60 * 1000));
      if (hours < 1) {
        const minutes = Math.floor(diff / (60 * 1000));
        return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
      }
      return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    }
    
    // Less than 7 days
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      return date.toLocaleString('en-US', {
        weekday: 'short',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
      });
    }
    
    // Default full date
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    });
  } catch (error) {
    console.error('Error formatting timestamp:', error);
    return 'Invalid date';
  }
};

// Enhanced function to remove user from both collections
const removeUserCompletely = async (email, userId = null) => {
  try {
    // First remove from approvedUsers collection
    await removeApprovedUser(email);
    
    // If we have a userId, also remove from users collection
    if (userId) {
      await deleteDoc(doc(db, 'users', userId));
      console.log(`User ${email} removed from users collection`);
    }
    
    return { 
      success: true, 
      message: 'User removed from system completely' 
    };
  } catch (err) {
    console.error('Error completely removing user:', err);
    return { 
      success: false, 
      error: err.message || 'Failed to remove user completely' 
    };
  }
};

const roleBadgeClass = (role) => {
  switch (role) {
    case 'admin':
      return 'bg-purple-100 text-purple-800';
    case 'employee':
      return 'bg-blue-100 text-blue-800';
    case 'driver':
      return 'bg-amber-100 text-amber-800';
    case 'brochure':
      return 'bg-cyan-100 text-cyan-800';
    default:
      return 'bg-green-100 text-green-800';
  }
};

const UserManagement = () => {
  const { isAdmin, loading } = useAuth();
  const [approvedUsers, setApprovedUsers] = useState([]);
  const [activeUsers, setActiveUsers] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState(null);
  const [newUser, setNewUser] = useState({
    email: '',
    name: '',
    role: 'employee'
  });
  const [error, setError] = useState('');
  const createBrochureAccess = httpsCallable(functions, 'createBrochureAccess');
  const defaultBrochureAccessEndpoint = process.env.REACT_APP_FIREBASE_PROJECT_ID
    ? `https://us-central1-${process.env.REACT_APP_FIREBASE_PROJECT_ID}.cloudfunctions.net/createBrochureAccessHttp`
    : 'https://us-central1-crm-boats.cloudfunctions.net/createBrochureAccessHttp';
  const brochureAccessEndpoint = process.env.REACT_APP_BROCHURE_ACCESS_ENDPOINT || defaultBrochureAccessEndpoint;

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
      console.log('Fetched Approved Users:', usersData);
      setApprovedUsers(usersData);
    });

    // Listen for active users
    const activeUsersQuery = query(collection(db, 'users'));
    const unsubscribeActive = onSnapshot(activeUsersQuery, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      console.log('Fetched Active Users:', usersData);
      setActiveUsers(usersData);
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
    setCreatedCredentials(null);

    const normalizedEmail = newUser.email.trim().toLowerCase();
    const normalizedName = newUser.name.trim();
    const isBrochureUser = newUser.role === 'brochure';
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!normalizedEmail || !emailPattern.test(normalizedEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    if (!isBrochureUser && !normalizedEmail.endsWith('@gmail.com')) {
      setError('Only Gmail addresses are allowed for this role');
      return;
    }

    if (!normalizedName) {
      setError('Name is required');
      return;
    }

    try {
      if (isBrochureUser) {
        let data = null;

        try {
          const result = await createBrochureAccess({
            email: normalizedEmail,
            name: normalizedName
          });
          data = result.data || {};
        } catch (callableError) {
          const token = await auth.currentUser?.getIdToken();
          if (!token) {
            throw callableError;
          }

          const response = await fetch(brochureAccessEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              email: normalizedEmail,
              name: normalizedName
            })
          });

          const fallbackData = await response.json().catch(() => null);
          if (!response.ok) {
            const fallbackMessage = fallbackData?.error || callableError?.message || `Request failed (${response.status})`;
            throw new Error(fallbackMessage);
          }

          data = fallbackData || {};
        }

        if (data.success) {
          setCreatedCredentials({
            email: data.email,
            password: data.password
          });
          setNewUser({ email: '', name: '', role: 'employee' });
          return;
        }

        setError(data.error || 'Failed to create brochure access');
        return;
      }

      const userData = {
        email: normalizedEmail,
        name: normalizedName,
        displayName: normalizedName,
        role: newUser.role,
        createdAt: new Date()
      };
      
      console.log('Adding new user with data:', userData);
      
      const result = await addApprovedUser(userData);

      if (result.success) {
        setShowAddForm(false);
        setCreatedCredentials(null);
        setNewUser({ email: '', name: '', role: 'employee' });
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
        // Find if user exists in active users
        const matchingActiveUser = activeUsers.find(user => user.email === email);
        const userId = matchingActiveUser ? matchingActiveUser.id : null;
        
        // Remove from both collections if needed
        const result = await removeUserCompletely(email, userId);
        
        if (!result.success) {
          setError(result.error || 'Failed to remove user');
        }
      } catch (err) {
        console.error('Error removing user:', err);
        setError('Failed to remove user');
      }
    }
  };

  // Additional function to remove an active user
  const handleRemoveActiveUser = async (userId, email) => {
    if (window.confirm('Are you sure you want to remove this active user? This will delete their account.')) {
      try {
        // Find corresponding approved user
        const isApproved = approvedUsers.some(user => user.email === email);
        
        // If user is also in approved list, remove from both
        if (isApproved) {
          await removeUserCompletely(email, userId);
        } else {
          // Just remove from active users
          await deleteDoc(doc(db, 'users', userId));
        }
      } catch (err) {
        console.error('Error removing active user:', err);
        setError('Failed to remove active user');
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
    <div className="space-y-6 px-4 md:px-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl sm:text-2xl font-bold">User Management</h2>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm sm:text-base"
        >
          <UserPlus size={18} />
          Add New User
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-3 sm:p-4 rounded">
          <div className="flex">
            <div className="ml-2 sm:ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Active Users Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <h3 className="px-4 sm:px-6 py-3 text-base sm:text-lg font-semibold">Active Users</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Active</th>
                <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {activeUsers.map((user) => (
                <tr key={user.id}>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                    <div className="text-xs sm:text-sm font-medium text-gray-900">
                      {user.displayName || user.name || 'N/A'}
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                    <div className="text-xs sm:text-sm text-gray-500 truncate max-w-[120px] sm:max-w-none">
                      {user.email}
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${roleBadgeClass(user.role)}`}>
                      {user.role || 'user'}
                    </span>
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                    <div className="text-xs sm:text-sm text-gray-500">
                      {formatLastLogin(user.lastLogin)}
                    </div>
                    {user.lastLogin && user.lastLogin.toDate && (
                      <div className="hidden sm:block text-xs text-gray-400 mt-1">
                        {new Date(user.lastLogin.toDate()).toLocaleString()}
                      </div>
                    )}
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleRemoveActiveUser(user.id, user.email)}
                      className="text-red-600 hover:text-red-900 p-2"
                      aria-label="Delete user"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {activeUsers.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-3 sm:px-6 py-4 text-center text-sm text-gray-500">
                    No active users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Approved Users Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <h3 className="px-4 sm:px-6 py-3 text-base sm:text-lg font-semibold">Approved Users</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
                <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {approvedUsers.map((user) => (
                <tr key={user.id}>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                    <div className="text-xs sm:text-sm font-medium text-gray-900">
                      {user.displayName || user.name || 'N/A'}
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                    <div className="text-xs sm:text-sm text-gray-500 truncate max-w-[120px] sm:max-w-none">
                      {user.email}
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${roleBadgeClass(user.role)}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                    {user.createdAt && user.createdAt.toDate ? new Date(user.createdAt.toDate()).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleRemoveApprovedUser(user.email)}
                      className="text-red-600 hover:text-red-900 p-2"
                      aria-label="Delete user"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {approvedUsers.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-3 sm:px-6 py-4 text-center text-sm text-gray-500">
                    No approved users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md mx-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base sm:text-lg font-semibold">Add New User</h3>
              <button 
                onClick={() => {
                  setShowAddForm(false);
                  setCreatedCredentials(null);
                }}
                className="text-gray-500 hover:text-gray-700 p-2"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            {createdCredentials ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                  <p className="text-sm font-medium text-green-800">Brochure access created.</p>
                  <p className="mt-2 text-sm text-green-700">Share these credentials now. The password is only shown once.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <div className="mt-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 break-all">
                    {createdCredentials.email}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Generated Password</label>
                  <div className="mt-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-mono text-gray-900 break-all">
                    {createdCredentials.password}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setCreatedCredentials(null);
                  }}
                  className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleAddUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <input
                    type="text"
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-base"
                    placeholder="Enter user's name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {newUser.role === 'brochure' ? 'Email Address' : 'Gmail Address'}
                  </label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-base"
                    placeholder={newUser.role === 'brochure' ? 'brochure@example.com' : 'user@gmail.com'}
                    pattern={newUser.role === 'brochure' ? undefined : '.*@gmail\\.com$'}
                    title={newUser.role === 'brochure' ? 'Please enter a valid email address' : 'Please enter a valid Gmail address'}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Role</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-base"
                  >
                    <option value="staff">Staff</option>
                    <option value="employee">Employee</option>
                    <option value="driver">Driver</option>
                    <option value="brochure">Brochure access</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                {newUser.role === 'brochure' && (
                  <p className="text-xs text-gray-500">
                    Brochure users get a generated password automatically and do not need a Gmail account.
                  </p>
                )}
                <div className="flex flex-col sm:flex-row justify-end gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setCreatedCredentials(null);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm sm:text-base w-full sm:w-auto"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm sm:text-base w-full sm:w-auto mt-2 sm:mt-0"
                  >
                    Add User
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
