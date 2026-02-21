import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface FilterValueRangeProps {
  valueMin?: number;
  valueMax?: number;
  onChangeMin: (v: number | undefined) => void;
  onChangeMax: (v: number | undefined) => void;
}

export function FilterValueRange({ valueMin, valueMax, onChangeMin, onChangeMax }: FilterValueRangeProps) {
  return (
    <div className="flex items-center gap-1.5">
      <Label className="text-xs text-muted-foreground whitespace-nowrap">R$</Label>
      <Input
        type="number"
        placeholder="Mín"
        value={valueMin ?? ''}
        onChange={e => onChangeMin(e.target.value ? Number(e.target.value) : undefined)}
        className="h-8 w-20 text-xs"
      />
      <span className="text-xs text-muted-foreground">-</span>
      <Input
        type="number"
        placeholder="Máx"
        value={valueMax ?? ''}
        onChange={e => onChangeMax(e.target.value ? Number(e.target.value) : undefined)}
        className="h-8 w-20 text-xs"
      />
    </div>
  );
}
