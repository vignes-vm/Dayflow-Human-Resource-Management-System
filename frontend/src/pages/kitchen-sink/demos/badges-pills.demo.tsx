import { Badge } from "@/components/ui/badge";
import { StatusPill } from "@/components/StatusPill";

export const title = "Badges & Status Pills";

export default function BadgesDemo() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Badge variant="neutral">Neutral</Badge>
        <Badge variant="primary">Primary</Badge>
        <Badge variant="success">Success</Badge>
        <Badge variant="warning">Warning</Badge>
        <Badge variant="danger">Danger</Badge>
      </div>
      <div className="flex flex-wrap gap-2">
        <StatusPill label="Approved" tone="success" />
        <StatusPill label="To approve" tone="neutral" />
        <StatusPill label="Refused" tone="danger" />
        <StatusPill label="Half day" tone="warning" />
        <StatusPill label="Draft" tone="primary" />
      </div>
    </div>
  );
}
