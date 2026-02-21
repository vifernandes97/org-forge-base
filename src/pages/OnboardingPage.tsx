import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useOrganization } from '@/contexts/OrganizationContext';
import { createOrganization, checkSlugAvailable } from '@/services/organizations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const schema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  slug: z.string().min(3, 'Mínimo 3 caracteres').max(40).regex(/^[a-z0-9-]+$/, 'Apenas letras minúsculas, números e hífens'),
});

type FormData = z.infer<typeof schema>;

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { refetch } = useOrganization();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  // Auto-generate slug from name
  const nameValue = watch('name');
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    register('name').onChange(e);
    const slug = e.target.value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
    setValue('slug', slug);
  };

  const onSubmit = async (data: FormData) => {
    try {
      setLoading(true);
      const available = await checkSlugAvailable(data.slug);
      if (!available) {
        toast({ title: 'Slug indisponível', description: 'Escolha outro identificador.', variant: 'destructive' });
        return;
      }
      await createOrganization(data.name, data.slug);
      await refetch();
      toast({ title: 'Organização criada!' });
      navigate('/dashboard');
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
            <Building2 className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Crie sua organização</CardTitle>
          <CardDescription>Configure o espaço de trabalho da sua equipe</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da organização</Label>
              <Input id="name" placeholder="Minha Empresa" {...register('name')} onChange={handleNameChange} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Identificador (slug)</Label>
              <Input id="slug" placeholder="minha-empresa" {...register('slug')} />
              {errors.slug && <p className="text-sm text-destructive">{errors.slug.message}</p>}
              <p className="text-xs text-muted-foreground">Usado na URL. Apenas letras minúsculas, números e hífens.</p>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Criando...' : 'Criar organização'}
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
