import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, getDocs, onSnapshot, doc, getDoc, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Home, DollarSign, Bookmark, Clock, ShieldCheck, Star, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import { handleFirestoreError, OperationType } from '../utils/errorHandling';
import ReviewModal from '../components/ReviewModal';
import TrustBadge from '../components/TrustBadge';
import ImageCarousel from '../components/ImageCarousel';

export default function TenantDashboard() {
  const { user, profile } = useAuth();
  const [savedProperties, setSavedProperties] = useState<any[]>([]);
  const [availableProperties, setAvailableProperties] = useState<any[]>([]);
  const [leases, setLeases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<{revieweeId: string, propertyId: string, leaseId: string} | null>(null);

  useEffect(() => {
    if (!user) return;

    // Fetch leases
    const leasesQuery = query(collection(db, 'leases'), where('tenantId', '==', user.uid));
    const unsubscribeLeases = onSnapshot(leasesQuery, async (snapshot) => {
      const l: any[] = [];
      for (const document of snapshot.docs) {
        const leaseData = document.data();
        let propertyData = null;
        try {
          const propDoc = await getDoc(doc(db, 'properties', leaseData.propertyId));
          if (propDoc.exists()) {
            propertyData = propDoc.data();
          }
        } catch (e) {
          console.error("Failed to fetch property details for lease", e);
        }
        l.push({ id: document.id, ...leaseData, property: propertyData });
      }
      setLeases(l);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'leases');
    });

    // Fetch saved properties
    const savedQuery = query(collection(db, 'saved_properties'), where('tenantId', '==', user.uid));
    const unsubscribeSaved = onSnapshot(savedQuery, async (snapshot) => {
      const savedProps: any[] = [];
      for (const document of snapshot.docs) {
        const savedData = document.data();
        let propertyData = null;
        try {
          const propDoc = await getDoc(doc(db, 'properties', savedData.propertyId));
          if (propDoc.exists()) {
            propertyData = propDoc.data();
          }
        } catch (e) {
          console.error("Failed to fetch property details for saved property", e);
        }
        savedProps.push({ id: document.id, ...savedData, property: propertyData });
      }
      setSavedProperties(savedProps);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'saved_properties');
    });

    // Fetch available properties
    const availableQuery = query(collection(db, 'properties'), where('status', '==', 'available'), limit(20));
    const unsubscribeAvailable = onSnapshot(availableQuery, (snapshot) => {
      const props: any[] = [];
      snapshot.forEach(doc => props.push({ id: doc.id, ...doc.data() }));
      setAvailableProperties(props);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'properties');
      setLoading(false);
    });

    return () => {
      unsubscribeLeases();
      unsubscribeSaved();
      unsubscribeAvailable();
    };
  }, [user]);

  if (loading) {
    return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>;
  }

  return (
    <div className="bg-background min-h-screen pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-outfit font-bold text-primary-900 tracking-tight">
              Welcome back, {profile?.name}
            </h1>
            <p className="text-gray-500 mt-2 text-lg">Manage your rentals, payments, and saved properties.</p>
          </div>
          <div className="bg-white px-6 py-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-6">
            <div className="text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">Trust Level</p>
              <div className="mt-1">
                <TrustBadge score={profile?.trustScore || 50} isVerified={profile?.isVerified} />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-8 sm:mb-10">
          <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-gray-100 flex items-center hover:shadow-md transition-shadow">
            <div className="p-4 rounded-2xl bg-primary-50 text-primary-600 mr-5">
              <Home className="h-8 w-8" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Active Leases</p>
              <p className="text-3xl font-outfit font-bold text-primary-900 mt-1">
                {leases.filter(l => l.status === 'active').length}
              </p>
            </div>
          </div>
          <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-gray-100 flex items-center hover:shadow-md transition-shadow">
            <div className="p-4 rounded-2xl bg-gray-50 text-gray-600 mr-5">
              <Bookmark className="h-8 w-8" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Saved Properties</p>
              <p className="text-3xl font-outfit font-bold text-primary-900 mt-1">{savedProperties.length}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 mb-6 sm:mb-8">
          {/* Leases */}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
            <div className="px-6 sm:px-8 py-5 sm:py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-xl font-outfit font-bold text-primary-900">My Leases</h3>
            </div>
            <div className="p-6 sm:p-8 flex-1">
              {leases.length > 0 ? (
                <ul className="divide-y divide-gray-100">
                  {leases.map((lease) => (
                    <li key={lease.id} className="py-6 first:pt-0 last:pb-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="flex items-center">
                        <div className={`p-4 rounded-2xl mr-4 ${
                          lease.status === 'active' ? 'bg-accent-50 text-accent-600' :
                          lease.status === 'pending' ? 'bg-yellow-50 text-yellow-600' :
                          'bg-gray-50 text-gray-600'
                        }`}>
                          <Home className="h-6 w-6" />
                        </div>
                        <div>
                          <Link to={`/property/${lease.propertyId}`} className="text-base font-bold text-primary-900 hover:text-primary-600 transition-colors line-clamp-1">
                            {lease.property?.title || `Property ID: ${lease.propertyId.substring(0, 8)}...`}
                          </Link>
                          <p className="text-sm text-gray-500 mt-1">
                            {new Date(lease.startDate).toLocaleDateString()} - {new Date(lease.endDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-left sm:text-right flex flex-col items-start sm:items-end gap-3 w-full sm:w-auto">
                        <p className="text-xl font-outfit font-bold text-primary-900">₦{lease.rentAmount.toLocaleString()}<span className="text-sm text-gray-500 font-medium">/yr</span></p>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                            lease.status === 'active' ? 'bg-accent-100 text-accent-800' : 
                            lease.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {lease.status}
                          </span>
                          {lease.status === 'active' && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setReviewTarget({
                                    revieweeId: lease.landlordId,
                                    propertyId: lease.propertyId,
                                    leaseId: lease.id
                                  });
                                  setReviewModalOpen(true);
                                }}
                                className="text-xs font-bold bg-gray-50 hover:bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg transition-colors border border-gray-200"
                              >
                                Review
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center py-12 text-gray-500 flex flex-col items-center justify-center h-full">
                  <div className="bg-gray-50 p-4 rounded-full mb-4">
                    <Home className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-lg font-medium text-gray-900">No active leases</p>
                  <p className="text-sm mt-1">When you rent a property, it will appear here.</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-6 sm:gap-8">
            {/* Saved Properties */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h3 className="text-xl font-outfit font-bold text-primary-900">Saved Properties</h3>
                <Link to="/" className="text-sm text-primary-600 hover:text-primary-800 font-bold flex items-center">
                  Find more <ChevronRight className="h-4 w-4 ml-1" />
                </Link>
              </div>
              <div className="p-8">
                {savedProperties.length > 0 ? (
                  <ul className="divide-y divide-gray-100">
                    {savedProperties.slice(0, 3).map((saved) => (
                      <li key={saved.id} className="py-4 first:pt-0 last:pb-0 flex justify-between items-center">
                        <div className="flex items-center">
                          <div className="h-12 w-12 bg-gray-100 rounded-xl flex items-center justify-center mr-4 overflow-hidden">
                            {saved.property?.images && saved.property.images.length > 0 ? (
                              <img src={saved.property.images[0]} alt={saved.property.title} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <Home className="h-5 w-5 text-gray-400" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-primary-900 line-clamp-1">{saved.property?.title || `Property ID: ${saved.propertyId.substring(0, 8)}...`}</p>
                            <p className="text-xs text-gray-500 font-medium mt-0.5">Saved {new Date(saved.createdAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <Link to={`/property/${saved.propertyId}`} className="text-sm font-bold text-primary-600 hover:text-primary-800 bg-primary-50 px-3 py-1.5 rounded-lg">
                          View
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Bookmark className="mx-auto h-10 w-10 text-gray-300 mb-3" />
                    <p>You haven't saved any properties yet.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Available Properties Suggestion */}
        <div className="mt-12">
          <div className="flex justify-between items-end mb-6">
            <div>
              <h3 className="text-2xl font-outfit font-bold text-primary-900">Recommended for you</h3>
              <p className="text-gray-500 mt-1">Explore available properties in your area.</p>
            </div>
            <Link to="/" className="text-sm text-primary-600 hover:text-primary-800 font-bold flex items-center bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100">
              View all <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </div>
          
          {availableProperties.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {availableProperties.slice(0, 3).map((property) => (
                <Link to={`/property/${property.id}`} key={property.id} className="group flex flex-col rounded-3xl shadow-sm overflow-hidden bg-white border border-gray-100 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                  <div className="flex-shrink-0 h-48 bg-gray-200 relative overflow-hidden">
                    {property.images && property.images.length > 0 ? (
                      <ImageCarousel images={property.images} title={property.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-gray-400">
                        <Home className="h-10 w-10" />
                      </div>
                    )}
                    <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm text-primary-900 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm">
                      {property.propertyType === 'house' ? 'home' : property.propertyType}
                    </div>
                  </div>
                  <div className="flex-1 p-6 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xl font-outfit font-bold text-primary-900 line-clamp-1">{property.title}</p>
                      </div>
                      <p className="text-sm text-gray-500 line-clamp-1 flex items-center font-medium">
                        {property.location}
                      </p>
                    </div>
                    <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
                      <div className="flex items-end text-primary-900">
                        <span className="text-2xl font-outfit font-bold">₦{property.price.toLocaleString()}</span>
                        <span className="text-sm font-medium text-gray-500 mb-1 ml-1">/yr</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-3xl border border-gray-100 text-gray-500">
              <Home className="mx-auto h-12 w-12 text-gray-300 mb-3" />
              <p>No available properties at the moment.</p>
            </div>
          )}
        </div>

        {reviewTarget && user && (
          <ReviewModal
            isOpen={reviewModalOpen}
            onClose={() => {
              setReviewModalOpen(false);
              setReviewTarget(null);
            }}
            reviewerId={user.uid}
            revieweeId={reviewTarget.revieweeId}
            type="landlord_review"
            propertyId={reviewTarget.propertyId}
            leaseId={reviewTarget.leaseId}
            onSuccess={() => alert('Review submitted successfully!')}
          />
        )}
      </div>
    </div>
  );
}
