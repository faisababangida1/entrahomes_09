import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { doc, getDoc, addDoc, collection, query, where, getDocs, onSnapshot, updateDoc, increment, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { MapPin, DollarSign, Home as HomeIcon, Heart, Calendar, MessageSquare, ShieldCheck, Bed, Sofa, CheckCircle2, AlertCircle, X, Sparkles, ExternalLink } from 'lucide-react';
import { motion } from 'motion/react';
import TrustBadge from '../components/TrustBadge';

import { handleFirestoreError, OperationType } from '../utils/errorHandling';
import { getExternalPropertyById } from '../services/externalListings';

export default function PropertyDetails() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const stateProperty = location.state?.property;
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [property, setProperty] = useState<any>(null);
  const [landlord, setLandlord] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [messaging, setMessaging] = useState(false);

  useEffect(() => {
    if (!id) return;

    if (stateProperty) {
      setProperty(stateProperty);
      setLandlord({ 
        name: 'Partner Network Landlord', 
        email: 'partner@rentra.com', 
        role: 'landlord', 
        isVerified: true,
        trustScore: 95,
        uid: 'external_network'
      });
      setLoading(false);
      return;
    }

    if (id.startsWith('ext_')) {
      const fetchExternal = async () => {
        const extProp = await getExternalPropertyById(id);
        if (extProp) {
          setProperty(extProp);
          setLandlord({ 
            name: 'Partner Network Landlord', 
            email: 'partner@rentra.com', 
            role: 'landlord', 
            isVerified: true,
            trustScore: 95,
            uid: 'external_network'
          });
        }
        setLoading(false);
      };
      fetchExternal();
      return;
    }

    const docRef = doc(db, 'properties', id);
    const unsubscribe = onSnapshot(docRef, async (docSnap) => {
      if (docSnap.exists()) {
        const propData = { id: docSnap.id, ...(docSnap.data() as any) };
        setProperty(propData);
        
        // Fetch landlord details (only if not already fetched or if landlordId changed)
        if (!landlord || landlord.uid !== propData.landlordId) {
          try {
            const landlordRef = doc(db, 'users', propData.landlordId);
            const landlordSnap = await getDoc(landlordRef);
            if (landlordSnap.exists()) {
              setLandlord(landlordSnap.data());
            }
          } catch (error) {
            console.error("Error fetching landlord:", error);
          }
        }

        // Check if saved by current tenant
        if (user && profile?.role === 'tenant') {
          try {
            const savedQuery = query(
              collection(db, 'saved_properties'), 
              where('tenantId', '==', user.uid),
              where('propertyId', '==', id)
            );
            const savedSnap = await getDocs(savedQuery);
            setIsSaved(!savedSnap.empty);
          } catch (error) {
            console.error("Error checking saved status:", error);
          }
        }
      } else {
        console.log("No such document!");
        setProperty(null);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `properties/${id}`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id, user, profile]);

  const handleSaveProperty = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (profile?.role !== 'tenant') return;

    setSaving(true);
    try {
      const propertyRef = doc(db, 'properties', id);
      
      if (isSaved) {
        // Find and delete saved property
        const savedQuery = query(
          collection(db, 'saved_properties'), 
          where('tenantId', '==', user.uid),
          where('propertyId', '==', id)
        );
        const savedSnap = await getDocs(savedQuery);
        
        if (!savedSnap.empty) {
          // Delete all matching docs (should be only one)
          const deletePromises = savedSnap.docs.map(doc => deleteDoc(doc.ref));
          await Promise.all(deletePromises);
        }
        
        setIsSaved(false);
      } else {
        // Add to saved_properties
        await addDoc(collection(db, 'saved_properties'), {
          tenantId: user.uid,
          propertyId: id,
          createdAt: serverTimestamp()
        });
        
        setIsSaved(true);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'properties/saved_properties');
    } finally {
      setSaving(false);
    }
  };

  const [isBottomNavVisible, setIsBottomNavVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
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

  const handleMessageLandlord = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (profile?.role !== 'tenant' || !landlord) return;

    setMessaging(true);
    try {
      // Check if conversation already exists
      const q = query(
        collection(db, 'conversations'),
        where('propertyId', '==', property.id),
        where('tenantId', '==', user.uid)
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        // Conversation exists, navigate to messages
        navigate('/messages');
      } else {
        // Create new conversation
        await addDoc(collection(db, 'conversations'), {
          propertyId: property.id,
          propertyTitle: property.title,
          tenantId: user.uid,
          tenantName: profile.name,
          landlordId: property.landlordId,
          landlordName: landlord.name,
          updatedAt: serverTimestamp()
        });
        navigate('/messages');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'conversations');
    } finally {
      setMessaging(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>;
  }

  if (!property) {
    return <div className="text-center p-12 text-gray-500 font-medium">Property not found.</div>;
  }

  return (
    <div className="bg-background min-h-screen pb-32 lg:pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Image Gallery */}
        <div className="rounded-3xl overflow-hidden mb-8 h-[400px] md:h-[500px] relative group">
          {property.images && property.images.length > 0 ? (
            <div className="flex w-full h-full overflow-x-auto snap-x snap-mandatory scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {property.images.map((imgUrl: string, index: number) => (
                <div key={index} className="w-full h-full flex-shrink-0 snap-center relative">
                  <img className="w-full h-full object-cover" src={imgUrl} alt={`${property.title} - Image ${index + 1}`} referrerPolicy="no-referrer" />
                  
                  {/* Status Badge on first image */}
                  {index === 0 && (
                    <div className="absolute top-6 left-6 flex gap-2">
                      <span className={`px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wider shadow-md backdrop-blur-sm ${
                        property.status === 'available' ? 'bg-white/95 text-accent-700' : 'bg-gray-900/90 text-white'
                      }`}>
                        {property.status}
                      </span>
                    </div>
                  )}

                  {/* Partner Listing Badge on first image */}
                  {index === 0 && property.isExternal && (
                    <div className="absolute top-6 right-6 z-10 bg-white/95 backdrop-blur-sm px-4 py-2 rounded-full shadow-md flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary-600" />
                      <span className="text-sm font-bold text-gray-900">Partner Listing</span>
                    </div>
                  )}
                  
                  {/* Image Counter */}
                  <div className="absolute bottom-6 right-6 bg-black/60 text-white px-3 py-1 rounded-full text-sm font-medium backdrop-blur-sm">
                    {index + 1} / {property.images.length}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-300 relative">
              <HomeIcon className="h-24 w-24" />
              <div className="absolute top-6 left-6 flex gap-2">
                <span className={`px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wider shadow-md backdrop-blur-sm ${
                  property.status === 'available' ? 'bg-white/95 text-accent-700' : 'bg-gray-900/90 text-white'
                }`}>
                  {property.status}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-12">
          {/* Main Content */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-outfit font-bold text-primary-900 tracking-tight leading-tight">{property.title}</h1>
            </div>
            
            <div className="flex items-center text-gray-500 mb-6 text-lg font-medium">
              <MapPin className="h-5 w-5 mr-2 text-gray-400" />
              {property.location}
            </div>

            <div className="flex flex-wrap gap-4 py-6 border-y border-gray-100 mb-8">
              <div className="flex items-center gap-2 text-gray-700 bg-gray-50 px-4 py-2 rounded-xl">
                <HomeIcon className="h-5 w-5 text-gray-400" />
                <span className="font-medium capitalize">{property.propertyType === 'house' ? 'Home' : property.propertyType}</span>
              </div>
              {property.bedrooms && (
                <div className="flex items-center gap-2 text-gray-700 bg-gray-50 px-4 py-2 rounded-xl">
                  <Bed className="h-5 w-5 text-gray-400" />
                  <span className="font-medium">{property.bedrooms} Bedrooms</span>
                </div>
              )}
              {property.furnished && (
                <div className="flex items-center gap-2 text-gray-700 bg-gray-50 px-4 py-2 rounded-xl">
                  <Sofa className="h-5 w-5 text-gray-400" />
                  <span className="font-medium">Furnished</span>
                </div>
              )}
            </div>
            
            <div className="prose max-w-none text-gray-600 mb-12">
              <h3 className="text-2xl font-outfit font-bold text-primary-900 mb-4">About this property</h3>
              <p className="whitespace-pre-line text-lg leading-relaxed">{property.description}</p>
            </div>
          </div>

          {/* Sidebar / Actions */}
          <div className="w-full lg:w-[400px] flex-shrink-0">
            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl sticky top-28 hidden lg:block">
              <div className="flex items-end mb-6 pb-6 border-b border-gray-100">
                <span className="text-4xl font-outfit font-bold text-primary-900">₦{property.price.toLocaleString()}</span>
                <span className="text-gray-500 ml-2 mb-1 font-medium text-lg">/ year</span>
              </div>

              {landlord && (
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Meet your host</p>
                    <TrustBadge score={landlord.trustScore} isVerified={landlord.isVerified} />
                  </div>
                  {property?.isExternal ? (
                    <a href={`https://wa.me/+2349120851828?text=${encodeURIComponent(`Hi EntraHomes, I am interested in this property: ${property.title}. Source: ${property.externalUrl || window.location.href}`)}`} target="_blank" rel="noopener noreferrer" className="flex items-center bg-gray-50 p-4 rounded-2xl border border-gray-100 hover:bg-gray-100 transition-colors">
                      <div className="h-14 w-14 rounded-full bg-[#25D366] flex items-center justify-center text-white font-bold text-xl mr-4 border-2 border-white shadow-sm">
                        <MessageSquare className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="font-bold text-primary-900 text-lg">EntraHomes Concierge</p>
                        <p className="text-sm text-gray-500 font-medium flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5 text-accent-600" />
                          Chat on WhatsApp
                        </p>
                      </div>
                    </a>
                  ) : (
                    <Link to={`/profile/${landlord.id}`} className="flex items-center bg-gray-50 p-4 rounded-2xl border border-gray-100 hover:bg-gray-100 transition-colors">
                      <div className="h-14 w-14 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-xl mr-4 border-2 border-white shadow-sm">
                        {landlord.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-primary-900 text-lg">{landlord.name}</p>
                        <p className="text-sm text-gray-500 font-medium flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5 text-accent-600" />
                          Identity verified
                        </p>
                      </div>
                    </Link>
                  )}
                </div>
              )}

              <div className="space-y-4">
                {property?.isExternal ? (
                  <a
                    href={`https://wa.me/+2349120851828?text=${encodeURIComponent(`Hi Rentra, I am interested in this property: ${property.title}. Source: ${property.externalUrl || window.location.href}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center px-6 py-4 border border-transparent text-lg font-bold rounded-2xl text-white bg-[#25D366] hover:bg-[#128C7E] focus:outline-none focus:ring-4 focus:ring-[#25D366]/30 transition-all shadow-md hover:shadow-lg"
                  >
                    <MessageSquare className="h-5 w-5 mr-2" />
                    Contact via WhatsApp
                  </a>
                ) : (
                  (!user || profile?.role === 'tenant') && (
                    <>
                      <button
                        onClick={handleMessageLandlord}
                        disabled={property.status !== 'available' || messaging}
                        className="w-full flex items-center justify-center px-6 py-4 border border-transparent text-lg font-bold rounded-2xl text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-4 focus:ring-primary-100 disabled:opacity-50 transition-all shadow-md hover:shadow-lg hidden lg:flex"
                      >
                        {messaging ? 'Opening...' : 'Contact Caretaker'}
                      </button>
                      
                      <div className="grid grid-cols-1 gap-4 hidden lg:grid">
                        <button
                          onClick={handleSaveProperty}
                          disabled={saving}
                          className={`w-full flex items-center justify-center px-4 py-3 border text-sm font-bold rounded-xl focus:outline-none focus:ring-4 transition-all shadow-sm ${
                            isSaved 
                              ? 'border-accent-200 bg-accent-50 text-accent-700 hover:bg-accent-100 focus:ring-accent-100' 
                              : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 focus:ring-gray-100'
                          }`}
                        >
                          <Heart className={`h-4 w-4 mr-2 ${isSaved ? 'fill-current text-accent-600' : 'text-gray-400'}`} />
                          {isSaved ? 'Saved' : 'Save'}
                        </button>
                      </div>
                    </>
                  )
                )}
                
                {!user && (
                  <p className="text-sm text-center text-gray-500 mt-6 font-medium">
                    Please log in as a tenant to save or rent this property.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Sticky Action Bar */}
      <div 
        className={`lg:hidden fixed left-0 right-0 bg-white border-t border-gray-100 p-4 flex items-center justify-between z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] transition-all duration-300 ease-in-out ${
          isBottomNavVisible 
            ? (user ? 'bottom-[calc(4rem+env(safe-area-inset-bottom))]' : 'bottom-0 pb-[max(1rem,env(safe-area-inset-bottom))]')
            : 'bottom-0 pb-[max(1rem,env(safe-area-inset-bottom))]'
        }`}
      >
        <div>
          <span className="text-2xl font-outfit font-bold text-primary-900">₦{property.price.toLocaleString()}</span>
          <span className="text-sm text-gray-500 font-medium ml-1">/ year</span>
        </div>
        {property?.isExternal ? (
          <a
            href={`https://wa.me/+2349120851828?text=${encodeURIComponent(`Hi EntraHomes, I am interested in this property: ${property.title}. Source: ${property.externalUrl || window.location.href}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#25D366] hover:bg-[#128C7E] text-white px-6 py-3 rounded-xl font-bold transition-colors shadow-sm flex items-center"
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            WhatsApp
          </a>
        ) : (
          (!user || profile?.role === 'tenant') && (
            <button
              onClick={handleMessageLandlord}
              disabled={property.status !== 'available' || messaging}
              className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-xl font-bold transition-colors shadow-sm disabled:opacity-50"
            >
              {messaging ? 'Opening...' : 'Contact Caretaker'}
            </button>
          )
        )}
      </div>
    </div>
  );
}
