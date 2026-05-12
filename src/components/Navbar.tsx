import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Home, LogOut, User, MessageSquare, Heart, Search } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';

export default function Navbar() {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { unreadCount } = useNotifications();
  const [isBottomNavVisible, setIsBottomNavVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      // Hide if scrolling down and past 50px, show if scrolling up
      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        setIsBottomNavVisible(false);
      } else {
        setIsBottomNavVisible(true);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const NavLink = ({ to, icon: Icon, label, badgeCount }: { to: string, icon: any, label: string, badgeCount?: number }) => {
    const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
    return (
      <Link 
        to={to} 
        className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-200 font-bold text-sm relative ${
          isActive 
            ? 'bg-primary-50 text-primary-700' 
            : 'text-gray-500 hover:text-primary-600 hover:bg-gray-50'
        }`}
      >
        <div className="relative">
          <Icon className={`h-4 w-4 ${isActive ? 'text-primary-600' : ''}`} />
          {badgeCount !== undefined && badgeCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
            </span>
          )}
        </div>
        <span className="hidden sm:inline">{label}</span>
      </Link>
    );
  };

  return (
    <>
      {/* Top Navbar (Desktop & Mobile Header) */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 sm:h-20 items-center">
            <div className="flex items-center">
              <Link to="/" className="flex items-center gap-2 text-xl sm:text-2xl font-outfit font-bold tracking-tight text-primary-900">
                <div className="bg-primary-600 p-1.5 rounded-xl">
                  <Home className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <span>EntraHomes</span>
              </Link>
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-2 sm:gap-4">
              <NavLink to="/" icon={Home} label="Home" />
              <NavLink to="/search" icon={Search} label="Search" />
              
              {user && profile ? (
                <>
                  {(profile.role === 'tenant' || profile.role === 'landlord') && (
                    <>
                      {profile.role === 'tenant' && (
                        <NavLink to="/tenant" icon={Heart} label="Saved" />
                      )}
                      <NavLink to="/messages" icon={MessageSquare} label="Messages" badgeCount={unreadCount} />
                    </>
                  )}
                  
                  <div className="h-6 w-px bg-gray-200 mx-2 hidden sm:block"></div>
                  
                  <Link 
                    to={`/${profile.role}`} 
                    className="flex items-center gap-2 text-gray-600 hover:text-primary-700 transition-colors font-bold ml-2"
                  >
                    <div className="h-9 w-9 rounded-full bg-primary-50 flex items-center justify-center text-primary-700 border border-primary-100">
                      <User className="h-4 w-4" />
                    </div>
                    <span className="hidden md:inline text-sm">Profile</span>
                  </Link>
                  <button 
                    onClick={handleLogout}
                    className="flex items-center justify-center h-9 w-9 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors ml-1"
                    title="Logout"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <Link 
                  to="/login" 
                  className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-full text-sm font-bold transition-colors shadow-sm ml-2"
                >
                  Sign In
                </Link>
              )}
            </div>

            {/* Mobile Header Actions */}
            <div className="flex md:hidden items-center gap-2">
              {user && profile ? (
                <>
                  <Link 
                    to={`/${profile.role}`} 
                    className="flex items-center justify-center h-9 w-9 rounded-full bg-primary-50 text-primary-700 border border-primary-100"
                  >
                    <User className="h-4 w-4" />
                  </Link>
                  <button 
                    onClick={handleLogout}
                    className="flex items-center justify-center h-9 w-9 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <Link 
                  to="/login" 
                  className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-full text-sm font-bold transition-colors shadow-sm"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation */}
      <div className={`md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50 pb-[env(safe-area-inset-bottom)] transition-transform duration-300 ease-in-out ${isBottomNavVisible ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="flex justify-around items-center h-16 px-2">
          <Link to="/" className={`flex flex-col items-center justify-center w-full h-full ${location.pathname === '/' ? 'text-primary-600' : 'text-gray-500'}`}>
            <Home className="h-5 w-5 mb-1" />
            <span className="text-[10px] font-bold">Home</span>
          </Link>
          <Link to="/search" className={`flex flex-col items-center justify-center w-full h-full ${location.pathname.startsWith('/search') ? 'text-primary-600' : 'text-gray-500'}`}>
            <Search className="h-5 w-5 mb-1" />
            <span className="text-[10px] font-bold">Search</span>
          </Link>
          
          {user && profile && (profile.role === 'tenant' || profile.role === 'landlord') && (
            <>
              {profile.role === 'tenant' && (
                <Link to="/tenant" className={`flex flex-col items-center justify-center w-full h-full ${location.pathname === '/tenant' ? 'text-primary-600' : 'text-gray-500'}`}>
                  <Heart className="h-5 w-5 mb-1" />
                  <span className="text-[10px] font-bold">Saved</span>
                </Link>
              )}
              <Link to="/messages" className={`flex flex-col items-center justify-center w-full h-full relative ${location.pathname.startsWith('/messages') ? 'text-primary-600' : 'text-gray-500'}`}>
                <div className="relative">
                  <MessageSquare className="h-5 w-5 mb-1" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-bold">Messages</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </>
  );
}
