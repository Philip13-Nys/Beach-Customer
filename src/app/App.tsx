import { HashRouter, Routes, Route } from "react-router";
import { AppProvider } from "./context/AppContext";
import Layout from "./components/Layout";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import Rooms from "./pages/Rooms";
import RoomDetail from "./pages/RoomDetail";
import BookingPage from "./pages/Booking";
import BookingConfirmation from "./pages/BookingConfirmation";
import BookingHistory from "./pages/BookingHistory";
import Payment from "./pages/Payment";
import Services from "./pages/Services";
import Inquiries from "./pages/Inquiries";
import Notifications from "./pages/Notifications";
import Reviews from "./pages/Reviews";
import AIAssistant from "./pages/AIAssistant";

export default function App() {
  return (
    <AppProvider>
      <HashRouter basename="/Beach-Customer">
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route
            path="/*"
            element={
              <Layout>
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/rooms" element={<Rooms />} />
                  <Route path="/rooms/:id" element={<RoomDetail />} />
                  <Route path="/booking/:roomId" element={<BookingPage />} />
                  <Route
                    path="/booking-confirmation/:id"
                    element={<BookingConfirmation />}
                  />
                  <Route path="/booking-history" element={<BookingHistory />} />
                  <Route path="/bookings" element={<BookingHistory />} />
                  <Route path="/payment" element={<Payment />} />
                  <Route path="/services" element={<Services />} />
                  <Route path="/inquiries" element={<Inquiries />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/reviews" element={<Reviews />} />
                  <Route path="/ai-assistant" element={<AIAssistant />} />
                  <Route path="/profile" element={<Profile />} />
                </Routes>
              </Layout>
            }
          />
        </Routes>
      </HashRouter>
    </AppProvider>
  );
}
