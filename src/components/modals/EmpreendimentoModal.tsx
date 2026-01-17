import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import EmpreendimentoForm from "@/components/forms/EmpreendimentoForm";

interface EmpreendimentoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: any;
  title: string;
}

export default function EmpreendimentoModal({ open, onOpenChange, initialData, title }: EmpreendimentoModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <EmpreendimentoForm
          initialData={initialData}
          onSuccess={() => onOpenChange(false)}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}