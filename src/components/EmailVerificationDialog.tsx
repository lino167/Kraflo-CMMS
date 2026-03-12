import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Mail, CheckCircle2, ArrowRight } from 'lucide-react';

interface EmailVerificationDialogProps {
  open: boolean;
  onClose: () => void;
  email: string;
}

export function EmailVerificationDialog({ open, onClose, email }: EmailVerificationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-4 p-3 bg-green-500/10 rounded-full w-fit">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
          </div>
          <DialogTitle className="text-center text-xl">
            Verifique seu email
          </DialogTitle>
          <DialogDescription className="text-center space-y-4">
            <p>
              Enviamos um link de confirmação para:
            </p>
            <div className="flex items-center justify-center gap-2 p-3 bg-secondary rounded-lg">
              <Mail className="h-4 w-4 text-primary" />
              <span className="font-medium text-foreground">{email}</span>
            </div>
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Próximos passos:</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Abra seu email e procure a mensagem da Kraflo</li>
              <li>Clique no link de confirmação</li>
              <li>Volte aqui e faça login com suas credenciais</li>
            </ol>
          </div>
          
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-sm">
            <p className="text-amber-600 dark:text-amber-400">
              💡 <strong>Dica:</strong> Verifique também sua pasta de spam ou lixo eletrônico.
            </p>
          </div>
          
          <Button onClick={onClose} className="w-full">
            Entendi, vou verificar
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
