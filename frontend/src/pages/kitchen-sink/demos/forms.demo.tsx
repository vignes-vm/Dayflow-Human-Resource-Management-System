import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MoneyInput } from "@/components/MoneyInput";
import { PercentInput } from "@/components/PercentInput";

export const title = "Form controls";

export default function FormsDemo() {
  const [money, setMoney] = useState("50000.00");
  const [pct, setPct] = useState("8.33");

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="ks-input">Input</Label>
        <Input id="ks-input" placeholder="Placeholder" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ks-input-invalid">Input (invalid)</Label>
        <Input id="ks-input-invalid" invalid defaultValue="bad value" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ks-textarea">Textarea</Label>
        <Textarea id="ks-textarea" placeholder="Notes…" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ks-select">Select</Label>
        <Select>
          <SelectTrigger id="ks-select">
            <SelectValue placeholder="Choose one" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="a">Option A</SelectItem>
            <SelectItem value="b">Option B</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ks-money">MoneyInput</Label>
        <MoneyInput id="ks-money" value={money} onValueChange={setMoney} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ks-percent">PercentInput</Label>
        <PercentInput id="ks-percent" value={pct} onValueChange={setPct} />
      </div>
      <div className="flex items-center gap-2">
        <Switch id="ks-switch" />
        <Label htmlFor="ks-switch">Switch</Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="ks-checkbox" />
        <Label htmlFor="ks-checkbox">Checkbox</Label>
      </div>
      <RadioGroup defaultValue="one" className="sm:col-span-2">
        <div className="flex items-center gap-2">
          <RadioGroupItem value="one" id="ks-radio-1" />
          <Label htmlFor="ks-radio-1">Option one</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="two" id="ks-radio-2" />
          <Label htmlFor="ks-radio-2">Option two</Label>
        </div>
      </RadioGroup>
    </div>
  );
}
