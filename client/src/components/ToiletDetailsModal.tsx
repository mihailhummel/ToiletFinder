import { useState } from "react";
import { X, MapPin, Navigation, Star, Flag, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StarRating } from "./StarRating";
import { AddReviewModal } from "./AddReviewModal";
import { ReportModal } from "./ReportModal";
import { LoginModal } from "./LoginModal";
import { useToiletReviews } from "@/hooks/useToilets";
import { useAuth } from "@/hooks/useAuth";
import type { Toilet } from "@/types/toilet";
import { formatDistanceToNow } from "date-fns";

interface ToiletDetailsModalProps {
  toilet: Toilet | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ToiletDetailsModal = ({ toilet, isOpen, onClose }: ToiletDetailsModalProps) => {
  const [showAddReview, setShowAddReview] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  
  const { user } = useAuth();
  const { data: reviews = [] } = useToiletReviews(toilet?.id || "");

  if (!toilet) return null;

  const handleAddReview = () => {
    if (!user) {
      setShowLogin(true);
      return;
    }
    setShowAddReview(true);
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "public": return "Public Toilet";
      case "restaurant": return "Restaurant";
      case "gas-station": return "Gas Station";
      case "cafe": return "Cafe";
      case "mall": return "Mall";
      default: return "Other";
    }
  };

  const getDirections = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${toilet.coordinates.lat},${toilet.coordinates.lng}`;
    window.open(url, '_blank');
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto z-[9999]">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center">
                <MapPin className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="font-semibold">{getTypeLabel(toilet.type)}</div>
                <div className="flex items-center space-x-1 text-sm text-gray-500">
                  {toilet.averageRating ? (
                    <>
                      <StarRating rating={toilet.averageRating} readonly size="sm" />
                      <span>{toilet.averageRating.toFixed(1)}</span>
                      <span>•</span>
                      <span>{toilet.reviewCount} reviews</span>
                    </>
                  ) : (
                    <span>No reviews yet</span>
                  )}
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Location Info */}
            <div className="flex items-start space-x-3">
              <MapPin className="w-4 h-4 text-primary mt-1" />
              <div className="flex-1">
                <div className="text-sm">
                  {toilet.coordinates.lat.toFixed(6)}, {toilet.coordinates.lng.toFixed(6)}
                </div>
              </div>
            </div>
            
            {/* Description */}
            {toilet.notes && (
              <div className="flex items-start space-x-3">
                <Info className="w-4 h-4 text-gray-500 mt-1" />
                <div className="flex-1">
                  <div className="text-sm text-gray-600">{toilet.notes}</div>
                </div>
              </div>
            )}
            
            {/* Action Buttons */}
            <div className="grid grid-cols-3 gap-3">
              <Button
                variant="outline"
                className="flex flex-col items-center space-y-1 h-auto py-3"
                onClick={getDirections}
              >
                <Navigation className="w-4 h-4 text-primary" />
                <span className="text-xs">Directions</span>
              </Button>
              
              <Button
                variant="outline"
                className="flex flex-col items-center space-y-1 h-auto py-3"
                onClick={handleAddReview}
              >
                <Star className="w-4 h-4 text-yellow-500" />
                <span className="text-xs">Review</span>
              </Button>
              
              <Button
                variant="outline"
                className="flex flex-col items-center space-y-1 h-auto py-3"
                onClick={() => setShowReport(true)}
              >
                <Flag className="w-4 h-4 text-red-500" />
                <span className="text-xs">Report</span>
              </Button>
            </div>
            
            {/* Reviews Section */}
            {reviews.length > 0 && (
              <div className="border-t pt-4">
                <h3 className="font-medium mb-3">Recent Reviews</h3>
                <div className="space-y-3">
                  {reviews.slice(0, 3).map((review) => (
                    <div key={review.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                            <span className="text-white text-xs font-medium">
                              {review.userName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="text-sm font-medium">{review.userName}</span>
                        </div>
                        <StarRating rating={review.rating} readonly size="sm" />
                      </div>
                      {review.text && (
                        <p className="text-sm text-gray-600 mb-1">{review.text}</p>
                      )}
                      <div className="text-xs text-gray-500">
                        {formatDistanceToNow(review.createdAt, { addSuffix: true })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AddReviewModal
        toilet={toilet}
        isOpen={showAddReview}
        onClose={() => setShowAddReview(false)}
      />

      <ReportModal
        toilet={toilet}
        isOpen={showReport}
        onClose={() => setShowReport(false)}
      />

      <LoginModal
        isOpen={showLogin}
        onClose={() => setShowLogin(false)}
      />
    </>
  );
};
