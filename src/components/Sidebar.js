import React, { useState, useEffect } from 'react';
import { 
    Menu, X, Calendar, PlusCircle, Users, LogOut, BarChart3,
    User, CreditCard, Euro, Ship, MessageSquare,
    Settings, Building, ChevronDown, ChevronUp, Utensils, Package, ShoppingCart, FileText,
    Star,  LineChart, QrCode, MapPin, Divide, DollarSign
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
    
    // Preferred sections - highlight what the user uses most
    const preferredSections = ['bookings', 'financial', 'catering'];

    // Auto-expand the current active section or preferred section by default
    useEffect(() => {
        // Find which group the current path belongs to
        let foundActiveGroup = false;
        
        for (const group of navigationGroups) {
            if (group && group.items && Array.isArray(group.items)) {
                const pathInGroup = group.items.some(item => item && location.pathname === item.path);
                if (pathInGroup) {
                    setExpandedGroup(group.id);
                    foundActiveGroup = true;
                    break;
                }
            }
        }
        
        // If no active group was found and no group is expanded, expand the first preferred section
        if (!foundActiveGroup && !expandedGroup) {
            for (const prefId of preferredSections) {
                const prefGroup = navigationGroups.find(g => g.id === prefId);
                if (prefGroup) {
                    setExpandedGroup(prefId);
                    break;
                }
            }
        }
    }, [location.pathname]);

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
        const currentFavorites = Array.isArray(favorites) ? favorites : [];
        if (!currentFavorites.some(fav => fav && fav.path === item.path)) {
            setFavorites([...currentFavorites, item]);
        }
    };
    
    const removeFromFavorites = (path) => {
        const currentFavorites = Array.isArray(favorites) ? favorites : [];
        setFavorites(currentFavorites.filter(item => item && item.path !== path));
    };
    
    const isFavorite = (path) => {
        return Array.isArray(favorites) && favorites.some(item => item && item.path === path);
    };

    // Basic navigation for regular users
    let navigationGroups = [
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
        },
        
    ];
    
    // Add full navigation for admin users
    if (isAdmin()) {
        navigationGroups = [
            // Main frequently used groups first
            {
                id: 'bookings',
                title: "Bookings & Calendar",
                icon: Calendar,
                isPriority: true,
                items: [
                    {
                        name: 'Upcoming Bookings',
                        icon: Calendar,
                        path: '/bookings',
                        allowed: true
                    },
                    {
                        name: 'Add New Booking',
                        icon: PlusCircle,
                        path: '/add-booking',
                        allowed: true
                    },
                    {
                        name: 'San Antonio Tours',
                        icon: Ship,
                        path: '/san-antonio-tours',
                        allowed: true
                    },
                    {
                        name: 'Generate Contract',
                        icon: FileText,
                        path: '/contract-generator',
                        allowed: true
                    },
                    {
    name: 'Client Data Collection',
    icon: Users,
    path: '/client-data-collection',
    allowed: true
}
                ]
            },
            {
                id: 'financial',
                title: "Finance & Payments",
                icon: Euro,
                isPriority: true,
                items: [
                    {
                        name: 'Payment Tracking',
                        icon: CreditCard,
                        path: '/payment-tracking',
                        allowed: true
                    },
                    {
                        name: 'Invoice Generator',
                        icon: FileText, 
                        path: '/invoice-generator',
                        allowed: true
                    },
                    {
                        name: 'Expenses Overview',
                        icon: Euro,
                        path: '/expenses',
                        allowed: true
                    },
                    {
                        name: 'Expense Tracker',
                        icon: LineChart,
                        path: '/expense-tracker',
                        allowed: true
                    },
                    {
                        name: 'Financial Dashboard',
                        icon: BarChart3,
                        path: '/financial-dashboard',
                        allowed: false
                    }
                ]
            },
            {
                id: 'catering',
                title: "Food & Beverages",
                icon: Utensils,
                isPriority: true,
                items: [
                    {
                        name: 'Product Catalog',
                        icon: Package,
                        path: '/products',
                        allowed: true
                    },
                    {
                        name: 'Add New Product',
                        icon: PlusCircle,
                        path: '/add-product',
                        allowed: true
                    },
                    {
                        name: 'Catering Orders',
                        icon: ShoppingCart,
                        path: '/catering-orders',
                        allowed: true
                    },
                    {
                        name: 'Provisioning Expenses',
                        icon: DollarSign,
                        path: '/catering-expenses',
                        allowed: true
                    },
                    {
                        name: 'Price Management',
                        icon: Euro,
                        path: '/pricing-manager',
                        allowed: true
                    }
                ]
            },
            // Priority separator
            {
                id: 'priority-separator',
                title: "Other Operations",
                icon: Divide,
                type: 'separator'
            },
            // Other groups below
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
                        name: 'Partner Management',
                        icon: Building,
                        path: '/manage-partners',
                        allowed: true
                    },
                    {
                        name: 'Inquiries & Leads',
                        icon: MessageSquare,
                        path: '/inquiries',
                        allowed: true
                    }
                ]
            },
            {
                id: 'places',
                title: "Places & QR Codes",
                icon: MapPin,
                items: [
                    {
                        name: 'Manage Places',
                        icon: QrCode,
                        path: '/places',
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
                        name: 'Chatbot Settings',
                        icon: MessageSquare,
                        path: '/chatbot-settings',
                        allowed: false
                    }
                ]
            },
            {
                id: 'admin',
                title: "Administration",
                icon: Settings,
                items: [
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
        ];
    }
    
  

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
                className={`fixed top-0 left-0 h-full bg-gray-900 text-gray-100 z-30 transform transition-transform duration-300 ease-in-out w-72 overflow-hidden
                    ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
            >
                <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="p-5 border-b border-gray-700 relative bg-gray-800">
                        {/* Mobile close button */}
                        {isMobile && (
                            <button
                                onClick={() => setIsOpen(false)}
                                className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-700 transition-colors"
                                aria-label="Close menu"
                            >
                                <X size={24} />
                            </button>
                        )}
                        <h1 className="text-xl font-bold mb-4 text-white">Just Enjoy Ibiza</h1>
                        <div className="flex items-center space-x-2 p-3 rounded-lg bg-gray-700">
                            <User size={20} className="text-blue-400" />
                            <div className="flex-1 overflow-hidden">
                                <p className="text-sm truncate text-white">{user?.email}</p>
                                <p className="text-xs text-gray-300 capitalize">{userRole}</p>
                            </div>
                        </div>
                    </div>

                    

                    {/* Navigation */}
                    <nav className="flex-1 overflow-y-auto pt-3">
                        
                        
                        {/* Regular Navigation Groups */}
                        <div className="space-y-3 px-3">
                            {/* First render priority sections */}
                            {isAdmin() && navigationGroups
                                .filter(group => group && group.isPriority)
                                .map((group) => renderNavigationGroup(group))}
                            
                            {/* Then render separators and other sections */}
                            {navigationGroups
                                .filter(group => group && (!group.isPriority || !isAdmin()))
                                .map((group) => renderNavigationGroup(group))}
                        </div>
                    </nav>

                    {/* Logout button */}
                    <button
                        onClick={handleLogout}
                        className="flex items-center w-full p-5 mt-2 text-red-400 hover:bg-gray-800 transition-colors border-t border-gray-700"
                    >
                        <LogOut size={18} className="mr-3" />
                        <span>Logout</span>
                    </button>
                </div>
            </aside>
        </React.Fragment>
    );
    
    // Helper function to render a navigation group
    function renderNavigationGroup(group) {
        if (!group) return null;
        
        // Handle separator type items
        if (group.type === 'separator') {
            return (
                <div key={group.id} className="pt-2 pb-1">
                    <div className="flex items-center px-3 py-2 text-xs uppercase tracking-wider text-gray-400 font-semibold border-b border-gray-700">
                        <group.icon size={16} className="mr-2" />
                        {group.title}
                    </div>
                </div>
            );
        }
        
        // Check if group has items and filter allowed ones
        const safeItems = group.items && Array.isArray(group.items) ? group.items : [];
        const allowedItems = safeItems.filter(item => item && item.allowed);
        
        if (allowedItems.length === 0) return null;
        
        const isExpanded = expandedGroup === group.id;
        const hasActiveItem = allowedItems.some(item => item && location.pathname === item.path);
        const isPriority = group.isPriority && isAdmin();

        return (
            <div key={group.id} className={`mb-2 ${isPriority ? 'bg-gray-800 rounded-lg' : ''}`}>
                <button
                    onClick={() => toggleGroup(group.id)}
                    className={`
                        w-full flex items-center justify-between px-4 py-3 text-sm
                        transition-colors rounded-lg
                        ${isExpanded ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}
                        ${hasActiveItem ? 'border-l-2 border-blue-500 pl-3' : ''}
                        ${isPriority ? 'bg-gradient-to-r from-blue-900 to-gray-800 font-medium text-white' : ''}
                    `}
                >
                    <div className="flex items-center">
                        <group.icon size={20} className={`mr-3 
                            ${isExpanded ? 'text-blue-400' : ''} 
                            ${isPriority ? 'text-blue-300' : ''}
                        `} />
                        <span className="font-medium">{group.title}</span>
                    </div>
                    {isExpanded ? (
                        <ChevronUp size={18} />
                    ) : (
                        <ChevronDown size={18} />
                    )}
                </button>
                
                {isExpanded && (
                    <div className="mt-2 ml-4 space-y-1">
                        {allowedItems.map((item) => {
                            if (!item || !item.path) return null;
                            
                            const isActive = location.pathname === item.path;
                            
                            return (
                                <div key={item.path} className="flex items-center group relative">
                                    <button
                                        onClick={() => handleNavClick(item.path)}
                                        className={`
                                            flex items-center w-full px-4 py-3 text-sm transition-colors rounded-md
                                            ${isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}
                                        `}
                                    >
                                        <item.icon size={18} className="mr-3" />
                                        <span>{item.name}</span>
                                    </button>
                                    
                                    <button
                                        onClick={() => isFavorite(item.path) 
                                            ? removeFromFavorites(item.path) 
                                            : addToFavorites(item)
                                        }
                                        className={`
                                            absolute right-2 p-1 rounded-full 
                                            ${isFavorite(item.path) 
                                                ? 'text-yellow-400 hover:bg-gray-700'
                                                : 'text-gray-500 opacity-0 group-hover:opacity-100 hover:bg-gray-700 hover:text-gray-300'
                                            }
                                        `}
                                        aria-label={isFavorite(item.path) ? "Remove from favorites" : "Add to favorites"}
                                    >
                                        {isFavorite(item.path) 
                                            ? <Star size={14} />
                                            : <Star size={14} />
                                        }
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }
};

export default Sidebar;