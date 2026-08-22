import { Building2, ScrollText } from "lucide-react";
import { Link } from "react-router-dom";

import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompanyProfileTab } from "@/features/settings/CompanyProfileTab";
import { WorkPayTab } from "@/features/settings/WorkPayTab";
import { HolidaysTab } from "@/features/settings/HolidaysTab";

export function SettingsPage() {
  return (
    <div>
      <PageHeader
        title="Settings"
        description="Company-wide configuration for every module."
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link to="/audit">
              <ScrollText className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Audit log
            </Link>
          </Button>
        }
      />
      <Tabs defaultValue="company">
        <TabsList className="flex-wrap">
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="work-pay">Work &amp; Pay</TabsTrigger>
          <TabsTrigger value="holidays">Holidays</TabsTrigger>
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="time-off-types">Time off types</TabsTrigger>
        </TabsList>
        <TabsContent value="company">
          <CompanyProfileTab />
        </TabsContent>
        <TabsContent value="work-pay">
          <WorkPayTab />
        </TabsContent>
        <TabsContent value="holidays">
          <HolidaysTab />
        </TabsContent>
        <TabsContent value="departments">
          <EmptyState
            icon={Building2}
            title="Departments moves here soon"
            description="Department CRUD is owned by the Employees module (M3) and isn't on main yet."
          />
        </TabsContent>
        <TabsContent value="time-off-types">
          <EmptyState
            icon={Building2}
            title="Time off types moves here soon"
            description="Time off type CRUD is owned by the Time Off module (M4) and isn't on main yet."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
