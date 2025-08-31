import React, { useState, useEffect } from 'react';
import { 
    Menu, X, Calendar, PlusCircle, Users, LogOut, BarChart3,
    User, CreditCard, Euro, Ship, MessageSquare,
    Settings, Building, ChevronDown, ChevronUp, Utensils, Package, ShoppingCart, FileText,
    Star,  LineChart, QrCode, MapPin, Divide, DollarSign, Zap, TrendingUp,
     Heart, Search
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Users2 } from 'lucide-react';

const Sidebar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, userRole, isAdmin, logout } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [expandedGroup, setExpandedGroup] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    
    // User-specific favorites with unique storage key
    const favoritesStorageKey = `favorites_${user?.uid || 'guest'}`;
    const [favorites, setFavorites] = useState(() => {
        const savedFavorites = localStorage.getItem(favoritesStorageKey);
        return savedFavorites ? JSON.parse(savedFavorites) : [];
    });
    
    // Quick actions for dashboard
    const quickActions = [
        { name: 'New Booking', icon: PlusCircle, path: '/add-booking', color: 'bg-blue-500' },
        { name: 'Payments', icon: CreditCard, path: '/payment-tracking', color: 'bg-green-500' },
        { name: 'Orders', icon: ShoppingCart, path: '/catering-orders', color: 'bg-orange-500' },
    ];
    
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

    // Search functionality
    const getFilteredItems = () => {
        if (!searchTerm) return [];
        
        const allItems = [];
        navigationGroups.forEach(group => {
            if (group && group.items) {
                group.items.forEach(item => {
                    if (item && item.allowed && item.name.toLowerCase().includes(searchTerm.toLowerCase())) {
                        allItems.push({ ...item, groupTitle: group.title });
                    }
                });
            }
        });
        return allItems;
    };

    // Basic navigation for regular users
    let navigationGroups = [
        {
            id: 'bookings',
            title: "Trips & Tours",
            icon: Calendar,
            color: 'text-blue-400',
            bgColor: 'bg-blue-50',
            items: [
                {
                    name: 'Upcoming Bookings',
                    icon: Calendar,
                    path: '/bookings',
                    allowed: true,
                    description: 'View and manage all bookings'
                },
                {
                    name: 'San Antonio Tours',
                    icon: Ship,
                    path: '/san-antonio-tours',
                    allowed: true,
                    description: 'Special tour packages'
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
                color: 'text-blue-400',
                bgColor: 'bg-blue-50',
                items: [
                    {
                        name: 'Upcoming Bookings',
                        icon: Calendar,
                        path: '/bookings',
                        allowed: true,
                        description: 'View and manage all bookings',
                        badge: 'Hot'
                    },
                    {
                        name: 'Add New Booking',
                        icon: PlusCircle,
                        path: '/add-booking',
                        allowed: true,
                        description: 'Create new booking'
                    },
                    {
                        name: 'San Antonio Tours',
                        icon: Ship,
                        path: '/san-antonio-tours',
                        allowed: true,
                        description: 'Special tour packages'
                    },
                    {
                    name: 'Charter Management',
                    icon: Users2,
                    path: '/charter-management',
                    allowed: true,
                    description: 'Manage leads & collaborator bookings',
                    badge: 'New'
                },
                    {
                        name: 'Generate Contract',
                        icon: FileText,
                        path: '/contract-generator',
                        allowed: true,
                        description: 'Create legal contracts'
                    },
                    {
                        name: 'Client Data Collection',
                        icon: Users,
                        path: '/client-data-collection',
                        allowed: true,
                        description: 'Collect client information'
                    }
                ]
            },
            {
                id: 'financial',
                title: "Finance & Payments",
                icon: Euro,
                isPriority: true,
                color: 'text-green-400',
                bgColor: 'bg-green-50',
                items: [
                    {
                        name: 'Payment Tracking',
                        icon: CreditCard,
                        path: '/payment-tracking',
                        allowed: true,
                        description: 'Track all payments',
                        badge: 'New'
                    },
                    {
                        name: 'Invoice Generator',
                        icon: FileText, 
                        path: '/invoice-generator',
                        allowed: true,
                        description: 'Generate invoices'
                    },
                    {
                        name: 'Expenses Overview',
                        icon: Euro,
                        path: '/expenses',
                        allowed: true,
                        description: 'View expense summary'
                    },
                    {
                        name: 'Expense Tracker',
                        icon: LineChart,
                        path: '/expense-tracker',
                        allowed: true,
                        description: 'Track business expenses'
                    },
                    {
                        name: 'Financial Dashboard',
                        icon: BarChart3,
                        path: '/financial-dashboard',
                        allowed: false,
                        description: 'Complete financial overview'
                    }
                ]
            },
            {
                id: 'catering',
                title: "Food & Beverages",
                icon: Utensils,
                isPriority: true,
                color: 'text-orange-400',
                bgColor: 'bg-orange-50',
                items: [
                    {
                        name: 'Product Catalog',
                        icon: Package,
                        path: '/products',
                        allowed: true,
                        description: 'Manage product inventory'
                    },
                    {
                        name: 'Add New Product',
                        icon: PlusCircle,
                        path: '/add-product',
                        allowed: true,
                        description: 'Add new products'
                    },
                    {
                        name: 'Catering Orders',
                        icon: ShoppingCart,
                        path: '/catering-orders',
                        allowed: true,
                        description: 'Manage food orders'
                    },
                    {
                        name: 'Provisioning Expenses',
                        icon: DollarSign,
                        path: '/catering-expenses',
                        allowed: true,
                        description: 'Track catering costs'
                    },
                    {
                        name: 'Price Management',
                        icon: Euro,
                        path: '/pricing-manager',
                        allowed: true,
                        description: 'Manage pricing strategies'
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
                color: 'text-cyan-400',
                bgColor: 'bg-cyan-50',
                items: [
                    {
                        name: 'Boat Fleet',
                        icon: Ship,
                        path: '/boats',
                        allowed: true,
                        description: 'Manage boat fleet'
                    },
                    {
                        name: 'Available Boats',
                        icon: Ship,
                        path: '/available-boats',
                        allowed: true,
                        description: 'Check boat availability'
                    },
                ]
            },
            {
                id: 'customers',
                title: "Customer Relations",
                icon: Users,
                color: 'text-purple-400',
                bgColor: 'bg-purple-50',
                items: [
                    {
                        name: 'Client Directory',
                        icon: Users,
                        path: '/clients',
                        allowed: true,
                        description: 'Manage client database'
                    },
                    {
                        name: 'Partner Management',
                        icon: Building,
                        path: '/manage-partners',
                        allowed: true,
                        description: 'Manage business partners'
                    },
                    {
                        name: 'Inquiries & Leads',
                        icon: MessageSquare,
                        path: '/inquiries',
                        allowed: true,
                        description: 'Handle customer inquiries'
                    }
                ]
            },
            {
                id: 'places',
                title: "Places & QR Codes",
                icon: MapPin,
                color: 'text-pink-400',
                bgColor: 'bg-pink-50',
                items: [
                    {
                        name: 'Manage Places',
                        icon: QrCode,
                        path: '/places',
                        allowed: true,
                        description: 'Manage location QR codes'
                    }
                ]
            },
            {
                id: 'support',
                title: "Customer Support",
                icon: MessageSquare,
                color: 'text-indigo-400',
                bgColor: 'bg-indigo-50',
                items: [
                    {
                        name: 'Chatbot Settings',
                        icon: MessageSquare,
                        path: '/chatbot-settings',
                        allowed: false,
                        description: 'Configure chatbot responses'
                    }
                ]
            },
            {
                id: 'admin',
                title: "Administration",
                icon: Settings,
                color: 'text-gray-400',
                bgColor: 'bg-gray-50',
                items: [
                    {
                        name: 'User Management',
                        icon: User,
                        path: '/user-management',
                        allowed: true,
                        description: 'Manage system users'
                    },
                    {
                        name: 'System Settings',
                        icon: Settings,
                        path: '/settings',
                        allowed: true,
                        description: 'Configure system settings'
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
                className="fixed top-4 left-4 z-30 p-2 rounded-xl bg-white hover:bg-gray-100 shadow-lg lg:hidden transition-all duration-200 hover:scale-105"
                aria-label="Toggle menu"
            >
                {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            {/* Sidebar */}
            <aside
                className={`fixed top-0 left-0 h-full bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-gray-100 z-30 transform transition-all duration-300 ease-in-out w-72 overflow-hidden shadow-2xl
                    ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
            >
                <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="p-6 border-b border-slate-700 relative bg-gradient-to-r from-blue-600 to-purple-600">
                        {/* Mobile close button */}
                        {isMobile && (
                            <button
                                onClick={() => setIsOpen(false)}
                                className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/20 transition-colors"
                                aria-label="Close menu"
                            >
                                <X size={24} />
                            </button>
                        )}
                        <h1 className="text-2xl font-bold mb-4 text-white bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
                            Just Enjoy Ibiza
                        </h1>
                        <div className="flex items-center space-x-3 p-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20">
                            <div className="p-2 bg-white/20 rounded-full">
                                <User size={20} className="text-white" />
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <p className="text-sm truncate text-white font-medium">{user?.email}</p>
                                <p className="text-xs text-blue-100 capitalize flex items-center gap-1">
                                    <Zap size={12} />
                                    {userRole} Account
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="p-4 border-b border-slate-700">
                        <div className="relative">
                            <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search features..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        
                        {/* Search Results */}
                        {searchTerm && (
                            <div className="mt-3 max-h-40 overflow-y-auto">
                                {getFilteredItems().map((item) => (
                                    <button
                                        key={item.path}
                                        onClick={() => {
                                            handleNavClick(item.path);
                                            setSearchTerm('');
                                        }}
                                        className="w-full flex items-center px-3 py-2 text-sm text-gray-300 hover:bg-slate-700 rounded-md transition-colors"
                                    >
                                        <item.icon size={16} className="mr-2 text-blue-400" />
                                        <div className="text-left">
                                            <div>{item.name}</div>
                                            <div className="text-xs text-gray-500">{item.groupTitle}</div>
                                        </div>
                                    </button>
                                ))}
                                {getFilteredItems().length === 0 && (
                                    <p className="text-sm text-gray-500 px-3 py-2">No results found</p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Quick Actions */}
                    {isAdmin() && !searchTerm && (
                        <div className="p-4 border-b border-slate-700">
                            <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
                                <Zap size={14} />
                                QUICK ACTIONS
                            </h3>
                            <div className="grid grid-cols-3 gap-2">
                                {quickActions.map((action) => (
                                    <button
                                        key={action.path}
                                        onClick={() => handleNavClick(action.path)}
                                        className={`${action.color} hover:opacity-90 text-white p-3 rounded-lg transition-all duration-200 hover:scale-105 flex flex-col items-center text-xs font-medium`}
                                    >
                                        <action.icon size={16} className="mb-1" />
                                        <span className="text-center leading-tight">{action.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Favorites */}
                    {favorites.length > 0 && !searchTerm && (
                        <div className="p-4 border-b border-slate-700">
                            <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
                                <Heart size={14} />
                                FAVORITES
                            </h3>
                            <div className="space-y-1">
                                {favorites.slice(0, 5).map((item) => (
                                    <button
                                        key={item.path}
                                        onClick={() => handleNavClick(item.path)}
                                        className="w-full flex items-center px-3 py-2 text-sm text-gray-300 hover:bg-slate-700 rounded-md transition-colors"
                                    >
                                        <item.icon size={16} className="mr-3 text-yellow-400" />
                                        <span className="truncate">{item.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Navigation */}
                    <nav className="flex-1 overflow-y-auto py-4">
                        {!searchTerm && (
                            <div className="space-y-2 px-4">
                                {/* First render priority sections */}
                                {isAdmin() && navigationGroups
                                    .filter(group => group && group.isPriority)
                                    .map((group) => renderNavigationGroup(group))}
                                
                                {/* Then render separators and other sections */}
                                {navigationGroups
                                    .filter(group => group && (!group.isPriority || !isAdmin()))
                                    .map((group) => renderNavigationGroup(group))}
                            </div>
                        )}
                    </nav>

                    {/* Logout button */}
                    <button
                        onClick={handleLogout}
                        className="flex items-center w-full p-6 mt-2 text-red-400 hover:bg-red-900/20 transition-all duration-200 border-t border-slate-700 group"
                    >
                        <LogOut size={18} className="mr-3 group-hover:translate-x-1 transition-transform" />
                        <span className="font-medium">Logout</span>
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
                <div key={group.id} className="pt-6 pb-2">
                    <div className="flex items-center px-3 py-2 text-xs uppercase tracking-wider text-gray-400 font-semibold border-b border-slate-700">
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
            <div key={group.id} className={`mb-3 ${isPriority ? 'bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl p-1' : ''}`}>
                <button
                    onClick={() => toggleGroup(group.id)}
                    className={`
                        w-full flex items-center justify-between px-4 py-4 text-sm
                        transition-all duration-200 rounded-xl group
                        ${isExpanded ? 'bg-slate-700 text-white shadow-lg' : 'text-gray-300 hover:bg-slate-800 hover:text-white'}
                        ${hasActiveItem ? 'border-l-4 border-blue-500 pl-3 bg-blue-900/20' : ''}
                        ${isPriority ? 'bg-gradient-to-r from-blue-900/30 to-purple-900/30 font-medium text-white border border-blue-500/20' : ''}
                    `}
                >
                    <div className="flex items-center">
                        <div className={`p-2 rounded-lg mr-3 ${group.bgColor || 'bg-slate-600'}`}>
                            <group.icon size={18} className={group.color || 'text-white'} />
                        </div>
                        <span className="font-medium">{group.title}</span>
                        {isPriority && (
                            <TrendingUp size={14} className="ml-2 text-green-400" />
                        )}
                    </div>
                    {isExpanded ? (
                        <ChevronUp size={18} className="group-hover:translate-y-1 transition-transform" />
                    ) : (
                        <ChevronDown size={18} className="group-hover:translate-y-1 transition-transform" />
                    )}
                </button>
                
                {isExpanded && (
                    <div className="mt-3 ml-2 space-y-1 animate-in slide-in-from-top-2 duration-200">
                        {allowedItems.map((item) => {
                            if (!item || !item.path) return null;
                            
                            const isActive = location.pathname === item.path;
                            
                            return (
                                <div key={item.path} className="flex items-center group relative">
                                    <button
                                        onClick={() => handleNavClick(item.path)}
                                        className={`
                                            flex items-center w-full px-4 py-3 text-sm transition-all duration-200 rounded-lg group/item
                                            ${isActive 
                                                ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg transform scale-[1.02]' 
                                                : 'text-gray-300 hover:bg-slate-700 hover:text-white hover:transform hover:scale-[1.01]'
                                            }
                                        `}
                                    >
                                        <item.icon size={16} className="mr-3 group-hover/item:scale-110 transition-transform" />
                                        <div className="flex-1 text-left">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">{item.name}</span>
                                                {item.badge && (
                                                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                                                        item.badge === 'Hot' ? 'bg-red-500 text-white' :
                                                        item.badge === 'New' ? 'bg-green-500 text-white' :
                                                        'bg-blue-500 text-white'
                                                    }`}>
                                                        {item.badge}
                                                    </span>
                                                )}
                                            </div>
                                            {item.description && (
                                                <div className="text-xs text-gray-400 mt-1">{item.description}</div>
                                            )}
                                        </div>
                                    </button>
                                    
                                    <button
                                        onClick={() => isFavorite(item.path) 
                                            ? removeFromFavorites(item.path) 
                                            : addToFavorites(item)
                                        }
                                        className={`
                                            absolute right-2 p-1.5 rounded-full transition-all duration-200
                                            ${isFavorite(item.path) 
                                                ? 'text-yellow-400 hover:bg-slate-600 hover:scale-110'
                                                : 'text-gray-500 opacity-0 group-hover:opacity-100 hover:bg-slate-600 hover:text-gray-300 hover:scale-110'
                                            }
                                        `}
                                        aria-label={isFavorite(item.path) ? "Remove from favorites" : "Add to favorites"}
                                    >
                                        <Star size={12} className={isFavorite(item.path) ? 'fill-current' : ''} />
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