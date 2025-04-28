import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  PlusCircle,
  Download,
  Trash2,
  History,
  Edit,
  MapPin,
  ExternalLink
} from 'lucide-react';
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { useAuth } from '../context/AuthContext';

const BoatLocationQRManager = () => {
  const { user } = useAuth();
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [scanStats, setScanStats] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list', 'add', 'edit', 'stats'

  // Simplified form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    specificBoatId: '',
    whatsappNumber: '',
    whatsappMessage: 'Hello! I saw your boat QR code and I\'m interested in learning more.'
  });

  useEffect(() => {
    if (user) fetchLocations();
  }, [user]);

  const fetchLocations = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'scanLocations'),
        where('createdBy', '==', user.uid)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setLocations(list);
    } catch (err) {
      console.error('Error fetching locations:', err);
    }
    setLoading(false);
  };

  const handleInputChange = e => {
    const { name, value } = e.target;
    setFormData(fd => ({ ...fd, [name]: value }));
  };

  const createLocation = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Please enter a name for the location');
      return;
    }
    
    try {
      setLoading(true);
      
      const cleanNumber = formData.whatsappNumber ? formData.whatsappNumber.replace(/\D/g, '') : '';
      
      const docRef = await addDoc(collection(db, 'scanLocations'), {
        name: formData.name,
        description: formData.description || '',
        category: formData.category || '',
        specificBoatId: formData.specificBoatId || '',
        whatsappNumber: cleanNumber,
        whatsappMessage: formData.whatsappMessage,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        scanCount: 0,
        conversionCount: 0
      });
      
      setLocations(prev => [
        ...prev,
        {
          id: docRef.id,
          name: formData.name,
          description: formData.description || '',
          category: formData.category || '',
          specificBoatId: formData.specificBoatId || '',
          whatsappNumber: cleanNumber,
          whatsappMessage: formData.whatsappMessage,
          createdBy: user.uid,
          scanCount: 0,
          conversionCount: 0
        }
      ]);
      
      setFormData({
        name: '',
        description: '',
        category: '',
        specificBoatId: '',
        whatsappNumber: '',
        whatsappMessage: 'Hello! I saw your boat QR code and I\'m interested in learning more.'
      });
      
      setViewMode('list');
    } catch (err) {
      console.error('Error creating location:', err);
      alert('Failed to create location');
    } finally {
      setLoading(false);
    }
  };

  const updateLocation = async e => {
    e.preventDefault();
    if (!selectedLocation) return;
    
    try {
      setLoading(true);
      
      const cleanNumber = formData.whatsappNumber ? formData.whatsappNumber.replace(/\D/g, '') : '';
      
      await updateDoc(doc(db, 'scanLocations', selectedLocation), {
        name: formData.name,
        description: formData.description || '',
        category: formData.category || '',
        specificBoatId: formData.specificBoatId || '',
        whatsappNumber: cleanNumber,
        whatsappMessage: formData.whatsappMessage
      });
      
      setLocations(prev =>
        prev.map(loc =>
          loc.id === selectedLocation
            ? {
                ...loc,
                name: formData.name,
                description: formData.description || '',
                category: formData.category || '',
                specificBoatId: formData.specificBoatId || '',
                whatsappNumber: cleanNumber,
                whatsappMessage: formData.whatsappMessage
              }
            : loc
        )
      );
      
      setViewMode('list');
      setSelectedLocation(null);
    } catch (err) {
      console.error('Error updating location:', err);
      alert('Failed to update location');
    } finally {
      setLoading(false);
    }
  };

  const deleteLocation = async id => {
    if (
      window.confirm(
        'Are you sure you want to delete this QR code? All scan data will be lost.'
      )
    ) {
      try {
        await deleteDoc(doc(db, 'scanLocations', id));
        setLocations(prev => prev.filter(loc => loc.id !== id));
      } catch (err) {
        console.error('Error deleting location:', err);
        alert('Failed to delete QR code');
      }
    }
  };

  const handleEditLocation = location => {
    setFormData({
      name: location.name,
      description: location.description || '',
      category: location.category || '',
      specificBoatId: location.specificBoatId || '',
      whatsappNumber: location.whatsappNumber || '',
      whatsappMessage: location.whatsappMessage || 'Hello! I saw your boat QR code and I\'m interested in learning more.'
    });
    setSelectedLocation(location.id);
    setViewMode('edit');
  };

  const downloadQrCode = id => {
    const container = document.getElementById(`qr-canvas-${id}`);
    const svg = container?.querySelector('svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], {
      type: 'image/svg+xml;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const location = locations.find(loc => loc.id === id);
    link.href = url;
    link.download = `qr-code-${location.name.replace(/\s+/g, '-').toLowerCase()}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // URL for the redirect function
  const TRACK_FN_URL = 'https://us-central1-crm-boats.cloudfunctions.net/trackAndRedirect';
  
  // Generate QR code URL with parameters
  const getQrCodeUrl = location => {
    let url = `${TRACK_FN_URL}?locationId=${location.id}`;
    
    if (location.category) {
      url += `&category=${encodeURIComponent(location.category)}`;
    }
    
    if (location.specificBoatId) {
      url += `&boat=${encodeURIComponent(location.specificBoatId)}`;
    }
    
    return url;
  };
    
  const fetchScanStats = async locationId => {
    try {
      // Get scan events
      const q = query(
        collection(db, 'locationScanEvents'),
        where('locationId', '==', locationId)
      );
      const snap = await getDocs(q);
      const scans = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Group scans by date
      const byDate = scans.reduce((acc, scan) => {
        const date = new Date(scan.timestamp?.toDate()).toLocaleDateString();
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {});
      
      setScanStats({
        total: scans.length,
        byDate,
        scans: scans.sort((a, b) => b.timestamp?.toDate() - a.timestamp?.toDate())
      });
      
      setSelectedLocation(locationId);
      setViewMode('stats');
    } catch (err) {
      console.error('Error fetching scan stats:', err);
      alert('Failed to fetch scan statistics');
    }
  };

  // ─── RENDER ───
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (viewMode === 'stats' && selectedLocation) {
    const location = locations.find(loc => loc.id === selectedLocation);
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">QR Code Statistics</h1>
          <button
            onClick={() => setViewMode('list')}
            className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300"
          >
            Back to QR Codes
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-2">{location.name}</h2>
          {location.description && (
            <p className="text-gray-600 mb-4">{location.description}</p>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-md">
              <h3 className="text-sm font-medium text-blue-700">Total Scans</h3>
              <p className="text-2xl font-bold">{scanStats?.total || 0}</p>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-md">
              <h3 className="text-sm font-medium text-blue-700">Scan to Visit Rate</h3>
              <p className="text-2xl font-bold">100%</p>
              <p className="text-xs text-blue-600">All scans redirect to your website</p>
            </div>
          </div>

          <h3 className="text-lg font-medium mb-2">Activity by Date</h3>
          <div className="bg-gray-50 p-4 rounded-md mb-6">
            {Object.keys(scanStats?.byDate || {}).length > 0 ? (
              Object.keys(scanStats.byDate).map(date => (
                <div key={date} className="flex justify-between mb-1">
                  <span>{date}</span>
                  <div>
                    <span className="font-medium">{scanStats.byDate[date]} scans</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500">No scan data available</p>
            )}
          </div>

          <h3 className="text-lg font-medium mb-2">Recent Scans</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white">
              <thead>
                <tr className="bg-gray-100">
                  <th className="py-2 px-4 text-left">Date & Time</th>
                  <th className="py-2 px-4 text-left">Device</th>
                </tr>
              </thead>
              <tbody>
                {scanStats?.scans?.length > 0 ? (
                  scanStats.scans.map(scan => (
                    <tr key={scan.id} className="border-t">
                      <td className="py-2 px-4">
                        {scan.timestamp?.toDate().toLocaleString()}
                      </td>
                      <td className="py-2 px-4 text-sm">
                        {scan.userAgent?.substring(0, 50) || 'Unknown'}...
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="2"
                      className="py-4 text-center text-gray-500"
                    >
                      No scan data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (viewMode === 'add' || viewMode === 'edit') {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">
            {viewMode === 'add' ? 'Add New QR Code' : 'Edit QR Code'}
          </h1>
          <button
            onClick={() => {
              setViewMode('list');
              setSelectedLocation(null);
              setFormData({
                name: '',
                description: '',
                category: '',
                specificBoatId: '',
                whatsappNumber: '',
                whatsappMessage: 'Hello! I saw your boat QR code and I\'m interested in learning more.'
              });
            }}
            className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="mb-4 p-4 bg-blue-50 rounded-md">
            <p className="text-sm text-blue-700">
              <strong>Note:</strong> QR codes will redirect users to the yacht rental page on justenjoyibizaboats.com
            </p>
          </div>

          <form onSubmit={viewMode === 'add' ? createLocation : updateLocation}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location Name
              </label>
              <input
                type="text"
                name="name"
                className="w-full p-2 border border-gray-300 rounded-md"
                placeholder="e.g., Marina Botafoch, Avenida Restaurant, Ibiza Town Kiosk"
                value={formData.name}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (optional)
              </label>
              <textarea
                name="description"
                className="w-full p-2 border border-gray-300 rounded-md"
                placeholder="Brief description of where this QR code will be placed"
                rows="2"
                value={formData.description}
                onChange={handleInputChange}
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Boat Category (optional)
              </label>
              <input
                type="text"
                name="category"
                className="w-full p-2 border border-gray-300 rounded-md"
                placeholder="e.g., yacht, speedboat, sailboat"
                value={formData.category}
                onChange={handleInputChange}
              />
              <p className="text-xs text-gray-500 mt-1">
                Will be used as a filter parameter on the yacht rental page
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Specific Boat ID (optional)
              </label>
              <input
                type="text"
                name="specificBoatId"
                className="w-full p-2 border border-gray-300 rounded-md"
                placeholder="e.g., sunseeker-predator-55"
                value={formData.specificBoatId}
                onChange={handleInputChange}
              />
              <p className="text-xs text-gray-500 mt-1">
                If provided, this specific boat will be highlighted on the yacht rental page
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                WhatsApp Contact Number (with country code)
              </label>
              <input
                type="text"
                name="whatsappNumber"
                className="w-full p-2 border border-gray-300 rounded-md"
                placeholder="e.g., +34612345678"
                value={formData.whatsappNumber}
                onChange={handleInputChange}
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default WhatsApp Message
              </label>
              <textarea
                name="whatsappMessage"
                className="w-full p-2 border border-gray-300 rounded-md"
                placeholder="Message that will be pre-filled when users click 'Contact Us'"
                rows="3"
                value={formData.whatsappMessage}
                onChange={handleInputChange}
              />
            </div>

            <button
              type="submit"
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              {viewMode === 'add' ? (
                <>
                  <PlusCircle size={18} className="mr-2" />
                  Create QR Code
                </>
              ) : (
                <>
                  <Edit size={18} className="mr-2" />
                  Update QR Code
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Default: list of locations
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Location QR Codes</h1>
        <button
          onClick={() => setViewMode('add')}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <PlusCircle size={18} className="mr-2" />
          Add New QR Code
        </button>
      </div>

      

      {locations.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <MapPin size={48} className="mx-auto mb-4 text-gray-400" />
          <h2 className="text-xl font-medium mb-2">No QR Codes Yet</h2>
          <p className="text-gray-500 mb-4">
            Create QR codes for different locations to track visits to your yacht rental page.
          </p>
          <button
            onClick={() => setViewMode('add')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Create Your First QR Code
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {locations.map(location => (
            <div
              key={location.id}
              className="bg-white rounded-lg shadow-md overflow-hidden"
            >
              <div className="p-4 border-b border-gray-100">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-lg">{location.name}</h3>
                    {location.description && (
                      <p className="text-sm text-gray-500 mt-1">{location.description}</p>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">
                    {location.scanCount || 0} scans
                  </div>
                </div>
              </div>

              <div
                id={`qr-canvas-${location.id}`}
                className="flex justify-center py-6 px-4 bg-gray-50"
              >
                <QRCodeSVG
                  value={getQrCodeUrl(location)}
                  size={150}
                  level="H"
                  includeMargin
                />
              </div>

              <div className="p-4 bg-white border-t border-gray-100">
                <div className="mb-3">
                  <a
                    href={`https://www.justenjoyibizaboats.com/yacht-rental.html`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center text-sm text-blue-600 hover:text-blue-800"
                  >
                    <ExternalLink size={14} className="mr-1" />
                    <span>Preview Destination</span>
                  </a>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => downloadQrCode(location.id)}
                    className="flex items-center px-3 py-1 bg-gray-200 rounded-md hover:bg-gray-300 text-sm"
                  >
                    <Download size={16} className="mr-1" />
                    Download QR
                  </button>
                  <button
                    onClick={() => fetchScanStats(location.id)}
                    className="flex items-center px-3 py-1 bg-gray-200 rounded-md hover:bg-gray-300 text-sm"
                  >
                    <History size={16} className="mr-1" />
                    Stats
                  </button>
                  <button
                    onClick={() => handleEditLocation(location)}
                    className="flex items-center px-3 py-1 bg-gray-200 rounded-md hover:bg-gray-300 text-sm"
                  >
                    <Edit size={16} className="mr-1" />
                    Edit
                  </button>
                  <button
                    onClick={() => deleteLocation(location.id)}
                    className="flex items-center px-3 py-1 bg-red-100 text-red-600 rounded-md hover:bg-red-200 text-sm"
                  >
                    <Trash2 size={16} className="mr-1" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BoatLocationQRManager;

