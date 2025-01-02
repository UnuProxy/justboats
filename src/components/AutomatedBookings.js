// src/components/AutomatedBookings.js
import React, { useState } from 'react';
import { Mail, MessageSquare } from 'lucide-react';

const AutomatedBookings = () => {
    const [loading, setLoading] = useState(false);

    const handleSendEmail = () => {
        setLoading(true);
        // TODO: Implement email sending
        setTimeout(() => setLoading(false), 1000);
    };

    const handleSendWhatsApp = () => {
        setLoading(true);
        // TODO: Implement WhatsApp sending
        setTimeout(() => setLoading(false), 1000);
    };

    return React.createElement(
        'div',
        { className: 'bg-white rounded-lg shadow-md' },
        React.createElement(
            'div',
            { className: 'p-6' },
            React.createElement('h2', { className: 'text-xl font-semibold mb-4' }, 'Booking Communications'),
            React.createElement(
                'div',
                { className: 'mb-6' },
                React.createElement(
                    'div',
                    { className: 'flex items-center space-x-4 mb-4' },
                    React.createElement(
                        'button',
                        {
                            onClick: handleSendEmail,
                            className: 'flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600',
                            disabled: loading
                        },
                        React.createElement(Mail, { className: 'w-4 h-4 mr-2' }),
                        'Send Email'
                    ),
                    React.createElement(
                        'button',
                        {
                            onClick: handleSendWhatsApp,
                            className: 'flex items-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600',
                            disabled: loading
                        },
                        React.createElement(MessageSquare, { className: 'w-4 h-4 mr-2' }),
                        'Send WhatsApp'
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'border rounded-lg p-4' },
                    React.createElement(
                        'pre',
                        { className: 'whitespace-pre-wrap font-sans text-sm' },
                        `Dear {customerName},

Thank you for booking with Just Enjoy Ibiza Boats!

Booking Details:
- Date: {bookingDate}
- Time: {bookingTime}
- Boat: {boatName}
- Duration: {duration}
- Meeting Point: {meetingPoint}

What to Bring:
- Swimwear and towels
- Sunscreen
- Valid ID
- Booking confirmation

Cancellation Policy:
- Free cancellation up to 48 hours before
- 50% charge for cancellations within 48 hours
- No refund for no-shows

Need to modify your booking? Contact us at {contactEmail}

See you soon!
Just Boats Ibiza Team`
                    )
                )
            )
        )
    );
};

export default AutomatedBookings;