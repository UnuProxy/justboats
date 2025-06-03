import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  PlusCircle,
  Download,
  Trash2,
  History,
  Edit,
  MapPin,
  ExternalLink,
  Copy
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

const LocationQRManager = () => {
  const { user } = useAuth();
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [scanStats, setScanStats] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list', 'add', 'edit', 'stats'
  const [useSimpleUrl, setUseSimpleUrl] = useState(false);

  // Form state - removed WhatsApp fields
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    address: ''
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
      return;
    }
    
    try {
      setLoading(true);
      
      const docRef = await addDoc(collection(db, 'scanLocations'), {
        name: formData.name,
        description: formData.description || '',
        category: formData.category || '',
        address: formData.address || '',
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
          address: formData.address || '',
          createdBy: user.uid,
          scanCount: 0,
          conversionCount: 0
        }
      ]);
      
      setFormData({
        name: '',
        description: '',
        category: '',
        address: ''
      });
      
      setViewMode('list');
    } catch (err) {
      console.error('Error creating location:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateLocation = async e => {
    e.preventDefault();
    if (!selectedLocation) return;
    
    try {
      setLoading(true);
      
      await updateDoc(doc(db, 'scanLocations', selectedLocation), {
        name: formData.name,
        description: formData.description || '',
        category: formData.category || '',
        address: formData.address || ''
      });
      
      setLocations(prev =>
        prev.map(loc =>
          loc.id === selectedLocation
            ? {
                ...loc,
                name: formData.name,
                description: formData.description || '',
                category: formData.category || '',
                address: formData.address || ''
              }
            : loc
        )
      );
      
      setViewMode('list');
      setSelectedLocation(null);
    } catch (err) {
      console.error('Error updating location:', err);
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
      }
    }
  };

  const handleEditLocation = location => {
    setFormData({
      name: location.name,
      description: location.description || '',
      category: location.category || '',
      address: location.address || ''
    });
    setSelectedLocation(location.id);
    setViewMode('edit');
  };

  const downloadQrCode = id => {
    const container = document.getElementById(`qr-canvas-${id}`);
    const svg = container?.querySelector('svg');
    if (!svg) return;
    
    const location = locations.find(loc => loc.id === id);
    const fileName = `qr-code-${location.name.replace(/\s+/g, '-').toLowerCase()}.jpg`;
    
    // Create canvas element
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size to match QR code size (200x200 + margins)
    canvas.width = 240;
    canvas.height = 240;
    
    // Fill with white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Convert SVG to image
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    
    const img = new Image();
    img.onload = () => {
      // Draw the QR code centered on canvas
      const padding = 20;
      ctx.drawImage(img, padding, padding, canvas.width - padding * 2, canvas.height - padding * 2);
      
      // Convert canvas to JPG and download
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        URL.revokeObjectURL(svgUrl);
      }, 'image/jpeg', 0.95); // 95% quality JPG
    };
    
    img.src = svgUrl;
  };

  // URL for the redirect function
  const TRACK_FN_URL = 'https://us-central1-crm-boats.cloudfunctions.net/trackAndRedirect';
  
  // Generate QR code URL with parameters (keeping your original structure)
  const getQrCodeUrl = location => {
    let url = `${TRACK_FN_URL}?locationId=${location.id}`;
    
    // Always include the location name
    url += `&name=${encodeURIComponent(location.name)}`;
    
    if (location.category) {
      url += `&category=${encodeURIComponent(location.category)}`;
    }
    
    if (location.address) {
      url += `&location=${encodeURIComponent(location.address)}`;
    }
    
    return url;
  };

  // Ultra-simple QR code URL - just the ID (optional for cleaner codes)
  const getSimpleQrCodeUrl = location => {
    return `${TRACK_FN_URL}?locationId=${location.id}`;
  };

  // Get the appropriate URL based on user preference
  const getFinalQrCodeUrl = location => {
    return useSimpleUrl ? getSimpleQrCodeUrl(location) : getQrCodeUrl(location);
  };

  // QR code complexity indicator
  const getQrCodeComplexity = (url) => {
    if (url.length < 50) return { level: 'Simple', color: 'green', description: 'Easy to scan' };
    if (url.length < 100) return { level: 'Medium', color: 'yellow', description: 'Good scanning' };
    return { level: 'Complex', color: 'red', description: 'May be harder to scan' };
  };

  // Copy URL to clipboard
  const copyUrlToClipboard = async (location) => {
    const url = getFinalQrCodeUrl(location);
    try {
      await navigator.clipboard.writeText(url);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
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
                address: ''
              });
            }}
            className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          
          <form onSubmit={viewMode === 'add' ? createLocation : updateLocation}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location Name
              </label>
              <input
                type="text"
                name="name"
                className="w-full p-2 border border-gray-300 rounded-md"
                placeholder="e.g., City Restaurant, Downtown Shop, Main Street Billboard"
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
                Category (optional)
              </label>
              <select
                name="category"
                className="w-full p-2 border border-gray-300 rounded-md"
                value={formData.category}
                onChange={handleInputChange}
              >
                <option value="">Select a category</option>
                <option value="restaurant">Restaurant</option>
                <option value="cafe">Café</option>
                <option value="shop">Shop</option>
                <option value="hotel">Hotel</option>
                <option value="billboard">Billboard</option>
                <option value="business">Business</option>
                <option value="event">Event</option>
                <option value="other">Other</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Will be used as a parameter to customize the landing page
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address (optional)
              </label>
              <input
                type="text"
                name="address"
                className="w-full p-2 border border-gray-300 rounded-md"
                placeholder="e.g., 123 Main St, New York, NY"
                value={formData.address}
                onChange={handleInputChange}
              />
              <p className="text-xs text-gray-500 mt-1">
                Physical location where this QR code will be placed
              </p>
            </div>

            {/* QR Code Options */}
            <div className="mb-6 p-4 bg-gray-50 rounded-md">
              <h3 className="text-sm font-medium text-gray-700 mb-3">QR Code Options</h3>
              <div className="mb-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={useSimpleUrl}
                    onChange={(e) => setUseSimpleUrl(e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-sm">Generate simple QR codes (recommended for better scanning)</span>
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  Simple codes only include the location ID. Additional data will be fetched server-side.
                </p>
              </div>
              
              {/* Preview URL length if form has data */}
              {formData.name && (
                <div className="text-xs text-gray-600">
                  <p>Preview URL length: ~{useSimpleUrl ? 80 : 80 + (formData.name?.length || 0) + (formData.category?.length || 0)} characters</p>
                  <p className={useSimpleUrl ? 'text-green-600' : formData.name.length > 20 ? 'text-red-600' : 'text-yellow-600'}>
                    {useSimpleUrl ? '✓ Simple QR code - Easy to scan' : 
                     formData.name.length > 20 ? '⚠ Complex QR code - May be harder to scan' : 
                     '◐ Medium QR code - Good scanning'}
                  </p>
                </div>
              )}
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
        <div className="flex gap-2">
          <label className="flex items-center text-sm">
            <input
              type="checkbox"
              checked={useSimpleUrl}
              onChange={(e) => setUseSimpleUrl(e.target.checked)}
              className="mr-2"
            />
            Simple QR codes
          </label>
          <button
            onClick={() => setViewMode('add')}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <PlusCircle size={18} className="mr-2" />
            Add New QR Code
          </button>
        </div>
      </div>

      {locations.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <MapPin size={48} className="mx-auto mb-4 text-gray-400" />
          <h2 className="text-xl font-medium mb-2">No QR Codes Yet</h2>
          <p className="text-gray-500 mb-4">
            Create QR codes for different locations to track visits to your website.
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
          {locations.map(location => {
            const qrUrl = getFinalQrCodeUrl(location);
            const complexity = getQrCodeComplexity(qrUrl);
            
            return (
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
                      {location.category && (
                        <span className="inline-block px-2 py-1 mt-2 text-xs bg-blue-100 text-blue-800 rounded-full">
                          {location.category}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      {location.scanCount || 0} scans
                    </div>
                  </div>
                </div>

                <div
                  id={`qr-canvas-${location.id}`}
                  className="flex flex-col items-center py-6 px-4 bg-gray-50"
                >
                  <QRCodeSVG
                    value={qrUrl}
                    size={200}                    // Increased size for better scanning
                    level={useSimpleUrl ? "L" : "M"}  // Low error correction for simple, Medium for detailed
                    includeMargin={true}
                    fgColor="#000000"            // Black foreground
                    bgColor="#FFFFFF"            // White background
                  />
                  
                  {/* URL Quality Indicator */}
                  <div className="mt-3 text-center">
                    <div className="text-xs text-gray-500">
                      URL Length: {qrUrl.length} chars
                    </div>
                    <div className={`text-xs font-medium ${
                      complexity.color === 'green' ? 'text-green-600' : 
                      complexity.color === 'yellow' ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {complexity.level} - {complexity.description}
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-white border-t border-gray-100">
                  <div className="mb-3">
                    <a
                      href={qrUrl}
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
                      Download
                    </button>
                    <button
                      onClick={() => copyUrlToClipboard(location)}
                      className="flex items-center px-3 py-1 bg-green-100 text-green-600 rounded-md hover:bg-green-200 text-sm"
                    >
                      <Copy size={16} className="mr-1" />
                      Copy URL
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
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LocationQRManager;

