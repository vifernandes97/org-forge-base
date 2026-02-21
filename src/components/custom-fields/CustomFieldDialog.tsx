import { useState, useEffect } from 'react';
import type { CustomFieldDefinition, CustomFieldType } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FieldTypeIcon, getFieldTypeLabel, fieldTypes } from './FieldTypeIcon';
import { CustomFieldRenderer } from './CustomFieldRenderer';
import { Plus, X, GripVertical } from 'lucide-react';
import { toast } from 'sonner';

interface CustomFieldDialogProps {
  field?: CustomFieldDefinition | null;
  trigger: React.ReactNode;
  onSave: (data: {
    field_label: string;
    field_name: string;
    field_type: CustomFieldType;
    options?: string[] | null;
    is_required: boolean;
    is_active: boolean;
  }) => void;
  isPending?: boolean;
}

function toSlug(label: string) {
  return label
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

export function CustomFieldDialog({ field, trigger, onSave, isPending }: CustomFieldDialogProps) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManual, setSlugManual] = useState(false);
  const [type, setType] = useState<CustomFieldType>('text');
  const [required, setRequired] = useState(false);
  const [active, setActive] = useState(true);
  const [options, setOptions] = useState<string[]>([]);
  const [newOption, setNewOption] = useState('');

  useEffect(() => {
    if (open && field) {
      setLabel(field.field_label);
      setSlug(field.field_name);
      setSlugManual(true);
      setType(field.field_type);
      setRequired(field.is_required);
      setActive(field.is_active);
      setOptions(field.options || []);
    } else if (open) {
      setLabel('');
      setSlug('');
      setSlugManual(false);
      setType('text');
      setRequired(false);
      setActive(true);
      setOptions([]);
    }
  }, [open, field]);

  const handleLabelChange = (val: string) => {
    setLabel(val);
    if (!slugManual) setSlug(toSlug(val));
  };

  const addOption = () => {
    const trimmed = newOption.trim();
    if (!trimmed || options.includes(trimmed)) return;
    setOptions([...options, trimmed]);
    setNewOption('');
  };

  const removeOption = (opt: string) => setOptions(options.filter(o => o !== opt));

  const handleSubmit = () => {
    if (label.trim().length < 2) {
      toast.error('O label deve ter pelo menos 2 caracteres');
      return;
    }
    if (!slug.trim()) {
      toast.error('O nome do campo é obrigatório');
      return;
    }
    if ((type === 'select' || type === 'multi_select') && options.length === 0) {
      toast.error('Adicione pelo menos uma opção');
      return;
    }
    onSave({
      field_label: label.trim(),
      field_name: slug.trim(),
      field_type: type,
      options: (type === 'select' || type === 'multi_select') ? options : null,
      is_required: required,
      is_active: active,
    });
    setOpen(false);
  };

  const showOptions = type === 'select' || type === 'multi_select';
  const previewField: CustomFieldDefinition = {
    id: 'preview',
    organization_id: '',
    field_name: slug,
    field_label: label || 'Campo',
    field_type: type,
    options: showOptions ? options : null,
    is_required: required,
    is_active: true,
    position: 0,
    created_at: '',
    updated_at: '',
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{field ? 'Editar Campo' : 'Novo Campo Personalizado'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Label</Label>
            <Input value={label} onChange={e => handleLabelChange(e.target.value)} placeholder="Ex: Empresa" />
          </div>

          <div className="space-y-2">
            <Label>Nome do campo (slug)</Label>
            <Input
              value={slug}
              onChange={e => { setSlug(toSlug(e.target.value)); setSlugManual(true); }}
              placeholder="ex: empresa"
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={v => setType(v as CustomFieldType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fieldTypes.map(t => (
                  <SelectItem key={t} value={t}>
                    <div className="flex items-center gap-2">
                      <FieldTypeIcon type={t} className="h-4 w-4" />
                      <span>{getFieldTypeLabel(t)}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            <Switch id="cf-required" checked={required} onCheckedChange={setRequired} />
            <Label htmlFor="cf-required">Obrigatório</Label>
          </div>

          {field && (
            <div className="flex items-center gap-3">
              <Switch id="cf-active" checked={active} onCheckedChange={setActive} />
              <Label htmlFor="cf-active">Ativo</Label>
            </div>
          )}

          {showOptions && (
            <div className="space-y-2">
              <Label>Opções</Label>
              <div className="space-y-1">
                {options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2 rounded border bg-muted/50 px-2 py-1">
                    <GripVertical className="h-3 w-3 text-muted-foreground" />
                    <span className="flex-1 text-sm">{opt}</span>
                    <button onClick={() => removeOption(opt)} className="text-destructive hover:text-destructive/80">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newOption}
                  onChange={e => setNewOption(e.target.value)}
                  placeholder="Nova opção..."
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addOption())}
                  className="flex-1"
                />
                <Button type="button" variant="outline" size="icon" onClick={addOption}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
            <Label className="text-xs text-muted-foreground">Preview</Label>
            <CustomFieldRenderer field={previewField} value="" onChange={() => {}} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {field ? 'Salvar' : 'Criar Campo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
