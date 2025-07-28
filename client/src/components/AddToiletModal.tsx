import { useState } from "react";
import { X, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAddToilet } from "@/hooks/useToilets";
import { useAuth } from "@/hooks/useAuth";
import { queryClient } from "@/lib/queryClient";
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

    // If location exists, submit the toilet using React Query mutation
    try {
      const toiletData = {
        type,
        coordinates: location,
        notes: notes.trim() || undefined,
        userId: user.uid,
        source: 'user' as const,
        addedByUserName: user.displayName || 'Anonymous User'
      };
      
      console.log("🚽 Client: Using React Query mutation to add toilet");
      console.log("🚽 Client: Request body:", JSON.stringify(toiletData, null, 2));
      
      const result = await addToiletMutation.mutateAsync(toiletData);
      
      console.log("🚽 Client: Mutation successful:", result);
      
      toast({
        title: "Success!",
        description: "Toilet location added successfully."
      });

      onClose();
      setType("public");
      setNotes("");
      
      // Invalidate queries to refresh the map data
      queryClient.invalidateQueries({ queryKey: ["toilets"] });
    } catch (error) {
      console.error("🚽 Client: Error adding toilet:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add toilet location. Please try again.",
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
      <DialogContent className="sm:max-w-md w-full max-w-full p-6 mobile:rounded-none mobile:h-screen mobile:max-h-screen mobile:p-4 bg-white shadow-xl border-0">
        <DialogHeader className="text-left space-y-3">
          <DialogTitle className="text-xl font-semibold text-gray-900">
            {location ? "Confirm Toilet Location" : "Add New Toilet"}
          </DialogTitle>
          <DialogDescription className="text-gray-600 text-sm leading-relaxed">
            {location 
              ? "Confirm the details and submit the toilet location"
              : "Select the toilet type and description, then choose location on map"
            }
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">Location</label>
            <div className={`flex items-center space-x-3 p-4 rounded-lg border transition-colors ${
              location 
                ? 'bg-green-50 border-green-200' 
                : 'bg-blue-50 border-blue-200'
            }`}>
              <MapPin className={`w-5 h-5 ${location ? 'text-green-600' : 'text-blue-600'}`} />
              <div className="flex-1">
                <div className={`font-medium text-sm ${location ? 'text-green-800' : 'text-blue-800'}`}>
                  {location ? "✓ Location Selected" : "📍 Location Required"}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {location 
                    ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`
                    : "Click 'Select Location' then tap on the map"
                  }
                </div>
              </div>
            </div>
          </div>
          
          <div>
            <label htmlFor="toilet-type" className="block text-sm font-medium mb-2 text-gray-700">Type of Place</label>
            <Select value={type} onValueChange={(value: ToiletType) => setType(value)}>
              <SelectTrigger id="toilet-type" className="border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border border-gray-200 shadow-lg">
                {toiletTypes.map(({ value, label }) => (
                  <SelectItem key={value} value={value} className="hover:bg-blue-50 focus:bg-blue-50">
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <label htmlFor="toilet-notes" className="block text-sm font-medium mb-2 text-gray-700">Notes (Optional)</label>
            <Textarea
              id="toilet-notes"
              name="toilet-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional information..."
              rows={3}
              className="resize-none border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
            />
          </div>
          
          <div className="flex space-x-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={addToiletMutation.isPending}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
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
