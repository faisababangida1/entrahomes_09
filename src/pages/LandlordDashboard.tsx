import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, increment, getDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Home, DollarSign, Users, Plus, X, AlertCircle, ShieldCheck, Star, ChevronRight, Trash2, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';

import { handleFirestoreError, OperationType } from '../utils/errorHandling';
import ReviewModal from '../components/ReviewModal';
import TrustBadge from '../components/TrustBadge';

interface Property {
  id: string;
  title: string;
  location: string;
  price: number;
  status: string;
  propertyType: string;
}

export default function LandlordDashboard() {
  const { user, profile } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [leases, setLeases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [propertyToDelete, setPropertyToDelete] = useState<string | null>(null);

  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<{revieweeId: string, propertyId: string, leaseId: string} | null>(null);

  // New Property Form State
  const [newProp, setNewProp] = useState({
    title: '',
    description: '',
    location: '',
    price: '',
    propertyType: 'apartment',
    imageUrls: [] as string[],
  });

  useEffect(() => {
    if (!user) return;

    // Fetch properties
    const propsQuery = query(collection(db, 'properties'), where('landlordId', '==', user.uid));
    const unsubscribeProps = onSnapshot(propsQuery, (snapshot) => {
      const p: Property[] = [];
      snapshot.forEach(doc => p.push({ id: doc.id, ...doc.data() } as Property));
      setProperties(p);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'properties');
    });

    // Fetch leases
    const leasesQuery = query(collection(db, 'leases'), where('landlordId', '==', user.uid));
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
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'leases');
    });

    return () => {
      unsubscribeProps();
      unsubscribeLeases();
    };
  }, [user]);

  const handleAddProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const parsedPrice = Number(newProp.price);
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        setSubmitError("Please enter a valid price.");
        setIsSubmitting(false);
        return;
      }

      const propertyData: any = {
        landlordId: user.uid,
        title: newProp.title,
        description: newProp.description,
        location: newProp.location,
        price: parsedPrice,
        propertyType: newProp.propertyType,
        status: 'available',
        createdAt: serverTimestamp()
      };

      if (newProp.imageUrls.length > 0) {
        propertyData.images = newProp.imageUrls;
      }

      await addDoc(collection(db, 'properties'), propertyData);
      setShowAddModal(false);
      setNewProp({ title: '', description: '', location: '', price: '', propertyType: 'apartment', imageUrls: [] });
    } catch (error: any) {
      console.error("Error adding property:", error);
      setSubmitError(error.message || "Failed to add property. Please check your permissions.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const approveLease = async (leaseId: string, propertyId: string) => {
    try {
      // Approve the lease
      const leaseRef = doc(db, 'leases', leaseId);
      await updateDoc(leaseRef, {
        status: 'active'
      });

      // Mark property as rented
      const propertyRef = doc(db, 'properties', propertyId);
      await updateDoc(propertyRef, {
        status: 'rented'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `leases/${leaseId}`);
    }
  };

  const confirmDeleteProperty = (propertyId: string) => {
    setPropertyToDelete(propertyId);
    setShowDeleteModal(true);
  };

  const handleDeleteProperty = async () => {
    if (propertyToDelete) {
      try {
        await deleteDoc(doc(db, 'properties', propertyToDelete));
        setShowDeleteModal(false);
        setPropertyToDelete(null);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `properties/${propertyToDelete}`);
      }
    }
  };

  if (loading) {
    return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-outfit font-bold text-gray-900 flex items-center gap-2 tracking-tight">
              Landlord Dashboard
              {profile?.isVerified && <ShieldCheck className="h-6 w-6 text-primary-600" title="Verified Landlord" />}
            </h1>
            <p className="text-gray-500 mt-2 text-lg font-medium">Manage your properties and track rent payments.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:block">
              <TrustBadge score={profile?.trustScore || 50} isVerified={profile?.isVerified} />
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-xl font-bold transition-colors shadow-sm"
            >
              <Plus className="h-5 w-5" />
              Add Property
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-8">
          <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-gray-100 flex items-center hover:shadow-md transition-shadow">
            <div className="p-4 rounded-2xl bg-primary-50 text-primary-600 mr-5">
              <Home className="h-8 w-8" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Total Properties</p>
              <p className="text-3xl font-outfit font-bold text-gray-900 mt-1">{properties.length}</p>
            </div>
          </div>
          <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-gray-100 flex items-center hover:shadow-md transition-shadow">
            <div className="p-4 rounded-2xl bg-accent-50 text-accent-600 mr-5">
              <Users className="h-8 w-8" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Active Leases</p>
              <p className="text-3xl font-outfit font-bold text-gray-900 mt-1">
                {leases.filter(l => l.status === 'active').length}
              </p>
            </div>
          </div>
        </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Leases */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <h3 className="text-xl font-outfit font-bold text-gray-900">Active Leases</h3>
          </div>
          <div className="p-0">
            {leases.length > 0 ? (
              <ul className="divide-y divide-gray-100">
                {leases.map((lease) => (
                  <li key={lease.id} className="p-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-start sm:items-center">
                      <div className={`p-3 rounded-2xl mr-4 flex-shrink-0 ${
                        lease.status === 'active' ? 'bg-accent-50 text-accent-600' :
                        lease.status === 'pending' ? 'bg-amber-50 text-amber-600' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        <Users className="h-6 w-6" />
                      </div>
                      <div>
                        <Link to={`/property/${lease.propertyId}`} className="text-base font-bold text-gray-900 hover:text-primary-600 transition-colors line-clamp-1">
                          {lease.property?.title || `Property ID: ${lease.propertyId.substring(0, 8)}...`}
                        </Link>
                        <p className="text-sm font-medium text-gray-500 mt-0.5">
                          {new Date(lease.startDate).toLocaleDateString()} - {new Date(lease.endDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                      <p className="text-lg font-outfit font-bold text-gray-900">₦{lease.rentAmount.toLocaleString()}/yr</p>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold capitalize ${
                          lease.status === 'active' ? 'bg-accent-50 text-accent-700 border border-accent-100' : 
                          lease.status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-100' : 
                          'bg-gray-50 text-gray-700 border border-gray-200'
                        }`}>
                          {lease.status}
                        </span>
                        {lease.status === 'pending' && (
                          <button
                            onClick={() => approveLease(lease.id, lease.propertyId)}
                            className="text-xs bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded-lg transition-colors font-bold shadow-sm"
                          >
                            Approve
                          </button>
                        )}
                        {lease.status === 'active' && (
                          <button
                            onClick={() => {
                              setReviewTarget({
                                revieweeId: lease.tenantId,
                                propertyId: lease.propertyId,
                                leaseId: lease.id
                              });
                              setReviewModalOpen(true);
                            }}
                            className="text-xs bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded-lg transition-colors font-bold shadow-sm"
                          >
                            Review Tenant
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <div className="bg-gray-50 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-base font-bold text-gray-900">No active leases</p>
                <p className="text-sm font-medium mt-1">When tenants rent your properties, they'll appear here.</p>
              </div>
            )}
          </div>
        </div>

        {/* My Properties */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <h3 className="text-xl font-outfit font-bold text-gray-900">My Properties</h3>
          </div>
          <div className="p-0">
            {properties.length > 0 ? (
              <ul className="divide-y divide-gray-100">
                {properties.map((property) => (
                  <li key={property.id} className="p-6 flex justify-between items-center hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-center">
                      <div className="h-14 w-14 bg-gray-100 rounded-2xl flex items-center justify-center mr-4 flex-shrink-0">
                        <Home className="h-6 w-6 text-gray-400" />
                      </div>
                      <div>
                        <p className="text-base font-bold text-gray-900">{property.title}</p>
                        <p className="text-sm font-medium text-gray-500 mt-0.5">{property.location}</p>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-2">
                      <div className="flex items-center justify-between w-full gap-4">
                        <p className="text-lg font-outfit font-bold text-gray-900">₦{property.price.toLocaleString()}/yr</p>
                        <button 
                          onClick={() => confirmDeleteProperty(property.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                          title="Delete property"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold capitalize ${
                        property.status === 'available' ? 'bg-accent-50 text-accent-700 border border-accent-100' : 'bg-primary-50 text-primary-700 border border-primary-100'
                      }`}>
                        {property.status}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <div className="bg-gray-50 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Home className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-base font-bold text-gray-900">No properties listed</p>
                <p className="text-sm font-medium mt-1">Add your first property to start receiving applications.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-outfit font-bold text-gray-900">Delete Property</h3>
              <button onClick={() => setShowDeleteModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>
            <p className="text-gray-600 mb-8">Are you sure you want to delete this property? This action cannot be undone.</p>
            <div className="flex justify-end gap-4">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-6 py-3 border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteProperty}
                className="px-6 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Add Property Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-center justify-center min-h-screen p-4 text-center sm:p-0">
            <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" aria-hidden="true" onClick={() => setShowAddModal(false)}></div>
            <div className="relative inline-block bg-white rounded-3xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:max-w-lg w-full border border-gray-100">
              <div className="bg-white px-6 pt-6 pb-6 sm:p-8">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-outfit font-bold text-primary-900" id="modal-title">
                    List New Property
                  </h3>
                  <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 p-2 rounded-full transition-colors">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <form onSubmit={handleAddProperty}>
                  {submitError && (
                    <div className="mb-6 bg-red-50 border border-red-100 p-4 rounded-xl flex items-start">
                      <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
                      <p className="text-sm text-red-700 font-medium">{submitError}</p>
                    </div>
                  )}
                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5">Title</label>
                      <input type="text" required value={newProp.title} onChange={e => setNewProp({...newProp, title: e.target.value})} className="block w-full border border-gray-200 rounded-xl shadow-sm py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 sm:text-sm transition-all" placeholder="Cozy 2BR Apartment" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5">Description</label>
                      <textarea required value={newProp.description} onChange={e => setNewProp({...newProp, description: e.target.value})} rows={3} className="block w-full border border-gray-200 rounded-xl shadow-sm py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 sm:text-sm transition-all resize-none" placeholder="Describe the property..."></textarea>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5">Location</label>
                      <input type="text" required value={newProp.location} onChange={e => setNewProp({...newProp, location: e.target.value})} className="block w-full border border-gray-200 rounded-xl shadow-sm py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 sm:text-sm transition-all" placeholder="123 Main St, City, State" />
                    </div>
                    <div className="grid grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5">Yearly Rent (₦)</label>
                        <input type="number" min="0" required value={newProp.price} onChange={e => setNewProp({...newProp, price: e.target.value})} className="block w-full border border-gray-200 rounded-xl shadow-sm py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 sm:text-sm transition-all" placeholder="1500" />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5">Property Type</label>
                        <select value={newProp.propertyType} onChange={e => setNewProp({...newProp, propertyType: e.target.value})} className="block w-full bg-white border border-gray-200 rounded-xl shadow-sm py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 sm:text-sm transition-all appearance-none">
                          <option value="apartment">Apartment</option>
                          <option value="house">Home</option>
                          <option value="studio">Studio</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5">Property Images (Up to 4)</label>
                      <div className="mt-1 flex flex-col items-center px-6 pt-5 pb-6 border-2 border-gray-200 border-dashed rounded-xl hover:bg-gray-50 transition-colors">
                        <div className="w-full flex flex-wrap gap-4 justify-center mb-4">
                          {newProp.imageUrls.map((url, index) => (
                            <div key={index} className="relative inline-block">
                              <img src={url} alt={`Preview ${index + 1}`} className="h-24 w-32 object-cover rounded-lg shadow-sm" />
                              <button
                                type="button"
                                onClick={() => {
                                  const newUrls = [...newProp.imageUrls];
                                  newUrls.splice(index, 1);
                                  setNewProp({...newProp, imageUrls: newUrls});
                                }}
                                className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow-md text-gray-500 hover:text-red-500 transition-colors"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                        
                        {newProp.imageUrls.length < 4 && (
                          <div className="space-y-1 text-center">
                            <Home className="mx-auto h-12 w-12 text-gray-300" />
                            <div className="flex text-sm text-gray-600 justify-center">
                              <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-bold text-primary-600 hover:text-primary-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary-500">
                                <span>Upload a file</span>
                                <input 
                                  id="file-upload" 
                                  name="file-upload" 
                                  type="file" 
                                  className="sr-only"
                                  accept="image/*"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      setSubmitError(null);
                                      const objectUrl = URL.createObjectURL(file);
                                      const img = new Image();
                                      img.onload = () => {
                                        try {
                                          const canvas = document.createElement('canvas');
                                          const MAX_WIDTH = 800;
                                          const MAX_HEIGHT = 800;
                                          let width = img.width;
                                          let height = img.height;
                                          if (width > height) {
                                            if (width > MAX_WIDTH) {
                                              height *= MAX_WIDTH / width;
                                              width = MAX_WIDTH;
                                            }
                                          } else {
                                            if (height > MAX_HEIGHT) {
                                              width *= MAX_HEIGHT / height;
                                              height = MAX_HEIGHT;
                                            }
                                          }
                                          canvas.width = width;
                                          canvas.height = height;
                                          const ctx = canvas.getContext('2d');
                                          ctx?.drawImage(img, 0, 0, width, height);
                                          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                                          if (dataUrl.length > 700000) {
                                             setSubmitError("Image is still too large after compression. Please choose a smaller image.");
                                          } else {
                                             setNewProp({...newProp, imageUrls: [...newProp.imageUrls, dataUrl]});
                                          }
                                        } catch (err) {
                                          console.error("Error processing image:", err);
                                          setSubmitError("Failed to process image. Please try a different one.");
                                        } finally {
                                          URL.revokeObjectURL(objectUrl);
                                        }
                                      };
                                      img.onerror = () => {
                                        setSubmitError("Failed to load image. Please try a different file.");
                                        URL.revokeObjectURL(objectUrl);
                                      };
                                      img.src = objectUrl;
                                    }
                                  }} 
                                />
                              </label>
                              <p className="pl-1">or drag and drop</p>
                            </div>
                            <p className="text-xs text-gray-500">PNG, JPG, GIF up to 5MB ({newProp.imageUrls.length}/4)</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-8 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                    <button type="button" disabled={isSubmitting} onClick={() => setShowAddModal(false)} className="w-full sm:w-auto inline-flex justify-center items-center rounded-xl border border-gray-200 px-5 py-2.5 bg-white text-sm font-bold text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 transition-colors shadow-sm">
                      Cancel
                    </button>
                    <button type="submit" disabled={isSubmitting} className="w-full sm:w-auto inline-flex justify-center items-center rounded-xl border border-transparent px-5 py-2.5 bg-primary-600 text-sm font-bold text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 transition-colors shadow-sm">
                      {isSubmitting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Listing...
                        </>
                      ) : 'List Property'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
      {reviewTarget && user && (
        <ReviewModal
          isOpen={reviewModalOpen}
          onClose={() => {
            setReviewModalOpen(false);
            setReviewTarget(null);
          }}
          reviewerId={user.uid}
          revieweeId={reviewTarget.revieweeId}
          type="tenant_review"
          propertyId={reviewTarget.propertyId}
          leaseId={reviewTarget.leaseId}
          onSuccess={() => alert('Review submitted successfully!')}
        />
      )}
    </div>
  );
}
