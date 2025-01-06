import React, { useState, useEffect } from 'react';
import { Menu, X, Calendar, PlusCircle, Users, LogOut, BarChart3, User, Wallet, CreditCard, Euro, Ship } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router';

const Sidebar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, userRole, isAdmin, logout } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

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

    const toggleSidebar = () => {
        setIsOpen(!isOpen);
    };

    const handleNavClick = (path) => {
        navigate(path);
        if (isMobile) {
            setIsOpen(false);
        }
    };

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const navigationItems = [
        {
            name: 'Dashboard',
            icon: React.createElement(BarChart3, { className: 'mr-3', size: 20 }),
            path: '/',
            allowed: true
        },
        {
            name: 'Upcoming Bookings',
            icon: React.createElement(Calendar, { className: 'mr-3', size: 20 }),
            path: '/bookings',
            allowed: true
        },
        {
            name: 'Add New Booking',
            icon: React.createElement(PlusCircle, { className: 'mr-3', size: 20 }),
            path: '/add-booking',
            allowed: true
        },
        {
            name: 'Payment Tracking',
            icon: React.createElement(CreditCard, { className: 'mr-3', size: 20 }),
            path: '/payment-tracking',
            allowed: true
        },
        {
            name: 'Manage Partners',
            icon: React.createElement(Users, { className: 'mr-3', size: 20 }),
            path: '/manage-partners',
            allowed: isAdmin()
        },
        {
            name: 'Analytics',
            icon: React.createElement(BarChart3, { className: 'mr-3', size: 20 }),
            path: '/analytics',
            allowed: isAdmin()
        },
        {
            name: 'User Management',
            icon: React.createElement(User, { className: 'mr-3', size: 20 }),
            path: '/user-management',
            allowed: isAdmin()
        },
        {
            name: 'Client Directory',
            icon: React.createElement(Users, { className: 'mr-3', size: 20 }),
            path: '/clients',
            allowed: true
        },
        {
            name: 'Add Expense',
            icon: React.createElement(Wallet, { className: 'mr-3', size: 20 }),
            path: '/add-expense',
            allowed: true
        },
        {
            name: 'Expenses Overview',
            icon: React.createElement(Euro, { className: 'mr-3', size: 20 }),
            path: '/expenses',
            allowed: true
        },
        {
            name: 'Boat Fleet',
            icon: React.createElement(Ship, { className: 'mr-3', size: 20 }), 
            path: '/boats',
            allowed: true
        },
    ];

    return React.createElement(
        React.Fragment,
        null,
        isMobile && isOpen && React.createElement('div', {
            className: 'fixed inset-0 bg-black bg-opacity-50 z-20',
            onClick: () => setIsOpen(false)
        }),
        React.createElement(
            'button',
            {
                onClick: toggleSidebar,
                className: 'fixed top-4 left-4 z-30 p-2 rounded-md bg-white hover:bg-gray-200 shadow-lg lg:hidden',
                style: { top: '16px', left: '16px' },
                'aria-label': 'Toggle menu',
            },
            isOpen ? React.createElement(X, { size: 24 }) : React.createElement(Menu, { size: 24 })
        ),
        React.createElement(
            'aside',
            {
                className: `fixed top-0 left-0 h-full bg-gray-800 text-white z-30 transform transition-transform duration-300 ease-in-out w-64
                    ${isOpen ? 'translate-x-0' : '-translate-x-full'}`,
            },
            React.createElement(
                'div',
                { className: 'p-4 flex flex-col h-full' },
                isMobile && React.createElement(
                    'button',
                    {
                        onClick: () => setIsOpen(false),
                        className: 'absolute top-4 right-4 p-2 rounded-full hover:bg-gray-700 transition-colors',
                        'aria-label': 'Close menu'
                    },
                    React.createElement(X, { size: 24 })
                ),
                React.createElement(
                    'div',
                    { className: 'mt-4' },
                    React.createElement('h1', { className: 'text-xl font-bold' }, 'Just Enjoy Ibiza'),
                    React.createElement(
                        'div',
                        { className: 'mt-4 flex items-center space-x-2 p-2 rounded-lg bg-gray-700' },
                        React.createElement(User, { size: 20 }),
                        React.createElement(
                            'div',
                            { className: 'flex-1 overflow-hidden' },
                            React.createElement('p', { className: 'text-sm truncate' }, user?.email),
                            React.createElement('p', { className: 'text-xs text-gray-400 capitalize' }, userRole)
                        )
                    )
                ),
                React.createElement(
                    'nav',
                    { className: 'flex-1 space-y-2' },
                    navigationItems.map((item) =>
                        item.allowed &&
                        React.createElement(
                            'button',
                            {
                                key: item.path,
                                onClick: () => handleNavClick(item.path),
                                className: `flex items-center w-full p-3 rounded-lg transition-colors
                                    ${location.pathname === item.path
                                        ? 'bg-gray-700 text-white'
                                        : 'hover:bg-gray-700'
                                    }`,
                            },
                            item.icon,
                            item.name
                        )
                    )
                ),
                React.createElement(
                    'button',
                    {
                        onClick: handleLogout,
                        className: 'flex items-center w-full p-3 mt-4 rounded-lg hover:bg-gray-700 transition-colors text-red-400 hover:text-red-300',
                    },
                    React.createElement(LogOut, { className: 'mr-3', size: 20 }),
                    'Logout'
                )
            )
        )
    );
};

export default Sidebar;