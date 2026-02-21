import {
  Type, Hash, DollarSign, Calendar, ChevronDown, List,
  CheckSquare, Link, Mail, Phone,
} from 'lucide-react';
import type { CustomFieldType } from '@/types';

const iconMap: Record<CustomFieldType, React.ElementType> = {
  text: Type,
  number: Hash,
  currency: DollarSign,
  date: Calendar,
  select: ChevronDown,
  multi_select: List,
  checkbox: CheckSquare,
  url: Link,
  email: Mail,
  phone: Phone,
};

const labelMap: Record<CustomFieldType, string> = {
  text: 'Texto',
  number: 'Número',
  currency: 'Moeda',
  date: 'Data',
  select: 'Seleção',
  multi_select: 'Multi-seleção',
  checkbox: 'Checkbox',
  url: 'URL',
  email: 'Email',
  phone: 'Telefone',
};

export function FieldTypeIcon({ type, className }: { type: CustomFieldType; className?: string }) {
  const Icon = iconMap[type] || Type;
  return <Icon className={className} />;
}

export function getFieldTypeLabel(type: CustomFieldType) {
  return labelMap[type] || type;
}

export const fieldTypes: CustomFieldType[] = [
  'text', 'number', 'currency', 'date', 'select', 'multi_select', 'checkbox', 'url', 'email', 'phone',
];
