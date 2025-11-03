"use client";

import {
  createRuntime,
  createMockTransport as mockTransportInDraft,
} from "@formlink/runtime";
import { FormlinkFlow, type FormlinkFlowRouteSpec } from "@formlink/runtime";
import type { Form } from "@formlink/runtime/schema";
import {
  RuntimeProvider,
  ShadCnProvider,
  TypeformTemplate,
} from "@formlink/runtime/ui/react";
import {
  Badge,
  Button,
  Calendar,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Command as CommandRoot,
  CommandSeparator,
  Input,
  Label,
  PopoverAnchor,
  PopoverContent,
  Popover as PopoverRoot,
  PopoverTrigger,
  ScrollArea,
  Separator,
  Textarea,
} from "@formlink/ui";
import type { Meta, StoryObj } from "@storybook/nextjs";
import { useMemo } from "react";

const meta: Meta = {
  title: "Universal/Typeform Quickstart",
} as Meta;
export default meta;
type Story = StoryObj;

// Complex Travel Recommendation form to showcase FormlinkFlow branching
const form: Form = {
  id: "travel_reco_complex",
  version_id: "v1",
  current_published_version_id: null,
  current_draft_version_id: "v1",
  short_id: "travel-reco",
  title: "Travel Recommendation (Typeform)",
  description: "Answer a few questions and we’ll tailor destinations for you.",
  questions: [
    {
      id: "q_mode",
      questionNo: 1,
      title: "What kind of trip?",
      type: {
        name: "singleChoice",
        display: "radio",
        options: [
          { value: "city", label: "City", score: 0 },
          { value: "beach", label: "Beach", score: 0 },
          { value: "mountains", label: "Mountains", score: 0 },
        ],
      },
      validations: { required: { value: true } },
      submissionBehavior: "manualAnswer",
      styling: { colSpan: 12 },
    },
    {
      id: "q_party",
      questionNo: 2,
      title: "Who’s traveling?",
      type: {
        name: "singleChoice",
        display: "radio",
        options: [
          { value: "solo", label: "Solo", score: 0 },
          { value: "couple", label: "Couple", score: 0 },
          { value: "family", label: "Family", score: 0 },
          { value: "friends", label: "Friends", score: 0 },
        ],
      },
      validations: { required: { value: true } },
      submissionBehavior: "manualAnswer",
      styling: { colSpan: 12 },
    },
    {
      id: "q_budget",
      questionNo: 3,
      title: "Budget per person (USD)",
      type: { name: "text", format: "number" },
      validations: { required: { value: true } },
      submissionBehavior: "manualAnswer",
      styling: { colSpan: 12 },
    },
    {
      id: "q_climate",
      questionNo: 4,
      title: "Preferred climate",
      type: {
        name: "singleChoice",
        display: "radio",
        options: [
          { value: "warm", label: "Warm", score: 0 },
          { value: "cold", label: "Cold", score: 0 },
          { value: "mild", label: "Mild", score: 0 },
        ],
      },
      validations: { required: { value: true } },
      submissionBehavior: "manualAnswer",
      styling: { colSpan: 12 },
    },
    {
      id: "q_season",
      questionNo: 5,
      title: "Season of travel",
      type: {
        name: "singleChoice",
        display: "radio",
        options: [
          { value: "spring", label: "Spring", score: 0 },
          { value: "summer", label: "Summer", score: 0 },
          { value: "autumn", label: "Autumn", score: 0 },
          { value: "winter", label: "Winter", score: 0 },
        ],
      },
      validations: { required: { value: true } },
      submissionBehavior: "manualAnswer",
      styling: { colSpan: 12 },
    },
    {
      id: "q_nightlife",
      questionNo: 6,
      title: "Nightlife important?",
      type: {
        name: "singleChoice",
        display: "radio",
        options: [
          { value: "yes", label: "Yes", score: 0 },
          { value: "no", label: "No", score: 0 },
        ],
      },
      validations: {},
      submissionBehavior: "manualAnswer",
      styling: { colSpan: 12 },
    },
    {
      id: "q_beach_type",
      questionNo: 7,
      title: "Beach activities you like",
      type: {
        name: "multipleChoice",
        display: "checkbox",
        options: [
          { value: "snorkel", label: "Snorkeling", score: 0 },
          { value: "surf", label: "Surfing", score: 0 },
          { value: "relax", label: "Relaxing", score: 0 },
        ],
      },
      validations: {},
      submissionBehavior: "manualAnswer",
      styling: { colSpan: 12 },
    },
    {
      id: "q_mtn_acts",
      questionNo: 8,
      title: "Mountain activities you like",
      type: {
        name: "multipleChoice",
        display: "checkbox",
        options: [
          { value: "ski", label: "Skiing", score: 0 },
          { value: "trek", label: "Trekking", score: 0 },
          { value: "views", label: "Scenic Views", score: 0 },
        ],
      },
      validations: {},
      submissionBehavior: "manualAnswer",
      styling: { colSpan: 12 },
    },
    {
      id: "q_remote",
      questionNo: 9,
      title: "Need remote‑work friendly?",
      type: {
        name: "singleChoice",
        display: "radio",
        options: [
          { value: "yes", label: "Yes", score: 0 },
          { value: "no", label: "No", score: 0 },
        ],
      },
      validations: {},
      submissionBehavior: "manualAnswer",
      styling: { colSpan: 12 },
    },
    {
      id: "q_remote_infra",
      questionNo: 10,
      title: "Remote‑work must‑haves",
      type: {
        name: "multipleChoice",
        display: "checkbox",
        options: [
          { value: "wifi", label: "Fast Wi‑Fi", score: 0 },
          { value: "cafes", label: "Good Cafés", score: 0 },
          { value: "quiet", label: "Quiet housing", score: 0 },
        ],
      },
      validations: {},
      submissionBehavior: "manualAnswer",
      styling: { colSpan: 12 },
    },
    {
      id: "q_family_kids",
      questionNo: 11,
      title: "Kids traveling?",
      type: {
        name: "singleChoice",
        display: "radio",
        options: [
          { value: "yes", label: "Yes", score: 0 },
          { value: "no", label: "No", score: 0 },
        ],
      },
      validations: {},
      submissionBehavior: "manualAnswer",
      styling: { colSpan: 12 },
    },
    {
      id: "q_kids_ages",
      questionNo: 12,
      title: "Kids ages (comma‑separated)",
      type: { name: "text", format: "text" },
      validations: {},
      submissionBehavior: "manualAnswer",
      styling: { colSpan: 12 },
    },
    {
      id: "q_visa",
      questionNo: 13,
      title: "Visa on arrival needed?",
      type: {
        name: "singleChoice",
        display: "radio",
        options: [
          { value: "yes", label: "Yes", score: 0 },
          { value: "no", label: "No", score: 0 },
        ],
      },
      validations: {},
      submissionBehavior: "manualAnswer",
      styling: { colSpan: 12 },
    },
    {
      id: "q_passport_valid",
      questionNo: 14,
      title: "Passport valid 6+ months?",
      type: {
        name: "singleChoice",
        display: "radio",
        options: [
          { value: "yes", label: "Yes", score: 0 },
          { value: "no", label: "No", score: 0 },
        ],
      },
      validations: {},
      submissionBehavior: "manualAnswer",
      styling: { colSpan: 12 },
    },
    {
      id: "q_dates",
      questionNo: 15,
      title: "Approximate start date",
      type: { name: "date", format: "date" },
      validations: {},
      submissionBehavior: "manualAnswer",
      styling: { colSpan: 12 },
    },
    {
      id: "q_length",
      questionNo: 16,
      title: "Trip length (days)",
      type: { name: "text", format: "number" },
      validations: {},
      submissionBehavior: "manualAnswer",
      styling: { colSpan: 12 },
    },
    {
      id: "q_gear",
      questionNo: 17,
      title: "Do you need rental gear?",
      type: {
        name: "singleChoice",
        display: "radio",
        options: [
          { value: "yes", label: "Yes", score: 0 },
          { value: "no", label: "No", score: 0 },
        ],
      },
      validations: {},
      submissionBehavior: "manualAnswer",
      styling: { colSpan: 12 },
    },
    {
      id: "q_quickmatch",
      questionNo: 18,
      title: "Quick match and skip the rest?",
      type: {
        name: "singleChoice",
        display: "radio",
        options: [
          { value: "yes", label: "Yes, pick for me", score: 0 },
          { value: "no", label: "No, I’ll answer all", score: 0 },
        ],
      },
      validations: {},
      submissionBehavior: "manualAnswer",
      styling: { colSpan: 12 },
    },
  ],
  settings: { defaultMode: "typeform", branching: { enabled: true } },
};

