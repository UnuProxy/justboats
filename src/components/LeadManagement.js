import React, { useState, useEffect, useMemo } from 'react';
import { 
  getFirestore, 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  updateDoc,
  addDoc,
  getDocs,
  serverTimestamp,
  deleteDoc
} from 'firebase/firestore';
import { getMessaging, getToken } from 'firebase/messaging';

const LeadManagement = () => {
  // States
  const [leads, setLeads] = useState([]);
  const [users, setUsers] = useState([]);
  const [boats, setBoats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedLead, setSelectedLead] = useState(null);
  const [showLeadDetails, setShowLeadDetails] = useState(false);
  const [notification, setNotification] = useState(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [activeTab, setActiveTab] = useState('leads');
  const [newNote, setNewNote] = useState('');
  const [leadNotes, setLeadNotes] = useState({});
  const [leadQualification, setLeadQualification] = useState({});
  const [reminders, setReminders] = useState([]);
  const [newReminder, setNewReminder] = useState({
    date: '',
    time: '',
    description: '',
    leadId: ''
  });

  // Lead statuses configuration with professional colors
  const statuses = {
    new: { label: 'New', color: '#3b82f6', bgColor: '#eff6ff', textColor: '#1e40af' },
    contacted: { label: 'Contacted', color: '#10b981', bgColor: '#ecfdf5', textColor: '#065f46' },
    followUp: { label: 'Follow Up', color: '#f59e0b', bgColor: '#fffbeb', textColor: '#92400e' },
    negotiating: { label: 'Negotiating', color: '#8b5cf6', bgColor: '#f5f3ff', textColor: '#5b21b6' },
    noAnswer: { label: 'No Answer', color: '#ef4444', bgColor: '#fef2f2', textColor: '#b91c1c' },
    converted: { label: 'Converted', color: '#059669', bgColor: '#d1fae5', textColor: '#065f46' },
    closed: { label: 'Closed', color: '#6b7280', bgColor: '#f3f4f6', textColor: '#374151' }
  };

  // Lead qualification levels
  const qualificationLevels = {
    hot: { label: 'Hot', color: '#ef4444', icon: '🔥' },
    warm: { label: 'Warm', color: '#f59e0b', icon: '⭐' },
    cold: { label: 'Cold', color: '#3b82f6', icon: '❄️' },
    unknown: { label: 'Unknown', color: '#6b7280', icon: '❓' }
  };

  // Initialize Firestore
  const db = getFirestore();

  // Set up browser notifications
  useEffect(() => {
    const setupNotifications = async () => {
      try {
        if ('Notification' in window) {
          const permission = await Notification.requestPermission();
          setNotificationsEnabled(permission === 'granted');
          
          if (permission === 'granted') {
            try {
              const messaging = getMessaging();
              await getToken(messaging);
              console.log('Notifications enabled');
            } catch (error) {
              console.error('Error setting up Firebase messaging:', error);
            }
          }
        }
      } catch (error) {
        console.error('Error setting up notifications:', error);
      }
    };
    
    setupNotifications();
  }, []);

  // Fetch leads in real-time
  useEffect(() => {
    let unsubscribeLeads;
    
    try {
      console.log('Setting up leads listener...');
      
      // Create a query for the inquiries collection
      const inquiriesQuery = query(
        collection(db, 'inquiries'),
        orderBy('timestamp', 'desc')
      );

      unsubscribeLeads = onSnapshot(inquiriesQuery, 
        (snapshot) => {
          console.log(`Received ${snapshot.docs.length} leads from Firestore`);
          
          const leadData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            status: doc.data().status || 'new'
          }));
          
          setLeads(leadData);
          setLoading(false);
          
          // Check for new leads since last update
          const newLeads = snapshot.docChanges()
            .filter(change => change.type === 'added');
          
          if (newLeads.length > 0) {
            const latestLead = newLeads[0].doc.data();
            const vesselName = latestLead.boatName || latestLead.yachtName || 'a yacht';
            showNotification('New Lead', `${latestLead.name || 'Someone'} inquired about ${vesselName}`);
          }
        }, 
        (error) => {
          console.error("Error fetching inquiries:", error);
          setLoading(false);
        }
      );
    } catch (error) {
      console.error("Error setting up inquiries listener:", error);
      setLoading(false);
    }

    return () => {
      if (unsubscribeLeads) {
        unsubscribeLeads();
      }
    };
  }, [db]);

  // Fetch users
  useEffect(() => {
    let unsubscribeUsers;
    
    try {
      const usersCollection = collection(db, 'users');
      
      unsubscribeUsers = onSnapshot(usersCollection, (snapshot) => {
        const userData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setUsers(userData);
      }, (error) => {
        console.error("Error fetching users:", error);
      });
    } catch (error) {
      console.error("Error setting up users listener:", error);
    }

    return () => {
      if (unsubscribeUsers) {
        unsubscribeUsers();
      }
    };
  }, [db]);

  // Fetch boats
  useEffect(() => {
    const fetchBoats = async () => {
      try {
        const boatsSnapshot = await getDocs(collection(db, 'boats'));
        const boatsData = boatsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setBoats(boatsData);
      } catch (error) {
        console.error("Error fetching boats:", error);
      }
    };
    
    fetchBoats();
  }, [db]);

  // Fetch notes for leads
  useEffect(() => {
    if (leads.length === 0) return;
    
    const fetchNotes = async () => {
      try {
        const notesSnapshot = await getDocs(collection(db, 'leadNotes'));
        const notesData = notesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Organize notes by lead ID
        const notesByLead = {};
        notesData.forEach(note => {
          if (!notesByLead[note.leadId]) {
            notesByLead[note.leadId] = [];
          }
          notesByLead[note.leadId].push(note);
        });
        
        // Sort notes by timestamp
        Object.keys(notesByLead).forEach(leadId => {
          notesByLead[leadId].sort((a, b) => 
            b.timestamp.toDate().getTime() - a.timestamp.toDate().getTime()
          );
        });
        
        setLeadNotes(notesByLead);
      } catch (error) {
        console.error("Error fetching notes:", error);
      }
    };
    
    const fetchQualifications = async () => {
      try {
        const qualificationsSnapshot = await getDocs(collection(db, 'leadQualifications'));
        const qualificationsData = qualificationsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Organize qualifications by lead ID
        const qualByLead = {};
        qualificationsData.forEach(qual => {
          qualByLead[qual.leadId] = qual;
        });
        
        setLeadQualification(qualByLead);
      } catch (error) {
        console.error("Error fetching qualifications:", error);
      }
    };
    
    const fetchReminders = async () => {
      try {
        const remindersSnapshot = await getDocs(collection(db, 'reminders'));
        const remindersData = remindersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Sort reminders by date
        remindersData.sort((a, b) => 
          a.reminderDate.toDate().getTime() - b.reminderDate.toDate().getTime()
        );
        
        setReminders(remindersData);
      } catch (error) {
        console.error("Error fetching reminders:", error);
      }
    };
    
    fetchNotes();
    fetchQualifications();
    fetchReminders();
  }, [db, leads]);

  // Show notification
  const showNotification = (title, body) => {
    // In-app notification
    setNotification({ title, body, timestamp: new Date() });
    setTimeout(() => setNotification(null), 5000);
    
    // Browser notification if enabled
    if (notificationsEnabled) {
      try {
        const notification = new Notification(title, {
          body,
          icon: '/logo.png' // Replace with your logo
        });
        
        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      } catch (error) {
        console.error('Error showing browser notification:', error);
      }
    }
    
    // Log notification to database
    try {
      addDoc(collection(db, 'notifications'), {
        title,
        body,
        read: false,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error('Error saving notification to database:', error);
    }
  };

  // Update lead status
  const updateLeadStatus = async (leadId, newStatus) => {
    try {
      await updateDoc(doc(db, 'inquiries', leadId), {
        status: newStatus,
        lastUpdated: serverTimestamp()
      });
      
      // Add a note about the status change
      await addNote(leadId, `Status changed to ${statuses[newStatus].label}`);
      
      showNotification('Status Updated', `Lead status changed to ${statuses[newStatus].label}`);
    } catch (error) {
      console.error('Error updating status:', error);
      showNotification('Error', 'Failed to update lead status');
    }
  };

  // Update lead assignment
  const updateLeadAssignment = async (leadId, userId) => {
    try {
      await updateDoc(doc(db, 'inquiries', leadId), {
        assignedTo: userId || null,
        lastUpdated: serverTimestamp()
      });
      
      const lead = leads.find(l => l.id === leadId);
      const user = users.find(u => u.id === userId);
      
      if (userId && lead && user) {
        await addNote(leadId, `Lead assigned to ${user.name}`);
        showNotification('Lead Assigned', `${lead.name}'s inquiry assigned to ${user.name}`);
      } else {
        await addNote(leadId, `Lead unassigned`);
        showNotification('Lead Unassigned', 'Lead is now unassigned');
      }
    } catch (error) {
      console.error('Error updating assignment:', error);
      showNotification('Error', 'Failed to update lead assignment');
    }
  };

  // Add a note to a lead
  const addNote = async (leadId, content, isSystem = true) => {
    if (!content.trim()) return;
    
    try {
      const noteRef = await addDoc(collection(db, 'leadNotes'), {
        leadId,
        content,
        isSystem,
        timestamp: serverTimestamp(),
        userId: localStorage.getItem('currentUserId') || 'system'
      });
      
      // Update local state immediately for better UX
      setLeadNotes(prev => {
        const updatedNotes = { ...prev };
        const newNote = {
          id: noteRef.id,
          leadId,
          content,
          isSystem,
          timestamp: { toDate: () => new Date() },
          userId: localStorage.getItem('currentUserId') || 'system'
        };
        
        if (!updatedNotes[leadId]) {
          updatedNotes[leadId] = [];
        }
        
        updatedNotes[leadId] = [newNote, ...updatedNotes[leadId]];
        return updatedNotes;
      });
      
      if (!isSystem) {
        setNewNote('');
      }
      
      return true;
    } catch (error) {
      console.error('Error adding note:', error);
      showNotification('Error', 'Failed to add note');
      return false;
    }
  };

  // Delete a note
  const deleteNote = async (noteId) => {
    try {
      await deleteDoc(doc(db, 'leadNotes', noteId));
      
      // Update local state
      setLeadNotes(prev => {
        const updatedNotes = { ...prev };
        
        Object.keys(updatedNotes).forEach(leadId => {
          updatedNotes[leadId] = updatedNotes[leadId].filter(note => note.id !== noteId);
        });
        
        return updatedNotes;
      });
      
      showNotification('Note Deleted', 'The note has been removed');
    } catch (error) {
      console.error('Error deleting note:', error);
      showNotification('Error', 'Failed to delete note');
    }
  };

  // Update lead qualification
  const updateLeadQualification = async (leadId, level) => {
    try {
      // Check if qualification exists
      const existingQual = leadQualification[leadId];
      
      if (existingQual) {
        await updateDoc(doc(db, 'leadQualifications', existingQual.id), {
          level,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'leadQualifications'), {
          leadId,
          level,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      
      // Update local state
      setLeadQualification(prev => ({
        ...prev,
        [leadId]: {
          ...existingQual,
          level,
          updatedAt: { toDate: () => new Date() }
        }
      }));
      
      // Add a note
      await addNote(leadId, `Lead qualified as ${qualificationLevels[level].label}`);
      
      showNotification('Lead Qualified', `Lead marked as ${qualificationLevels[level].label}`);
    } catch (error) {
      console.error('Error updating qualification:', error);
      showNotification('Error', 'Failed to update lead qualification');
    }
  };

  // Add a reminder
  const addReminder = async () => {
    if (!newReminder.date || !newReminder.description || !newReminder.leadId) {
      showNotification('Error', 'Please fill in all reminder fields');
      return;
    }
    
    try {
      const reminderDate = new Date(`${newReminder.date}T${newReminder.time || '09:00'}`);
      
      const reminderRef = await addDoc(collection(db, 'reminders'), {
        leadId: newReminder.leadId,
        description: newReminder.description,
        reminderDate: reminderDate,
        completed: false,
        createdAt: serverTimestamp(),
        userId: localStorage.getItem('currentUserId') || 'system'
      });
      
      // Update local state
      setReminders(prev => [
        ...prev,
        {
          id: reminderRef.id,
          leadId: newReminder.leadId,
          description: newReminder.description,
          reminderDate: { toDate: () => reminderDate },
          completed: false,
          createdAt: { toDate: () => new Date() },
          userId: localStorage.getItem('currentUserId') || 'system'
        }
      ].sort((a, b) => 
        a.reminderDate.toDate().getTime() - b.reminderDate.toDate().getTime()
      ));
      
      // Add a note
      const lead = leads.find(l => l.id === newReminder.leadId);
      await addNote(
        newReminder.leadId, 
        `Reminder set for ${reminderDate.toLocaleDateString()}: ${newReminder.description}`
      );
      
      // Reset form
      setNewReminder({
        date: '',
        time: '',
        description: '',
        leadId: ''
      });
      
      showNotification('Reminder Set', `Reminder added for ${lead?.name || 'lead'}`);
    } catch (error) {
      console.error('Error adding reminder:', error);
      showNotification('Error', 'Failed to add reminder');
    }
  };

  // Complete a reminder
  const completeReminder = async (reminderId) => {
    try {
      await updateDoc(doc(db, 'reminders', reminderId), {
        completed: true,
        completedAt: serverTimestamp()
      });
      
      // Update local state
      setReminders(prev => prev.map(reminder => 
        reminder.id === reminderId 
          ? { 
              ...reminder, 
              completed: true, 
              completedAt: { toDate: () => new Date() } 
            } 
          : reminder
      ));
      
      showNotification('Reminder Completed', 'The reminder has been marked as completed');
    } catch (error) {
      console.error('Error completing reminder:', error);
      showNotification('Error', 'Failed to update reminder');
    }
  };

  // Delete a reminder
  const deleteReminder = async (reminderId) => {
    try {
      await deleteDoc(doc(db, 'reminders', reminderId));
      
      // Update local state
      setReminders(prev => prev.filter(reminder => reminder.id !== reminderId));
      
      showNotification('Reminder Deleted', 'The reminder has been removed');
    } catch (error) {
      console.error('Error deleting reminder:', error);
      showNotification('Error', 'Failed to delete reminder');
    }
  };

  // Contact via email
  const contactViaEmail = (lead) => {
    if (!lead || !lead.email) return;
    
    const vesselName = getVesselName(lead);
    const subject = `Regarding your inquiry about ${vesselName}`;
    const body = `Hello ${lead.name},\n\nThank you for your interest in ${vesselName}. I'd like to provide you with more information and answer any questions you might have.\n\nBest regards,`;
    
    window.location.href = `mailto:${lead.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    // Update status if new
    if (lead.status === 'new') {
      updateLeadStatus(lead.id, 'contacted');
    }
  };

  // Contact via phone
  const contactViaPhone = (phone) => {
    if (!phone) return;
    window.location.href = `tel:${phone}`;
  };

  // Format date in British style (DD/MM/YYYY)
  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      
      return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  };

  // Format date without time
  const formatDateOnly = (timestamp) => {
    if (!timestamp) return 'N/A';
    
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      
      return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).format(date);
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  };

  // Format time
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      
      return new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch (error) {
      console.error('Error formatting time:', error);
      return '';
    }
  };

  

  // Get boat details - checks both boatName and yachtName
  const getBoatDetails = (boatName) => {
    if (!boatName) return null;
    return boats.find(boat => boat.name === boatName) || null;
  };
  
  // Get the boat/yacht name (handles both field names)
  const getVesselName = (lead) => {
    return lead.boatName || lead.yachtName || 'Not specified';
  };

  // Get lead qualification level
  const getLeadQualification = (leadId) => {
    return leadQualification[leadId]?.level || 'unknown';
  };

  // Calculate days since last contact
  const calculateDaysSinceLastContact = (lead) => {
    const leadNotesList = leadNotes[lead.id] || [];
    const lastContactNote = leadNotesList.find(note => !note.isSystem);
    
    if (!lastContactNote) {
      return lead.lastUpdated 
        ? Math.floor((new Date() - lead.lastUpdated.toDate()) / (1000 * 60 * 60 * 24))
        : Math.floor((new Date() - lead.timestamp.toDate()) / (1000 * 60 * 60 * 24));
    }
    
    return Math.floor((new Date() - lastContactNote.timestamp.toDate()) / (1000 * 60 * 60 * 24));
  };

  // Filtered leads
  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      const matchesSearch = searchTerm === '' || 
        (lead.name && lead.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (lead.email && lead.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (lead.boatName && lead.boatName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (lead.yachtName && lead.yachtName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (lead.phone && lead.phone.includes(searchTerm));
      
      const matchesStatus = filterStatus === '' || lead.status === filterStatus;
      
      return matchesSearch && matchesStatus;
    });
  }, [leads, searchTerm, filterStatus]);

  // Upcoming reminders
  const upcomingReminders = useMemo(() => {
    const now = new Date();
    return reminders
      .filter(reminder => !reminder.completed && reminder.reminderDate.toDate() > now)
      .slice(0, 5);
  }, [reminders]);

  // Today's reminders
  const todaysReminders = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    
    return reminders.filter(reminder => 
      !reminder.completed && 
      reminder.reminderDate.toDate() >= todayStart &&
      reminder.reminderDate.toDate() < todayEnd
    );
  }, [reminders]);

  // Overdue reminders
  const overdueReminders = useMemo(() => {
    const now = new Date();
    return reminders.filter(reminder => 
      !reminder.completed && 
      reminder.reminderDate.toDate() < now
    );
  }, [reminders]);

  // Get status counts
  const statusCounts = useMemo(() => {
    const counts = {};
    Object.keys(statuses).forEach(status => {
      counts[status] = leads.filter(lead => lead.status === status).length;
    });
    counts.all = leads.length;
    return counts;
  }, [leads]);

  // Open lead details modal
  const openLeadDetails = (lead) => {
    setSelectedLead(lead);
    setShowLeadDetails(true);
  };

  // Close lead details modal
  const closeLeadDetails = () => {
    setShowLeadDetails(false);
  };

  // Render a status badge
  const StatusBadge = ({ status }) => {
    const statusInfo = statuses[status] || statuses.new;
    
    return (
      <span 
        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium" 
        style={{ 
          backgroundColor: statusInfo.bgColor,
          color: statusInfo.textColor
        }}
      >
        {statusInfo.label}
      </span>
    );
  };

  // Render a qualification badge
  const QualificationBadge = ({ level }) => {
    const qualInfo = qualificationLevels[level] || qualificationLevels.unknown;
    
    return (
      <span 
        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium" 
        style={{ color: qualInfo.color }}
      >
        <span className="mr-1">{qualInfo.icon}</span>
        {qualInfo.label}
      </span>
    );
  };

  // Lead card component for mobile view
  const LeadCard = ({ lead }) => {
    const qualification = getLeadQualification(lead.id);
    const daysSinceContact = calculateDaysSinceLastContact(lead);
    const vesselName = getVesselName(lead);
    
    return (
      <div className="bg-white rounded-lg shadow mb-3 overflow-hidden border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center">
                <h3 className="font-semibold text-gray-900">
                  {vesselName}
                </h3>
                <QualificationBadge level={qualification} />
              </div>
              <p className="text-sm text-gray-600">{lead.name || 'No name provided'}</p>
            </div>
            <StatusBadge status={lead.status} />
          </div>
        </div>
        
        <div className="p-4">
          <div className="grid grid-cols-2 gap-2 text-sm mb-3">
            <div>
              <p className="text-gray-500">Email:</p>
              <p className="text-gray-800 truncate">{lead.email || 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-500">Phone:</p>
              <p className="text-gray-800">{lead.phone || 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-500">Date:</p>
              <p className="text-gray-800">{formatDate(lead.timestamp)}</p>
            </div>
            <div>
              <p className="text-gray-500">Last Contact:</p>
              <p className="text-gray-800">{daysSinceContact} days ago</p>
            </div>
          </div>
          
          <div className="flex justify-between">
            <div className="flex space-x-2">
              <button
                onClick={() => contactViaEmail(lead)}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
              >
                <svg className="h-3.5 w-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                </svg>
                Email
              </button>
              
              <button
                onClick={() => contactViaPhone(lead.phone)}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
              >
                <svg className="h-3.5 w-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path>
                </svg>
                Call
              </button>
            </div>
            
            <button
              onClick={() => openLeadDetails(lead)}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
            >
              Details
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Note component
  const Note = ({ note, onDelete }) => {
    const userColor = note.isSystem ? 'text-gray-500' : 'text-blue-600';
    const userName = note.isSystem 
      ? 'System' 
      : (users.find(u => u.id === note.userId)?.name || 'Unknown');
    
    return (
      <div className="mb-3 bg-white rounded-lg border border-gray-200 p-3">
        <div className="flex justify-between mb-1">
          <div className={`text-xs font-medium ${userColor}`}>
            {userName}
          </div>
          <div className="text-xs text-gray-400">
            {formatDate(note.timestamp)}
            {!note.isSystem && (
              <button
                onClick={() => onDelete(note.id)}
                className="ml-2 text-red-500 hover:text-red-700"
                title="Delete note"
              >
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-700">{note.content}</p>
      </div>
    );
  };

  // Reminder component
  const ReminderItem = ({ reminder, lead, onComplete, onDelete }) => {
    const isPast = reminder.reminderDate.toDate() < new Date();
    
    return (
      <div className={`p-3 mb-2 rounded-lg border ${
        isPast ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'
      }`}>
        <div className="flex justify-between items-start">
          <div>
            <div className="text-sm font-medium">
              {reminder.description}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {formatDateOnly(reminder.reminderDate)} at {formatTime(reminder.reminderDate)}
            </div>
            {lead && (
              <div className="text-xs text-gray-500 mt-1">
                Lead: {lead.name} ({getVesselName(lead)})
              </div>
            )}
          </div>
          <div className="flex space-x-1">
            <button
              onClick={() => onComplete(reminder.id)}
              className="text-green-600 hover:text-green-800"
              title="Mark as completed"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </button>
            <button
              onClick={() => onDelete(reminder.id)}
              className="text-red-600 hover:text-red-800"
              title="Delete reminder"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Dashboard component
  const Dashboard = () => {
    const newLeadsCount = leads.filter(lead => lead.status === 'new').length;
    const contactedLeadsCount = leads.filter(lead => lead.status === 'contacted').length;
    const followUpLeadsCount = leads.filter(lead => lead.status === 'followUp').length;
    
    // Calculate conversion rate
    const convertedLeadsCount = leads.filter(lead => lead.status === 'converted').length;
    const conversionRate = leads.length > 0 
      ? ((convertedLeadsCount / leads.length) * 100).toFixed(1) 
      : 0;
    
    return (
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-blue-500 rounded-md p-3">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      New Leads
                    </dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900">
                        {newLeadsCount}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Contacted Leads
                    </dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900">
                        {contactedLeadsCount}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-yellow-500 rounded-md p-3">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Follow-up Required
                    </dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900">
                        {followUpLeadsCount}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-indigo-500 rounded-md p-3">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Conversion Rate
                    </dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900">
                        {conversionRate}%
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Today's reminders */}
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Todays Reminders
            </h3>
          </div>
          <div className="px-4 py-5 sm:p-6">
            {todaysReminders.length === 0 ? (
              <p className="text-sm text-gray-500">No reminders for today.</p>
            ) : (
              <div className="space-y-2">
                {todaysReminders.map(reminder => (
                  <ReminderItem 
                    key={reminder.id} 
                    reminder={reminder} 
                    lead={leads.find(l => l.id === reminder.leadId)}
                    onComplete={completeReminder}
                    onDelete={deleteReminder}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Overdue reminders */}
        {overdueReminders.length > 0 && (
          <div className="bg-red-50 shadow overflow-hidden sm:rounded-lg border border-red-200">
            <div className="px-4 py-5 border-b border-red-200 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-red-800">
                Overdue Reminders
              </h3>
            </div>
            <div className="px-4 py-5 sm:p-6">
              <div className="space-y-2">
                {overdueReminders.map(reminder => (
                  <ReminderItem 
                    key={reminder.id} 
                    reminder={reminder} 
                    lead={leads.find(l => l.id === reminder.leadId)}
                    onComplete={completeReminder}
                    onDelete={deleteReminder}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Recent leads */}
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Recent Leads
            </h3>
          </div>
          <div className="px-4 py-5 sm:p-6">
            {leads.length === 0 ? (
              <p className="text-sm text-gray-500">No leads yet.</p>
            ) : (
              <div className="space-y-3">
                {leads.slice(0, 5).map(lead => (
                  <div key={lead.id} className="flex justify-between items-center p-3 border border-gray-100 rounded-lg">
                    <div>
                      <p className="font-medium">{lead.name}</p>
                      <p className="text-sm text-gray-500">{getVesselName(lead)}</p>
                      {lead.price && <p className="text-xs text-gray-500">{lead.price}</p>}
                    </div>
                    <div className="flex items-center space-x-3">
                      <StatusBadge status={lead.status} />
                      <button
                        onClick={() => openLeadDetails(lead)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        View
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Reminders component
  const Reminders = () => {
    return (
      <div className="space-y-6">
        {/* New reminder form */}
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Create New Reminder
            </h3>
          </div>
          <div className="px-4 py-5 sm:p-6">
            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              <div className="sm:col-span-3">
                <label htmlFor="reminder-lead" className="block text-sm font-medium text-gray-700">
                  Lead
                </label>
                <select
                  id="reminder-lead"
                  value={newReminder.leadId}
                  onChange={(e) => setNewReminder({...newReminder, leadId: e.target.value})}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                >
                  <option value="">Select a lead</option>
                  {leads.map(lead => (
                    <option key={lead.id} value={lead.id}>
                      {lead.name} - {lead.yachtName || 'No yacht'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="reminder-date" className="block text-sm font-medium text-gray-700">
                  Date
                </label>
                <input
                  type="date"
                  id="reminder-date"
                  value={newReminder.date}
                  onChange={(e) => setNewReminder({...newReminder, date: e.target.value})}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>

              <div className="sm:col-span-1">
                <label htmlFor="reminder-time" className="block text-sm font-medium text-gray-700">
                  Time
                </label>
                <input
                  type="time"
                  id="reminder-time"
                  value={newReminder.time}
                  onChange={(e) => setNewReminder({...newReminder, time: e.target.value})}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>

              <div className="sm:col-span-6">
                <label htmlFor="reminder-description" className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <input
                  type="text"
                  id="reminder-description"
                  value={newReminder.description}
                  onChange={(e) => setNewReminder({...newReminder, description: e.target.value})}
                  placeholder="What needs to be done?"
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>
            <div className="mt-5">
              <button
                type="button"
                onClick={addReminder}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Create Reminder
              </button>
            </div>
          </div>
        </div>

        {/* Upcoming reminders */}
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Upcoming Reminders
            </h3>
          </div>
          <div className="px-4 py-5 sm:p-6">
            {upcomingReminders.length === 0 ? (
              <p className="text-sm text-gray-500">No upcoming reminders.</p>
            ) : (
              <div className="space-y-3">
                {upcomingReminders.map(reminder => (
                  <ReminderItem 
                    key={reminder.id} 
                    reminder={reminder} 
                    lead={leads.find(l => l.id === reminder.leadId)}
                    onComplete={completeReminder}
                    onDelete={deleteReminder}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Today's reminders */}
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Todays Reminders
            </h3>
          </div>
          <div className="px-4 py-5 sm:p-6">
            {todaysReminders.length === 0 ? (
              <p className="text-sm text-gray-500">No reminders for today.</p>
            ) : (
              <div className="space-y-3">
                {todaysReminders.map(reminder => (
                  <ReminderItem 
                    key={reminder.id} 
                    reminder={reminder} 
                    lead={leads.find(l => l.id === reminder.leadId)}
                    onComplete={completeReminder}
                    onDelete={deleteReminder}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Overdue reminders */}
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-red-800">
              Overdue Reminders
            </h3>
          </div>
          <div className="px-4 py-5 sm:p-6">
            {overdueReminders.length === 0 ? (
              <p className="text-sm text-gray-500">No overdue reminders.</p>
            ) : (
              <div className="space-y-3">
                {overdueReminders.map(reminder => (
                  <ReminderItem 
                    key={reminder.id} 
                    reminder={reminder} 
                    lead={leads.find(l => l.id === reminder.leadId)}
                    onComplete={completeReminder}
                    onDelete={deleteReminder}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Notification */}
      {notification && (
        <div className="fixed top-4 right-4 max-w-sm w-full bg-white rounded-lg shadow-lg border-l-4 z-50 border-green-500 overflow-hidden">
          <div className="p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-3 w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {notification.title}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {notification.body}
                </p>
              </div>
              <div className="ml-4 flex-shrink-0 flex">
                <button
                  className="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-500"
                  onClick={() => setNotification(null)}
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          <div className="bg-green-50 px-4 py-2 sm:px-6">
            <div className="flex justify-between items-center text-xs">
              <p className="text-green-800">
                {formatDate(notification.timestamp)}
              </p>
              <button 
                className="font-medium text-green-600 hover:text-green-500"
                onClick={() => setNotificationsEnabled(!notificationsEnabled)}
              >
                {notificationsEnabled ? 'Disable notifications' : 'Enable notifications'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page header */}
      <div className="border-b border-gray-200 pb-5 mb-6">
        <div className="sm:flex sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
              Yacht Sales CRM
            </h2>
            <p className="mt-2 max-w-4xl text-sm text-gray-500">
              Manage leads, schedule reminders, and track customer interactions.
            </p>
          </div>
          <div className="mt-4 sm:mt-0">
            <button
              type="button"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              onClick={() => setNotificationsEnabled(!notificationsEnabled)}
            >
              {notificationsEnabled ? 'Notifications On' : 'Enable Notifications'}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`${
              activeTab === 'dashboard'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('leads')}
            className={`${
              activeTab === 'leads'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Leads ({leads.length})
          </button>
          <button
            onClick={() => setActiveTab('reminders')}
            className={`${
              activeTab === 'reminders'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Reminders {todaysReminders.length > 0 && (
              <span className="ml-2 bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-xs">
                {todaysReminders.length}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Dashboard View */}
      {activeTab === 'dashboard' && <Dashboard />}

      {/* Leads View */}
      {activeTab === 'leads' && (
        <>
          {/* Status filters and search */}
          <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setFilterStatus('')}
                    className={`px-3 py-2 text-sm font-medium rounded-md ${
                      filterStatus === '' 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    All Leads ({statusCounts.all || 0})
                  </button>
                  
                  {Object.entries(statuses).map(([status, { label, color }]) => (
                    <button
                      key={status}
                      onClick={() => setFilterStatus(status)}
                      className={`px-3 py-2 text-sm font-medium rounded-md ${
                        filterStatus === status 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                      style={filterStatus === status ? { backgroundColor: color + '20', color } : {}}
                    >
                      {label} ({statusCounts[status] || 0})
                    </button>
                  ))}
                </div>
                
                <div className="w-full sm:w-64">
                  <div className="relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      placeholder="Search leads..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Leads list */}
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="py-12 text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No leads found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {searchTerm || filterStatus ? 'Try adjusting your search or filters' : 'New inquiries will appear here'}
                </p>
              </div>
            ) : (
              <>
                {/* Desktop View */}
                <div className="hidden md:block">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Customer
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Yacht
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Qualification
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Assigned
                        </th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredLeads.map(lead => (
                        <tr key={lead.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div>
                                <div className="text-sm font-medium text-gray-900">{lead.name || 'No name provided'}</div>
                                <div className="text-sm text-gray-500">{lead.email || 'No email provided'}</div>
                                {lead.phone && (
                                  <div className="text-sm text-gray-500">{lead.phone}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{getVesselName(lead)}</div>
                            {lead.date && (
                              <div className="text-sm text-gray-500">Requested: {lead.date}</div>
                            )}
                            {lead.passengers && (
                              <div className="text-sm text-gray-500">Passengers: {lead.passengers}</div>
                            )}
                            {lead.price && (
                              <div className="text-sm text-gray-500">Price: {lead.price}</div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <StatusBadge status={lead.status} />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <QualificationBadge level={getLeadQualification(lead.id)} />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <select
                              value={lead.assignedTo || ''}
                              onChange={(e) => updateLeadAssignment(lead.id, e.target.value)}
                              className="block w-full py-2 pl-3 pr-10 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                            >
                              <option value="">Unassigned</option>
                              {users.map(user => (
                                <option key={user.id} value={user.id}>
                                  {user.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end space-x-2">
                              <button
                                onClick={() => contactViaEmail(lead)}
                                className="text-blue-600 hover:text-blue-900"
                                title="Email"
                              >
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                              </button>
                              
                              <button
                                onClick={() => contactViaPhone(lead.phone)}
                                className="text-green-600 hover:text-green-900"
                                title="Call"
                              >
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                              </button>
                              
                              <button
                                onClick={() => openLeadDetails(lead)}
                                className="text-indigo-600 hover:text-indigo-900"
                                title="View Details"
                              >
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Mobile View */}
                <div className="block md:hidden p-4">
                  <div className="space-y-4">
                    {filteredLeads.map(lead => (
                      <LeadCard key={lead.id} lead={lead} />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* Reminders View */}
      {activeTab === 'reminders' && <Reminders />}

      {/* Lead Details Modal */}
      {showLeadDetails && selectedLead && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-5xl sm:w-full">
              <div className="bg-white">
                <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg leading-6 font-medium text-gray-900">
                        Lead Details
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        {selectedLead.name} • {formatDate(selectedLead.timestamp)}
                      </p>
                    </div>
                    <button
                      className="rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
                      onClick={closeLeadDetails}
                    >
                      <span className="sr-only">Close</span>
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="px-4 py-5 sm:p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left column - Lead information */}
                    <div className="col-span-1">
                      <div className="bg-gray-50 rounded-lg p-4 mb-4">
                        <h4 className="text-sm font-medium text-gray-500 mb-3">Lead Information</h4>
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs text-gray-500">Name</p>
                            <p className="text-sm font-medium">{selectedLead.name || 'Not provided'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Email</p>
                            <p className="text-sm font-medium">{selectedLead.email || 'Not provided'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Phone</p>
                            <p className="text-sm font-medium">{selectedLead.phone || 'Not provided'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Inquiry Date</p>
                            <p className="text-sm font-medium">{formatDate(selectedLead.timestamp)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Requested Date</p>
                            <p className="text-sm font-medium">{selectedLead.date || 'Not specified'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Last Updated</p>
                            <p className="text-sm font-medium">{formatDate(selectedLead.lastUpdated) || 'Not updated'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Assigned To</p>
                            <select
                              value={selectedLead.assignedTo || ''}
                              onChange={(e) => updateLeadAssignment(selectedLead.id, e.target.value)}
                              className="mt-1 block w-full py-1.5 pl-3 pr-10 text-sm border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
                            >
                              <option value="">Unassigned</option>
                              {users.map(user => (
                                <option key={user.id} value={user.id}>
                                  {user.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-4 mb-4">
                        <h4 className="text-sm font-medium text-gray-500 mb-3">Lead Status</h4>
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs text-gray-500">Current Status</p>
                            <div className="mt-1">
                              <StatusBadge status={selectedLead.status} />
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Change Status</p>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(statuses).map(([status, { label, color }]) => (
                                <button
                                  key={status}
                                  onClick={() => updateLeadStatus(selectedLead.id, status)}
                                  className={`px-2 py-1 text-xs font-medium rounded-md ${
                                    selectedLead.status === status 
                                      ? 'text-white' 
                                      : 'text-gray-700 hover:bg-gray-100'
                                  }`}
                                  style={
                                    selectedLead.status === status 
                                      ? { backgroundColor: color } 
                                      : { borderWidth: 1, borderColor: color + '50' }
                                  }
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-500 mb-3">Lead Qualification</h4>
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs text-gray-500">Current Qualification</p>
                            <div className="mt-1">
                              <QualificationBadge level={getLeadQualification(selectedLead.id)} />
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Change Qualification</p>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(qualificationLevels).map(([level, { label, icon, color }]) => (
                                <button
                                  key={level}
                                  onClick={() => updateLeadQualification(selectedLead.id, level)}
                                  className="px-2 py-1 text-xs font-medium rounded-md border hover:bg-gray-100"
                                  style={{ borderColor: color, color }}
                                >
                                  <span className="mr-1">{icon}</span>
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Middle column - Yacht information and message */}
                    <div className="col-span-1">
                      <div className="bg-gray-50 rounded-lg p-4 mb-4">
                        <h4 className="text-sm font-medium text-gray-500 mb-3">Boat Information</h4>
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs text-gray-500">Boat Name</p>
                            <p className="text-sm font-medium">{getVesselName(selectedLead)}</p>
                          </div>
                          
                          <div>
                            <p className="text-xs text-gray-500">Passengers</p>
                            <p className="text-sm font-medium">{selectedLead.passengers || 'Not specified'}</p>
                          </div>
                          
                          <div>
                            <p className="text-xs text-gray-500">Price</p>
                            <p className="text-sm font-medium">{selectedLead.price || 'Not specified'}</p>
                          </div>
                          
                          {/* Boat details from database if available */}
                          {getBoatDetails(selectedLead.boatName || selectedLead.yachtName) && (
                            <>
                              <div>
                                <p className="text-xs text-gray-500">Length</p>
                                <p className="text-sm font-medium">{getBoatDetails(selectedLead.boatName || selectedLead.yachtName).length || 'Not specified'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">Year</p>
                                <p className="text-sm font-medium">{getBoatDetails(selectedLead.boatName || selectedLead.yachtName).year || 'Not specified'}</p>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-4 mb-4">
                        <h4 className="text-sm font-medium text-gray-500 mb-3">Inquiry Message</h4>
                        <div className="p-3 bg-white rounded border border-gray-200">
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">
                            {selectedLead.message || 'No message provided'}
                          </p>
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-500 mb-3">Set Reminder</h4>
                        <div className="space-y-3">
                          <div>
                            <label htmlFor="reminder-date-modal" className="block text-xs text-gray-500">
                              Date
                            </label>
                            <input
                              type="date"
                              id="reminder-date-modal"
                              value={newReminder.date}
                              onChange={(e) => setNewReminder({...newReminder, date: e.target.value, leadId: selectedLead.id})}
                              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            />
                          </div>
                          <div>
                            <label htmlFor="reminder-time-modal" className="block text-xs text-gray-500">
                              Time
                            </label>
                            <input
                              type="time"
                              id="reminder-time-modal"
                              value={newReminder.time}
                              onChange={(e) => setNewReminder({...newReminder, time: e.target.value})}
                              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            />
                          </div>
                          <div>
                            <label htmlFor="reminder-desc-modal" className="block text-xs text-gray-500">
                              Description
                            </label>
                            <input
                              type="text"
                              id="reminder-desc-modal"
                              value={newReminder.description}
                              onChange={(e) => setNewReminder({...newReminder, description: e.target.value})}
                              placeholder="What needs to be done?"
                              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={addReminder}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            Create Reminder
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Right column - Notes and activity */}
                    <div className="col-span-1">
                      <div className="bg-gray-50 rounded-lg p-4 h-full">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="text-sm font-medium text-gray-500">Notes & Activity</h4>
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() => contactViaEmail(selectedLead)}
                              className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200"
                            >
                              Email
                            </button>
                            <button
                              onClick={() => contactViaPhone(selectedLead.phone)}
                              className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-green-700 bg-green-100 hover:bg-green-200"
                            >
                              Call
                            </button>
                          </div>
                        </div>

                        {/* Add note form */}
                        <div className="mb-4">
                          <textarea
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                            placeholder="Add a new note..."
                            className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            rows={3}
                          ></textarea>
                          <button
                            type="button"
                            onClick={() => addNote(selectedLead.id, newNote, false)}
                            className="mt-2 inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            Add Note
                          </button>
                        </div>

                        {/* Notes list */}
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {!leadNotes[selectedLead.id] || leadNotes[selectedLead.id].length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-4">No notes yet</p>
                          ) : (
                            leadNotes[selectedLead.id].map(note => (
                              <Note 
                                key={note.id} 
                                note={note} 
                                onDelete={deleteNote} 
                              />
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                    onClick={closeLeadDetails}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadManagement;


