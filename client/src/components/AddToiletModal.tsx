import { useState } from "react";
import { X, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAddToilet } from "@/hooks/useToilets";
import { useAuth } from "@/hooks/useAuth";
import type { ToiletType, MapLocation } from "@/types/toilet";

interface AddToiletModalProps {
  isOpen: boolean;
  onClose: () => void;
  location?: MapLocation;
  onRequestLocationSelection?: (type: ToiletType, notes: string) => void;
  onCloseForLocationSelection?: () => void;
}

const toiletTypes: { value: ToiletType; label: string }[] = [
  { value: "public", label: "Public Toilet" },
  { value: "restaurant", label: "Restaurant" },
  { value: "cafe", label: "Cafe" },
  { value: "gas-station", label: "Gas Station" },
  { value: "mall", label: "Mall" },
  { value: "other", label: "Other" },
];

export const AddToiletModal = ({ isOpen, onClose, location, onRequestLocationSelection, onCloseForLocationSelection }: AddToiletModalProps) => {
  const [type, setType] = useState<ToiletType>("public");
  const [notes, setNotes] = useState("");
  
  const { user } = useAuth();
  const { toast } = useToast();
  const addToiletMutation = useAddToilet();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log("Add toilet form submitted", { user: !!user, location, type, notes });
    
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to add a toilet location.",
        variant: "destructive"
      });
      return;
    }

    // If no location, request location selection
    if (!location) {
      console.log("No location, requesting location selection");
      if (onRequestLocationSelection) {
        onRequestLocationSelection(type, notes);
        // Don't call onClose() here - let the parent handle closing when transitioning to location mode
      }
      return;
    }

    // If location exists, submit the toilet
    try {
      await addToiletMutation.mutateAsync({
        type,
        coordinates: location,
        notes: notes.trim() || undefined,
        userId: user.uid,
        source: 'user',
        addedByUserName: user.displayName || 'Anonymous User'
      });

      toast({
        title: "Success!",
        description: "Toilet location added successfully."
      });

      onClose();
      setType("public");
      setNotes("");
    } catch (error) {
      console.error("Error adding toilet:", error);
      toast({
        title: "Error",
        description: "Failed to add toilet location. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("Cancel button clicked");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md w-full max-w-full p-6 mobile:rounded-none mobile:h-screen mobile:max-h-screen mobile:p-4">
        <DialogHeader>
          <DialogTitle>{location ? "Confirm Toilet Location" : "Add New Toilet"}</DialogTitle>
          <DialogDescription>
            {location 
              ? "Confirm the details and submit the toilet location"
              : "Select the toilet type and description, then choose location on map"
            }
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Location</label>
            <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
              <MapPin className="w-4 h-4 text-primary" />
              <div className="flex-1 text-sm">
                <div>{location ? "Selected location" : "Click 'Add Toilet' to select location on map"}</div>
                {location && (
                  <div className="text-gray-500 text-xs">
                    {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Type of Place</label>
            <Select value={type} onValueChange={(value: ToiletType) => setType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {toiletTypes.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Notes (Optional)</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional information..."
              rows={3}
              className="resize-none"
            />
          </div>
          
          <div className="flex space-x-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={addToiletMutation.isPending}
              className="flex-1"
            >
              {addToiletMutation.isPending 
                ? "Adding..." 
                : location 
                ? "Confirm & Add Toilet" 
                : "Select Location"
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