const routes: FormlinkFlowRouteSpec = {
  routes: [
    // ANY: quick match ends immediately
    {
      id: "any_quick_end",
      from: "ANY",
      when: { lang: "jsonata", expr: "a.q_quickmatch = 'yes'" },
      to: "END",
      priority: 1000,
      note: "Quick match",
    },
    // From mode: route to specialized branches
    // Defer core-branch routing until after base info (season) is answered
    {
      id: "mode_city_to_nightlife",
      from: "q_season",
      when: { lang: "jsonata", expr: "a.q_mode = 'city'" },
      to: "q_nightlife",
      priority: 10,
    },
    {
      id: "mode_beach_to_beach",
      from: "q_season",
      when: { lang: "jsonata", expr: "a.q_mode = 'beach'" },
      to: "q_beach_type",
      priority: 10,
    },
    {
      id: "mode_mtn_to_mtn",
      from: "q_season",
      when: { lang: "jsonata", expr: "a.q_mode = 'mountains'" },
      to: "q_mtn_acts",
      priority: 10,
    },
    // Family path: if kids present, ask kids ages next
    {
      id: "party_family_kids",
      from: "q_party",
      when: { lang: "jsonata", expr: "a.q_party = 'family'" },
      to: "q_family_kids",
      priority: 5,
    },
    {
      id: "kids_yes_ages",
      from: "q_family_kids",
      when: { lang: "jsonata", expr: "a.q_family_kids = 'yes'" },
      to: "q_kids_ages",
      priority: 5,
    },
    // Remote-work path
    {
      id: "remote_yes_infra",
      from: "q_remote",
      when: { lang: "jsonata", expr: "a.q_remote = 'yes'" },
      to: "q_remote_infra",
      priority: 5,
    },
    // Skip family/kids when not a family traveler (place before fallthrough to kids)
    {
      id: "remote_no_skip_kids",
      from: "q_remote",
      when: {
        lang: "jsonata",
        expr: "a.q_party != 'family' and a.q_remote = 'no'",
      },
      to: "q_visa",
      priority: 4,
    },
    {
      id: "remote_infra_skip_kids",
      from: "q_remote_infra",
      when: { lang: "jsonata", expr: "a.q_party != 'family'" },
      to: "q_visa",
      priority: 4,
    },
    // Mountains + cold implies winter gear and passport
    {
      id: "mtn_cold_to_gear",
      from: "q_mtn_acts",
      when: { lang: "jsonata", expr: "(a.q_climate = 'cold')" },
      to: "q_gear",
      priority: 1,
    },
    // City + nightlife funnels to visa
    {
      id: "nightlife_yes_to_visa",
      from: "q_nightlife",
      when: { lang: "jsonata", expr: "a.q_nightlife = 'yes'" },
      to: "q_visa",
      priority: 1,
    },
    // Ensure visa before passport validity
    {
      id: "visa_to_passport",
      from: "q_visa",
      when: { lang: "jsonata", expr: "1" },
      to: "q_passport_valid",
      priority: 1,
    },
  ],
};

