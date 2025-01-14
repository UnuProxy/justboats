import React, { useState, useEffect } from 'react';
import {
    Menu, X, Calendar, PlusCircle, Users, LogOut, BarChart3,
    User, Wallet, CreditCard, Euro, Ship, MessageSquare,
    Settings, Building, ChevronDown, ChevronUp
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

    const navigationGroups = [
        {
            id: 'bookings',
            title: "Bookings",
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
                }
            ]
        },
        {
            id: 'financial',
            title: "Financial Management",
            icon: Euro,
            items: [
                {
                    name: 'Payment Tracking',
                    icon: CreditCard,
                    path: '/payment-tracking',
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
            id: 'fleet',
            title: "Fleet Operations",
            icon: Ship,
            items: [
                {
                    name: 'Boat Fleet',
                    icon: Ship,
                    path: '/boats',
                    allowed: true
                }
            ]
        },
        {
            id: 'relations',
            title: "Relations",
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
                    allowed: isAdmin()
                }
            ]
        },
        {
            id: 'tools',
            title: "Tools",
            icon: Settings,
            items: [
                {
                    name: 'Analytics Dashboard',
                    icon: BarChart3,
                    path: '/analytics',
                    allowed: isAdmin()
                },
                {
                    name: 'User Management',
                    icon: User,
                    path: '/user-management',
                    allowed: isAdmin()
                },
                {
                    name: 'Chatbot Settings',
                    icon: MessageSquare,
                    path: '/chatbot-settings',
                    allowed: isAdmin()
                },
                {
                    name: 'System Settings',
                    icon: Settings,
                    path: '/settings',
                    allowed: isAdmin()
                }
            ]
        }
    ];

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
                className={`fixed top-0 left-0 h-full bg-gray-900 text-gray-100 z-30 transform transition-transform duration-300 ease-in-out w-64
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
                    <nav className="flex-1 overflow-y-auto py-4">
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
                                                <button
                                                    key={item.path}
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