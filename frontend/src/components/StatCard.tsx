import { Card } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface StatCardProps {
  title: ReactNode;
  value: ReactNode;
  icon: LucideIcon;
  trend?: ReactNode;
  trendUp?: boolean;
  description?: ReactNode;
}

export function StatCard({ title, value, icon: Icon, trend, trendUp, description }: StatCardProps) {
  return (
    <Card className="p-6 bg-gradient-card backdrop-blur-sm border-border/50 hover:border-primary/50 transition-all">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground mb-2">{title}</p>
          <h3 className="text-3xl font-bold text-foreground">{value}</h3>
          {description && <p className="text-sm text-muted-foreground mt-2">{description}</p>}
          {trend && (
            <p className={`text-sm mt-2 ${trendUp ? "text-success" : "text-destructive"}`}>
              {trend}
            </p>
          )}
        </div>
        <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow">
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </Card>
  );
}
