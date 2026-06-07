import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { StarRating } from "./StarRating";
import { notify } from "@/lib/notify";
import { InlineMessage } from "@/components/ui/inline-message";
import { useAddReview, useUserReviewStatus } from "@/hooks/useToilets";
import { useAuth } from "@/hooks/useAuth";
import type { Toilet } from "@/types/toilet";

interface AddReviewModalProps {
  toilet: Toilet;
  isOpen: boolean;
  onClose: () => void;
}

export const AddReviewModal = ({ toilet, isOpen, onClose }: AddReviewModalProps) => {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const { user } = useAuth();
  const addReviewMutation = useAddReview();
  const { data: hasReviewed } = useUserReviewStatus(toilet.id, user?.uid);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!user) {
      setFormError("Please sign in to leave a review.");
      return;
    }

    if (rating === 0) {
      setFormError("Please select a rating.");
      return;
    }

    if (hasReviewed) {
      setFormError("You have already reviewed this toilet.");
      return;
    }

    try {
      await addReviewMutation.mutateAsync({
        toiletId: toilet.id,
        review: {
          toiletId: toilet.id,
          userId: user.uid,
          userName: user.displayName || "Anonymous",
          rating,
          text: text.trim() || undefined
        }
      });

      notify.success("Review submitted!", {
        description: "Thanks for helping others find quality facilities.",
      });

      onClose();
      setRating(0);
      setText("");
    } catch (error) {
      setFormError("Failed to submit review. Please try again.");
    }
  };

  const handleClose = () => {
    onClose();
    setRating(0);
    setText("");
    setFormError(null);
  };

  if (hasReviewed) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md z-[9999]">
          <DialogHeader>
            <DialogTitle>Already Reviewed</DialogTitle>
            <DialogDescription>
              You can only submit one review per toilet location
            </DialogDescription>
          </DialogHeader>
          <div className="text-center py-4">
            <p className="text-gray-600 mb-4">
              You have already left a review for this toilet location.
            </p>
            <Button onClick={handleClose}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md z-[9999]">
        <DialogHeader>
          <DialogTitle>Add Review</DialogTitle>
          <DialogDescription>
            Share your experience to help others find quality facilities
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="review-rating" className="block text-sm font-medium mb-2">Your Rating</label>
            <div id="review-rating">
              <StarRating
                rating={rating}
                onRatingChange={setRating}
                size="lg"
              />
            </div>
          </div>
          
          <div>
            <label htmlFor="review-text" className="block text-sm font-medium mb-2">Your Review</label>
            <Textarea
              id="review-text"
              name="review-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Share your experience..."
              rows={3}
              className="resize-none"
            />
          </div>
          
          {formError && (
            <InlineMessage variant="error">{formError}</InlineMessage>
          )}

          <div className="flex space-x-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={addReviewMutation.isPending || rating === 0}
              className="flex-1"
            >
              {addReviewMutation.isPending ? "Submitting..." : "Submit Review"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