export const Demo: Story = {
  render: () => {
    const engine = useMemo(() => FormlinkFlow.compile(routes, form), []);
    const rt = useMemo(
      () =>
        createRuntime({
          form,
          transport: mockTransportInDraft(),
          uiMode: "typeform",
          flowEngine: engine,
        }),
      [engine],
    );
    return (
      <ShadCnProvider
        components={{
          Button,
          Input,
          Textarea,
          Label,
          Badge,
          ScrollArea,
          Separator,
          PopoverRoot,
          PopoverTrigger,
          PopoverContent,
          PopoverAnchor,
          CommandRoot,
          CommandList,
          CommandItem,
          CommandGroup,
          CommandEmpty,
          CommandInput,
          CommandSeparator,
          Calendar,
        }}
      >
        <RuntimeProvider runtime={rt} showDevtools flowEngine={engine}>
          <TypeformTemplate flowEngine={engine} />
        </RuntimeProvider>
      </ShadCnProvider>
    );
  },
};

export const InputsShowcase: Story = {
  name: "Inputs — Phone, Date, File",
  render: () => {
    const form: Form = {
      id: "typeform_inputs_showcase",
      version_id: "v1",
      current_published_version_id: null,
      current_draft_version_id: "v1",
      short_id: "tf-inputs",
      title: "Input Showcase",
      description: "Phone, Date, File with Typeform layout",
      questions: [
        {
          id: "q_contact",
          questionNo: 1,
          title: "Preferred contact method",
          type: {
            name: "singleChoice",
            display: "radio",
            options: [
              { value: "email", label: "Email", score: 0 },
              { value: "phone", label: "Phone", score: 0 },
            ],
          },
          validations: { required: { value: true } },
          submissionBehavior: "manualAnswer",
          styling: { colSpan: 12 },
        },
        {
          id: "q_email",
          questionNo: 2,
          title: "Email",
          type: { name: "text", format: "email" },
          validations: { required: { value: true } },
          submissionBehavior: "manualAnswer",
          styling: { colSpan: 12 },
        },
        {
          id: "q_phone",
          questionNo: 3,
          title: "Phone number",
          type: { name: "text", format: "tel" },
          validations: { required: { value: true } },
          submissionBehavior: "manualAnswer",
          styling: { colSpan: 12 },
        },
        {
          id: "q_date",
          questionNo: 4,
          title: "Preferred date",
          type: { name: "date", format: "date" },
          validations: {},
          submissionBehavior: "manualAnswer",
          styling: { colSpan: 12 },
        },
        {
          id: "q_file",
          questionNo: 5,
          title: "Attach your resume (PDF)",
          type: { name: "fileUpload" },
          validations: { required: { value: false } },
          submissionBehavior: "manualAnswer",
          styling: { colSpan: 12 },
        },
      ],
      settings: { defaultMode: "typeform", branching: { enabled: false } },
    };

    const rt = useMemo(
      () =>
        createRuntime({
          form,
          transport: mockTransportInDraft(),
          uiMode: "typeform",
        }),
      [],
    );

    return (
      <ShadCnProvider
        components={{
          Button,
          Input,
          Textarea,
          Label,
          Badge,
          ScrollArea,
          Separator,
          PopoverRoot,
          PopoverTrigger,
          PopoverContent,
          PopoverAnchor,
          CommandRoot,
          CommandList,
          CommandItem,
          CommandGroup,
          CommandEmpty,
          CommandInput,
          CommandSeparator,
          Calendar,
        }}
      >
        <RuntimeProvider runtime={rt} showDevtools>
          <TypeformTemplate />
        </RuntimeProvider>
      </ShadCnProvider>
    );
  },
};

