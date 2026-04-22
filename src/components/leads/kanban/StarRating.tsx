import { useState } from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  value: number;
  onChange: (n: number) => void;
  size?: 'sm' | 'md';
}

export function StarRating({ value, onChange, size = 'sm' }: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState(0);
  const sizeClass = size === 'md' ? 'h-4 w-4' : 'h-3 w-3';
  const display = hoverValue || value;

  const stop = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  return (
    <div className="flex items-center gap-0.5" onMouseLeave={() => setHoverValue(0)}>
      {Array.from({ length: 5 }).map((_, i) => {
        const starValue = i + 1;
        const filled = starValue <= display;
        return (
          <button
            key={i}
            type="button"
            onPointerDown={stop}
            onMouseDown={stop}
            onMouseEnter={() => setHoverValue(starValue)}
            onClick={(e) => {
              e.stopPropagation();
              onChange(value === starValue ? 0 : starValue);
            }}
            className="p-0 leading-none transition-transform hover:scale-110"
            aria-label={`Qualificar com ${starValue} estrela${starValue > 1 ? 's' : ''}`}
          >
            <Star
              className={`${sizeClass} ${filled ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`}
            />
          </button>
        );
      })}
    </div>
  );
}
