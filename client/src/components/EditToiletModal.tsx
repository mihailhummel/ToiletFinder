import React, { useState, useEffect } from "react";
import { X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { haptics } from "@/lib/haptics";
import type { ToiletType, Accessibility, AccessType, MapLocation } from "@/types/toilet";

interface EditToiletModalProps {
  isOpen: boolean;
  onClose: () => void;
  location?: MapLocation;
  initialData: {
    type: ToiletType;
    title: string;
    accessibility: Accessibility;
    accessType: AccessType;
  };
  onConfirm: (data: {
    type: ToiletType;
    title: string;
    accessibility: Accessibility;
    accessType: AccessType;
  }) => void;
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

export const EditToiletModal = ({ isOpen, onClose, location, initialData, onConfirm }: EditToiletModalProps) => {
  const [type, setType] = useState<ToiletType>(initialData.type);
  const [title, setTitle] = useState(initialData.title);
  const [accessibility, setAccessibility] = useState<Accessibility>(initialData.accessibility);
  const [accessType, setAccessType] = useState<AccessType>(initialData.accessType);
  
  const { toast } = useToast();

  // Update state when initialData changes
  useEffect(() => {
    if (isOpen) {
      setType(initialData.type);
      setTitle(initialData.title);
      setAccessibility(initialData.accessibility);
      setAccessType(initialData.accessType);
    }
  }, [isOpen, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log("Edit toilet form submitted");
    
    // Pass the updated data back to the parent component
    onConfirm({
      type,
      title,
      accessibility,
      accessType
    });
    
    // Close the modal
    handleClose();
    
    // Show success toast
    toast({
      title: "Changes saved",
      description: "Your changes have been saved successfully."
    });
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleClose();
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
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
            Edit Toilet Details
          </DialogTitle>
          <DialogDescription className="text-gray-600 text-xs leading-relaxed">
            Make changes to the toilet details
          </DialogDescription>
        </DialogHeader>
        
        {/* Location display */}
        {location && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
            <div className="flex items-center space-x-2 mb-2">
              <Check className="w-4 h-4 text-blue-600" />
              <span className="font-medium text-blue-800 text-sm">Selected Location</span>
            </div>
            <div className="text-xs text-blue-700">
              {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
            </div>
          </div>
        )}
        
        {/* Edit Form */}
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
              onClick={() => haptics.medium()}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white shadow-sm text-sm py-2"
            >
              Confirm & Add
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};