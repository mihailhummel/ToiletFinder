import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { User } from "lucide-react";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal = ({ isOpen, onClose }: LoginModalProps) => {
  const { signInWithGoogle } = useAuth();

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
      onClose();
    } catch (error) {
      console.error("Sign in error:", error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm z-[9999] bg-white shadow-xl border-0">
        <DialogHeader className="text-center">
          <DialogTitle className="text-xl font-semibold text-gray-900">Sign In</DialogTitle>
          <DialogDescription className="text-gray-600">
            Sign in with Google to add toilet locations and reviews
          </DialogDescription>
        </DialogHeader>
        <div className="text-center space-y-6">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-700 rounded-full flex items-center justify-center mx-auto shadow-lg">
            <User className="w-8 h-8 text-white" />
          </div>
          
          <div>
            <h2 className="text-xl font-semibold mb-2 text-gray-900">Sign In Required</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              Please sign in with Google to leave reviews and help the community.
            </p>
          </div>
          
          <Button
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center space-x-3 bg-white hover:bg-gray-50 text-gray-900 border-2 border-gray-300 shadow-sm h-12 font-medium"
            variant="outline"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path 
                fill="#4285F4" 
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path 
                fill="#34A853" 
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path 
                fill="#FBBC05" 
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path 
                fill="#EA4335" 
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span>Continue with Google</span>
          </Button>
          
          <Button variant="ghost" onClick={onClose} className="text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100">
            Maybe later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
