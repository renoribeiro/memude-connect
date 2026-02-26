import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface CreatePipelineModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    isCreating: boolean;
    onCreate: (data: { nome: string; descricao?: string }) => void;
}

export default function CreatePipelineModal({
    open,
    onOpenChange,
    isCreating,
    onCreate,
}: CreatePipelineModalProps) {
    const [nome, setNome] = useState('');
    const [descricao, setDescricao] = useState('');

    const handleOpenChange = (v: boolean) => {
        if (!v) {
            setNome('');
            setDescricao('');
        }
        onOpenChange(v);
    };

    const handleSave = () => {
        if (!nome.trim()) return;
        onCreate({
            nome: nome.trim(),
            descricao: descricao.trim() || undefined,
        });
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Criar Novo Funil</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="new-pipeline-name">Nome do Funil *</Label>
                        <Input
                            id="new-pipeline-name"
                            value={nome}
                            onChange={(e) => setNome(e.target.value)}
                            placeholder="Ex: Funil de Captação"
                            autoFocus
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="new-pipeline-desc">Descrição</Label>
                        <Input
                            id="new-pipeline-desc"
                            value={descricao}
                            onChange={(e) => setDescricao(e.target.value)}
                            placeholder="Descreva o objetivo deste funil..."
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => handleOpenChange(false)}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSave} disabled={isCreating || !nome.trim()}>
                        {isCreating ? 'Criando...' : 'Criar Funil'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
