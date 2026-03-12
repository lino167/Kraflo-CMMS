/**
 * Card de problemas frequentes por tag
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tag, Clock } from 'lucide-react';
import { TagStats } from '@/lib/report-types';

interface TagProblemsCardProps {
  tags: TagStats[];
  maxItems?: number;
}

export function TagProblemsCard({ tags, maxItems = 5 }: TagProblemsCardProps) {
  const displayTags = tags.slice(0, maxItems);
  const maxFalhas = Math.max(...displayTags.map(t => t.totalFalhas), 1);

  if (displayTags.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Tag className="h-4 w-4 text-primary" />
          Problemas por Tag
        </CardTitle>
        <CardDescription>
          Tags com mais ocorrências no período
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {displayTags.map((tag) => (
            <div key={tag.tag} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs">
                    {tag.tag}
                  </Badge>
                  <span className="text-muted-foreground">
                    {tag.equipamentos.length} equip.
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium">{tag.totalFalhas} falhas</span>
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {tag.mttrMedio}h
                  </span>
                </div>
              </div>
              <Progress 
                value={(tag.totalFalhas / maxFalhas) * 100} 
                className="h-1.5"
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
