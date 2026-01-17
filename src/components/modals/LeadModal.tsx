import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import LeadForm from "@/components/forms/LeadForm";

interface LeadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: any;
  title: string;
  onLeadCreated?: (leadId: string) => void;
}

export default function LeadModal({ 
  open, 
  onOpenChange, 
  initialData, 
  title,
  onLeadCreated 
}: LeadModalProps) {
  const handleSuccess = (leadId?: string) => {
    if (leadId && onLeadCreated) {
      onLeadCreated(leadId);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <LeadForm
          initialData={initialData}
          onSuccess={handleSuccess}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}