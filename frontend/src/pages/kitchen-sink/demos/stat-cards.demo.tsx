import { Users, Clock, Wallet } from "lucide-react";

import { StatCard } from "@/components/StatCard";

export const title = "StatCard";

export default function StatCardsDemo() {
  return (
    <div className="grid gap-4 sm:grid-cols-4">
      <StatCard
        label="Headcount"
        value="128"
        icon={Users}
        delta={{ value: "4.2%", direction: "up" }}
      />
      <StatCard
        label="Avg. work hours"
        value="7.8h"
        icon={Clock}
        delta={{ value: "0.3h", direction: "down", positiveIsGood: false }}
      />
      <StatCard
        label="Payroll cost"
        value="₹18.4L"
        icon={Wallet}
        delta={{ value: "flat", direction: "flat" }}
      />
      <StatCard label="Loading" value="" loading />
    </div>
  );
}
