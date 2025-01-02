import React from "react";
import UpcomingBookings from "./UpcomingBookings";
import AddBooking from "./AddBooking";
import ManagePartners from "./ManagePartners";
import UserManagement from './UserManagement';

function MainContent({ activeSection }) {
  return (
    <main className="content">
      {activeSection === "upcomingBookings" && <UpcomingBookings />}
      {activeSection === "addBooking" && <AddBooking />}
      {activeSection === "managePartners" && <ManagePartners />}
      {activeSection === "userManagement" && <UserManagement />}
    </main>
  );
}

export default MainContent;