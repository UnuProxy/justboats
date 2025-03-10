import React, { useState, useEffect } from 'react';
import { 
    Menu, X, Calendar, PlusCircle, Users, LogOut, BarChart3,
    User, Wallet, CreditCard, Euro, Ship, MessageSquare,
    Settings, Building, ChevronDown, ChevronUp, Utensils, Package, Box, ShoppingCart, FileText,
    Star, StarOff
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

const Sidebar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, userRole, isAdmin, logout } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [expandedGroup, setExpandedGroup] = useState(null);
    
    // User-specific favorites with unique storage key
    const favoritesStorageKey = `favorites_${user?.uid || 'guest'}`;
    const [favorites, setFavorites] = useState(() => {
        const savedFavorites = localStorage.getItem(favoritesStorageKey);
        return savedFavorites ? JSON.parse(savedFavorites) : [];
    });

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
            if (window.innerWidth > 768) {
                setIsOpen(true);
            }
        };
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    
    // Save favorites to localStorage when they change
    useEffect(() => {
        localStorage.setItem(favoritesStorageKey, JSON.stringify(favorites));
    }, [favorites, favoritesStorageKey]);

    const toggleSidebar = () => setIsOpen(!isOpen);
    const toggleGroup = (group) => {
        setExpandedGroup(expandedGroup === group ? null : group);
    };

    const handleNavClick = (path) => {
        navigate(path);
        if (isMobile) {
            setIsOpen(false);
        }
    };

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/login');
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };
    
    // Favorite functions
    const addToFavorites = (item) => {
        if (!favorites.some(fav => fav.path === item.path)) {
            setFavorites([...favorites, item]);
        }
    };
    
    const removeFromFavorites = (path) => {
        setFavorites(favorites.filter(item => item.path !== path));
    };
    
    const isFavorite = (path) => {
        return favorites.some(item => item.path === path);
    };

    // Basic navigation for regular users
    const navigationGroups = [
        {
            id: 'bookings',
            title: "Trips & Tours",
            icon: Calendar,
            items: [
                {
                    name: 'Upcoming Bookings',
                    icon: Calendar,
                    path: '/bookings',
                    allowed: true
                },
                {
                    name: 'San Antonio Tours',
                    icon: Ship,
                    path: '/san-antonio-tours',
                    allowed: true
                }
            ]
        }
    ];
    
    // Add full navigation for admin users
    if (isAdmin()) {
        navigationGroups.length = 0; // Clear basic navigation
        
        // Full navigation structure for admins
        navigationGroups.push(
            {
                id: 'bookings',
                title: "Bookings & Calendar",
                icon: Calendar,
                items: [
                    {
                        name: 'Add New Booking',
                        icon: PlusCircle,
                        path: '/add-booking',
                        allowed: true
                    },
                    {
                        name: 'Upcoming Bookings',
                        icon: Calendar,
                        path: '/bookings',
                        allowed: true
                    },
                    {
                        name: 'San Antonio Tours',
                        icon: Ship,
                        path: '/san-antonio-tours',
                        allowed: true
                    }
                ]
            },
            {
                id: 'fleet',
                title: "Boats",
                icon: Ship,
                items: [
                    {
                        name: 'Boat Fleet',
                        icon: Ship,
                        path: '/boats',
                        allowed: true
                    },
                    {
                        name: 'Available Boats',
                        icon: Ship,
                        path: '/available-boats',
                        allowed: true
                    },
                ]
            },
            {
                id: 'customers',
                title: "Customer Relations",
                icon: Users,
                items: [
                    {
                        name: 'Client Directory',
                        icon: Users,
                        path: '/clients',
                        allowed: true
                    },
                    {
                        name: 'Manage Partners',
                        icon: Building,
                        path: '/manage-partners',
                        allowed: true
                    }
                ]
            },
            {
                id: 'support',
                title: "Customer Support",
                icon: MessageSquare,
                items: [
                    {
                        name: 'Inquiries & Leads',
                        icon: MessageSquare,
                        path: '/inquiries',
                        allowed: true
                    },
                    {
                        name: 'Chatbot Conversations',
                        icon: MessageSquare,
                        path: '/chatbot-settings',
                        allowed: true
                    }
                ]
            },
            {
                id: 'catering',
                title: "Food & Beverages",
                icon: Utensils,
                items: [
                    {
                        name: 'Add Product',
                        icon: PlusCircle,
                        path: '/add-product',
                        allowed: true
                    },
                    {
                        name: 'Products List',
                        icon: Package,
                        path: '/products',
                        allowed: true
                    },
                    {
                        name: 'Packages',
                        icon: Box,
                        path: '/packages',
                        allowed: true
                    },
                    {
                        name: 'Orders',
                        icon: ShoppingCart,
                        path: '/catering-orders',
                        allowed: true
                    }
                ]
            },
            {
                id: 'financial',
                title: "Finance & Payments",
                icon: Euro,
                items: [
                    {
                        name: 'Payment Tracking',
                        icon: CreditCard,
                        path: '/payment-tracking',
                        allowed: true
                    },
                    {
                        name: 'Invoice',
                        icon: FileText, 
                        path: '/invoice-generator',
                        allowed: true
                    },
                    {
                        name: 'Add Expense',
                        icon: Wallet,
                        path: '/add-expense',
                        allowed: true
                    },
                    {
                        name: 'Expenses Overview',
                        icon: Euro,
                        path: '/expenses',
                        allowed: true
                    }
                ]
            },
            {
                id: 'admin',
                title: "Administration",
                icon: Settings,
                items: [
                    {
                        name: 'Analytics Dashboard',
                        icon: BarChart3,
                        path: '/analytics',
                        allowed: true
                    },
                    {
                        name: 'User Management',
                        icon: User,
                        path: '/user-management',
                        allowed: true
                    },
                    {
                        name: 'System Settings',
                        icon: Settings,
                        path: '/settings',
                        allowed: true
                    }
                ]
            }
        );
    }
    

    // Function to get the icon component for a given path
    const getIconForPath = (path) => {
        for (const group of navigationGroups) {
            for (const item of group.items) {
                if (item.path === path) {
                    return item.icon;
                }
            }
        }
        return Star; // Default icon
    };

    return (
        <React.Fragment>
            {/* Mobile overlay */}
            {isMobile && isOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-20"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Mobile toggle button */}
            <button
                onClick={toggleSidebar}
                className="fixed top-4 left-4 z-30 p-2 rounded-md bg-white hover:bg-gray-200 shadow-lg lg:hidden"
                aria-label="Toggle menu"
            >
                {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            {/* Sidebar */}
            <aside
                className={`fixed top-0 left-0 h-full bg-gray-900 text-gray-100 z-30 transform transition-transform duration-300 ease-in-out w-64 overflow-hidden
                    ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
            >
                <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="p-4 border-b border-gray-700 relative">
                        {/* Mobile close button - now properly positioned */}
                        {isMobile && (
                            <button
                                onClick={() => setIsOpen(false)}
                                className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-700 transition-colors"
                                aria-label="Close menu"
                            >
                                <X size={24} />
                            </button>
                        )}
                        <h1 className="text-xl font-bold mb-4">Just Enjoy Ibiza</h1>
                        <div className="flex items-center space-x-2 p-2 rounded-lg bg-gray-800">
                            <User size={20} />
                            <div className="flex-1 overflow-hidden">
                                <p className="text-sm truncate">{user?.email}</p>
                                <p className="text-xs text-gray-400 capitalize">{userRole}</p>
                            </div>
                        </div>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 overflow-y-auto">
                        {/* Favorites Section */}
                        <div className="mb-2 mt-2">
                            <div className="px-4 py-2 flex items-center justify-between text-gray-300">
                                <div className="flex items-center">
                                    <Star size={20} className="mr-2 text-yellow-400" />
                                    <span className="font-medium">My Favorites</span>
                                </div>
                            </div>
                            <div className="py-2 bg-gray-800">
                                {favorites.length === 0 ? (
                                    <p className="text-xs text-gray-500 px-6 py-2">Add favorites by clicking the star icon next to menu items</p>
                                ) : (
                                    favorites.map((item) => {
                                        const IconComponent = getIconForPath(item.path);
                                        return (
                                            <div key={item.path} className="flex items-center px-6 py-2">
                                                <button
                                                    onClick={() => handleNavClick(item.path)}
                                                    className={`flex-1 flex items-center text-sm text-left transition-colors
                                                        ${location.pathname === item.path
                                                            ? 'text-blue-400'
                                                            : 'text-gray-300 hover:text-gray-100'
                                                        }`}
                                                >
                                                    <IconComponent size={16} className="mr-2" />
                                                    {item.name}
                                                </button>
                                                <button
                                                    onClick={() => removeFromFavorites(item.path)}
                                                    className="text-gray-400 hover:text-red-400 p-1"
                                                    aria-label="Remove from favorites"
                                                >
                                                    <StarOff size={14} />
                                                </button>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                        
                        {/* Regular Navigation Groups */}
                        {navigationGroups.map((group) => {
                            const allowedItems = group.items.filter(item => item.allowed);
                            if (allowedItems.length === 0) return null;

                            return (
                                <div key={group.id} className="mb-2">
                                    <button
                                        onClick={() => toggleGroup(group.id)}
                                        className="w-full px-4 py-2 flex items-center justify-between text-gray-300 hover:bg-gray-800 transition-colors"
                                    >
                                        <div className="flex items-center">
                                            <group.icon size={20} className="mr-2" />
                                            <span className="font-medium">{group.title}</span>
                                        </div>
                                        {expandedGroup === group.id ? (
                                            <ChevronUp size={16} />
                                        ) : (
                                            <ChevronDown size={16} />
                                        )}
                                    </button>
                                    {expandedGroup === group.id && (
                                        <div className="py-2 bg-gray-800">
                                            {allowedItems.map((item) => (
                                                <div key={item.path} className="flex items-center">
                                                    <button
                                                        onClick={() => handleNavClick(item.path)}
                                                        className={`flex items-center w-full px-6 py-2 text-sm transition-colors
                                                            ${location.pathname === item.path
                                                                ? 'bg-blue-600 text-white'
                                                                : 'text-gray-300 hover:bg-gray-700'
                                                            }`}
                                                    >
                                                        <item.icon size={16} className="mr-2" />
                                                        {item.name}
                                                    </button>
                                                    <button
                                                        onClick={() => isFavorite(item.path) 
                                                            ? removeFromFavorites(item.path) 
                                                            : addToFavorites(item)
                                                        }
                                                        className={`absolute right-3 text-gray-400 hover:text-yellow-400 ${
                                                            isFavorite(item.path) ? 'text-yellow-400' : ''
                                                        }`}
                                                    >
                                                        {isFavorite(item.path) 
                                                            ? <Star size={14} />
                                                            : <Star size={14} />
                                                        }
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </nav>

                    {/* Logout button */}
                    <button
                        onClick={handleLogout}
                        className="flex items-center w-full p-4 text-red-400 hover:bg-gray-800 transition-colors border-t border-gray-700"
                    >
                        <LogOut size={20} className="mr-2" />
                        <span>Logout</span>
                    </button>
                </div>
            </aside>
        </React.Fragment>
    );
};

export default Sidebar;