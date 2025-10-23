import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAddReport } from "@/hooks/useToilets";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Toilet, ReportReason } from "@/types/toilet";

interface ReportModalProps {
  toilet: Toilet;
  isOpen: boolean;
  onClose: () => void;
}

export const ReportModal = ({ toilet, isOpen, onClose }: ReportModalProps) => {
  const [reason, setReason] = useState<ReportReason>('doesnt-exist');
  const [comment, setComment] = useState<string>('');
  
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const addReportMutation = useAddReport();

  // Dynamic report reasons with translations
  const reportReasons: { value: ReportReason; label: string }[] = [
    { value: "doesnt-exist", label: t('report.reasonDoesntExist') },
    { value: "wrong-details", label: t('report.reasonWrongDetails') },
    { value: "inaccessible", label: t('report.reasonInaccessible') },
    { value: "closed", label: t('report.reasonClosed') },
    { value: "other", label: t('report.reasonOther') },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate that wrong-details has a comment
    if (reason === 'wrong-details' && !comment.trim()) {
      toast({
        title: t('error.addingToilet'),
        description: t('report.detailsLabel'),
        variant: "destructive"
      });
      return;
    }
    
    try {
      const reportData = {
        toiletId: toilet.id,
        userId: user?.uid || '',
        userName: user?.displayName || user?.email || '',
        reason,
        comment: comment.trim() || undefined
      };
      
      console.log('🔍 Submitting report:', reportData);
      
      await addReportMutation.mutateAsync(reportData);

      toast({
        title: t('report.success'),
        description: "Thank you for helping improve the community data."
      });

      onClose();
      setReason('doesnt-exist');
      setComment('');
    } catch (error) {
      console.error('❌ Error submitting report:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit report. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleClose = () => {
    onClose();
    setReason('doesnt-exist');
    setComment('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className="
          w-[92vw]             /* comfy gutters on tiny screens */
          sm:w-[80vw]          /* 80% from sm up */
          md:w-auto            /* let max-width control on desktop */
          max-w-[560px]        /* cap desktop width (adjust to taste) */
          p-4 sm:p-6
          bg-white shadow-xl border-0
          mobile:max-h-[75vh] mobile:h-auto
        "
        style={{
          borderRadius: '24px',
          maxHeight: 'calc(100vh - 32px)',
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      >

        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">{t('report.title')}</DialogTitle>
          {/*<DialogDescription className="text-sm sm:text-base">
            {t('report.description')}
          </DialogDescription>*/}
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            {/*<label className="block text-sm sm:text-base font-medium mb-3">{t('report.issueType')}</label>*/}
            <RadioGroup value={(reason ?? 'doesnt-exist') as string} onValueChange={(value) => setReason(value as ReportReason)}>
              {reportReasons.map(({ value, label }) => (
                <div key={value} className="flex items-center space-x-2">
                  <RadioGroupItem
                    value={value}
                    id={value}
                    className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5"
                  />
                  <Label htmlFor={value} className="text-sm sm:text-base cursor-pointer">
                    {label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
          
          {/* Show required details field for wrong-details reports */}
          {reason === 'wrong-details' && (
            <div>
              <label className="block text-sm sm:text-base font-medium mb-2 text-red-600">
                {t('report.detailsLabel')}
              </label>
              <Textarea
                value={comment || ''}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t('report.detailsPlaceholder')}
                rows={3}
                className="resize-none border-red-300 focus:border-red-500"
                required
              />
            </div>
          )}
          
          {/* Show optional comments field for other report types */}
          {reason !== 'wrong-details' && (
            <div>
              <label className="block text-sm sm:text-base font-medium mb-2">
                {t('report.comment')} (Optional)
              </label>
              <Textarea
                value={comment || ''}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Please provide more details..."
                rows={3}
                className="resize-none"
              />
            </div>
          )}
          
          <div className="flex space-x-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="flex-1 text-sm sm:text-base h-9 sm:h-10"
            >
              {t('button.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={addReportMutation.isPending}
              className="flex-1 bg-red-500 hover:bg-red-600 text-sm sm:text-base h-9 sm:h-10"
            >
              {addReportMutation.isPending ? "Submitting..." : t('report.submit')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
