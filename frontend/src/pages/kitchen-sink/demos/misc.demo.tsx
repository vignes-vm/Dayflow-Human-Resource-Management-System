import { useState } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export const title = "Avatar, Card, Calendar, Tabs, Dropdown";

export default function MiscDemo() {
  const [date, setDate] = useState<Date | undefined>(new Date());

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="flex items-center gap-3">
        <Avatar>
          <AvatarFallback>MK</AvatarFallback>
        </Avatar>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary">Dropdown</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Item one</DropdownMenuItem>
            <DropdownMenuItem>Item two</DropdownMenuItem>
            <DropdownMenuItem danger>Danger item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Card title</CardTitle>
        </CardHeader>
        <CardContent>Card content goes here.</CardContent>
      </Card>

      <Calendar
        mode="single"
        selected={date}
        onSelect={setDate}
        className="rounded-card border-border border"
      />

      <Tabs defaultValue="one">
        <TabsList>
          <TabsTrigger value="one">Tab one</TabsTrigger>
          <TabsTrigger value="two">Tab two</TabsTrigger>
        </TabsList>
        <TabsContent value="one">Content one</TabsContent>
        <TabsContent value="two">Content two</TabsContent>
      </Tabs>
    </div>
  );
}
