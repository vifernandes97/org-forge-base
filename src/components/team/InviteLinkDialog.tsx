import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateInvite } from '@/hooks/useInvites';
import { buildInviteUrl } from '@/services/invites';
import { toast } from 'sonner';
import { Copy, Check } from 'lucide-react';
import type { OrgRole } from '@/types';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function InviteLinkDialog({ open, onOpenChange }: Props) {
  const create = useCreateInvite();
  const [role, setRole] = useState<OrgRole>('member');
  const [expires, setExpires] = useState<string>('7');
  const [usage, setUsage] = useState<string>('1');
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setRole('member'); setExpires('7'); setUsage('1');
    setGeneratedUrl(null); setCopied(false);
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleGenerate = async () => {
    try {
      const expires_in_days = expires === 'never' ? null : parseInt(expires, 10);
      const max_uses = usage === 'unlimited' ? null : parseInt(usage, 10);
      const inv = await create.mutateAsync({ role, expires_in_days, max_uses });
      setGeneratedUrl(buildInviteUrl(inv.token));
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar link');
    }
  };

  const handleCopy = async () => {
    if (!generatedUrl) return;
    await navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    toast.success('Link copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gerar link de convite</DialogTitle>
          <DialogDescription>
            Compartilhe este link com novos membros para que entrem na organização.
          </DialogDescription>
        </DialogHeader>

        {!generatedUrl ? (
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Papel</Label>
              <Select value={role} onValueChange={v => setRole(v as OrgRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="member">Membro</SelectItem>
                  <SelectItem value="viewer">Visualizador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Validade</Label>
              <Select value={expires} onValueChange={setExpires}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 dia</SelectItem>
                  <SelectItem value="7">7 dias</SelectItem>
                  <SelectItem value="30">30 dias</SelectItem>
                  <SelectItem value="never">Nunca expira</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Usos</Label>
              <Select value={usage} onValueChange={setUsage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Uso único</SelectItem>
                  <SelectItem value="5">Até 5 usos</SelectItem>
                  <SelectItem value="25">Até 25 usos</SelectItem>
                  <SelectItem value="unlimited">Ilimitado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Link gerado</Label>
            <div className="flex gap-2">
              <Input readOnly value={generatedUrl} onFocus={e => e.currentTarget.select()} />
              <Button type="button" variant="outline" size="icon" onClick={handleCopy} aria-label="Copiar link">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Após fechar, você poderá copiar o link novamente na lista abaixo.
            </p>
          </div>
        )}

        <DialogFooter>
          {!generatedUrl ? (
            <>
              <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
              <Button onClick={handleGenerate} disabled={create.isPending}>
                {create.isPending ? 'Gerando...' : 'Gerar link'}
              </Button>
            </>
          ) : (
            <Button onClick={() => handleClose(false)}>Concluir</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
