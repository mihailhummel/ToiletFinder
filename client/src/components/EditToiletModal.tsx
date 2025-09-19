import React, { useState, useEffect } from "react";
import { X, Check, MapPin, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { haptics } from "@/lib/haptics";
import { useLanguage } from "@/contexts/LanguageContext";
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
    coordinates?: MapLocation;
  }) => void;
  onRequestLocationSelection?: (type: ToiletType, title: string, accessibility: Accessibility, accessType: AccessType, originalLocation: MapLocation) => void;
}

// Toilet type templates for automatic assignment (same as AddToiletModal)
const TOILET_TYPE_TEMPLATES: Record<ToiletType, { accessibility: Accessibility; accessType: AccessType }> = {
  "public": { accessibility: "unknown", accessType: "free" },
  "restaurant": { accessibility: "accessible", accessType: "customers-only" },
  "cafe": { accessibility: "accessible", accessType: "customers-only" },
  "gas-station": { accessibility: "accessible", accessType: "customers-only" },
  "mall": { accessibility: "accessible", accessType: "free" },
  "other": { accessibility: "unknown", accessType: "unknown" }
};

export const EditToiletModal = ({ isOpen, onClose, location, initialData, onConfirm, onRequestLocationSelection }: EditToiletModalProps) => {
  const [type, setType] = useState<ToiletType>(initialData.type);
  const [title, setTitle] = useState(initialData.title);
  const [accessibility, setAccessibility] = useState<Accessibility>(initialData.accessibility);
  const [accessType, setAccessType] = useState<AccessType>(initialData.accessType);
  const [editableLocation, setEditableLocation] = useState(location || { lat: 0, lng: 0 });
  
  const { toast } = useToast();
  const { t } = useLanguage();
  
  // Dynamic toilet types with translations
  const toiletTypes: { value: ToiletType; label: string }[] = [
    { value: "public", label: t('toiletType.public') },
    { value: "restaurant", label: t('toiletType.restaurant') },
    { value: "cafe", label: t('toiletType.cafe') },
    { value: "gas-station", label: t('toiletType.gasStation') },
    { value: "mall", label: t('toiletType.mall') },
    { value: "other", label: t('toiletType.other') },
  ];
  
  // Dynamic accessibility options with translations and colors
  const accessibilityOptions: { value: Accessibility; label: string; color: string }[] = [
    { value: "accessible", label: t('accessibility.accessible'), color: "text-green-700 bg-green-100" },
    { value: "not-accessible", label: t('accessibility.notAccessible'), color: "text-red-700 bg-red-100" },
    { value: "unknown", label: t('accessibility.unknown'), color: "text-gray-700 bg-gray-100" },
  ];
  
  // Dynamic access type options with translations and colors
  const accessTypeOptions: { value: AccessType; label: string; color: string }[] = [
    { value: "free", label: t('accessType.free'), color: "text-green-700 bg-green-100" },
    { value: "customers-only", label: t('accessType.customersOnly'), color: "text-yellow-700 bg-yellow-100" },
    { value: "paid", label: t('accessType.paid'), color: "text-purple-700 bg-purple-100" },
    { value: "unknown", label: t('accessType.unknown'), color: "text-gray-700 bg-gray-100" },
  ];

  // Auto-apply template when toilet type changes
  const handleTypeChange = (newType: ToiletType) => {
    setType(newType);
    const template = TOILET_TYPE_TEMPLATES[newType];
    setAccessibility(template.accessibility);
    setAccessType(template.accessType);
  };

  // Update state when initialData changes
  useEffect(() => {
    if (isOpen) {
      setType(initialData.type);
      setTitle(initialData.title);
      setAccessibility(initialData.accessibility);
      setAccessType(initialData.accessType);
      if (location) {
        setEditableLocation(location);
      }
    }
  }, [isOpen, initialData, location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log("Edit toilet form submitted");
    
    // Validate coordinates
    if (!editableLocation.lat || !editableLocation.lng) {
      toast({
        title: "Invalid coordinates",
        description: "Please enter valid latitude and longitude values.",
        variant: "destructive"
      });
      return;
    }

    // Pass the updated data back to the parent component
    onConfirm({
      type,
      title,
      accessibility,
      accessType,
      coordinates: editableLocation
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
        className="sm:max-w-md w-full max-w-full mobile:max-h-[75vh] mobile:h-auto bg-white shadow-xl border-0 overflow-hidden"
        style={{
          borderRadius: '24px',
          margin: '0',
          maxWidth: '500px',
          width: 'calc(100vw - 16px)', // Reduced margins for more content space
          maxHeight: 'calc(100vh - 80px)', // Reduced top/bottom margins
          left: '50%',
          top: 'calc(50% + 8px)', // Moved closer to center
          transform: 'translate(-50%, -50%)',
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
          overflowY: 'auto',
          overflowX: 'hidden', // Prevent horizontal overflow
          padding: '0.75rem', // Reduced padding for more content space
          gap: '.5rem',
        }}
      >
        <DialogHeader className="text-left space-y-2">
          <DialogTitle className="text-lg font-semibold text-gray-900">
            {t('button.edit')}
          </DialogTitle>
          <DialogDescription className="text-gray-600 text-xs leading-relaxed">
            {t('description.editToilet')}
          </DialogDescription>
        </DialogHeader>
        
        {/* Location editing section - Responsive */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5">
          {/* Desktop layout */}
          <div className="hidden sm:block">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-blue-800 text-sm">{t('location.title')}</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (onRequestLocationSelection) {
                    onRequestLocationSelection(type, title, accessibility, accessType, editableLocation);
                  }
                }}
                className="h-7 px-3 text-xs text-blue-600 border-blue-300 hover:bg-blue-100"
              >
                <Edit3 className="w-3 h-3 mr-1" />
                {t('location.changeOnMap')}
              </Button>
            </div>
            
            <div className="text-xs text-blue-700 break-all">
              <span className="font-medium">{t('location.coordinates')}:</span> <span className="font-mono">{editableLocation.lat.toFixed(6)}, {editableLocation.lng.toFixed(6)}</span>
            </div>
            <div className="text-xs text-blue-500 mt-1">
              {t('location.changeInstruction')}
            </div>
          </div>

          {/* Mobile layout */}
          <div className="sm:hidden">
            <div className="flex items-center justify-between">
              {/* Left side - Location title and coordinates */}
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-blue-800 text-sm">{t('location.title')}</span>
                </div>
                <div className="text-xs text-blue-700 break-all">
                  <span className="font-mono text-xs">{editableLocation.lat.toFixed(6)}, {editableLocation.lng.toFixed(6)}</span>
                </div>
              </div>
              
              {/* Right side - Change button */}
              <div className="ml-2 flex-shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (onRequestLocationSelection) {
                      onRequestLocationSelection(type, title, accessibility, accessType, editableLocation);
                    }
                  }}
                  className="h-8 px-2 text-xs text-blue-600 border-blue-300 hover:bg-blue-100 whitespace-nowrap"
                >
                  <Edit3 className="w-3 h-3 mr-1" />
                  {t('location.change')}
                </Button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Edit Form */}
        <form onSubmit={handleSubmit} className="space-y-2.5 min-w-0">
          <div className="min-w-0">
            <Label htmlFor="toilet-type" className="text-xs font-medium text-gray-700">{t('addToilet.toiletType')}</Label>
            <Select value={type} onValueChange={handleTypeChange}>
              <SelectTrigger id="toilet-type" className="border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-9 text-sm w-full">
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

          <div className="min-w-0">
            <Label htmlFor="toilet-title" className="text-xs font-medium text-gray-700">{t('addToilet.toiletTitle')}</Label>
            <Input
              id="toilet-title"
              name="toilet-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('addToilet.titlePlaceholder')}
              className="border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white h-9 text-sm w-full"
            />
          </div>

          <div className="min-w-0">
            <Label htmlFor="toilet-access-type" className="text-xs font-medium text-gray-700">{t('addToilet.accessType')}</Label>
            <Select value={accessType} onValueChange={(value: AccessType) => setAccessType(value)}>
              <SelectTrigger id="toilet-access-type" className="border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-9 text-sm w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border border-gray-200 shadow-lg">
                {accessTypeOptions.map(({ value, label, color }) => (
                  <SelectItem key={value} value={value} className="hover:bg-blue-50 focus:bg-blue-50 text-sm">
                    <span className={`${color} px-2 py-1 rounded-full font-medium`}>
                      {label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-0">
            <Label htmlFor="toilet-accessibility" className="text-xs font-medium text-gray-700">{t('addToilet.accessibility')}</Label>
            <Select value={accessibility} onValueChange={(value: Accessibility) => setAccessibility(value)}>
              <SelectTrigger id="toilet-accessibility" className="border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-9 text-sm w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border border-gray-200 shadow-lg">
                {accessibilityOptions.map(({ value, label, color }) => (
                  <SelectItem key={value} value={value} className="hover:bg-blue-50 focus:bg-blue-50 text-sm">
                    <span className={`${color} px-2 py-1 rounded-full font-medium`}>
                      {label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex space-x-2 pt-1.5 min-w-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50 text-sm py-2 min-w-0"
            >
              <span className="truncate">{t('button.cancel')}</span>
            </Button>
            <Button
              type="submit"
              onClick={() => haptics.medium()}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white shadow-sm text-sm py-2 min-w-0"
            >
              <span className="truncate">{t('button.save')}</span>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};