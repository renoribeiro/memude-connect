import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import CorretorForm from "@/components/forms/CorretorForm";

interface CorretorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: any;
  title: string;
}

export default function CorretorModal({ open, onOpenChange, initialData, title }: CorretorModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <CorretorForm
            initialData={initialData}
            onSuccess={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}