export const AllControls: Story = {
  name: "All Controls Showcase",
  render: () => {
    const form: Form = {
      id: "typeform_all_controls",
      version_id: "v1",
      current_published_version_id: null,
      current_draft_version_id: "v1",
      short_id: "tf-all-controls",
      title: "All Controls",
      description:
        "Single/Multi, Rating, Linear, Likert, Ranking, Phone, Country, Textarea, Date.",
      questions: [
        {
          id: "q_single",
          questionNo: 1,
          title: "Single choice (inline)",
          type: {
            name: "singleChoice",
            display: "radio",
            options: [
              { value: "a", label: "Alpha", score: 0 },
              { value: "b", label: "Beta", score: 0 },
              { value: "c", label: "Gamma", score: 0 },
            ],
          },
          validations: { required: { value: true } },
          submissionBehavior: "manualAnswer",
          styling: { colSpan: 12 },
        },
        {
          id: "q_multi",
          questionNo: 2,
          title: "Multi select (inline)",
          type: {
            name: "multipleChoice",
            display: "checkbox",
            options: [
              { value: "1", label: "One", score: 0 },
              { value: "2", label: "Two", score: 0 },
              { value: "3", label: "Three", score: 0 },
            ],
          },
          validations: {},
          submissionBehavior: "manualAnswer",
          styling: { colSpan: 12 },
        },
        {
          id: "q_rating",
          questionNo: 3,
          title: "Rating (1–5)",
          type: {
            name: "rating",
            config: {
              min: 1,
              max: 5,
              step: 1,
              minLabel: "Low",
              maxLabel: "High",
            },
          },
          validations: {},
          submissionBehavior: "manualAnswer",
          styling: { colSpan: 12 },
        },
        {
          id: "q_linear",
          questionNo: 4,
          title: "Satisfaction (Linear scale)",
          type: {
            name: "linearScale",
            config: {
              start: 1,
              end: 7,
              step: 1,
              startLabel: "Low",
              endLabel: "High",
            },
          },
          validations: {},
          submissionBehavior: "manualAnswer",
          styling: { colSpan: 12 },
        },
        {
          id: "q_likert",
          questionNo: 5,
          title: "Agreement (Likert)",
          type: {
            name: "likertScale",
            options: [
              "Strongly disagree",
              "Disagree",
              "Neutral",
              "Agree",
              "Strongly agree",
            ],
          },
          validations: {},
          submissionBehavior: "manualAnswer",
          styling: { colSpan: 12 },
        },
        {
          id: "q_ranking",
          questionNo: 6,
          title: "Rank your preferences",
          type: {
            name: "ranking",
            options: [
              { value: "p1", label: "Price", score: 0 },
              { value: "p2", label: "Location", score: 0 },
              { value: "p3", label: "Amenities", score: 0 },
            ],
          },
          validations: {},
          submissionBehavior: "manualAnswer",
          styling: { colSpan: 12 },
        },
        {
          id: "q_phone",
          questionNo: 7,
          title: "Phone number",
          type: { name: "text", format: "tel" },
          validations: {},
          submissionBehavior: "manualAnswer",
          styling: { colSpan: 12 },
        },
        {
          id: "q_country",
          questionNo: 8,
          title: "Country",
          type: { name: "text", format: "country" },
          validations: {},
          submissionBehavior: "manualAnswer",
          styling: { colSpan: 12 },
        },
        {
          id: "q_textarea",
          questionNo: 9,
          title: "Tell us more (textarea)",
          type: { name: "text", format: "textarea" },
          validations: {},
          submissionBehavior: "manualAnswer",
          styling: { colSpan: 12 },
        },
        {
          id: "q_date",
          questionNo: 10,
          title: "Preferred date",
          type: { name: "date", format: "date" },
          validations: {},
          submissionBehavior: "manualAnswer",
          styling: { colSpan: 12 },
        },
        {
          id: "q_address",
          questionNo: 11,
          title: "Your address",
          type: { name: "address" },
          validations: {},
          submissionBehavior: "manualAnswer",
          styling: { colSpan: 12 },
        },
        {
          id: "q_signature",
          questionNo: 12,
          title: "Draw your signature",
          type: { name: "signature" },
          validations: {},
          submissionBehavior: "manualAnswer",
          styling: { colSpan: 12 },
        },
        {
          id: "q_file",
          questionNo: 13,
          title: "Upload a file",
          type: { name: "fileUpload" },
          validations: {},
          submissionBehavior: "manualAnswer",
          styling: { colSpan: 12 },
        },
      ],
      settings: { defaultMode: "typeform", branching: { enabled: false } },
    };

    const rt = useMemo(
      () =>
        createRuntime({
          form,
          transport: mockTransportInDraft(),
          uiMode: "typeform",
        }),
      [],
    );

    return (
      <ShadCnProvider
        components={{
          Button,
          Input,
          Textarea,
          Label,
          Badge,
          ScrollArea,
          Separator,
          PopoverRoot,
          PopoverTrigger,
          PopoverContent,
          PopoverAnchor,
          CommandRoot,
          CommandList,
          CommandItem,
          CommandGroup,
          CommandEmpty,
          CommandInput,
          CommandSeparator,
          Calendar,
        }}
      >
        <RuntimeProvider runtime={rt} showDevtools>
          <TypeformTemplate />
        </RuntimeProvider>
      </ShadCnProvider>
    );
  },
};

