import React, { useState, useEffect } from "react";
import { X, MapPin, Check, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAddToilet } from "@/hooks/useToilets";
import { useAuth } from "@/hooks/useAuth";
import { queryClient } from "@/lib/queryClient";
import type { ToiletType, Accessibility, AccessType, MapLocation } from "@/types/toilet";
import { haptics } from "@/lib/haptics";

interface AddToiletModalProps {
  isOpen: boolean;
  onClose: () => void;
  location?: MapLocation;
  onRequestLocationSelection?: (type: ToiletType, title: string, accessibility: Accessibility, accessType: AccessType) => void;
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

const accessibilityOptions: { value: Accessibility; label: string }[] = [
  { value: "accessible", label: "Wheelchair Accessible" },
  { value: "not-accessible", label: "Not Accessible" },
  { value: "unknown", label: "Unknown" },
];

const accessTypeOptions: { value: AccessType; label: string }[] = [
  { value: "free", label: "Free of Charge" },
  { value: "customers-only", label: "Customers Only" },
  { value: "paid", label: "Paid Access" },
  { value: "unknown", label: "Unknown" },
];

export const AddToiletModal = ({ isOpen, onClose, location, onRequestLocationSelection, onCloseForLocationSelection }: AddToiletModalProps) => {
  const [type, setType] = useState<ToiletType>("public");
  const [title, setTitle] = useState("");
  const [accessibility, setAccessibility] = useState<Accessibility>("unknown");
  const [accessType, setAccessType] = useState<AccessType>("unknown");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const addToiletMutation = useAddToilet();

  // Auto-show confirmation when location is provided (but not when editing)
  useEffect(() => {
    if (location && !showConfirmation && !isEditing) {
      setShowConfirmation(true);
    }
  }, [location, showConfirmation, isEditing]);

    const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log("Add toilet form submitted", { user: !!user, location, type, title, accessibility, accessType });
    
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
        // Close the modal first, then request location selection
        onClose();
        setTimeout(() => {
          onRequestLocationSelection(type, title, accessibility, accessType);
        }, 100);
      }
      return;
    }

    // If we have a location, we're in confirmation mode - submit the toilet
    try {
      const toiletData = {
        type,
        title: title.trim() || null,
        coordinates: location,
        accessibility,
        accessType,
        userId: user.uid,
        source: 'user' as const,
        addedByUserName: user.displayName || 'Anonymous User'
      };
      
      console.log("🚽 Toilet data being sent:", toiletData);
      
      console.log("🚽 Client: Using React Query mutation to add toilet");
      console.log("🚽 Client: Request body:", JSON.stringify(toiletData, null, 2));
      
      const result = await addToiletMutation.mutateAsync(toiletData);
      
      console.log("🚽 Client: Mutation successful:", result);
      
      toast({
        title: "Success!",
        description: "Toilet location added successfully."
      });

      handleClose();
      setIsEditing(false);
      
      // Invalidate queries to refresh the map data
      queryClient.invalidateQueries({ queryKey: ["toilets"] });
      queryClient.invalidateQueries({ queryKey: ["toilets-supabase"] });
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
    handleClose();
  };

  const handleEdit = () => {
    setShowConfirmation(false);
    setIsEditing(false); // Reset editing state when going back to form
  };

  const handleClose = () => {
    setType("public");
    setTitle("");
    setAccessibility("unknown");
    setAccessType("unknown");
    setShowConfirmation(false);
    setIsEditing(false);
    onClose();
  };

  const getTypeLabel = (type: ToiletType) => {
    return toiletTypes.find(t => t.value === type)?.label || type;
  };

  const getAccessibilityLabel = (accessibility: Accessibility) => {
    return accessibilityOptions.find(a => a.value === accessibility)?.label || accessibility;
  };

  const getAccessTypeLabel = (accessType: AccessType) => {
    return accessTypeOptions.find(a => a.value === accessType)?.label || accessType;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose} className="add-toilet-modal">
      <DialogContent 
        className="sm:max-w-md w-full max-w-full p-4 mobile:max-h-[75vh] mobile:h-auto bg-white shadow-xl border-0"
        style={{
          borderRadius: '24px',
          margin: '0',
          maxWidth: '500px',
          width: 'calc(100vw - 40px)',
          maxHeight: 'calc(100vh - 112px)',
          left: '50%',
          top: 'calc(50% + 16px)',
          transform: 'translate(-50%, -50%)',
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
          overflowY: 'auto',
          padding: '1rem'
        }}
      >
        <DialogHeader className="text-left space-y-2">
          <DialogTitle className="text-lg font-semibold text-gray-900">
            {showConfirmation ? "Confirm Details" : "Add Toilet"}
          </DialogTitle>
          <DialogDescription className="text-gray-600 text-xs leading-relaxed">
            {showConfirmation 
              ? "Review and confirm the details"
              : "Fill in the toilet details, then select location"
            }
          </DialogDescription>
        </DialogHeader>
        
        {showConfirmation ? (
          // Confirmation Step
          <div className="space-y-3">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-2">
                <Check className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-blue-800 text-sm">Location Selected</span>
              </div>
              <div className="text-xs text-blue-700">
                {location?.lat.toFixed(6)}, {location?.lng.toFixed(6)}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-gray-700">Type:</span>
                <span className="text-xs text-gray-900">{getTypeLabel(type)}</span>
              </div>
              
              {title && (
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-gray-700">Title:</span>
                  <span className="text-xs text-gray-900 font-medium">{title}</span>
                </div>
              )}
              
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-gray-700">Accessibility:</span>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  accessibility === 'accessible' ? 'bg-blue-100 text-blue-800' :
                  accessibility === 'not-accessible' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {getAccessibilityLabel(accessibility)}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-gray-700">Access:</span>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  accessType === 'free' ? 'bg-green-100 text-green-800' :
                  accessType === 'customers-only' ? 'bg-yellow-100 text-yellow-800' :
                  accessType === 'paid' ? 'bg-purple-100 text-purple-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {getAccessTypeLabel(accessType)}
                </span>
              </div>
              

            </div>

            <form onSubmit={handleSubmit}>
              <div className="flex space-x-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    haptics.light();
                    handleEdit();
                  }}
                  className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50 text-sm py-2"
                >
                  <Edit className="w-3 h-3 mr-1" />
                  Edit
                </Button>
                <Button
                  type="submit"
                  disabled={addToiletMutation.isPending}
                  onClick={() => haptics.medium()}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white shadow-sm text-sm py-2"
                >
                  {addToiletMutation.isPending ? "Adding..." : "Confirm & Add"}
                </Button>
              </div>
            </form>
          </div>
        ) : (
          // Form Step
          <form onSubmit={handleSubmit} className="space-y-3">
            
            <div>
              <Label htmlFor="toilet-type" className="text-xs font-medium text-gray-700">Type of Place</Label>
              <Select value={type} onValueChange={(value: ToiletType) => setType(value)}>
                <SelectTrigger id="toilet-type" className="border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border border-gray-200 shadow-lg">
                  {toiletTypes.map(({ value, label }) => (
                    <SelectItem key={value} value={value} className="hover:bg-blue-50 focus:bg-blue-50 text-sm">
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="toilet-title" className="text-xs font-medium text-gray-700">Title (Optional)</Label>
              <Input
                id="toilet-title"
                name="toilet-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Central Park Restroom"
                className="border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white h-9 text-sm"
              />
            </div>

            <div>
              <Label htmlFor="toilet-accessibility" className="text-xs font-medium text-gray-700">Accessibility</Label>
              <Select value={accessibility} onValueChange={(value: Accessibility) => setAccessibility(value)}>
                <SelectTrigger id="toilet-accessibility" className="border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border border-gray-200 shadow-lg">
                  {accessibilityOptions.map(({ value, label }) => (
                    <SelectItem key={value} value={value} className="hover:bg-blue-50 focus:bg-blue-50 text-sm">
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="toilet-access-type" className="text-xs font-medium text-gray-700">Access Type</Label>
              <Select value={accessType} onValueChange={(value: AccessType) => setAccessType(value)}>
                <SelectTrigger id="toilet-access-type" className="border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border border-gray-200 shadow-lg">
                  {accessTypeOptions.map(({ value, label }) => (
                    <SelectItem key={value} value={value} className="hover:bg-blue-50 focus:bg-blue-50 text-sm">
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            

            
            <div className="flex space-x-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50 text-sm py-2"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addToiletMutation.isPending}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white shadow-sm text-sm py-2"
              >
                {addToiletMutation.isPending ? "Adding..." : "Select Location"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
