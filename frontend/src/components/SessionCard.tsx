import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StopCircle, Activity } from "lucide-react";

export function SessionCard({ session, onStop }) {
  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case "running":
        return "text-success";
      case "stopped":
        return "text-muted-foreground";
      case "error":
        return "text-destructive";
      default:
        return "text-accent";
    }
  };

  return (
    <Card className="p-4 bg-gradient-card backdrop-blur-sm border-border/50 hover:border-primary/50 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground capitalize">{session.type}</h3>
            <p className="text-xs text-muted-foreground">{session.sessionId}</p>
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onStop(session.sessionId)}
          className="hover:bg-destructive/10 hover:text-destructive"
        >
          <StopCircle className="w-4 h-4" />
        </Button>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Status</span>
        <span className={`font-medium ${getStatusColor(session.status)}`}>
          {session.status}
        </span>
      </div>
      <div className="flex items-center justify-between text-sm mt-2">
        <span className="text-muted-foreground">Started</span>
        <span className="text-foreground">
          {new Date(session.startedAt).toLocaleTimeString()}
        </span>
      </div>
    </Card>
  );
}
