import { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <Card className="glass-panel border-white/5 flex flex-col items-center justify-center p-12 text-center min-h-[300px] animate-fade-in relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-xl" />

      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-6 relative z-10">
        <Icon className="h-8 w-8 text-primary" />
        <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl animate-pulse-neon" />
      </div>

      <h3 className="text-xl font-display font-semibold text-foreground mb-2 relative z-10">
        {title}
      </h3>

      <p className="text-muted-foreground max-w-sm mb-6 relative z-10">
        {description}
      </p>

      {action && <div className="relative z-10">{action}</div>}
    </Card>
  );
}