export const SelectionModes: Story = {
  name: "Selections — Inline vs Dropdown",
  render: () => {
    const form: Form = {
      id: "typeform_selects_showcase",
      version_id: "v1",
      current_published_version_id: null,
      current_draft_version_id: "v1",
      short_id: "tf-selects",
      title: "Selection Showcase",
      description: "Inline (≤5) vs Dropdown (>5) rendering",
      questions: [
        {
          id: "q_small_single",
          questionNo: 1,
          title: "Pick one (≤5 options → Inline)",
          type: {
            name: "singleChoice",
            display: "radio",
            options: [
              { value: "a", label: "Alpha", score: 0 },
              { value: "b", label: "Beta", score: 0 },
              { value: "c", label: "Gamma", score: 0 },
            ],
          },
          validations: { required: { value: true } },
          submissionBehavior: "manualAnswer",
          styling: { colSpan: 12 },
        },
        {
          id: "q_large_single",
          questionNo: 2,
          title: "Pick one (>5 options → Dropdown)",
          type: {
            name: "singleChoice",
            display: "radio",
            options: [
              { value: "a", label: "Alpha", score: 0 },
              { value: "b", label: "Beta", score: 0 },
              { value: "c", label: "Gamma", score: 0 },
              { value: "d", label: "Delta", score: 0 },
              { value: "e", label: "Epsilon", score: 0 },
              { value: "f", label: "Zeta", score: 0 },
            ],
          },
          validations: {},
          submissionBehavior: "manualAnswer",
          styling: { colSpan: 12 },
        },
        {
          id: "q_small_multi",
          questionNo: 3,
          title: "Pick many (≤5 options → Inline)",
          type: {
            name: "multipleChoice",
            display: "checkbox",
            options: [
              { value: "1", label: "One", score: 0 },
              { value: "2", label: "Two", score: 0 },
              { value: "3", label: "Three", score: 0 },
            ],
          },
          validations: { required: { value: true } },
          submissionBehavior: "manualAnswer",
          styling: { colSpan: 12 },
        },
        {
          id: "q_large_multi",
          questionNo: 4,
          title: "Pick many (>5 options → Dropdown)",
          type: {
            name: "multipleChoice",
            display: "checkbox",
            options: [
              { value: "1", label: "One", score: 0 },
              { value: "2", label: "Two", score: 0 },
              { value: "3", label: "Three", score: 0 },
              { value: "4", label: "Four", score: 0 },
              { value: "5", label: "Five", score: 0 },
              { value: "6", label: "Six", score: 0 },
            ],
          },
          validations: {},
          submissionBehavior: "manualAnswer",
          styling: { colSpan: 12 },
        },
      ],
      settings: { defaultMode: "typeform", branching: { enabled: false } },
    };

    const rt = useMemo(
      () =>
        createRuntime({
          form,
          transport: mockTransportInDraft(),
          uiMode: "typeform",
        }),
      [],
    );

    return (
      <ShadCnProvider
        components={{
          Button,
          Input,
          Textarea,
          Label,
          Badge,
          ScrollArea,
          Separator,
          PopoverRoot,
          PopoverTrigger,
          PopoverContent,
          PopoverAnchor,
          CommandRoot,
          CommandList,
          CommandItem,
          CommandGroup,
          CommandEmpty,
          CommandInput,
          CommandSeparator,
          Calendar,
        }}
      >
        <RuntimeProvider runtime={rt} showDevtools>
          <TypeformTemplate />
        </RuntimeProvider>
      </ShadCnProvider>
    );
  },
};
