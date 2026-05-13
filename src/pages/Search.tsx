import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { collection, query, where, limit, getDoc, doc, getDocs, addDoc, deleteDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Search as SearchIcon, MapPin, DollarSign, Home as HomeIcon, Building, Warehouse, Store, Heart, ShieldCheck, Filter, Bed, Sofa, X, Sparkles } from 'lucide-react';
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
  bathrooms?: number;
  furnished?: boolean;
  landlordTrustScore?: number;
  landlordVerified?: boolean;
  isExternal?: boolean;
  externalSource?: string;
  externalUrl?: string;
}

const CATEGORIES = [
  { id: 'all', label: 'All', icon: HomeIcon },
  { id: 'apartment', label: 'Apartment', icon: Building },
  { id: 'house', label: 'Home', icon: HomeIcon },
  { id: 'studio', label: 'Studio', icon: Building },
];

let cachedSearchProperties: Property[] | null = null;
const searchShuffleSeed = new Map<string, number>();
let cachedSearchTerm = '';
let cachedSearchActiveCategory = 'all';
let cachedSearchSortBy = 'recommended';
let cachedSearchMinPrice: number | '' = '';
let cachedSearchMaxPrice: number | '' = '';
let cachedSearchBeds: number | 'any' = 'any';
let cachedSearchBaths: number | 'any' = 'any';

