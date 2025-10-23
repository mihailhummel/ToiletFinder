import { MapPin, Utensils, Car, Coffee, Building } from "lucide-react";
import type { ToiletType } from "@/types/toilet";

interface ToiletMarkerProps {
  type: ToiletType;
  onClick: () => void;
  className?: string;
}

export const ToiletMarker = ({ type, onClick, className = "" }: ToiletMarkerProps) => {
  const getIcon = () => {
    switch (type) {
      case "restaurant":
        return <Utensils className="w-4 h-4 text-white" />;
      case "gas-station":
        return <Car className="w-4 h-4 text-white" />;
      case "cafe":
        return <Coffee className="w-4 h-4 text-white" />;
      case "mall":
        return <Building className="w-4 h-4 text-white" />;
      case "EKOTOI":
        return <MapPin className="w-4 h-4 text-white" />;
      default:
        return <MapPin className="w-4 h-4 text-white" />;
    }
  };

  const getColor = () => {
    switch (type) {
      case "restaurant":
        return "bg-yellow-500";
      case "gas-station":
        return "bg-red-500";
      case "cafe":
        return "bg-purple-500";
      case "mall":
        return "bg-blue-600";
      case "EKOTOI":
        return "bg-green-500";
      default:
        return "bg-green-500";
    }
  };

  return (
    <button
      onClick={onClick}
      className={`toilet-marker ${getColor()} ${className} hover:scale-110 transition-transform duration-200`}
    >
      {getIcon()}
    </button>
  );
};
