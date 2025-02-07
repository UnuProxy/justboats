import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from "../firebase/firebaseConfig";
import { Search, Filter } from 'lucide-react';

const BoatFinder = () => {
    const [boats, setBoats] = useState([]);
    const [loading, setLoating] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({
        type: '',
        location: '',
        minPrice: '',
        maxPrice: '',
        company: ''
    });

    useEffect(() => {
        const fetchBoats = async () => {
            try {
                setLoating(true);
                // Fetch boats from Firebase (external_boats collection)
                const boatsRef = collection(db, 'external_boats');
                const boatsSnapshot = await getDocs(boatsRef);
                const boatsFromFirebase = boatsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    source: 'firebase',
                    ...doc.data()
                }));

               

                // Combine all boat sources
                const allBoats = [
                    ...boatsFromFirebase,
                    // ...partnerBoats.flat()
                ];

                setBoats(allBoats);
            } catch (error) {
                console.error('Error fetching boats:', error);
                setError(error.message);
            } finally {
                setLoating(false);
            }
        };

        fetchBoats();
    }, []);

    // Example function to fetch from partner API
    // const fetchPartnerBoats = async (partnerId) => {
    //     const response = await fetch(`https://api.partner.com/boats`);
    //     const data = await response.json();
    //     return data.map(boat => ({
    //         ...boat,
    //         source: partnerId
    //     }));
    // };

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const filteredBoats = boats.filter(boat => {
        const matchesSearch = boat.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            boat.company?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = !filters.type || boat.type === filters.type;
        const matchesLocation = !filters.location || boat.location === filters.location;
        const matchesCompany = !filters.company || boat.company === filters.company;
        const matchesPrice = (!filters.minPrice || boat.price >= Number(filters.minPrice)) &&
                           (!filters.maxPrice || boat.price <= Number(filters.maxPrice));

        return matchesSearch && matchesType && matchesLocation && matchesCompany && matchesPrice;
    });

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-red-500 p-4">
                Error: {error}
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Available Partner Boats</h1>
            </div>

            {/* Search and Filters */}
            <div className="mb-6 space-y-4">
                <div className="flex items-center gap-4">
                    <div className="relative flex-1">
                        <input
                            type="text"
                            placeholder="Search boats..."
                            className="w-full p-2 pl-10 border rounded-lg"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
                    </div>
                    <Filter className="text-gray-600" size={24} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <select
                        name="type"
                        value={filters.type}
                        onChange={handleFilterChange}
                        className="p-2 border rounded-lg"
                    >
                        <option value="">Boat Type</option>
                        {[...new Set(boats.map(boat => boat.type))].map(type => (
                            <option key={type} value={type}>{type}</option>
                        ))}
                    </select>

                    <select
                        name="location"
                        value={filters.location}
                        onChange={handleFilterChange}
                        className="p-2 border rounded-lg"
                    >
                        <option value="">Location</option>
                        {[...new Set(boats.map(boat => boat.location))].map(location => (
                            <option key={location} value={location}>{location}</option>
                        ))}
                    </select>

                    <div className="flex gap-2">
                        <input
                            type="number"
                            name="minPrice"
                            placeholder="Min €"
                            value={filters.minPrice}
                            onChange={handleFilterChange}
                            className="p-2 border rounded-lg w-1/2"
                        />
                        <input
                            type="number"
                            name="maxPrice"
                            placeholder="Max €"
                            value={filters.maxPrice}
                            onChange={handleFilterChange}
                            className="p-2 border rounded-lg w-1/2"
                        />
                    </div>
                </div>
            </div>

            {/* Boat Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredBoats.map((boat) => (
                    <div key={boat.id} className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
                        <div className="relative w-full h-64">
                            <img
                                src={boat.images?.[0] || boat.image}
                                alt={boat.name}
                                className="w-full h-full object-cover rounded-t-lg"
                            />
                        </div>
                        <div className="p-6">
                            <h2 className="text-2xl font-semibold mb-4">{boat.name}</h2>
                            <div className="space-y-2 text-gray-600">
                                <p className="text-base">
                                    <span className="font-medium">Company:</span> {boat.company}
                                </p>
                                <p className="text-base">
                                    <span className="font-medium">Type:</span> {boat.type}
                                </p>
                                <p className="text-base">
                                    <span className="font-medium">Location:</span> {boat.location}
                                </p>
                                <p className="text-base">
                                    <span className="font-medium">Price:</span> {boat.price}€/day
                                </p>
                            </div>
                            <a
                                href={boat.bookingUrl || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-4 w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors inline-block text-center"
                            >
                                Check Availability
                            </a>
                        </div>
                    </div>
                ))}
            </div>

            {filteredBoats.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                    No boats found matching your criteria
                </div>
            )}
        </div>
    );
};

export default BoatFinder;