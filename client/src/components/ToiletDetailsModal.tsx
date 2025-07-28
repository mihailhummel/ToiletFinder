import React, { useState } from "react";
import { X, MapPin, Navigation, Star, Flag, Info, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StarRating } from "./StarRating";
import { AddReviewModal } from "./AddReviewModal";
import { ReportModal } from "./ReportModal";
import { LoginModal } from "./LoginModal";
import { useToiletReviews, useDeleteToilet } from "@/hooks/useToilets";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const { user, isAdmin } = useAuth();
  const { data: reviews = [] } = useToiletReviews(toilet?.id || "");
  const deleteToiletMutation = useDeleteToilet();
  const { toast } = useToast();

  // Debug logging to see toilet data
  React.useEffect(() => {
    if (toilet && isOpen) {
      console.log('🔍 Toilet Details Debug:', {
        id: toilet.id,
        source: toilet.source,
        addedByUserName: toilet.addedByUserName,
        type: toilet.type,
        title: toilet.title
      });
    }
  }, [toilet, isOpen]);

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
    const { lat, lng } = toilet.coordinates;
    
    // Use navigation URLs that automatically start routing
    // This will trigger the native app selection on mobile devices and start navigation
    
    // For Google Maps - use navigation mode
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    
    // For Apple Maps (iOS) - use navigation scheme
    const appleMapsUrl = `http://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
    
    // Detect platform and use appropriate URL
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    
    let url;
    if (isIOS) {
      // Try Apple Maps first, fallback to Google Maps
      url = appleMapsUrl;
    } else {
      // Use Google Maps for Android and desktop
      url = googleMapsUrl;
    }
    
    // Try to open in a new tab/window
    const newWindow = window.open(url, '_blank');
    
    // If popup is blocked, fall back to current window
    if (!newWindow) {
      window.location.href = url;
    }
  };

  const handleDeleteToilet = async () => {
    if (!user || !isAdmin) {
      toast({
        title: "Access denied",
        description: "Only admins can delete toilet locations.",
        variant: "destructive"
      });
      return;
    }

    try {
      await deleteToiletMutation.mutateAsync({
        toiletId: toilet.id,
        adminEmail: user.email || '',
        userId: user.uid
      });

      toast({
        title: "Success!",
        description: "Toilet location deleted successfully."
      });

      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete toilet location.",
        variant: "destructive"
      });
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto z-[9999] w-full max-w-full p-4 mobile:rounded-t-2xl mobile:rounded-b-none mobile:fixed mobile:bottom-0 mobile:left-0 mobile:right-0 mobile:max-h-[70vh] mobile:h-auto mobile:translate-y-0 mobile:shadow-2xl mobile:overflow-y-auto">
          <DialogHeader className="pb-3">
            <DialogTitle className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-secondary rounded-lg flex items-center justify-center">
                <MapPin className="w-3 h-3 text-white" />
              </div>
              <div>
                <div className="font-semibold text-sm">{toilet.title || getTypeLabel(toilet.type)}</div>
                <div className="flex items-center space-x-1 text-xs text-gray-500">
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
          
          <div className="space-y-3">
            {/* Location Info */}
            <div className="flex items-start space-x-2">
              <MapPin className="w-3 h-3 text-primary mt-0.5" />
              <div className="flex-1">
                <div className="text-xs">
                  {toilet.coordinates.lat.toFixed(6)}, {toilet.coordinates.lng.toFixed(6)}
                </div>
              </div>
            </div>
            
            {/* Added by information for toilets with user attribution */}
            {toilet.addedByUserName && (
              <div className="flex items-start space-x-2">
                <div className="w-3 h-3 bg-blue-500 mt-0.5 rounded-full"></div>
                <div className="flex-1">
                  <div className="text-xs text-blue-600 font-medium">
                    Added by {toilet.addedByUserName}
                    {toilet.source === 'osm' && <span className="text-gray-500 ml-1">(imported)</span>}
                  </div>
                </div>
              </div>
            )}

            {/* Accessibility Information */}
            {toilet.accessibility && toilet.accessibility !== 'unknown' && (
              <div className="flex items-start space-x-2">
                <div className={`w-3 h-3 mt-0.5 rounded-full ${
                  toilet.accessibility === 'accessible' ? 'bg-blue-500' : 'bg-red-500'
                }`}></div>
                <div className="flex-1">
                  <div className="text-xs text-gray-600">
                    {toilet.accessibility === 'accessible' ? 'Wheelchair Accessible' : 'Not Wheelchair Accessible'}
                  </div>
                </div>
              </div>
            )}

            {/* Access Type Information */}
            {toilet.accessType && toilet.accessType !== 'unknown' && (
              <div className="flex items-start space-x-2">
                <div className={`w-3 h-3 mt-0.5 rounded-full ${
                  toilet.accessType === 'free' ? 'bg-green-500' : 
                  toilet.accessType === 'customers-only' ? 'bg-yellow-500' : 'bg-purple-500'
                }`}></div>
                <div className="flex-1">
                  <div className="text-xs text-gray-600">
                    {toilet.accessType === 'free' ? 'Free of Charge' : 
                     toilet.accessType === 'customers-only' ? 'Customers Only' : 'Paid Access'}
                  </div>
                </div>
              </div>
            )}

            {/* Description */}
            {toilet.notes && (
              <div className="flex items-start space-x-2">
                <Info className="w-3 h-3 text-gray-500 mt-0.5" />
                <div className="flex-1">
                  <div className="text-xs text-gray-600">{toilet.notes}</div>
                </div>
              </div>
            )}
            
            {/* Action Buttons */}
            <div className={`grid gap-3 ${isAdmin ? 'grid-cols-4' : 'grid-cols-3'}`}>
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

              {isAdmin && (
                <Button
                  variant="outline"
                  className="flex flex-col items-center space-y-1 h-auto py-3 border-red-200 hover:bg-red-50"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                  <span className="text-xs text-red-600">Delete</span>
                </Button>
              )}
            </div>
            
            {/* Reviews Section */}
            {reviews.length > 0 && (
              <div className="border-t pt-3">
                <h3 className="font-medium mb-2 text-sm">Recent Reviews</h3>
                <div className="space-y-2">
                  {reviews.slice(0, 3).map((review) => (
                    <div key={review.id} className="p-2 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center space-x-2">
                          <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                            <span className="text-white text-xs font-medium">
                              {review.userName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="text-xs font-medium">{review.userName}</span>
                        </div>
                        <StarRating rating={review.rating} readonly size="sm" />
                      </div>
                      {review.text && (
                        <p className="text-xs text-gray-600 mb-1">{review.text}</p>
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Toilet Location</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-600">
              Are you sure you want to delete this toilet location? This action cannot be undone.
            </p>
            <div className="flex space-x-3">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteToilet}
                disabled={deleteToiletMutation.isPending}
                className="flex-1"
              >
                {deleteToiletMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
