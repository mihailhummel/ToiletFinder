import React, { useState, useEffect } from "react";
import { X, MapPin, Check, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EditToiletModal } from "./EditToiletModal";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAddToiletOptimized } from "@/hooks/useToiletCache";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
// import { queryClient } from "@/lib/queryClient"; // No longer needed with optimized caching
import type { ToiletType, Accessibility, AccessType, MapLocation } from "@/types/toilet";
import { haptics } from "@/lib/haptics";

interface AddToiletModalProps {
  isOpen: boolean;
  onClose: () => void;
  location?: MapLocation;
  onRequestLocationSelection?: (type: ToiletType, title: string, accessibility: Accessibility, accessType: AccessType) => void;
  onCloseForLocationSelection?: () => void;
  onToiletAdded?: (toilet: any) => void;
}

// Toilet types will be translated dynamically

// Accessibility and access type options are now defined dynamically inside the component

export const AddToiletModal = ({ isOpen, onClose, location, onRequestLocationSelection, onCloseForLocationSelection, onToiletAdded }: AddToiletModalProps) => {
  const [type, setType] = useState<ToiletType>("public");
  const [title, setTitle] = useState("");
  const [accessibility, setAccessibility] = useState<Accessibility>("unknown");
  const [accessType, setAccessType] = useState<AccessType>("unknown");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const addToiletMutation = useAddToiletOptimized(); // Uses optimized caching
  
  // Dynamic toilet types with translations
  const toiletTypes: { value: ToiletType; label: string }[] = [
    { value: "public", label: t('toiletType.public') },
    { value: "restaurant", label: t('toiletType.restaurant') },
    { value: "cafe", label: t('toiletType.cafe') },
    { value: "gas-station", label: t('toiletType.gasStation') },
    { value: "mall", label: t('toiletType.mall') },
    { value: "other", label: t('toiletType.other') },
  ];
  
  // Dynamic accessibility options with translations
  const accessibilityOptions: { value: Accessibility; label: string }[] = [
    { value: "accessible", label: t('accessibility.accessible') },
    { value: "not-accessible", label: t('accessibility.notAccessible') },
    { value: "unknown", label: t('accessibility.unknown') },
  ];
  
  // Dynamic access type options with translations
  const accessTypeOptions: { value: AccessType; label: string }[] = [
    { value: "free", label: t('accessType.free') },
    { value: "customers-only", label: t('accessType.customersOnly') },
    { value: "paid", label: t('accessType.paid') },
    { value: "unknown", label: t('accessType.unknown') },
  ];

  // Auto-show confirmation when location is provided (but not when editing)
  useEffect(() => {
    if (location && !showConfirmation && !isEditing) {
      setShowConfirmation(true);
    }
  }, [location, showConfirmation, isEditing]);

    const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Form submission initiated
    
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
      // Request location selection
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
        lat: location.lat,
        lng: location.lng,
        type,
        title: title.trim() || '',
        accessibility,
        accessType,
        userId: user.uid,
        source: 'user' as const,
        addedByUserName: user.displayName || 'Anonymous User'
      };
      
      // Sending toilet data to server
      
      // Use optimized mutation with automatic cache updates
      addToiletMutation.mutate(toiletData, {
        onSuccess: (result) => {
          // Toilet added successfully
          
          handleClose();
          setIsEditing(false);
          
          // Call the callback if provided
          if (onToiletAdded) {
            onToiletAdded(result);
          }
        },
        onError: (error) => {
          console.error("🚽 Client: Error adding toilet:", error);
          // Error toast is handled by the mutation hook
        }
      });
      
      // Note: Cache updates and toasts are handled by the optimized mutation hook
      
    } catch (error) {
      console.error("🚽 Client: Unexpected error:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Modal cancelled by user
    handleClose();
  };

  const handleEdit = () => {
    // Instead of going back to the form, show the edit modal
    setShowEditModal(true);
  };
  
  const handleEditConfirm = (data: {
    type: ToiletType;
    title: string;
    accessibility: Accessibility;
    accessType: AccessType;
  }) => {
    // Update the form data with the edited values
    setType(data.type);
    setTitle(data.title);
    setAccessibility(data.accessibility);
    setAccessType(data.accessType);
    
    // Close the edit modal
    setShowEditModal(false);
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
    <>
      {/* Edit Toilet Modal */}
      <EditToiletModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        location={location}
        initialData={{
          type,
          title,
          accessibility,
          accessType
        }}
        onConfirm={handleEditConfirm}
      />
      
      {/* Main Add Toilet Modal */}
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
            {showConfirmation ? t('addToilet.selectLocation') : t('addToilet.title')}
          </DialogTitle>
          <DialogDescription className="text-gray-600 text-xs leading-relaxed">
            {showConfirmation ? t('description.reviewDetails') : t('description.fillDetails')}
          </DialogDescription>
        </DialogHeader>
        
        {showConfirmation ? (
          // Confirmation Step
          <div className="space-y-3">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-2">
                <Check className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-blue-800 text-sm">{t('addToilet.selectLocation')}</span>
              </div>
              <div className="text-xs text-blue-700">
                {location?.lat.toFixed(6)}, {location?.lng.toFixed(6)}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-gray-700">{t('addToilet.toiletType')}:</span>
                <span className="text-xs text-gray-900">{getTypeLabel(type)}</span>
              </div>
              
              {title && (
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-gray-700">{t('addToilet.toiletTitle')}:</span>
                  <span className="text-xs text-gray-900 font-medium">{title}</span>
                </div>
              )}
              
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-gray-700">{t('addToilet.accessibility')}:</span>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  accessibility === 'accessible' ? 'bg-blue-100 text-blue-800' :
                  accessibility === 'not-accessible' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {getAccessibilityLabel(accessibility)}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-gray-700">{t('addToilet.accessType')}:</span>
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
                  {t('button.edit')}
                </Button>
                <Button
                  type="submit"
                  disabled={addToiletMutation.isPending}
                  onClick={() => haptics.medium()}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white shadow-sm text-sm py-2"
                >
                  {addToiletMutation.isPending ? "Adding..." : t('button.submit')}
                </Button>
              </div>
            </form>
          </div>
        ) : (
          // Form Step
          <form onSubmit={handleSubmit} className="space-y-3">
            
            <div>
              <Label htmlFor="toilet-type" className="text-xs font-medium text-gray-700">{t('addToilet.toiletType')}</Label>
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
              <Label htmlFor="toilet-title" className="text-xs font-medium text-gray-700">{t('addToilet.toiletTitle')}</Label>
              <Input
                id="toilet-title"
                name="toilet-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('addToilet.titlePlaceholder')}
                className="border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white h-9 text-sm"
              />
            </div>

            <div>
              <Label htmlFor="toilet-accessibility" className="text-xs font-medium text-gray-700">{t('addToilet.accessibility')}</Label>
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
              <Label htmlFor="toilet-access-type" className="text-xs font-medium text-gray-700">{t('addToilet.accessType')}</Label>
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
                {t('button.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={addToiletMutation.isPending}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white shadow-sm text-sm py-2"
              >
                {addToiletMutation.isPending ? "Adding..." : t('addToilet.selectLocation')}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
};
