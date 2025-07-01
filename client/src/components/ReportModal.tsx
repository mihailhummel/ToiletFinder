import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAddReport } from "@/hooks/useToilets";
import { useAuth } from "@/hooks/useAuth";
import type { Toilet, ReportReason } from "@/types/toilet";

interface ReportModalProps {
  toilet: Toilet;
  isOpen: boolean;
  onClose: () => void;
}

const reportReasons: { value: ReportReason; label: string }[] = [
  { value: "doesnt-exist", label: "Toilet doesn't exist" },
  { value: "inaccessible", label: "Inaccessible" },
  { value: "closed", label: "Closed permanently" },
  { value: "other", label: "Other" },
];

export const ReportModal = ({ toilet, isOpen, onClose }: ReportModalProps) => {
  const [reason, setReason] = useState<ReportReason>("doesnt-exist");
  const [comment, setComment] = useState("");
  
  const { user } = useAuth();
  const { toast } = useToast();
  const addReportMutation = useAddReport();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await addReportMutation.mutateAsync({
        toiletId: toilet.id,
        userId: user?.uid,
        reason,
        comment: comment.trim() || undefined
      });

      toast({
        title: "Report submitted",
        description: "Thank you for helping improve the community data."
      });

      onClose();
      setReason("doesnt-exist");
      setComment("");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit report. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleClose = () => {
    onClose();
    setReason("doesnt-exist");
    setComment("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report Issue</DialogTitle>
          <DialogDescription>
            Report problems with this toilet location to help maintain accurate information
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-3">Issue Type</label>
            <RadioGroup value={reason} onValueChange={(value: ReportReason) => setReason(value)}>
              {reportReasons.map(({ value, label }) => (
                <div key={value} className="flex items-center space-x-2">
                  <RadioGroupItem value={value} id={value} />
                  <Label htmlFor={value} className="text-sm cursor-pointer">
                    {label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">
              Additional Comments (Optional)
            </label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Please provide more details..."
              rows={3}
              className="resize-none"
            />
          </div>
          
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
              disabled={addReportMutation.isPending}
              className="flex-1 bg-red-500 hover:bg-red-600"
            >
              {addReportMutation.isPending ? "Submitting..." : "Submit Report"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
