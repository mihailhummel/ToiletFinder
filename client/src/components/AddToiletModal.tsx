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
}

const toiletTypes: { value: ToiletType; label: string }[] = [
  { value: "public", label: "Public Toilet" },
  { value: "restaurant", label: "Restaurant" },
  { value: "cafe", label: "Cafe" },
  { value: "gas-station", label: "Gas Station" },
  { value: "mall", label: "Mall" },
  { value: "other", label: "Other" },
];

export const AddToiletModal = ({ isOpen, onClose, location }: AddToiletModalProps) => {
  const [type, setType] = useState<ToiletType>("public");
  const [notes, setNotes] = useState("");
  
  const { user } = useAuth();
  const { toast } = useToast();
  const addToiletMutation = useAddToilet();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to add a toilet location.",
        variant: "destructive"
      });
      return;
    }

    if (!location) {
      toast({
        title: "Location required",
        description: "Please select a location on the map.",
        variant: "destructive"
      });
      return;
    }

    try {
      await addToiletMutation.mutateAsync({
        type,
        coordinates: location,
        notes: notes.trim() || undefined,
        userId: user.uid
      });

      toast({
        title: "Success!",
        description: "Toilet location added successfully."
      });

      onClose();
      setType("public");
      setNotes("");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add toilet location. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Toilet</DialogTitle>
          <DialogDescription>
            Add a new toilet location to help others find nearby facilities
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Location</label>
            <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
              <MapPin className="w-4 h-4 text-primary" />
              <div className="flex-1 text-sm">
                <div>Current map center</div>
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
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={addToiletMutation.isPending || !location}
              className="flex-1"
            >
              {addToiletMutation.isPending ? "Adding..." : "Add Toilet"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
