import React, { useState } from 'react';
import { Star, X } from 'lucide-react';
import { addDoc, collection, doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { OperationType, handleFirestoreError } from '../utils/errorHandling';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  reviewerId: string;
  revieweeId: string;
  type: 'tenant_review' | 'landlord_review';
  propertyId?: string;
  leaseId?: string;
  onSuccess?: () => void;
}

export default function ReviewModal({
  isOpen,
  onClose,
  reviewerId,
  revieweeId,
  type,
  propertyId,
  leaseId,
  onSuccess
}: ReviewModalProps) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Determine review type based on who is reviewing whom
      // In a real app, we might pass this as a prop, but we can infer it
      // if we know the current user's role. For now, let's pass it as a prop or infer.
      // Let's add 'type' to props.
      
      const reviewData: any = {
        reviewerId,
        revieweeId,
        rating,
        comment,
        type,
        createdAt: serverTimestamp(),
      };

      if (propertyId) reviewData.propertyId = propertyId;
      if (leaseId) reviewData.leaseId = leaseId;

      await addDoc(collection(db, 'reviews'), reviewData);

      // Optionally, update the reviewee's trust score here
      // In a real app, this would be done securely via a Cloud Function
      // For this prototype, we'll do a simple client-side update
      try {
        const userRef = doc(db, 'users', revieweeId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          const currentScore = userData.trustScore || 100;
          // Simple logic: rating 5 adds 2 points, rating 1 subtracts 5 points
          let scoreChange = 0;
          if (rating === 5) scoreChange = 2;
          else if (rating === 4) scoreChange = 1;
          else if (rating === 3) scoreChange = -1;
          else if (rating === 2) scoreChange = -3;
          else if (rating === 1) scoreChange = -5;

          const newScore = Math.max(0, Math.min(100, currentScore + scoreChange));
          await updateDoc(userRef, { trustScore: newScore });
        }
      } catch (scoreError) {
        console.error("Failed to update trust score:", scoreError);
        // Don't fail the review submission if score update fails
      }

      setRating(5);
      setComment('');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit review');
      handleFirestoreError(err, OperationType.CREATE, 'reviews');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-xl max-w-md w-full overflow-hidden border border-gray-100">
        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h3 className="text-xl font-outfit font-bold text-gray-900">Leave a Review</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors bg-white p-1.5 rounded-full hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl text-sm font-medium border border-red-100">
              {error}
            </div>
          )}
          
          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-3">Rating</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="focus:outline-none transition-transform hover:scale-110"
                >
                  <Star
                    className={`h-10 w-10 ${
                      star <= rating ? 'text-amber-400 fill-current' : 'text-gray-200'
                    } transition-colors`}
                  />
                </button>
              ))}
            </div>
          </div>
          
          <div className="mb-8">
            <label htmlFor="comment" className="block text-sm font-bold text-gray-700 mb-3">
              Comment <span className="text-gray-400 font-medium">(Optional)</span>
            </label>
            <textarea
              id="comment"
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow resize-none"
              placeholder="Share your experience..."
            />
          </div>
          
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 text-gray-700 hover:bg-gray-100 rounded-xl font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center min-w-[140px]"
            >
              {isSubmitting ? (
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                'Submit Review'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
