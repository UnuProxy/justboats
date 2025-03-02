import React from 'react';

export const CustomTooltip = ({ children, content }) => (
    <div className="relative group inline-block">
        {children}
        <div className="invisible group-hover:visible absolute z-50 px-2 py-1 text-sm text-white bg-gray-900 rounded-md 
             bottom-full left-1/2 transform -translate-x-1/2 mb-1 min-w-max">
            {content}
        </div>
    </div>
);

export const CustomAlert = ({ children, type = 'success' }) => (
    <div className={`p-4 rounded-lg mb-4 ${
        type === 'error' 
            ? 'bg-red-50 border border-red-200 text-red-700' 
            : 'bg-green-50 border border-green-200 text-green-700'
    }`}>
        <div className="flex">
            <div className="flex-shrink-0">
                {type === 'error' ? (
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                ) : (
                    <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                )}
            </div>
            <div className="ml-3">
                <p className={`text-sm ${type === 'error' ? 'text-red-800' : 'text-green-800'}`}>
                    {children}
                </p>
            </div>
        </div>
    </div>
);