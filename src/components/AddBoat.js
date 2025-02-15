import React, { useState, useEffect } from 'react';
import { collection, addDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from "../firebase/firebaseConfig";
import { useNavigate, useParams } from 'react-router-dom';

const CheckboxGroup = ({ title, items, values, onChange }) => (
    <div className="space-y-3">
        <h3 className="text-lg font-medium">{title}</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(items).map(([key, label]) => (
                <div key={key} className="flex items-center space-x-2">
                    <input
                        type="checkbox"
                        id={key}
                        checked={values[key] || false}
                        onChange={(e) => onChange(null, key, e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                    />
                    <label htmlFor={key} className="text-sm text-gray-700">
                        {label}
                    </label>
                </div>
            ))}
        </div>
    </div>
);


const AddBoat = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [imageFiles, setImageFiles] = useState([]);
    const [imagePreviews, setImagePreviews] = useState([]);
    const MAX_IMAGES = 12;
    const [isEditing, setIsEditing] = useState(false);

    const initialBoatState = {
        // Basic Information
        icalUrl: '',
        name: '',
        images: [],
        specs: '',
        price: '',
        cruisingArea: '',
        description: '',

        // Detailed Specifications
        detailedSpecs: {
            Length: '',
            Guests: '',
            Crew: '',
            'Cruising Area': '',
            Price: '',
            'Cruising Speed': '',
            'Max Speed': '',
            Class: '',
            Engine: '',
            HP: '',
            Cabins: ''
        },

        // Seasonal Prices
        seasonalPrices: {
            'May / October': '',
            'June / September': '',
            'July / August': ''
        },

        // Equipment
        equipment: {
            tenders: {
                limousineTenders: false,
                regularTenders: false,
                tenderCount: ''
            },
            jacuzziAndPool: {
                deckJacuzzi: false,
                deckJacuzziCount: '',
                pool: false,
                antiJellyfishPool: false,
                aquapark: false,
                inflatablePlatform: false
            }
        },

        // Water Sports
        waterSports: {
            jetSkis: {
                waverunners: false,
                waverunnerCount: '',
                standUpJetskis: false,
                standUpJetskiCount: ''
            },
            seaBobs: {
                hasSeaBobs: false,
                seaBobCount: ''
            },
            eFoils: {
                hasEFoils: false,
                eFoilCount: ''
            },
            waterToys: {
                paddleboards: false,
                paddleboardCount: '',
                wakeboard: false,
                waterSkis: false,
                kayaks: false,
                inflatableTows: false,
                waterScooter: false,
                kneeBoard: false,
                windsurf: false
            },
            diving: {
                scubaDiving: false,
                snorkelingGear: false,
                fishingGear: false
            },
            inflatables: {
                hasInflatables: false,
                trampoline: false
            }
        },

        // Amenities
        amenities: {
            entertainment: {
                wifi: false,
                satellite: false,
                appleTV: false,
                sonos: false,
                indoorCinema: false,
                outdoorCinema: false,
                ipodDockingStation: false,
                gameConsole: false
            },
            comfort: {
                airConditioning: false,
                heating: false,
                stabilizers: false,
                deck: {
                    sunAwning: false,
                    outdoorBar: false,
                    outdoorDining: false,
                    outdoorLounge: false,
                    sunpads: false,
                    sundeckShower: false
                }
            },
            wellness: {
                gym: false,
                gymEquipment: false,
                spa: false,
                massage: false,
                sauna: false,
                steamRoom: false,
                beautyRoom: false
            },
            dining: {
                formalDiningArea: false,
                casualDiningArea: false,
                alFrescoDining: false,
                profesionalGalley: false,
                wineStorage: false,
                bbqGrill: false
            },
            kids: {
                childFriendly: false,
                babyEquipment: false,
                childProtectionGates: false,
                toysAndGames: false
            },
            access: {
                wheelchairAccessible: false,
                elevatorLift: false,
                disabledFacilities: false
            }
        },

        // Additional Features
        additional: {
            safety: {
                lifeJackets: false,
                firstAidKit: false,
                emergencyFlares: false,
                fireExtinguishers: false,
                emergencyRadio: false,
                epirb: false
            },
            crew: {
                captain: false,
                chef: false,
                steward: false,
                deckhand: false,
                engineer: false,
                masseur: false
            },
            services: {
                concierge: false,
                security: false,
                housekeeping: false,
                laundry: false,
                breakfast: false,
                lunch: false,
                dinner: false,
                barService: false
            }
        }
    };

    const [boatData, setBoatData] = useState(initialBoatState);

    useEffect(() => {
        if (id) {
            setIsEditing(true);
            const fetchBoatDetails = async () => {
                setLoading(true);
                try {
                     const boatDoc = await getDoc(doc(db, 'boats', id));
                     if (boatDoc.exists()) {
                        const data = boatDoc.data();
                        setBoatData({ id: boatDoc.id, ...data });
                        setImagePreviews(data.images || []);
                        setImageFiles(data.images || []); // Initialize imageFiles with existing URLs
                     } else {
                         setError("Boat not found");
                    }
                } catch (err) {
                    setError(err.message);
                } finally {
                    setLoading(false);
                }
            };
            fetchBoatDetails();
        } else {
            setBoatData(initialBoatState);
            setImageFiles([]);
            setImagePreviews([]);
            setIsEditing(false);
        }
    }, [id]);

    const handleImageChange = (e) => {
        const files = Array.from(e.target.files);
        const remainingSlots = MAX_IMAGES - imageFiles.length;
        const filesToAdd = files.slice(0, remainingSlots);

        if (imageFiles.length + files.length > MAX_IMAGES) {
            alert(`You can only upload up to ${MAX_IMAGES} images. ${remainingSlots} slots remaining.`);
        }

        filesToAdd.forEach(file => {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreviews(prev => [...prev, reader.result]);
            };
            reader.readAsDataURL(file);
        });

        setImageFiles(prev => [...prev, ...filesToAdd]);
    };

    const removeImage = (index) => {
        setImageFiles(prev => prev.filter((_, i) => i !== index));
        setImagePreviews(prev => prev.filter((_, i) => i !== index));
    };

    // First, modify the handleInputChange function to handle nested objects better:
const handleInputChange = (e, section = null) => {
    const { name, value } = e.target;
    
    setBoatData(prev => {
        // Handle doubly nested sections (e.g., 'amenities.comfort.deck')
        if (section && section.includes('.')) {
            const parts = section.split('.');
            if (parts.length === 3) {
                // Handle triple nesting (e.g., amenities.comfort.deck)
                const [mainSection, subSection, subSubSection] = parts;
                return {
                    ...prev,
                    [mainSection]: {
                        ...prev[mainSection],
                        [subSection]: {
                            ...prev[mainSection][subSection],
                            [subSubSection]: {
                                ...prev[mainSection][subSection][subSubSection],
                                [name]: value
                            }
                        }
                    }
                };
            } else {
                // Handle double nesting
                const [mainSection, subSection] = parts;
                return {
                    ...prev,
                    [mainSection]: {
                        ...prev[mainSection],
                        [subSection]: {
                            ...prev[mainSection][subSection],
                            [name]: value
                        }
                    }
                };
            }
        }
        
        // Handle single-level nesting
        if (section) {
            return {
                ...prev,
                [section]: {
                    ...prev[section],
                    [name]: value
                }
            };
        }
        
        // Handle top-level fields
        return {
            ...prev,
            [name]: value
        };
    });
};

    const uploadImages = async (files) => {
        const uploadPromises = files.map(async (file) => {
            try {
                const storageRef = ref(storage, `boats/${Date.now()}_${file.name}`);
                await uploadBytes(storageRef, file);
                return getDownloadURL(storageRef);
            } catch (error) {
                console.error('Error uploading image:', error);
                throw error;
            }
        });

        return Promise.all(uploadPromises);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
    
        try {
            const newImageUrls = await uploadImages(imageFiles.filter(file => typeof file !== 'string'));
    
            let finalImageUrls = [];
            if (isEditing && boatData.images) {
                const existingImageUrls = Array.isArray(boatData.images)
                    ? boatData.images.filter(url => imagePreviews.includes(url))
                    : [];
                finalImageUrls = [...existingImageUrls, ...newImageUrls];
            } else {
                finalImageUrls = newImageUrls;
            }
    
            const boatDataToSave = {
                ...boatData,
                images: finalImageUrls,
                availabilityType: boatData.icalUrl ? 'ical' : 'manual', // Add this line
                updatedAt: new Date()
            };
    
            if (isEditing) {
                const boatRef = doc(db, 'boats', id);
                await updateDoc(boatRef, boatDataToSave);
            } else {
                const boatsRef = collection(db, 'boats');
                await addDoc(boatsRef, {
                    ...boatDataToSave,
                    createdAt: new Date()
                });
            }
            navigate('/boats');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const placeholders = {
        description: "Enter a detailed description of the boat, including its key features, amenities, and unique characteristics...",
        specs: {
            Length: "e.g., 32.92m",
            Guests: "e.g., 12",
            Crew: "e.g., 3",
            'Cruising Area': "e.g., Balearics",
            Price: "e.g., €11,000 per day",
            'Cruising Speed': "e.g., 28 knots",
            'Max Speed': "e.g., 36 knots",
            Class: "e.g., Motoryacht",
            Engine: "e.g., 2 x MTU 12V 4000 M90",
            HP: "e.g., 5,470",
            Cabins: "e.g., 4 (2 Master, 2 Twin)"
        },
        seasonalPrices: {
            'May / October': "e.g., €11,000 per day",
            'June / September': "e.g., €11,000 per day",
            'July / August': "e.g., €13,750 per day"
        }
    };

     return (
        <div className="container mx-auto p-4 max-w-3xl">
            <h1 className="text-2xl font-bold mb-6">{isEditing ? 'Edit Boat' : 'Add New Boat'}</h1>

            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold">Basic Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Name</label>
                            <input
                                type="text"
                                name="name"
                                value={boatData.name}
                                onChange={handleInputChange}
                                placeholder="e.g., Mangusta 108"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Boat Images</label>
                            <div className="mt-1 space-y-4">
                                <div className="flex items-center justify-between">
                                    <label className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                                        <span>Upload Images ({imageFiles.length}/{MAX_IMAGES})</span>
                                        <input
                                            type="file"
                                            className="hidden"
                                            accept="image/*"
                                            multiple
                                            onChange={handleImageChange}
                                            disabled={imageFiles.length >= MAX_IMAGES}
                                        />
                                    </label>
                                    <span className="text-sm text-gray-500">
                                        {MAX_IMAGES - imageFiles.length} slots remaining
                                    </span>
                                </div>
                                {loading ? (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                                    {/* Skeleton preview images while loading */}
                                        {[...Array(12)].map((_, index) => (
                                           <div key={index} className="relative group bg-gray-100 rounded-lg w-full h-24 animate-pulse">
                                          </div>
                                        ))}
                                  </div>
                                ) : (
                                    imagePreviews.length > 0 && (
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                                            {imagePreviews.map((preview, index) => (
                                                <div key={index} className="relative group">
                                                    <img
                                                        src={preview}
                                                        alt={`Preview ${index + 1}`}
                                                        className="w-full h-24 object-cover rounded-lg"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => removeImage(index)}
                                                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Description</label>
                        <textarea
                            name="description"
                            value={boatData.description}
                            onChange={handleInputChange}
                            placeholder={placeholders.description}
                            rows="4"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                    </div>
                </div>

                <div className="space-y-4">
                    <h2 className="text-xl font-semibold">Detailed Specifications</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.keys(boatData.detailedSpecs).map(spec => (
                        <div key={spec}>
                            <label className="block text-sm font-medium text-gray-700">{spec}</label>
                            <input
                                type="text"
                                name={spec}
                                value={boatData.detailedSpecs[spec]}
                                onChange={(e) => handleInputChange(e, 'detailedSpecs')}
                                placeholder={placeholders.specs[spec]}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            />
                        </div>
                    ))}
                    </div>
                </div>

                <div className="space-y-4">
                    <h2 className="text-xl font-semibold">Seasonal Prices</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.keys(boatData.seasonalPrices).map(season => (
                            <div key={season}>
                                <label className="block text-sm font-medium text-gray-700">{season}</label>
                                <input
                                    type="text"
                                    name={season}
                                    value={boatData.seasonalPrices[season]}
                                    onChange={(e) => handleInputChange(e, 'seasonalPrices')}
                                    placeholder={placeholders.seasonalPrices[season]}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Add this inside your form, after the Seasonal Prices section */}
{/* Entertainment Section */}
<div className="space-y-4 border-b pb-6">
    <CheckboxGroup
        title="Entertainment"
        items={{
            wifi: "Wi-Fi",
            satellite: "Satellite TV",
            appleTV: "Apple TV",
            sonos: "Sonos Sound System",
            indoorCinema: "Indoor Cinema",
            outdoorCinema: "Outdoor Cinema",
            ipodDockingStation: "iPod Docking",
            gameConsole: "Game Console"
        }}
        values={boatData.amenities.entertainment}
        onChange={(section, key, value) => 
            handleInputChange({
                target: {
                    name: key,
                    value
                }
            }, 'amenities.entertainment')}
    />
</div>

{/* Comfort & Deck */}
<div className="space-y-4 border-b pb-6">
    <h3 className="text-lg font-medium">Comfort & Deck Features</h3>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CheckboxGroup
            title="Indoor Comfort"
            items={{
                airConditioning: "Air Conditioning",
                heating: "Heating",
                stabilisers: "Stabilisers"
            }}
            values={boatData.amenities.comfort}
            onChange={(section, key, value) => 
                handleInputChange({
                    target: {
                        name: key,
                        value
                    }
                }, 'amenities.comfort')}
        />
        <CheckboxGroup
    title="Deck Features"
    items={{
        sunAwning: "Sun Awning",
        outdoorBar: "Outdoor Bar",
        outdoorDining: "Outdoor Dining",
        outdoorLounge: "Outdoor Lounge Area",
        sunpads: "Sunpads",
        sundeckShower: "Sundeck Shower"
    }}
    values={boatData.amenities.comfort.deck}
    onChange={(_, key, value) => 
        handleInputChange({
            target: {
                name: key,
                value
            }
        }, 'amenities.comfort.deck')} 
/>
    </div>
</div>

{/* Dining */}
<div className="space-y-4 border-b pb-6">
    <CheckboxGroup
        title="Dining Facilities"
        items={{
            formalDiningArea: "Formal Dining Area",
            casualDiningArea: "Casual Dining Area",
            alFrescoDining: "Al Fresco Dining",
            profesionalGalley: "Professional Galley",
            wineStorage: "Wine Storage",
            bbqGrill: "BBQ Grill"
        }}
        values={boatData.amenities.dining}
        onChange={(section, key, value) => 
            handleInputChange({
                target: {
                    name: key,
                    value
                }
            }, 'amenities.dining')}
    />
</div>

{/* Wellness */}
<div className="space-y-4 border-b pb-6">
    <CheckboxGroup
        title="Wellness & Fitness"
        items={{
            gym: "Gym",
            gymEquipment: "Gym Equipment",
            spa: "Spa",
            massage: "Massage Room",
            sauna: "Sauna",
            steamRoom: "Steam Room",
            beautyRoom: "Beauty Room"
        }}
        values={boatData.amenities.wellness}
        onChange={(section, key, value) => 
            handleInputChange({
                target: {
                    name: key,
                    value
                }
            }, 'amenities.wellness')}
    />
</div>

{/* Kids */}
<div className="space-y-4 border-b pb-6">
    <CheckboxGroup
        title="Kids Amenities"
        items={{
            childFriendly: "Child Friendly",
            babyEquipment: "Baby Equipment",
            childProtectionGates: "Child Protection Gates",
            toysAndGames: "Toys and Games"
        }}
        values={boatData.amenities.kids}
        onChange={(section, key, value) => 
            handleInputChange({
                target: {
                    name: key,
                    value
                }
            }, 'amenities.kids')}
    />
</div>

{/* Accessibility */}
<div className="space-y-4 border-b pb-6">
    <CheckboxGroup
        title="Accessibility"
        items={{
            wheelchairAccessible: "Wheelchair Accessible",
            elevatorLift: "Elevator/Lift",
            disabledFacilities: "Disabled Facilities"
        }}
        values={boatData.amenities.access}
        onChange={(section, key, value) => 
            handleInputChange({
                target: {
                    name: key,
                    value
                }
            }, 'amenities.access')}
    />
</div>

{/* Additional Services */}
<div className="space-y-4 border-b pb-6">
    <h3 className="text-lg font-medium">Additional Services</h3>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <CheckboxGroup
            title="Crew"
            items={{
                captain: "Captain",
                chef: "Chef",
                steward: "Steward",
                deckhand: "Deckhand",
                engineer: "Engineer",
                masseur: "Masseur"
            }}
            values={boatData.additional.crew}
            onChange={(section, key, value) => 
                handleInputChange({
                    target: {
                        name: key,
                        value
                    }
                }, 'additional.crew')}
        />
        <CheckboxGroup
            title="Services"
            items={{
                concierge: "Concierge",
                security: "Security",
                housekeeping: "Housekeeping",
                laundry: "Laundry",
                breakfast: "Breakfast",
                lunch: "Lunch",
                dinner: "Dinner",
                barService: "Bar Service"
            }}
            values={boatData.additional.services}
            onChange={(section, key, value) => 
                handleInputChange({
                    target: {
                        name: key,
                        value
                    }
                }, 'additional.services')}
        />
    </div>
</div>

{/* Safety */}
<div className="space-y-4">
    <CheckboxGroup
        title="Safety Equipment"
        items={{
            lifeJackets: "Life Jackets",
            firstAidKit: "First Aid Kit",
            emergencyFlares: "Emergency Flares",
            fireExtinguishers: "Fire Extinguishers",
            emergencyRadio: "Emergency Radio",
            epirb: "EPIRB"
        }}
        values={boatData.additional.safety}
        onChange={(section, key, value) => 
            handleInputChange({
                target: {
                    name: key,
                    value
                }
            }, 'additional.safety')}
    />
</div>


{/* iCal Calendar Integration */}
<div className="space-y-4 border-b pb-6">
    <h3 className="text-lg font-medium">Calendar Integration</h3>
    <div>
        <label className="block text-sm font-medium text-gray-700">iCal Calendar URL (Optional)</label>
        <input
            type="url"
            name="icalUrl"
            value={boatData.icalUrl || ''}
            onChange={handleInputChange}
            placeholder="https://example.com/calendar.ics"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
        <p className="mt-1 text-sm text-gray-500">
            Add a calendar URL to sync boat availability
        </p>
    </div>
</div>

                <div className="flex justify-end space-x-4">
                    <button
                        type="button"
                        onClick={() => navigate('/boats')}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md shadow-sm hover:bg-blue-700 disabled:opacity-50"
                    >
                        {loading ? (isEditing ? 'Updating...' : 'Adding...') : (isEditing ? 'Update Boat' : 'Add Boat')}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AddBoat;