import { cn } from '@/lib/utils';

type Variant = 'horizontal' | 'vertical' | 'simbolo';

const src = (variant: Variant, color: 'azul' | 'branco') =>
  `/brand/org-connect-${variant}-${color}-transparente.svg`;

/** Logo Org Connect: azul no tema claro, branco no escuro (troca via classe .dark, sem JS). */
export function BrandLogo({ variant = 'horizontal', className }: { variant?: Variant; className?: string }) {
  return (
    <>
      <img src={src(variant, 'azul')} alt="Org Connect" className={cn('block dark:hidden', className)} />
      <img src={src(variant, 'branco')} alt="Org Connect" className={cn('hidden dark:block', className)} />
    </>
  );
}
