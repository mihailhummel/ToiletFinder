import { useState } from "react";
import { X, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import type { ToiletType } from "@/types/toilet";

interface FilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onFiltersChange: (filters: FilterOptions) => void;
}

export interface FilterOptions {
  types: ToiletType[];
  minRating: number;
}

const toiletTypes: { value: ToiletType; label: string }[] = [
  { value: "public", label: "Public" },
  { value: "EKOTOI", label: "EKOTOI" },
  { value: "restaurant", label: "Restaurant" },
  { value: "gas-station", label: "Gas Station" },
  { value: "cafe", label: "Cafe" },
  { value: "mall", label: "Mall" },
  { value: "other", label: "Other" },
];

export const FilterPanel = ({ isOpen, onClose, onFiltersChange }: FilterPanelProps) => {
  const [selectedTypes, setSelectedTypes] = useState<ToiletType[]>(toiletTypes.map(t => t.value));
  const [minRating, setMinRating] = useState([1]);

  const handleTypeChange = (type: ToiletType, checked: boolean) => {
    const newTypes = checked 
      ? [...selectedTypes, type]
      : selectedTypes.filter(t => t !== type);
    
    setSelectedTypes(newTypes);
    onFiltersChange({ types: newTypes, minRating: minRating[0] });
  };

  const handleRatingChange = (value: number[]) => {
    setMinRating(value);
    onFiltersChange({ types: selectedTypes, minRating: value[0] });
  };

  return (
    <div className={`filter-panel fixed bottom-0 left-0 right-0 bg-white rounded-t-xl shadow-lg transform transition-transform duration-300 z-20 ${
      isOpen ? 'translate-y-0' : 'translate-y-full'
    }`}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Filter className="w-5 h-5" />
            <h3 className="font-semibold">Filter Toilets</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-3">Type</label>
            <div className="grid grid-cols-2 gap-3">
              {toiletTypes.map(({ value, label }) => (
                <div key={value} className="flex items-center space-x-2">
                  <Checkbox
                    id={value}
                    checked={selectedTypes.includes(value)}
                    onCheckedChange={(checked) => handleTypeChange(value, !!checked)}
                  />
                  <label htmlFor={value} className="text-sm cursor-pointer">
                    {label}
                  </label>
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-3">Minimum Rating</label>
            <div className="px-2">
              <Slider
                value={minRating}
                onValueChange={handleRatingChange}
                max={5}
                min={1}
                step={0.5}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>{minRating[0]}+ stars</span>
                <span>5 stars</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
