import { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useCreateFunnel } from '@/hooks/useFunnels';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';

const schema = z.object({
  name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(100),
  description: z.string().trim().max(500).optional(),
});

type FormValues = z.infer<typeof schema>;

export function CreateFunnelDialog() {
  const [open, setOpen] = useState(false);
  const createFunnel = useCreateFunnel();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '' },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      await createFunnel.mutateAsync({
        name: values.name,
        description: values.description || null,
      });
      toast.success('Funil criado com sucesso');
      form.reset();
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar funil');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-2" />Novo Funil</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar Funil</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Nome</FormLabel>
                <FormControl><Input placeholder="Ex: Funil de Vendas" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Descrição (opcional)</FormLabel>
                <FormControl><Textarea placeholder="Descreva o funil..." {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createFunnel.isPending}>
                {createFunnel.isPending ? 'Criando...' : 'Criar'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
