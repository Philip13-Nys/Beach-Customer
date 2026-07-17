import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router';
import { useApp } from '../context/AppContext';
import FloatingAI from './FloatingAI';
import {
  Waves, Menu, X, Bell, User, LogOut, ChevronDown,
  Anchor, Home, Bed, Calendar, Clock, CreditCard,
  MessageCircle, Star, Bot, Activity, Phone
} from 'lucide-react';

const navLinks = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Rooms', href: '/rooms', icon: Bed },
  { label: 'Activities', href: '/services', icon: Activity },
];

const authNavLinks = [
  { label: 'My Bookings', href: '/booking-history', icon: Calendar },
];

const guestLinks = [
  { label: 'My Bookings', href: '/bookings', icon: Calendar },
  { label: 'Booking History', href: '/booking-history', icon: Clock },
  { label: 'Payments', href: '/payment', icon: CreditCard },
  { label: 'Notifications', href: '/notifications', icon: Bell },
  { label: 'Reviews', href: '/reviews', icon: Star },
  { label: 'AI Assistant', href: '/ai-assistant', icon: Bot },
  { label: 'Contact / Chat', href: '/inquiries', icon: MessageCircle },
  { label: 'Profile', href: '/profile', icon: User },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout, unreadCount } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setUserMenuOpen(false);
    navigate('/');
  };

  const isActive = (href: string) =>
    href === '/' ? location.pathname === '/' : location.pathname.startsWith(href);

  return (
    <div className="min-h-screen flex flex-col" style={{ fontFamily: 'var(--font-body)' }}>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
                <Anchor className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-sm font-semibold text-primary leading-none" style={{ fontFamily: 'var(--font-display)' }}>
                  Sabang Beach and Diving Resort
                </div>
                <div className="text-[10px] text-muted-foreground leading-none tracking-wide uppercase">
                  Beach & Dive Resort
                </div>
              </div>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-6">
              {navLinks.map(link => (
                <Link
                  key={link.href}
                  to={link.href}
                  className={`text-sm font-medium transition-colors ${
                    isActive(link.href)
                      ? 'text-accent'
                      : 'text-foreground hover:text-primary'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              {user && authNavLinks.map(link => (
                <Link
                  key={link.href}
                  to={link.href}
                  className={`text-sm font-medium transition-colors flex items-center gap-1 ${
                    isActive(link.href)
                      ? 'text-accent'
                      : 'text-foreground hover:text-primary'
                  }`}
                >
                  <link.icon className="w-3.5 h-3.5" />
                  {link.label}
                </Link>
              ))}
              <Link
                to="/inquiries"
                className="text-sm font-medium text-foreground hover:text-primary transition-colors flex items-center gap-1"
              >
                <Phone className="w-3.5 h-3.5" /> Contact
              </Link>
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-3">
              {user ? (
                <>
                  {/* Notifications */}
                  <Link to="/notifications" className="relative p-2 rounded-full hover:bg-muted transition-colors">
                    <Bell className="w-5 h-5 text-foreground" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 w-4 h-4 bg-accent text-white text-[10px] rounded-full flex items-center justify-center font-semibold">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </Link>

                  {/* User menu */}
                  <div className="relative">
                    <button
                      onClick={() => setUserMenuOpen(!userMenuOpen)}
                      className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full border border-border hover:bg-muted transition-colors"
                    >
                      <img
                        src={user.avatar}
                        alt={user.firstName}
                        className="w-7 h-7 rounded-full object-cover"
                      />
                      <span className="text-sm font-medium text-foreground hidden sm:block">{user.firstName}</span>
                      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>

                    {userMenuOpen && (
                      <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-border py-2 z-50">
                        <div className="px-4 py-2 border-b border-border mb-1">
                          <div className="text-sm font-semibold text-foreground">{user.firstName} {user.lastName}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        </div>
                        {guestLinks.map(link => (
                          <Link
                            key={link.href}
                            to={link.href}
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                          >
                            <link.icon className="w-4 h-4 text-muted-foreground" />
                            {link.label}
                          </Link>
                        ))}
                        <div className="border-t border-border mt-1 pt-1">
                          <button
                            onClick={handleLogout}
                            className="flex items-center gap-3 px-4 py-2 text-sm text-destructive hover:bg-red-50 w-full transition-colors"
                          >
                            <LogOut className="w-4 h-4" />
                            Sign Out
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    to="/auth"
                    className="text-sm font-medium text-primary hover:text-primary/80 transition-colors hidden sm:block"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/auth?tab=register"
                    className="text-sm font-medium bg-accent text-white px-4 py-2 rounded-full hover:bg-accent/90 transition-colors"
                  >
                    Book Now
                  </Link>
                </div>
              )}

              {/* Mobile menu toggle */}
              <button
                className="md:hidden p-2 rounded-full hover:bg-muted transition-colors"
                onClick={() => setMenuOpen(!menuOpen)}
              >
                {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-border bg-white py-4">
            <div className="max-w-7xl mx-auto px-4 space-y-1">
              {navLinks.map(link => (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive(link.href) ? 'bg-secondary text-primary' : 'text-foreground hover:bg-muted'
                  }`}
                >
                  <link.icon className="w-4 h-4" />
                  {link.label}
                </Link>
              ))}
              {user && guestLinks.map(link => (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  <link.icon className="w-4 h-4" />
                  {link.label}
                </Link>
              ))}
              {!user && (
                <Link
                  to="/auth"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-primary hover:bg-muted transition-colors"
                >
                  <User className="w-4 h-4" />
                  Sign In / Register
                </Link>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Page content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Floating AI Assistant */}
      <FloatingAI />

      {/* Footer */}
      <footer className="bg-primary text-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                  <Anchor className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-semibold text-white" style={{ fontFamily: 'var(--font-display)' }}>Sabang Beach and Diving Resort</div>
                  <div className="text-xs text-white/60 uppercase tracking-wide">Beach & Dive Resort</div>
                </div>
              </div>
              <p className="text-white/70 text-sm leading-relaxed max-w-xs">
                A top tropical getaway in Oriental Mindoro, famous for its white-sand beaches and world-class scuba diving.
              </p>
              <div className="flex items-center gap-2 mt-4">
                <Waves className="w-4 h-4 text-accent" />
                <span className="text-white/60 text-xs">Est. 2015 · Puerto Galera, Philippines</span>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-white/80 mb-3">Explore</h4>
              <ul className="space-y-2">
                {[['Rooms', '/rooms'], ['Activities', '/services'], ['Dining', '#'], ['Gallery', '#']].map(([label, href]) => (
                  <li key={label}>
                    <Link to={href} className="text-white/60 text-sm hover:text-white transition-colors">{label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-white/80 mb-3">Contact</h4>
              <ul className="space-y-2 text-white/60 text-sm">
                <li>📍 Sabang, Puerto Galera</li>
                <li>📞 +63 48 555 0192</li>
                <li>✉️ hello@sabangbeach.ph</li>
                <li className="pt-2">
                  <Link to="/inquiries" className="text-accent hover:text-accent/80 transition-colors text-sm font-medium">
                    Send a message →
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-white/40 text-xs">© 2026 Sabang Beach & Diving Resorts. All rights reserved.</p>
            <div className="flex gap-4 text-white/40 text-xs">
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-white transition-colors">Cookie Policy</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
