import { createRuntime, createMockTransport } from "@formlink/runtime";
import {
  RuntimeProvider,
  ShadCnProvider,
  ClassicTemplate,
} from "@formlink/runtime/ui/react";
import type { Form } from "@formlink/runtime/schema";
import { useMemo } from "react";

const formDefinition: Form = {
  id: "5660054c-05dd-406a-95a5-b74637544976",
  version_id: "draft-v1",
  title: "Start Your Growth Journey",
  description:
    "We help brands thrive. Share your project details and goals below, and let's explore how we can elevate your business together.",
  questions: [
    {
      id: "name",
      questionNo: 1,
      title: "What’s your name?",
      type: { name: "text", format: "text" },
      validations: { required: { value: true } },
      submissionBehavior: "manualAnswer",
      styling: { colSpan: 12 },
    },
    {
      id: "email",
      questionNo: 2,
      title: "What’s the best email to reach you at?",
      type: { name: "text", format: "email" },
      validations: { required: { value: true } },
      submissionBehavior: "manualAnswer",
      styling: { colSpan: 12 },
    },
    {
      id: "website",
      questionNo: 3,
      title: "What’s your company website?",
      type: { name: "text", format: "url" },
      validations: {},
      submissionBehavior: "manualAnswer",
      styling: { colSpan: 12 },
    },
    {
      id: "goal",
      questionNo: 4,
      title: "What’s your primary marketing goal right now?",
      type: { name: "text", format: "text" },
      validations: {},
      submissionBehavior: "manualAnswer",
      styling: { colSpan: 12 },
    },
    {
      id: "services",
      questionNo: 5,
      title: "Which services are you interested in?",
      type: {
        name: "multipleChoice",
        options: [
          { value: "seo", label: "SEO", score: 0 },
          { value: "ppc", label: "PPC", score: 0 },
          { value: "content", label: "Content Marketing", score: 0 },
          { value: "social", label: "Social Media", score: 0 },
          { value: "email", label: "Email Marketing", score: 0 },
        ],
        display: "checkbox",
      },
      validations: {},
      submissionBehavior: "manualAnswer",
      styling: { colSpan: 12 },
    },
    {
      id: "budget",
      questionNo: 6,
      title: "What monthly budget range are you considering?",
      type: {
        name: "singleChoice",
        options: [
          { value: "<1k", label: "Less than $1k", score: 0 },
          { value: "1k-5k", label: "$1k - $5k", score: 0 },
          { value: "5k-10k", label: "$5k - $10k", score: 0 },
          { value: "10k+", label: "$10k+", score: 0 },
        ],
        display: "dropdown",
      },
      validations: {},
      submissionBehavior: "manualAnswer",
      styling: { colSpan: 12 },
    },
    {
      id: "startDate",
      questionNo: 7,
      title: "When would you like to start?",
      type: { name: "date", format: "date" },
      validations: {},
      submissionBehavior: "manualAnswer",
      styling: { colSpan: 12 },
    },
    {
      id: "notes",
      questionNo: 8,
      title: "Anything else we should know to prepare for a first call?",
      type: { name: "text", format: "textarea" },
      validations: {},
      submissionBehavior: "manualAnswer",
      styling: { colSpan: 12 },
    },
  ],
  settings: {
    defaultMode: "classic",
  },
};

// Styled Components
const Button = (props: any) => (
  <button
    className="inline-flex items-center justify-center rounded-full text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 shadow-md hover:shadow-lg h-11 px-8 py-2"
    {...props}
  />
);

const Input = (props: any) => (
  <input
    className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-all shadow-sm"
    {...props}
  />
);

const Textarea = (props: any) => (
  <textarea
    className="flex min-h-[100px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm ring-offset-background placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-all shadow-sm resize-y"
    {...props}
  />
);

const Checkbox = (props: any) => (
  <input
    type="checkbox"
    className="peer h-5 w-5 shrink-0 rounded-md border border-slate-300 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 accent-indigo-600 cursor-pointer"
    {...props}
  />
);

const Label = (props: any) => (
  <label
    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-700"
    {...props}
  />
);

const Badge = (props: any) => (
  <div
    className="inline-flex items-center rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-indigo-700 hover:bg-indigo-100"
    {...props}
  />
);

const Separator = (props: any) => (
  <div className="shrink-0 bg-slate-100 h-[1px] w-full my-4" {...props} />
);

const Card = ({ className, ...props }: any) => (
  <div
    className={`rounded-2xl border border-slate-100 bg-white text-slate-950 shadow-xl shadow-slate-200/50 ${className}`}
    {...props}
  />
);

// Mock complex components required by ShadCnProvider types but not strictly needed for this simple form logic if we stick to basic inputs
const Mock = ({ children }: any) => <>{children}</>;
const MockDiv = ({ children, ...props }: any) => (
  <div {...props}>{children}</div>
);

const components = {
  Button,
  Input,
  Textarea,
  Checkbox, // Adding Checkbox explicitly if supported, or it falls back to input type=checkbox
  Label,
  Badge,
  Separator,

  // Required Mocks/Placeholders for complete map
  ScrollArea: MockDiv,
  PopoverRoot: Mock,
  PopoverTrigger: MockDiv,
  PopoverContent: MockDiv,
  PopoverAnchor: MockDiv,

  CommandRoot: MockDiv,
  CommandList: MockDiv,
  CommandItem: MockDiv,
  CommandGroup: MockDiv,
  CommandEmpty: MockDiv,
  CommandInput: Input,
  CommandSeparator: Separator,

  // Dialogs often used in DatePicker
  DialogRoot: Mock,
  DialogTrigger: MockDiv,
  DialogContent: MockDiv,
  DialogHeader: MockDiv,
  DialogTitle: MockDiv,
  DialogDescription: MockDiv,
  DialogFooter: MockDiv,
  DialogClose: MockDiv,
};

const mockTransportInDraft = createMockTransport();

export default function MarketingAgencyLeadIntake() {
  const runtime = useMemo(
    () =>
      createRuntime({
        form: formDefinition,
        transport: mockTransportInDraft,
        uiMode: "classic",
      }),
    [],
  );

  return (
    <RuntimeProvider runtime={runtime} showDevtools>
      <ShadCnProvider components={components}>
        <div className="min-h-screen bg-slate-50/50 flex flex-col items-center justify-center p-4 md:p-8 font-sans text-slate-900">
          <div className="w-full max-w-2xl">
            <Card className="p-6 md:p-10">
              <div className="mb-8 text-center space-y-2">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                  Start Your Growth Journey
                </h1>
                <p className="text-slate-500 text-lg">
                  We help brands thrive. Let's elevate your business together.
                </p>
              </div>
              <ClassicTemplate />
            </Card>
            <div className="mt-8 text-center text-sm text-slate-400">
              <p>
                &copy; {new Date().getFullYear()} Marketing Agency. All rights
                reserved.
              </p>
            </div>
          </div>
        </div>
      </ShadCnProvider>
    </RuntimeProvider>
  );
}
