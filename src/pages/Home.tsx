import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, where, limit, onSnapshot, getDoc, doc, getDocs, addDoc, deleteDoc, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Search, MapPin, DollarSign, Home as HomeIcon, Building, Warehouse, Store, Heart, ShieldCheck, Filter, Bed, Sofa, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';

import { handleFirestoreError, OperationType } from '../utils/errorHandling';

interface Property {
  id: string;
  title: string;
  location: string;
  price: number;
  propertyType: string;
  images?: string[];
  status: string;
  landlordId: string;
  bedrooms?: number;
  furnished?: boolean;
  landlordTrustScore?: number;
  landlordVerified?: boolean;
  isExternal?: boolean;
  externalSource?: string;
}

const CATEGORIES = [
  { id: 'all', label: 'All', icon: HomeIcon },
  { id: 'apartment', label: 'Apartment', icon: Building },
  { id: 'house', label: 'Home', icon: HomeIcon },
  { id: 'studio', label: 'Studio', icon: Building },
];

let cachedHomeProperties: Property[] | null = null;
const homeShuffleSeed = new Map<string, number>();
let cachedHomeSearchTerm = '';
let cachedHomeActiveCategory = 'all';
let cachedHomeSortBy = 'recommended';

import ImageCarousel from '../components/ImageCarousel';

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [properties, setProperties] = useState<Property[]>(cachedHomeProperties || []);
  const [savedProperties, setSavedProperties] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(cachedHomeProperties === null);
  const [searchTerm, setSearchTerm] = useState(cachedHomeSearchTerm);
  const [activeCategory, setActiveCategory] = useState(cachedHomeActiveCategory);
  const [sortBy, setSortBy] = useState(cachedHomeSortBy);

  useEffect(() => { cachedHomeSearchTerm = searchTerm; }, [searchTerm]);
  useEffect(() => { cachedHomeActiveCategory = activeCategory; }, [activeCategory]);
  useEffect(() => { cachedHomeSortBy = sortBy; }, [sortBy]);

  useEffect(() => {
    const q = query(
      collection(db, 'properties'),
      where('status', '==', 'available')
    );
    
    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
      const props: Property[] = [];
      
      // Fetch landlord trust info for each property
      for (const document of querySnapshot.docs) {
        const data = document.data();
        let trustScore = 50;
        let isVerified = false;
        
        try {
          if (data.landlordId && data.landlordId !== 'external_network') {
            const landlordDoc = await getDoc(doc(db, 'users', data.landlordId));
            if (landlordDoc.exists()) {
              const landlordData = landlordDoc.data();
              trustScore = landlordData.trustScore ?? 50;
              isVerified = landlordData.isVerified ?? false;
            }
          }
        } catch (e) {
          console.error("Failed to fetch landlord trust info", e);
        }

        props.push({ 
          id: document.id, 
          ...data,
          landlordTrustScore: trustScore,
          landlordVerified: isVerified
        } as Property);
      }
      
      // Stable shuffle: assign a random number to each new property
      props.forEach(p => {
        if (!homeShuffleSeed.has(p.id)) {
          homeShuffleSeed.set(p.id, Math.random());
        }
      });
      
      cachedHomeProperties = props;
      setProperties(props);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'properties');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch saved properties for the current user
  useEffect(() => {
    if (!user) {
      setSavedProperties(new Set());
      return;
    }

    const savedQuery = query(
      collection(db, 'saved_properties'),
      where('tenantId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(savedQuery, (snapshot) => {
      const savedIds = new Set<string>();
      snapshot.forEach((doc) => {
        savedIds.add(doc.data().propertyId);
      });
      setSavedProperties(savedIds);
    });

    return () => unsubscribe();
  }, [user]);

  const filteredProperties = properties.filter(p => {
    const title = p.title || '';
    const location = p.location || '';
    const search = searchTerm.trim().toLowerCase();
    const matchesSearch = search === '' || 
                          title.toLowerCase().includes(search) || 
                          location.toLowerCase().includes(search);
    const matchesCategory = activeCategory === 'all' || p.propertyType?.toLowerCase() === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const sortedProperties = [...filteredProperties].sort((a, b) => {
    if (sortBy === 'price_asc') {
      return a.price - b.price;
    } else if (sortBy === 'price_desc') {
      return b.price - a.price;
    } else {
      // recommended (shuffle)
      return (homeShuffleSeed.get(a.id) || 0) - (homeShuffleSeed.get(b.id) || 0);
    }
  });

  const handleSaveProperty = async (e: React.MouseEvent, propertyId: string) => {
    e.preventDefault();
    if (!user) {
      navigate('/login');
      return;
    }

    try {
      const isSaved = savedProperties.has(propertyId);
      
      if (isSaved) {
        // Find and delete saved property
        const savedQuery = query(
          collection(db, 'saved_properties'), 
          where('tenantId', '==', user.uid),
          where('propertyId', '==', propertyId)
        );
        const savedSnap = await getDocs(savedQuery);
        
        if (!savedSnap.empty) {
          const deletePromises = savedSnap.docs.map(doc => deleteDoc(doc.ref));
          await Promise.all(deletePromises);
        }
      } else {
        // Add to saved_properties
        await addDoc(collection(db, 'saved_properties'), {
          tenantId: user.uid,
          propertyId: propertyId,
          createdAt: serverTimestamp()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'properties/saved_properties');
    }
  };

  return (
    <div className="bg-background min-h-screen pb-20">
      {/* Hero Section */}
      <div className="relative bg-white pt-16 pb-12 px-4 sm:px-6 lg:px-8 border-b border-gray-100">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl sm:text-5xl md:text-6xl font-outfit font-bold text-primary-900 tracking-tight leading-tight"
            >
              Discover spaces you can <span className="text-primary-600">trust</span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto font-medium"
            >
              Curated rentals with verified landlords, transparent pricing, and secure payments.
            </motion.p>
            
            {/* Search Bar */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-10 max-w-3xl mx-auto relative group"
            >
              <div className="flex bg-white border border-gray-200 rounded-full shadow-sm hover:shadow-md transition-shadow p-2 items-center">
                <div className="flex-1 flex items-center pl-4">
                  <Search className="h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    className="w-full pl-3 pr-4 py-3 bg-transparent border-none focus:ring-0 text-gray-900 placeholder-gray-400 text-base font-medium"
                    placeholder="Search by location or neighborhood..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (searchTerm) {
                          navigate(`/search?q=${encodeURIComponent(searchTerm)}`);
                        } else {
                          navigate('/search');
                        }
                      }
                    }}
                  />
                </div>
                <div className="h-8 w-px bg-gray-200 mx-2 hidden sm:block"></div>
                <button className="hidden sm:flex items-center gap-2 px-4 py-3 text-gray-600 hover:text-primary-600 font-bold transition-colors">
                  <Filter className="h-4 w-4" />
                  <span>Filters</span>
                </button>
                <button 
                  onClick={() => {
                    if (searchTerm) {
                      navigate(`/search?q=${encodeURIComponent(searchTerm)}`);
                    } else {
                      navigate('/search');
                    }
                  }}
                  className="ml-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-full transition-colors shadow-sm"
                >
                  Search
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        <div className="flex space-x-6 overflow-x-auto pb-4 hide-scrollbar">
          {CATEGORIES.map((category) => {
            const Icon = category.icon;
            const isActive = activeCategory === category.id;
            return (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`flex flex-col items-center justify-center min-w-[70px] gap-2 transition-all ${
                  isActive 
                    ? 'text-primary-700 border-b-2 border-primary-700 pb-2' 
                    : 'text-gray-500 hover:text-gray-900 border-b-2 border-transparent pb-2 hover:border-gray-300'
                }`}
              >
                <Icon className={`h-6 w-6 ${isActive ? 'text-primary-700' : 'text-gray-400'}`} />
                <span className="text-sm font-bold">{category.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Property Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-xl font-outfit font-bold text-gray-900">
            {sortedProperties.length} {sortedProperties.length === 1 ? 'property' : 'properties'} found
          </h2>
          
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-500">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-white border border-gray-200 text-gray-700 text-sm rounded-xl focus:ring-primary-500 focus:border-primary-500 block p-2.5 font-medium"
            >
              <option value="recommended">Recommended</option>
              <option value="price_asc">Price: Lowest to Highest</option>
              <option value="price_desc">Price: Highest to Lowest</option>
            </select>
          </div>
        </div>
        
        {loading ? (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm animate-pulse h-[380px]">
                <div className="aspect-[4/3] bg-gray-200 w-full"></div>
                <div className="p-6 flex flex-col gap-4">
                  <div className="h-6 bg-gray-200 rounded-md w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded-md w-1/2"></div>
                  <div className="flex gap-3 mt-2">
                    <div className="h-4 bg-gray-200 rounded-md w-1/4"></div>
                    <div className="h-4 bg-gray-200 rounded-md w-1/4"></div>
                  </div>
                  <div className="mt-auto pt-4 border-t border-gray-100 flex justify-between">
                    <div className="h-6 bg-gray-200 rounded-md w-1/3"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : sortedProperties.length > 0 ? (
          <>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sortedProperties.map((property, index) => (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                key={property.id} 
              >
                <Link to={`/property/${property.id}`} state={{ property }} className="group block h-full">
                  <div className="flex flex-col h-full bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                    {/* Image Container */}
                    <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
                      {property.isExternal && (
                        <div className="absolute top-4 left-4 z-10 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-primary-600" />
                          <span className="text-xs font-bold text-gray-900">Partner Listing</span>
                        </div>
                      )}
                      <ImageCarousel images={property.images} title={property.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" />
                      
                      {/* Trust Badge */}
                      {property.landlordVerified && (
                        <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-white/95 backdrop-blur-md text-primary-900 px-3 py-1.5 rounded-full text-xs font-bold shadow-sm border border-white/20">
                          <ShieldCheck className="h-4 w-4 text-accent-600" />
                          <span>Verified Host</span>
                        </div>
                      )}
                      
                      {/* Favorite Button */}
                      <button 
                        className={`absolute top-4 right-4 p-2.5 backdrop-blur-sm rounded-full transition-colors shadow-sm ${
                          savedProperties.has(property.id)
                            ? 'bg-accent-50 text-accent-600 hover:bg-accent-100'
                            : 'bg-white/90 text-gray-400 hover:text-red-500 hover:bg-white'
                        }`}
                        onClick={(e) => handleSaveProperty(e, property.id)}
                      >
                        <Heart className={`h-4 w-4 ${savedProperties.has(property.id) ? 'fill-current' : ''}`} />
                      </button>
                    </div>
                    
                    {/* Content */}
                    <div className="p-6 flex flex-col flex-grow">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-lg font-outfit font-bold text-gray-900 line-clamp-1 group-hover:text-primary-600 transition-colors">
                          {property.title}
                        </h3>
                      </div>
                      
                      <div className="flex items-center text-sm font-medium text-gray-500 mb-4">
                        <span className="line-clamp-1">{property.location}</span>
                      </div>

                      <div className="flex items-center gap-3 text-sm font-medium text-gray-600 mb-6">
                        {property.bedrooms && (
                          <div className="flex items-center gap-1.5">
                            <Bed className="h-4 w-4 text-gray-400" />
                            <span>{property.bedrooms} Beds</span>
                          </div>
                        )}
                        {property.furnished && (
                          <div className="flex items-center gap-1.5">
                            <Sofa className="h-4 w-4 text-gray-400" />
                            <span>Furnished</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between">
                        <div className="flex items-baseline text-primary-900">
                          <span className="text-xl font-outfit font-bold">₦{property.price.toLocaleString()}</span>
                          <span className="text-sm font-medium text-gray-500 ml-1">/ year</span>
                        </div>
                        {property.landlordTrustScore && property.landlordTrustScore >= 80 && (
                          <div className="text-xs font-bold text-accent-700 bg-accent-50 px-2.5 py-1 rounded-md">
                            Top Rated
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </>
        ) : (
          <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm">
            <div className="mx-auto h-20 w-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
              <Search className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-outfit font-bold text-gray-900">No properties found</h3>
            <p className="mt-2 text-gray-500 max-w-sm mx-auto font-medium">
              {searchTerm 
                ? "We couldn't find anything matching your search. Try adjusting your filters." 
                : "There are currently no properties available in this category."}
            </p>
            {(searchTerm || activeCategory !== 'all') && (
              <button 
                onClick={() => {
                  setSearchTerm('');
                  setActiveCategory('all');
                }}
                className="mt-6 text-primary-600 font-bold hover:text-primary-700 bg-primary-50 px-6 py-2.5 rounded-xl transition-colors"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