import ImageCarousel from '../components/ImageCarousel';

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || cachedSearchTerm || '';
  const { user } = useAuth();
  
  const [properties, setProperties] = useState<Property[]>(cachedSearchProperties || []);
  const [savedProperties, setSavedProperties] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(cachedSearchProperties === null);
  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const [activeCategory, setActiveCategory] = useState(cachedSearchActiveCategory);
  const [sortBy, setSortBy] = useState(cachedSearchSortBy);
  
  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [minPrice, setMinPrice] = useState<number | ''>(cachedSearchMinPrice);
  const [maxPrice, setMaxPrice] = useState<number | ''>(cachedSearchMaxPrice);
  const [beds, setBeds] = useState<number | 'any'>(cachedSearchBeds);
  const [baths, setBaths] = useState<number | 'any'>(cachedSearchBaths);

  useEffect(() => { cachedSearchTerm = searchTerm; }, [searchTerm]);
  useEffect(() => { cachedSearchActiveCategory = activeCategory; }, [activeCategory]);
  useEffect(() => { cachedSearchSortBy = sortBy; }, [sortBy]);
  useEffect(() => { cachedSearchMinPrice = minPrice; }, [minPrice]);
  useEffect(() => { cachedSearchMaxPrice = maxPrice; }, [maxPrice]);
  useEffect(() => { cachedSearchBeds = beds; }, [beds]);
  useEffect(() => { cachedSearchBaths = baths; }, [baths]);

  const activeFilterCount = (minPrice !== '' ? 1 : 0) + 
                            (maxPrice !== '' ? 1 : 0) + 
                            (beds !== 'any' ? 1 : 0) + 
                            (baths !== 'any' ? 1 : 0);

  useEffect(() => {
    const fetchProperties = async () => {
      setLoading(true);
      try {
        const url = new URL('/api/properties', window.location.origin);
        url.searchParams.set('status', 'available');
        if (activeCategory !== 'all') {
          url.searchParams.set('category', activeCategory);
        }
        
        const response = await fetch(url.toString());
        if (!response.ok) throw new Error('Failed to fetch properties');
        const props: Property[] = await response.json();
        
        // Fetch landlord trust info (Firebase)
        const enrichedProps = await Promise.all(props.map(async (p) => {
          let trustScore = 50;
          let isVerified = false;
          
          try {
            if (p.landlordId && p.landlordId !== 'external_network') {
              const landlordDoc = await getDoc(doc(db, 'users', p.landlordId));
              if (landlordDoc.exists()) {
                const landlordData = landlordDoc.data();
                trustScore = landlordData.trustScore ?? 50;
                isVerified = landlordData.isVerified ?? false;
              }
            }
          } catch (e) {
            console.error("Failed to fetch landlord trust info", e);
          }

          return { 
            ...p,
            landlordTrustScore: trustScore,
            landlordVerified: isVerified
          };
        }));

        enrichedProps.forEach(p => {
          if (!searchShuffleSeed.has(p.id)) {
            searchShuffleSeed.set(p.id, Math.random());
          }
        });
        
        cachedSearchProperties = enrichedProps;
        setProperties(enrichedProps);
      } catch (error) {
        console.error("Error fetching properties:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProperties();
  }, [activeCategory]);

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
    const matchesMinPrice = minPrice === '' || p.price >= minPrice;
    const matchesMaxPrice = maxPrice === '' || p.price <= maxPrice;
    const matchesBeds = beds === 'any' || (p.bedrooms && p.bedrooms >= beds);
    const matchesBaths = baths === 'any' || (p.bathrooms && p.bathrooms >= baths);
    
    return matchesSearch && matchesCategory && matchesMinPrice && matchesMaxPrice && matchesBeds && matchesBaths;
  });

  const sortedProperties = [...filteredProperties].sort((a, b) => {
    if (sortBy === 'price_asc') {
      return a.price - b.price;
    } else if (sortBy === 'price_desc') {
      return b.price - a.price;
    } else {
      // recommended (shuffle)
      return (searchShuffleSeed.get(a.id) || 0) - (searchShuffleSeed.get(b.id) || 0);
    }
  });

  const handleSaveProperty = async (e: React.MouseEvent, propertyId: string) => {
    e.preventDefault();
    if (!user) {
      // Could redirect to login or show a toast
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
      {/* Search Header */}
      <div className="bg-white border-b border-gray-100 sticky top-16 sm:top-20 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1 w-full relative">
              <div className="flex bg-gray-50 border border-gray-200 rounded-2xl p-1.5 items-center focus-within:ring-2 focus-within:ring-primary-500/20 focus-within:border-primary-500 transition-all">
                <div className="flex-1 flex items-center pl-3">
                  <SearchIcon className="h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    className="w-full pl-3 pr-4 py-2.5 bg-transparent border-none focus:ring-0 text-gray-900 placeholder-gray-400 text-sm font-medium"
                    placeholder="Search by location, neighborhood, or property name..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      if (e.target.value) {
                        setSearchParams({ q: e.target.value });
                      } else {
                        setSearchParams({});
                      }
                    }}
                  />
                </div>
              </div>
            </div>
            
            <div className="flex gap-2 w-full md:w-auto overflow-x-auto hide-scrollbar pb-1 md:pb-0">
              <button 
                onClick={() => setShowFilters(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 font-bold text-sm transition-colors whitespace-nowrap relative"
              >
                <Filter className="h-4 w-4" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-primary-600 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              <button 
                onClick={() => setShowFilters(true)}
                className={`flex items-center gap-2 px-4 py-2.5 bg-white border rounded-xl font-bold text-sm transition-colors whitespace-nowrap ${
                  minPrice !== '' || maxPrice !== '' ? 'border-primary-500 text-primary-700 bg-primary-50' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Price
              </button>
              <button 
                onClick={() => setShowFilters(true)}
                className={`flex items-center gap-2 px-4 py-2.5 bg-white border rounded-xl font-bold text-sm transition-colors whitespace-nowrap ${
                  beds !== 'any' || baths !== 'any' ? 'border-primary-500 text-primary-700 bg-primary-50' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Beds & Baths
              </button>
            </div>
          </div>
        </div>
        
        {/* Categories */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-6 overflow-x-auto pt-2 pb-0 hide-scrollbar">
            {CATEGORIES.map((category) => {
              const Icon = category.icon;
              const isActive = activeCategory === category.id;
              return (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={`flex flex-col items-center justify-center min-w-[70px] gap-2 transition-all ${
                    isActive 
                      ? 'text-primary-700 border-b-2 border-primary-700 pb-3' 
                      : 'text-gray-500 hover:text-gray-900 border-b-2 border-transparent pb-3 hover:border-gray-300'
                  }`}
                >
                  <Icon className={`h-5 w-5 ${isActive ? 'text-primary-700' : 'text-gray-400'}`} />
                  <span className="text-xs font-bold">{category.label}</span>
                </button>
              );
            })}
          </div>
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
              <SearchIcon className="h-10 w-10 text-gray-400" />
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
                  setSearchParams({});
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
      {/* Filters Modal */}
      {showFilters && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
          <motion.div 
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="text-xl font-outfit font-bold text-gray-900">Filters</h3>
              <button 
                onClick={() => setShowFilters(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {/* Price Range */}
              <div className="mb-8">
                <h4 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">Price Range (Yearly)</h4>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1 font-medium">Min Price</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₦</span>
                      <input 
                        type="number" 
                        value={minPrice}
                        onChange={(e) => setMinPrice(e.target.value ? Number(e.target.value) : '')}
                        className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="Any"
                      />
                    </div>
                  </div>
                  <div className="text-gray-400 font-bold">-</div>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1 font-medium">Max Price</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₦</span>
                      <input 
                        type="number" 
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : '')}
                        className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="Any"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Rooms and Beds */}
              <div>
                <h4 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">Rooms and Beds</h4>
                
                <div className="space-y-6">
                  {/* Bedrooms */}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700 font-medium">Bedrooms</span>
                    <div className="flex items-center gap-2">
                      {['any', 1, 2, 3, 4, 5].map((num) => (
                        <button
                          key={num}
                          onClick={() => setBeds(num as any)}
                          className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                            beds === num 
                              ? 'bg-primary-600 text-white' 
                              : 'bg-white border border-gray-200 text-gray-700 hover:border-gray-900'
                          }`}
                        >
                          {num === 5 ? '5+' : num === 'any' ? 'Any' : num}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Bathrooms */}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700 font-medium">Bathrooms</span>
                    <div className="flex items-center gap-2">
                      {['any', 1, 2, 3, 4, 5].map((num) => (
                        <button
                          key={num}
                          onClick={() => setBaths(num as any)}
                          className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                            baths === num 
                              ? 'bg-primary-600 text-white' 
                              : 'bg-white border border-gray-200 text-gray-700 hover:border-gray-900'
                          }`}
                        >
                          {num === 5 ? '5+' : num === 'any' ? 'Any' : num}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-100 flex justify-between items-center bg-white sticky bottom-0 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4">
              <button 
                onClick={() => {
                  setMinPrice('');
                  setMaxPrice('');
                  setBeds('any');
                  setBaths('any');
                }}
                className="text-gray-900 font-bold underline hover:text-gray-600"
              >
                Clear all
              </button>
              <button 
                onClick={() => setShowFilters(false)}
                className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-xl font-bold transition-colors"
              >
                Show {filteredProperties.length} homes
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
