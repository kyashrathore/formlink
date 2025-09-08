"use client";

import type { Meta, StoryObj } from "@storybook/react";
import React, { useMemo, useState } from "react";
import {
  Button,
  Calendar,
  Checkbox,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@formlink/ui";
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@formlink/ui/lib/utils";

const meta: Meta = {
  title: "Form/Classic Gallery",
} as Meta;

export default meta;
type Story = StoryObj;

const choiceOptions = [
  { value: "a", label: "Option A" },
  { value: "b", label: "Option B" },
  { value: "c", label: "Option C" },
];

const likertOptions = [
  "Strongly disagree",
  "Disagree",
  "Neutral",
  "Agree",
  "Strongly agree",
];

export const ClassicGrid: Story = {
  render: () => {
    // Text inputs
    const [text, setText] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [tel, setTel] = useState("");
    const [number, setNumber] = useState<string | number>("");
    const [textarea, setTextarea] = useState("");

    // Choices
    const [single, setSingle] = useState<string>("");
    const [multi, setMulti] = useState<string[]>([]);
    const [likert, setLikert] = useState<string>("");

    // Rating / Linear (simple selects for classic preview)
    const [rating, setRating] = useState<string>("");
    const [linear, setLinear] = useState<string>("");

    // Date
    const [dateOpen, setDateOpen] = useState(false);
    const [dateVal, setDateVal] = useState<Date | undefined>(undefined);

    // File upload
    const [file, setFile] = useState<File | null>(null);

    // Address
    const [address, setAddress] = useState({
      street1: "",
      street2: "",
      city: "",
      stateProvince: "",
      postalCode: "",
      country: "",
    });

    // Country
    const [country, setCountry] = useState<string>("");

    // Ranking (simple dropdowns)
    const [ranking, setRanking] = useState<Record<string, number>>({});
    const rankingOptions = useMemo(() => choiceOptions.map((o) => o.value), []);
    const handleRankChange = (opt: string, rank: number) => {
      setRanking((prev) => {
        // Swap ranks if another option already has this rank
        const existing = Object.entries(prev).find(([, r]) => r === rank)?.[0];
        const next = { ...prev, [opt]: rank };
        if (existing && existing !== opt) {
          next[existing] = prev[opt] || 0;
        }
        return next;
      });
    };

    const onSubmit = () => {
      alert(
        JSON.stringify(
          {
            text,
            email,
            password: password ? "•••••" : "",
            tel,
            number,
            textarea,
            single,
            multi,
            likert,
            rating,
            linear,
            date: dateVal ? format(dateVal, "yyyy-MM-dd") : "",
            file: file?.name || "",
            address,
            country,
            ranking,
          },
          null,
          2,
        ),
      );
    };

    return (
      <div style={{ padding: 24 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 16,
          }}
        >
          <div>
            <Label>Text</Label>
            <Input value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label>Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <Label>Phone</Label>
            <Input
              type="tel"
              value={tel}
              onChange={(e) => setTel(e.target.value)}
            />
          </div>
          <div>
            <Label>Number</Label>
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={number as any}
              onChange={(e) => setNumber(e.target.value)}
            />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <Label>Textarea</Label>
            <Textarea
              className="min-h-[100px]"
              value={textarea}
              onChange={(e) => setTextarea(e.target.value)}
            />
          </div>
          <div>
            <Label>Single Choice</Label>
            <RadioGroup
              value={single}
              onValueChange={setSingle}
              className="mt-2"
            >
              {choiceOptions.map((o) => (
                <div key={o.value} className="flex items-center space-x-2">
                  <RadioGroupItem id={`single-${o.value}`} value={o.value} />
                  <Label htmlFor={`single-${o.value}`}>{o.label}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
          <div>
            <Label>Multiple Choice</Label>
            <div className="mt-2 space-y-2">
              {choiceOptions.map((o) => (
                <div key={o.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`multi-${o.value}`}
                    checked={multi.includes(o.value)}
                    onCheckedChange={(checked) =>
                      setMulti((prev) =>
                        checked
                          ? [...prev, o.value]
                          : prev.filter((v) => v !== o.value),
                      )
                    }
                  />
                  <Label htmlFor={`multi-${o.value}`}>{o.label}</Label>
                </div>
              ))}
            </div>
          </div>
          <div>
            <Label>Rating</Label>
            <Select value={rating} onValueChange={setRating}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select rating" />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Linear Scale</Label>
            <Select value={linear} onValueChange={setLinear}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select value" />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground mt-1 flex justify-between">
              <span>Low</span>
              <span>High</span>
            </div>
          </div>
          <div>
            <Label>Likert</Label>
            <RadioGroup
              value={likert}
              onValueChange={setLikert}
              className="mt-2"
            >
              {likertOptions.map((opt, i) => (
                <div key={i} className="flex items-center space-x-2">
                  <RadioGroupItem id={`likert-${i}`} value={opt} />
                  <Label htmlFor={`likert-${i}`}>{opt}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
          <div>
            <Label>Date</Label>
            <Popover open={dateOpen} onOpenChange={setDateOpen}>
              {/* <PopoverTrigger asChild> */}
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal mt-2",
                  !dateVal && "text-muted-foreground",
                )}
                onClick={() => setDateOpen(!dateOpen)}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateVal ? (
                  format(dateVal, "MM/dd/yyyy")
                ) : (
                  <span>Pick a date</span>
                )}
              </Button>
              {/* </PopoverTrigger> */}
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateVal}
                  onSelect={(d) => setDateVal(d)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label>File Upload</Label>
            <Input
              type="file"
              className="mt-2"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            {file && (
              <div className="text-xs text-muted-foreground mt-1">
                {file.name}
              </div>
            )}
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <Label>Address</Label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <Input
                placeholder="Street 1"
                value={address.street1}
                onChange={(e) =>
                  setAddress({ ...address, street1: e.target.value })
                }
              />
              <Input
                placeholder="Street 2"
                value={address.street2}
                onChange={(e) =>
                  setAddress({ ...address, street2: e.target.value })
                }
              />
              <Input
                placeholder="City"
                value={address.city}
                onChange={(e) =>
                  setAddress({ ...address, city: e.target.value })
                }
              />
              <Input
                placeholder="State/Province"
                value={address.stateProvince}
                onChange={(e) =>
                  setAddress({ ...address, stateProvince: e.target.value })
                }
              />
              <Input
                placeholder="Postal Code"
                value={address.postalCode}
                onChange={(e) =>
                  setAddress({ ...address, postalCode: e.target.value })
                }
              />
              <Input
                placeholder="Country"
                value={address.country}
                onChange={(e) =>
                  setAddress({ ...address, country: e.target.value })
                }
              />
            </div>
          </div>
          <div>
            <Label>Country</Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select a country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="US">United States</SelectItem>
                <SelectItem value="CA">Canada</SelectItem>
                <SelectItem value="GB">United Kingdom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <Label>Ranking</Label>
            <div className="mt-2 space-y-2">
              {choiceOptions.map((o) => (
                <div key={o.value} className="flex items-center gap-3">
                  <div className="w-48">{o.label}</div>
                  <Select
                    value={String(ranking[o.value] || 0)}
                    onValueChange={(v) =>
                      handleRankChange(o.value, parseInt(v))
                    }
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue placeholder="--" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">--</SelectItem>
                      {choiceOptions.map((_, idx) => (
                        <SelectItem key={idx + 1} value={String(idx + 1)}>
                          {idx + 1}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={onSubmit}>Submit Snapshot</Button>
        </div>
      </div>
    );
  },
};
