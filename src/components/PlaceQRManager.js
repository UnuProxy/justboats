import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { PlusCircle, Download, Trash2, History, Edit, MapPin, QrCode, Phone } from 'lucide-react';
import { collection, addDoc, query, where, getDocs, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from "../firebase/firebaseConfig";
import { useAuth } from '../context/AuthContext';

const PlaceQRManager = () => {
    const { user } = useAuth();
    const [places, setPlaces] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedPlace, setSelectedPlace] = useState(null);
    const [scanStats, setScanStats] = useState(null);
    const [viewMode, setViewMode] = useState('list'); // 'list', 'add', 'edit', 'stats'
    
    // New place form state
    const [formData, setFormData] = useState({
        name: '',
        type: 'restaurant', // restaurant, beach, club, etc.
        address: '',
        whatsappNumber: '',
        whatsappMessage: 'Hello! I just scanned the QR code at ${placeName}.'
    });
    
    const baseUrl = window.location.origin;

    useEffect(() => {
        fetchPlaces();
    }, [user]);

    const fetchPlaces = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, "places"), where("createdBy", "==", user.uid));
            const querySnapshot = await getDocs(q);
            
            const placesList = [];
            querySnapshot.forEach((doc) => {
                placesList.push({ id: doc.id, ...doc.data() });
            });
            
            setPlaces(placesList);
        } catch (error) {
            console.error("Error fetching places:", error);
        }
        setLoading(false);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value
        });
    };

    const createPlace = async (e) => {
        e.preventDefault();
        
        if (!formData.name.trim()) {
            alert("Please enter a name for the place");
            return;
        }

        if (!formData.whatsappNumber.trim()) {
            alert("Please enter a WhatsApp number");
            return;
        }

        try {
            // Clean the phone number (remove spaces, dashes, etc.)
            const cleanNumber = formData.whatsappNumber.replace(/\D/g, '');
            
            // Replace ${placeName} in the whatsapp message
            const processedMessage = formData.whatsappMessage.replace('${placeName}', formData.name);
            
            const docRef = await addDoc(collection(db, "places"), {
                name: formData.name,
                type: formData.type,
                address: formData.address,
                whatsappNumber: cleanNumber,
                whatsappMessage: processedMessage,
                createdBy: user.uid,
                createdAt: serverTimestamp(),
                scanCount: 0
            });
            
            setPlaces([...places, {
                id: docRef.id,
                name: formData.name,
                type: formData.type,
                address: formData.address,
                whatsappNumber: cleanNumber,
                whatsappMessage: processedMessage,
                createdBy: user.uid,
                scanCount: 0
            }]);
            
            // Reset form
            setFormData({
                name: '',
                type: 'restaurant',
                address: '',
                whatsappNumber: '',
                whatsappMessage: 'Hello! I just scanned the QR code at ${placeName}.'
            });
            
            setViewMode('list');
        } catch (error) {
            console.error("Error creating place:", error);
            alert("Failed to create place");
        }
    };

    const updatePlace = async (e) => {
        e.preventDefault();
        if (!selectedPlace) return;
        
        try {
            // Clean the phone number
            const cleanNumber = formData.whatsappNumber.replace(/\D/g, '');
            
            // Replace ${placeName} in the whatsapp message
            const processedMessage = formData.whatsappMessage.replace('${placeName}', formData.name);
            
            await updateDoc(doc(db, "places", selectedPlace), {
                name: formData.name,
                type: formData.type,
                address: formData.address,
                whatsappNumber: cleanNumber,
                whatsappMessage: processedMessage,
            });
            
            // Update local state
            setPlaces(places.map(place => 
                place.id === selectedPlace ? {
                    ...place,
                    name: formData.name,
                    type: formData.type,
                    address: formData.address,
                    whatsappNumber: cleanNumber,
                    whatsappMessage: processedMessage,
                } : place
            ));
            
            setViewMode('list');
            setSelectedPlace(null);
        } catch (error) {
            console.error("Error updating place:", error);
            alert("Failed to update place");
        }
    };

    const deletePlace = async (id) => {
        if (window.confirm("Are you sure you want to delete this place? All QR code data will be lost.")) {
            try {
                await deleteDoc(doc(db, "places", id));
                setPlaces(places.filter(place => place.id !== id));
            } catch (error) {
                console.error("Error deleting place:", error);
                alert("Failed to delete place");
            }
        }
    };

    const handleEditPlace = (place) => {
        setFormData({
            name: place.name,
            type: place.type || 'restaurant',
            address: place.address || '',
            whatsappNumber: place.whatsappNumber,
            whatsappMessage: place.whatsappMessage
        });
        setSelectedPlace(place.id);
        setViewMode('edit');
    };

    const downloadQrCode = (id) => {
        const canvas = document.getElementById(`qr-canvas-${id}`);
        if (!canvas) return;

        const place = places.find(p => p.id === id);
        if (!place) return;

        // Get the SVG element
        const svgElement = canvas.querySelector('svg');
        if (!svgElement) return;

        // Convert SVG to dataURL
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        // Create temporary link and trigger download
        const link = document.createElement('a');
        link.href = url;
        link.download = `qr-code-${place.name.replace(/\s+/g, '-').toLowerCase()}.svg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const fetchScanStats = async (placeId) => {
        try {
            const q = query(collection(db, "placeScanEvents"), where("placeId", "==", placeId));
            const querySnapshot = await getDocs(q);
            
            const scans = [];
            querySnapshot.forEach((doc) => {
                scans.push({ id: doc.id, ...doc.data() });
            });
            
            // Group by date for basic stats
            const scansByDate = scans.reduce((acc, scan) => {
                const date = new Date(scan.timestamp?.toDate()).toLocaleDateString();
                if (!acc[date]) {
                    acc[date] = 0;
                }
                acc[date]++;
                return acc;
            }, {});
            
            setScanStats({
                total: scans.length,
                byDate: scansByDate,
                scans: scans.sort((a, b) => b.timestamp - a.timestamp)
            });
            
            setSelectedPlace(placeId);
            setViewMode('stats');
        } catch (error) {
            console.error("Error fetching scan stats:", error);
            alert("Failed to fetch scan statistics");
        }
    };

    const getQrCodeUrl = (placeId) => {
        return `${baseUrl}/scan/${placeId}`;
    };

    // Render loading state
    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    // Render statistics view
    if (viewMode === 'stats' && selectedPlace) {
        const place = places.find(p => p.id === selectedPlace);
        
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold">Scan Statistics</h1>
                    <button 
                        onClick={() => setViewMode('list')}
                        className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300"
                    >
                        Back to Places
                    </button>
                </div>
                
                {place && (
                    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                        <h2 className="text-xl font-semibold mb-2">{place.name}</h2>
                        <p className="text-gray-600 mb-4">{place.type} • {place.address}</p>
                        <p className="mb-4 font-medium">Total Scans: {scanStats?.total || 0}</p>
                        
                        <h3 className="text-lg font-medium mb-2">Scans by Date</h3>
                        <div className="bg-gray-50 p-4 rounded-md mb-6">
                            {scanStats?.byDate && Object.entries(scanStats.byDate).length > 0 ? (
                                <div className="space-y-2">
                                    {Object.entries(scanStats.byDate).map(([date, count]) => (
                                        <div key={date} className="flex justify-between">
                                            <span>{date}</span>
                                            <span className="font-medium">{count} scans</span>
                                        </div>
                                    ))}
                                </div>
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
                                        <th className="py-2 px-4 text-left">Referrer</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {scanStats?.scans?.length > 0 ? (
                                        scanStats.scans.map((scan) => (
                                            <tr key={scan.id} className="border-t">
                                                <td className="py-2 px-4">
                                                    {scan.timestamp?.toDate().toLocaleString()}
                                                </td>
                                                <td className="py-2 px-4">{scan.userAgent || "Unknown"}</td>
                                                <td className="py-2 px-4">{scan.referrer || "Direct"}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="3" className="py-4 text-center text-gray-500">
                                                No scan data available
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Render form for adding a new place
    if (viewMode === 'add' || viewMode === 'edit') {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold">
                        {viewMode === 'add' ? 'Add New Place' : 'Edit Place'}
                    </h1>
                    <button 
                        onClick={() => {
                            setViewMode('list');
                            setSelectedPlace(null);
                            setFormData({
                                name: '',
                                type: 'restaurant',
                                address: '',
                                whatsappNumber: '',
                                whatsappMessage: 'Hello! I just scanned the QR code at ${placeName}.'
                            });
                        }}
                        className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300"
                    >
                        Cancel
                    </button>
                </div>
                
                <div className="bg-white rounded-lg shadow-md p-6">
                    <form onSubmit={viewMode === 'add' ? createPlace : updatePlace}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Place Name
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    className="w-full p-2 border border-gray-300 rounded-md"
                                    placeholder="e.g., Ocean Beach Club"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Place Type
                                </label>
                                <select
                                    name="type"
                                    className="w-full p-2 border border-gray-300 rounded-md"
                                    value={formData.type}
                                    onChange={handleInputChange}
                                >
                                    <option value="restaurant">Restaurant</option>
                                    <option value="beach">Beach</option>
                                    <option value="club">Club</option>
                                    <option value="hotel">Hotel</option>
                                    <option value="bar">Bar</option>
                                    <option value="attraction">Attraction</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                        </div>
                        
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Address
                            </label>
                            <input
                                type="text"
                                name="address"
                                className="w-full p-2 border border-gray-300 rounded-md"
                                placeholder="e.g., Calle Example 123, Ibiza"
                                value={formData.address}
                                onChange={handleInputChange}
                            />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    WhatsApp Number (with country code)
                                </label>
                                <input
                                    type="text"
                                    name="whatsappNumber"
                                    className="w-full p-2 border border-gray-300 rounded-md"
                                    placeholder="e.g., +34612345678"
                                    value={formData.whatsappNumber}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>
                        </div>
                        
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                WhatsApp Message Template
                            </label>
                            <textarea
                                name="whatsappMessage"
                                className="w-full p-2 border border-gray-300 rounded-md"
                                placeholder="Message to send when QR is scanned"
                                rows="3"
                                value={formData.whatsappMessage}
                                onChange={handleInputChange}
                            ></textarea>
                            <p className="text-xs text-gray-500 mt-1">
                                Use ${'{placeName}'} to automatically insert the place name in the message.
                            </p>
                        </div>
                        
                        <button
                            type="submit"
                            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                        >
                            {viewMode === 'add' ? (
                                <>
                                    <PlusCircle size={18} className="mr-2" />
                                    Create Place with QR Code
                                </>
                            ) : (
                                <>
                                    <Edit size={18} className="mr-2" />
                                    Update Place
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // Render list of places (default view)
    return (
        <div className="container mx-auto px-4 py-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Place QR Codes</h1>
                <button 
                    onClick={() => setViewMode('add')}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                    <PlusCircle size={18} className="mr-2" />
                    Add New Place
                </button>
            </div>
            
            {places.length === 0 ? (
                <div className="bg-white rounded-lg shadow-md p-6 text-center">
                    <QrCode size={48} className="mx-auto mb-4 text-gray-400" />
                    <h2 className="text-xl font-medium mb-2">No Places Yet</h2>
                    <p className="text-gray-500 mb-4">
                        Create your first place to generate a QR code that customers can scan.
                    </p>
                    <button 
                        onClick={() => setViewMode('add')}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                        Create Your First Place
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {places.map((place) => (
                        <div key={place.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                            <div className="p-4 border-b border-gray-100">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-semibold text-lg">{place.name}</h3>
                                        <div className="flex items-center text-sm text-gray-500 mt-1">
                                            <span className="capitalize">{place.type}</span>
                                            {place.address && (
                                                <>
                                                    <span className="mx-2">•</span>
                                                    <MapPin size={14} className="mr-1" />
                                                    <span className="truncate max-w-[150px]">{place.address}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-sm text-gray-500">
                                        {place.scanCount || 0} scans
                                    </div>
                                </div>
                            </div>
                            
                            <div 
                                id={`qr-canvas-${place.id}`} 
                                className="flex justify-center py-6 px-4 bg-gray-50"
                            >
                                <QRCodeSVG 
                                    value={getQrCodeUrl(place.id)}
                                    size={150}
                                    level="H"
                                    includeMargin={true}
                                />
                            </div>
                            
                            <div className="p-4 bg-white border-t border-gray-100">
                                <div className="text-sm text-gray-600 mb-3 flex items-center">
                                    <Phone size={14} className="mr-1" />
                                    <span>{place.whatsappNumber}</span>
                                </div>
                                
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => downloadQrCode(place.id)}
                                        className="flex items-center px-3 py-1 bg-gray-200 rounded-md hover:bg-gray-300 text-sm"
                                    >
                                        <Download size={16} className="mr-1" />
                                        Download
                                    </button>
                                    <button
                                        onClick={() => fetchScanStats(place.id)}
                                        className="flex items-center px-3 py-1 bg-gray-200 rounded-md hover:bg-gray-300 text-sm"
                                    >
                                        <History size={16} className="mr-1" />
                                        Stats
                                    </button>
                                    <button
                                        onClick={() => handleEditPlace(place)}
                                        className="flex items-center px-3 py-1 bg-gray-200 rounded-md hover:bg-gray-300 text-sm"
                                    >
                                        <Edit size={16} className="mr-1" />
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => deletePlace(place.id)}
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

export default PlaceQRManager;