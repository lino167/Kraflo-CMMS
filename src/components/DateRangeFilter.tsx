import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { format, subDays, startOfWeek, endOfWeek, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export type DateRange = {
  from: Date;
  to: Date;
};

export type FilterPreset = '3d' | '7d' | '15d' | '30d' | 'week' | 'month' | 'custom';

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

export function DateRangeFilter({ value, onChange, className }: DateRangeFilterProps) {
  const [activePreset, setActivePreset] = useState<FilterPreset>('month');
  const [isFromOpen, setIsFromOpen] = useState(false);
  const [isToOpen, setIsToOpen] = useState(false);

  const applyPreset = (preset: FilterPreset) => {
    const today = new Date();
    let from: Date;
    let to: Date = endOfDay(today);

    switch (preset) {
      case '3d':
        from = startOfDay(subDays(today, 3));
        break;
      case '7d':
        from = startOfDay(subDays(today, 7));
        break;
      case '15d':
        from = startOfDay(subDays(today, 15));
        break;
      case '30d':
        from = startOfDay(subDays(today, 30));
        break;
      case 'week':
        from = startOfDay(startOfWeek(today, { weekStartsOn: 1 }));
        to = endOfDay(endOfWeek(today, { weekStartsOn: 1 }));
        break;
      case 'month':
        from = startOfMonth(today);
        to = endOfMonth(today);
        break;
      default:
        return;
    }

    setActivePreset(preset);
    onChange({ from, to });
  };

  const handleFromChange = (date: Date | undefined) => {
    if (!date) return;

    setActivePreset('custom');
    // Se a data inicial for maior que a final, ajusta a final para hoje
    const newTo = date > value.to ? endOfDay(new Date()) : value.to;
    onChange({ from: startOfDay(date), to: newTo });
    setIsFromOpen(false);
  };

  const handleToChange = (date: Date | undefined) => {
    if (!date) return;

    setActivePreset('custom');
    onChange({ from: value.from, to: endOfDay(date) });
    setIsToOpen(false);
  };

  const clearToDate = () => {
    // Limpa a data final e define como hoje
    setActivePreset('custom');
    onChange({ from: value.from, to: endOfDay(new Date()) });
  };

  const presets = [
    { key: '3d' as FilterPreset, label: '3 dias' },
    { key: '7d' as FilterPreset, label: '7 dias' },
    { key: '15d' as FilterPreset, label: '15 dias' },
    { key: '30d' as FilterPreset, label: '30 dias' },
    { key: 'week' as FilterPreset, label: 'Semana' },
    { key: 'month' as FilterPreset, label: 'Este Mês' },
  ];

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {presets.map((preset) => (
        <Button
          key={preset.key}
          variant={activePreset === preset.key ? 'default' : 'outline'}
          size="sm"
          onClick={() => applyPreset(preset.key)}
          className="h-8"
        >
          {preset.label}
        </Button>
      ))}

      {/* Data Início */}
      <Popover open={isFromOpen} onOpenChange={setIsFromOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={activePreset === 'custom' ? 'default' : 'outline'}
            size="sm"
            className="h-8 min-w-[120px]"
          >
            <CalendarIcon className="h-4 w-4 mr-2" />
            <span className="text-xs text-muted-foreground mr-1">De:</span>
            {format(value.from, 'dd/MM/yy', { locale: ptBR })}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-popover z-50" align="start">
          <Calendar
            mode="single"
            selected={value.from}
            onSelect={handleFromChange}
            locale={ptBR}
            disabled={(date) => date > new Date()}
            initialFocus
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>

      {/* Data Fim */}
      <Popover open={isToOpen} onOpenChange={setIsToOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={activePreset === 'custom' ? 'default' : 'outline'}
            size="sm"
            className="h-8 min-w-[120px]"
          >
            <CalendarIcon className="h-4 w-4 mr-2" />
            <span className="text-xs text-muted-foreground mr-1">Até:</span>
            {format(value.to, 'dd/MM/yy', { locale: ptBR })}
            {activePreset === 'custom' && (
              <X
                className="h-3 w-3 ml-2 hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  clearToDate();
                }}
              />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-popover z-50" align="start">
          <Calendar
            mode="single"
            selected={value.to}
            onSelect={handleToChange}
            locale={ptBR}
            disabled={(date) => date < value.from || date > new Date()}
            initialFocus
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
