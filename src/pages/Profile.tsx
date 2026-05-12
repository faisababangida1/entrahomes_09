import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { ShieldCheck, Star, Home, Calendar, MapPin, CheckCircle2 } from 'lucide-react';
import TrustBadge from '../components/TrustBadge';
import ImageCarousel from '../components/ImageCarousel';

export default function Profile() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<any>(null);
  const [properties, setProperties] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!id) return;
      
      try {
        // Fetch user profile
        const userDoc = await getDoc(doc(db, 'users', id));
        if (userDoc.exists()) {
          setProfile({ id: userDoc.id, ...userDoc.data() });
          
          // If landlord, fetch their properties
          if (userDoc.data().role === 'landlord') {
            const propsQuery = query(collection(db, 'properties'), where('landlordId', '==', id), where('status', '==', 'available'));
            const propsSnap = await getDocs(propsQuery);
            const props: any[] = [];
            propsSnap.forEach(doc => props.push({ id: doc.id, ...doc.data() }));
            setProperties(props);
          }
          
          // Fetch reviews for this user
          const reviewsQuery = query(collection(db, 'reviews'), where('revieweeId', '==', id));
          const reviewsSnap = await getDocs(reviewsQuery);
          const revs: any[] = [];
          reviewsSnap.forEach(doc => revs.push({ id: doc.id, ...doc.data() }));
          setReviews(revs);
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [id]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>;
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-outfit font-bold text-gray-900">Profile not found</h2>
          <p className="text-gray-500 mt-2">The user you are looking for does not exist.</p>
        </div>
      </div>
    );
  }

  const averageRating = reviews.length > 0 
    ? reviews.reduce((acc, curr) => acc + curr.rating, 0) / reviews.length 
    : 0;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header Profile Section */}
      <div className="bg-white border-b border-gray-100 pt-12 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
            <div className="h-32 w-32 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-5xl border-4 border-white shadow-lg flex-shrink-0">
              {profile.name.charAt(0)}
            </div>
            
            <div className="flex-1 text-center md:text-left">
              <div className="flex flex-col md:flex-row md:items-center gap-3 mb-2 justify-center md:justify-start">
                <h1 className="text-3xl font-outfit font-bold text-primary-900">{profile.name}</h1>
                {profile.isVerified && (
                  <div className="flex items-center gap-1.5 bg-accent-50 text-accent-700 px-3 py-1 rounded-full text-sm font-bold border border-accent-100 w-fit mx-auto md:mx-0">
                    <ShieldCheck className="h-4 w-4" />
                    Verified {profile.role === 'landlord' ? 'Host' : 'Tenant'}
                  </div>
                )}
              </div>
              
              <p className="text-gray-500 font-medium mb-6 capitalize">{profile.role}</p>
              
              <div className="flex flex-wrap justify-center md:justify-start gap-6">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-gray-50 rounded-xl">
                    <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{averageRating > 0 ? averageRating.toFixed(1) : 'New'}</p>
                    <p className="text-xs text-gray-500 font-medium">{reviews.length} Reviews</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-gray-50 rounded-xl">
                    <ShieldCheck className="h-5 w-5 text-primary-500" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{profile.trustScore || 50}/100</p>
                    <p className="text-xs text-gray-500 font-medium">Trust Score</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-gray-50 rounded-xl">
                    <Calendar className="h-5 w-5 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">Joined</p>
                    <p className="text-xs text-gray-500 font-medium">{new Date(profile.createdAt).getFullYear()}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Left Column: Verification & Details */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-outfit font-bold text-primary-900 mb-4">Verified Info</h3>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-gray-700">
                  <CheckCircle2 className="h-5 w-5 text-accent-500" />
                  <span className="font-medium">Identity</span>
                </li>
                <li className="flex items-center gap-3 text-gray-700">
                  <CheckCircle2 className="h-5 w-5 text-accent-500" />
                  <span className="font-medium">Email address</span>
                </li>
              </ul>
            </div>
            
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-outfit font-bold text-primary-900 mb-4">About Trust Score</h3>
              <p className="text-sm text-gray-600 leading-relaxed mb-4">
                Trust Scores are calculated based on verified identity, positive reviews, and platform activity. A higher score indicates a more reliable user.
              </p>
              <TrustBadge score={profile.trustScore || 50} isVerified={profile.isVerified} />
            </div>
          </div>

          {/* Right Column: Reviews & Properties */}
          <div className="md:col-span-2 space-y-8">
            
            {/* Reviews Section */}
            <div>
              <h2 className="text-2xl font-outfit font-bold text-primary-900 mb-6">What people are saying</h2>
              
              {reviews.length > 0 ? (
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <div key={review.id} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold">
                            {review.reviewerName ? review.reviewerName.charAt(0) : 'U'}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900">{review.reviewerName || 'Anonymous'}</p>
                            <p className="text-xs text-gray-500">{new Date(review.createdAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex">
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} className={`h-4 w-4 ${i < review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`} />
                          ))}
                        </div>
                      </div>
                      <p className="text-gray-700 leading-relaxed">{review.comment}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 text-center">
                  <Star className="mx-auto h-10 w-10 text-gray-300 mb-3" />
                  <p className="text-gray-500 font-medium">No reviews yet.</p>
                </div>
              )}
            </div>

            {/* Properties Section (Landlords only) */}
            {profile.role === 'landlord' && (
              <div className="pt-4">
                <h2 className="text-2xl font-outfit font-bold text-primary-900 mb-6">{profile.name}'s Listings</h2>
                
                {properties.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {properties.map((property) => (
                      <Link to={`/property/${property.id}`} key={property.id} className="group flex flex-col rounded-2xl shadow-sm overflow-hidden bg-white border border-gray-100 hover:shadow-md transition-all">
                        <div className="h-40 bg-gray-200 relative overflow-hidden">
                          <ImageCarousel images={property.images} title={property.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        </div>
                        <div className="p-4">
                          <h3 className="font-bold text-gray-900 line-clamp-1 group-hover:text-primary-600 transition-colors">{property.title}</h3>
                          <p className="text-sm text-gray-500 mt-1 line-clamp-1">{property.location}</p>
                          <p className="font-bold text-primary-900 mt-2">${property.price}/mo</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 text-center">
                    <Home className="mx-auto h-10 w-10 text-gray-300 mb-3" />
                    <p className="text-gray-500 font-medium">No active listings.</p>
                  </div>
                )}
              </div>
            )}
            
          </div>
        </div>
      </div>
    </div>
  );
}
