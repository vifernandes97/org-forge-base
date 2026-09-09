import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrganization } from '@/contexts/OrganizationContext';
import { createOrganization, checkSlugAvailable } from '@/services/organizations';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateOrganizationDialog({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { refetch, setActiveOrg } = useOrganization();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setName('');
    setSlug('');
    setSlugTouched(false);
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      toast.error('Informe o nome da empresa (mínimo 2 caracteres).');
      return;
    }
    if (slug.length < 3) {
      toast.error('O identificador precisa ter pelo menos 3 caracteres.');
      return;
    }
    setLoading(true);
    try {
      const available = await checkSlugAvailable(slug);
      if (!available) {
        toast.error('Este identificador já está em uso. Escolha outro.');
        return;
      }
      const created: any = await createOrganization(name.trim(), slug);
      await refetch();
      if (created?.id) setActiveOrg(created.id);
      toast.success('Empresa criada!');
      onOpenChange(false);
      reset();
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar empresa');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova empresa</DialogTitle>
          <DialogDescription>
            Cada empresa tem seus próprios negócios, funis, equipe e configurações.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-org-name">Nome</Label>
            <Input
              id="new-org-name"
              autoFocus
              placeholder="Minha Empresa"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-org-slug">Identificador</Label>
            <Input
              id="new-org-slug"
              placeholder="minha-empresa"
              value={slug}
              onChange={(e) => { setSlugTouched(true); setSlug(slugify(e.target.value)); }}
            />
            <p className="text-xs text-muted-foreground">
              Apenas letras minúsculas, números e hífens.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Criando...' : 'Criar empresa'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
