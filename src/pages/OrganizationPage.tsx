import { useState, useEffect } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { updateOrganization, deleteOrganization, checkSlugAvailable } from '@/services/organizations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import { Building2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export default function OrganizationPage() {
  const { organization, isOwner, loading, refetch } = useOrganization();
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (organization) {
      setName(organization.name);
      setSlug(organization.slug);
      setLogoUrl(organization.logo_url || '');
    }
  }, [organization]);

  const handleSave = async () => {
    if (!organization || !name.trim() || !slug.trim()) return;
    setSaving(true);
    try {
      // Check slug if changed
      if (slug !== organization.slug) {
        const available = await checkSlugAvailable(slug);
        if (!available) {
          toast.error('Este slug já está em uso.');
          setSaving(false);
          return;
        }
      }
      await updateOrganization(organization.id, { name: name.trim(), slug: slug.trim(), logo_url: logoUrl.trim() || null });
      await refetch();
      toast.success('Organização atualizada!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!organization) return;
    setDeleting(true);
    try {
      await deleteOrganization(organization.id);
      toast.success('Organização excluída.');
      await signOut();
      navigate('/login');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir organização');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Card><CardContent className="p-6 space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Building2 className="h-6 w-6" />
        Organização
      </h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Dados da organização</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="org-name">Nome</Label>
            <Input id="org-name" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="org-slug">Slug</Label>
            <Input id="org-slug" value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} />
            <p className="text-xs text-muted-foreground">Identificador único (apenas letras minúsculas, números e hífens)</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="org-logo">URL do Logo</Label>
            <Input id="org-logo" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://..." />
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </Button>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      {isOwner && (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-lg text-destructive">Zona de perigo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ao excluir a organização, todos os dados (negócios, funis, tarefas, membros) serão permanentemente removidos.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir organização
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir organização?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação é irreversível. Digite <strong>{organization?.name}</strong> para confirmar.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Input
                  value={deleteConfirm}
                  onChange={e => setDeleteConfirm(e.target.value)}
                  placeholder={`Digite "${organization?.name}"`}
                />
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setDeleteConfirm('')}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={deleteConfirm !== organization?.name || deleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleting ? 'Excluindo...' : 'Excluir permanentemente'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
