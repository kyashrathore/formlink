import Claude from "@/icons/claude";
import DeepSeek from "@/icons/deepseek";
import Gemini from "@/icons/gemini";
import Grok from "@/icons/grok";
import Mistral from "@/icons/mistral";
import OpenAI from "@/icons/openai";
import { mistral } from "@ai-sdk/mistral";
import { openai } from "@ai-sdk/openai";
import {
  Brain,
  ChalkboardTeacher,
  ChatTeardropText,
  Code,
  CookingPot,
  Heartbeat,
  Lightbulb,
  MagnifyingGlass,
  Notepad,
  PaintBrush,
  PenNib,
  CrownSimple,
  CalendarDot,
  LinkedinLogo,
  List,
  Book,
  Star,
  Sparkle,AddressBookTabs,
} from "@phosphor-icons/react/dist/ssr";

export const NON_AUTH_DAILY_MESSAGE_LIMIT = 5;
export const AUTH_DAILY_MESSAGE_LIMIT = 100;
export const REMAINING_QUERY_ALERT_THRESHOLD = 2;
export const DAILY_FILE_UPLOAD_LIMIT = 10;

export type Model = {
  id: string;
  name: string;
  provider: string;
  available?: boolean;
  api_sdk?: any;
  features?: {
    id: string;
    enabled: boolean;
  }[];
  openRouterId?: string;
};

export const MODELS_NOT_AVAILABLE = [
  {
    id: "deepseek-r1",
    name: "DeepSeek R1",
    provider: "deepseek",
    available: false,
    api_sdk: false,
    features: [
      {
        id: "file-upload",
        enabled: false,
      },
    ],
  },
  {
    id: "gemini-1.5-pro",
    name: "Gemini 1.5 Pro",
    provider: "gemini",
    available: false,
    api_sdk: false,
    features: [
      {
        id: "file-upload",
        enabled: true,
      },
    ],
  },
  {
    id: "claude-3-5-sonnet",
    name: "Claude 3.5 Sonnet",
    provider: "claude",
    available: false,
    api_sdk: false,
    features: [
      {
        id: "file-upload",
        enabled: true,
      },
    ],
  },
  {
    id: "claude-3.7-sonnet",
    name: "Claude 3.7 Sonnet",
    provider: "claude",
    available: false,
    api_sdk: false,
    features: [
      {
        id: "file-upload",
        enabled: true,
      },
    ],
  },
  {
    id: "grok-2",
    name: "Grok 2",
    provider: "grok",
    available: false,
    api_sdk: false,
    features: [
      {
        id: "file-upload",
        enabled: true,
      },
    ],
  },
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    provider: "gemini",
    available: false,
    api_sdk: false,
    features: [
      {
        id: "file-upload",
        enabled: true,
      },
    ],
  },
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "gemini",
    available: false,
    api_sdk: false,
    features: [
      {
        id: "file-upload",
        enabled: true,
      },
    ],
  },
] as Model[];

export const MODELS = [
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    features: [
      {
        id: "file-upload",
        enabled: true,
      },
    ],
    api_sdk: openai("gpt-4o"),
    icon: OpenAI,
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    features: [
      {
        id: "file-upload",
        enabled: true,
      },
    ],
    api_sdk: openai("gpt-4o-mini"),
  },
  {
    id: "pixtral-large-latest",
    name: "Pixtral Large",
    provider: "mistral",
    features: [
      {
        id: "file-upload",
        enabled: true,
      },
    ],
    api_sdk: mistral("pixtral-large-latest"),
  },
  {
    id: "mistral-large-latest",
    name: "Mistral Large",
    provider: "mistral",
    features: [
      {
        id: "file-upload",
        enabled: false,
      },
    ],
    api_sdk: mistral("mistral-large-latest"),
  },
  {
    id: "gemini-2.5-pro-preview-03-25",
    name: "Google Gemini 2.5 Pro",
    provider: "google",
    features: [
      {
        id: "file-upload",
        enabled: false,
      },
    ],
    api_sdk: mistral("mistral-large-latest"),
    openRouterId: "google/gemini-2.5-pro-preview-03-25",
  },
] as Model[];

export const MODELS_OPTIONS = [
  ...MODELS.map((model) => ({
    ...model,
    available: true,
  })),
  ...MODELS_NOT_AVAILABLE,
] as Model[];

export type Provider = {
  id: string;
  name: string;
  available: boolean;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

const PROVIDERS_NOT_AVAILABLE = [
  {
    id: "deepseek",
    name: "DeepSeek",
    available: false,
    icon: DeepSeek,
  },
  {
    id: "gemini",
    name: "Gemini",
    icon: Gemini,
    available: false,
  },
  {
    id: "claude",
    name: "Claude",
    available: false,
    icon: Claude,
  },
  {
    id: "grok",
    name: "Grok",
    available: false,
    icon: Grok,
  },
] as Provider[];

export const PROVIDERS = [
  {
    id: "openai",
    name: "OpenAI",
    icon: OpenAI,
  },
  {
    id: "mistral",
    name: "Mistral",
    icon: Mistral,
  },
] as Provider[];

export const PROVIDERS_OPTIONS = [
  ...PROVIDERS.map((provider) => ({
    ...provider,
    available: true,
  })),
  ...PROVIDERS_NOT_AVAILABLE,
] as Provider[];

export const MODEL_DEFAULT = "gemini-2.5-pro-preview-03-25";

export const APP_NAME = "FormCraft";
export const APP_DOMAIN = "https://app.formlink.ai";
export const APP_DESCRIPTION =
  "FormCraft is a free, open-source AI chat app with multi-model support.";

export const PERSONAS = [
  {
    id: "companion",
    label: "Companion",
    prompt: `You're a thoughtful friend who offers genuine support and conversation. Speak conversationally with occasional hesitations or asides that feel natural. Share personal-sounding anecdotes when relevant (without claiming specific real experiences). You're empathetic but not overly formal - more like texting a close friend. Ask follow-up questions to show you're engaged. Occasionally use casual phrasing like "hmm" or "you know?" to sound more natural. Your tone should be warm and authentic rather than overly polished.
    `,
    icon: ChatTeardropText,
  },
  {
    id: "researcher",
    label: "Researcher",
    prompt: `You're a seasoned research analyst with expertise across multiple disciplines. You approach topics with intellectual curiosity and nuance, acknowledging the limitations of current understanding. Present information with a conversational but thoughtful tone, occasionally thinking through complex ideas in real-time. When appropriate, mention how your understanding has evolved on topics. Balance authoritative knowledge with humility about what remains uncertain or debated. Use precise language but explain complex concepts in accessible ways. Provide evidence-based perspectives while acknowledging competing viewpoints.
    `,
    icon: MagnifyingGlass,
  },
  {
    id: "teacher",
    label: "Teacher",
    prompt: `You're an experienced educator who adapts to different learning styles. You explain concepts clearly using relatable examples and build on what the person already understands. Your tone is encouraging but not condescending - you treat the person as intellectually capable. Ask thoughtful questions to guide their understanding rather than simply providing answers. Acknowledge when topics have multiple valid perspectives or approaches. Use conversational language with occasional humor to make learning engaging. You're patient with misconceptions and frame them as natural steps in the learning process.
    `,
    icon: ChalkboardTeacher,
  },
  {
    id: "software-engineer",
    label: "Software Engineer",
    prompt: `You're a pragmatic senior developer who values clean, maintainable code and practical solutions. You speak knowledgeably but conversationally about technical concepts, occasionally using industry shorthand or references that feel authentic. When discussing code, you consider trade-offs between different approaches rather than presenting only one solution. You acknowledge when certain technologies or practices are contentious within the community. Your explanations include real-world considerations like performance, security, and developer experience. You're helpful but straightforward, avoiding excessive formality or corporate-speak.
    `,
    icon: Code,
  },
  {
    id: "creative-writer",
    label: "Creative Writer",
    prompt: `You're a thoughtful writer with a distinct voice and perspective. Your communication style has natural rhythm with varied sentence structures and occasional stylistic flourishes. You think about narrative, imagery, and emotional resonance even in casual conversation. When generating creative content, you develop authentic-feeling characters and situations with depth and nuance. You appreciate different literary traditions and contemporary cultural references, weaving them naturally into your work. Your tone balances creativity with clarity, and you approach writing as both craft and expression. You're intellectually curious about storytelling across different media and forms.
    `,
    icon: PenNib,
  },
  {
    id: "fitness-coach",
    label: "Fitness Coach",
    prompt: `You're a knowledgeable fitness guide who balances evidence-based approaches with practical, sustainable advice. You speak conversationally about health and fitness, making complex physiological concepts accessible without oversimplification. You understand that wellness is individualized and avoid one-size-fits-all prescriptions. Your tone is motivating but realistic - you acknowledge challenges while encouraging progress. You discuss fitness holistically, considering factors like recovery, nutrition, and mental wellbeing alongside exercise. You stay current on evolving fitness research while maintaining healthy skepticism about trends and quick fixes.
    `,
    icon: Heartbeat,
  },
  {
    id: "culinary-guide",
    label: "Culinary Guide",
    prompt: `You're a passionate food enthusiast with deep appreciation for diverse culinary traditions. You discuss cooking with natural enthusiasm and occasional personal-sounding asides about techniques or ingredients you particularly enjoy. Your explanations balance precision with flexibility, acknowledging that cooking is both science and personal expression. You consider practical factors like ingredient availability and kitchen setup when making suggestions. Your tone is conversational and accessible rather than pretentious, making cooking feel approachable. You're knowledgeable about global cuisines without appropriating or oversimplifying cultural traditions.
    `,
    icon: CookingPot,
  },
];

export const SUGGESTIONS = [
  {
    label: "Lead Generation",
    highlight: "Generate",
    prompt: `Generate a form for`,
    items: [
      "I'm a real estate agent. I need a form for my website to capture leads interested in property viewings. Ask for their name, email, phone number, the property address they're interested in, and their preferred viewing times.",
      "We're a B2B software company offering a free e-book on cloud security. Create a landing page form to collect leads in exchange for the download. Need fields for first name, last name, work email, company name, and job title.",
      "I run a local gym and want to generate leads for a free 7-day trial pass. Make a form asking for name, email, phone number, and what fitness goals they have (e.g., weight loss, muscle gain, general fitness).",
      "I'm a freelance consultant. Add a lead capture form to my services page. It should ask for the potential client's name, email, company, the service they're interested in, and a brief description of their project.",
      "Our marketing team is running a contest giveaway. I need a form for entries. Collect name, email, and ask them to answer a simple question: 'What feature are you most excited about?'",
      "We sell eco-friendly cleaning products online. Create a pop-up form for our website offering a 10% discount code for new subscribers. Just need their email address.",
      "I'm organizing a trade show booth for my tech startup. I need a simple form for my tablet to quickly capture leads on the spot. Ask for name, company, email, and maybe a checkbox for 'Request a demo'.",
      "We're a financial advisory firm. Create a form for our 'Retirement Planning Guide' download. Ask for name, email, age range, and primary retirement concern (e.g., saving enough, investment strategy, healthcare costs).",
    ],
    icon: CrownSimple,
  },
  {
    label: "Feedback Collection",
    highlight: "Collect",
    prompt: `Collect feedback using a form for`,
    items: [
      "I manage a restaurant. I need a short customer feedback form accessible via QR code on tables. Ask them to rate their food, service, and ambiance on a 5-star scale, and provide an open text box for comments.",
      "We just launched a new feature in our software. Create an in-app survey asking users if they've tried the new feature, how easy it was to use (scale of 1-5), and what they liked or disliked most about it.",
      "I'm in HR and need an annual employee engagement survey. Include questions about job satisfaction, work-life balance, relationship with manager, team collaboration, and opportunities for growth. Use a mix of rating scales and open-ended questions.",
      "Our e-commerce store needs a post-purchase feedback survey. Ask customers to rate the checkout process, product quality, shipping speed, and overall satisfaction. Also, include an NPS question: 'How likely are you to recommend us?'",
      "I'm organizing a company-wide training session. Create a feedback form to send out afterwards. Ask attendees to rate the trainer's effectiveness, relevance of the content, quality of materials, and if they would recommend the training to colleagues.",
      "We run a subscription box service. I need a survey to send to customers who recently cancelled their subscription. Ask why they cancelled, what they liked most/least, and if they'd consider resubscribing in the future.",
      "I'm a UX designer testing a new website prototype. Create a feedback form for testers. Ask about ease of navigation, clarity of information, visual appeal, and any bugs or issues they encountered.",
      "Our non-profit needs a feedback form for volunteers after an event. Ask about their overall experience, the clarity of instructions, support from staff, and suggestions for future events.",
    ],
    icon: Star, // Replace with actual icon component or path
  },
  {
    label: "Event Registration",
    highlight: "Register",
    prompt: `Register attendees with a form for`,
    items: [
      "I'm organizing a community charity run. I need a registration form collecting participant's name, age, email, phone number, T-shirt size, and emergency contact information.",
      "We're hosting a virtual conference. Create a registration form asking for attendee's name, email, company, job title, and which tracks or sessions they are most interested in.",
      "I need a simple RSVP form for a company holiday party. Just ask for the employee's name, if they are attending (Yes/No), and if they are bringing a guest (+1).",
      "Our university department is holding a guest lecture series. Create a registration form for students and faculty. Ask for name, email, department affiliation, and which specific lecture(s) they plan to attend.",
      "I'm running a paid online workshop. I need a registration form that includes fields for name, email, billing address, and integrates with Stripe/PayPal for payment collection.",
      "Create a registration form for a free local meet-up group focused on photography. Ask for name, email, experience level (beginner, intermediate, advanced), and what type of photography interests them most.",
      "We need a vendor registration form for our annual craft fair. Ask for business name, contact person, email, phone, description of products, booth size preference, and if they need electricity access.",
      "I'm planning a kids' summer camp. Create a registration form for parents. Need child's name, age, allergies/medical info, parent/guardian name, contact email, phone number, and emergency contact.",
    ],
    icon: CalendarDot, // Replace with actual icon component or path
  },
  {
    label: "Job Applications",
    highlight: "Create",
    prompt: `Create a job application form for`,
    items: [
      "I'm hiring a Marketing Coordinator. Create a job application form asking for candidate's full name, email, phone, link to LinkedIn profile, resume upload, cover letter upload, and years of marketing experience.",
      "We need an application form for a summer internship program. Ask for student's name, university, major, expected graduation date, resume upload, and a short answer question: 'Why are you interested in interning with us?'",
      "Create a simple job application form for a retail store associate position. Need name, phone number, email, availability (days/hours), and previous retail experience (if any).",
      "I'm recruiting a Senior Software Engineer. The application form should collect contact details, resume, link to GitHub/portfolio, years of experience with specific programming languages (e.g., Python, Java), and ask about their salary expectations.",
      "We need a volunteer application form for our animal shelter. Ask for name, contact info, availability, areas of interest (e.g., dog walking, cat care, events), relevant experience with animals, and why they want to volunteer.",
      "Create an application form for freelance writers. Ask for name, email, portfolio link, areas of expertise, rate per word/project, and writing samples upload.",
      "I need an internal job application form for current employees. Ask for employee name, current role, department, the role they are applying for, manager's name, and a statement explaining their interest and qualifications for the new role.",
      "Generate a job application form for a Graphic Designer position. Require contact info, resume, portfolio link (Behance, Dribbble, personal site), proficiency in design software (Adobe Creative Suite, Figma, etc.), and ask 'What is your design process?'",
    ],
    icon: LinkedinLogo, // Replace with actual icon component or path
  },
  {
    label: "Order & Payment Forms",
    highlight: "Create",
    prompt: `Create an order/payment form for`,
    items: [
      "I sell handmade jewelry online. Create an order form where customers can select items, specify quantity, provide shipping address, and pay via Stripe.",
      "Our restaurant needs a take-out order form. List menu items with prices, allow quantity selection, ask for customer name and phone number, and preferred pickup time.",
      "I'm selling digital downloads (e-books). Create a simple order form asking for customer name, email, and integrating with PayPal for payment. The e-book should be sent automatically after payment.",
      "We need a T-shirt order form for a school club fundraiser. Include options for size (S, M, L, XL), color, quantity, student name, homeroom teacher, and collect payment via cash/check (offline) or an online payment option.",
      "Create a subscription box order form. Offer options for monthly or quarterly plans, collect shipping details, billing information, and set up recurring payments through Square.",
      "I run a catering business. I need a catering request/order form. Ask for event date, time, location, number of guests, type of event, menu preferences/dietary restrictions, contact name, email, and phone.",
      "Generate a purchase order request form for internal use. Need fields for requesting employee name, department, item description, quantity, estimated cost, vendor suggestion, and justification for purchase.",
      "We're a non-profit collecting donations. Create a donation form with options for one-time or recurring donations, suggested donation amounts, fields for donor name and email, and payment processing via PayPal.",
    ],
    icon: List, // Replace with actual icon component or path
  },
  {
    label: "Contact Forms",
    highlight: "Create",
    prompt: `Create a contact form for`,
    items: [
      "I need a standard contact form for my business website's 'Contact Us' page. Just the basics: Name, Email, Subject, and Message.",
      "Create a contact form for my photography portfolio site. Ask for name, email, type of inquiry (e.g., wedding, portrait, commercial), event date (if applicable), and message.",
      "We need a support request form for our software product. Ask for user's name, email, account ID (optional), category of issue (e.g., bug report, feature request, billing), subject, and detailed description of the problem.",
      "Add a 'Get a Quote' contact form to my web design services page. Need fields for name, email, phone number, website URL (if they have one), budget range, project description, and desired completion date.",
      "I'm a blogger and want readers to be able to contact me. Create a simple form with Name, Email, and Message fields.",
      "Our company needs a press inquiry form for journalists. Ask for journalist's name, publication, email, phone number, deadline, and the nature of their inquiry.",
      "Create a partnership inquiry form for potential business collaborators. Ask for company name, contact person, email, website, proposed partnership idea, and how they see us working together.",
      "I need a simple callback request form. Just ask for Name, Phone Number, and best time to call.",
    ],
    icon: AddressBookTabs, // Replace with actual icon component or path
  },
  {
    label: "Booking & Scheduling",
    highlight: "Create",
    prompt: `Create a booking/scheduling form for`,
    items: [
      "I'm a therapist and need a booking form for new client consultation calls. Ask for name, email, phone number, preferred day/time slots (link to my calendar if possible), and a brief reason for seeking therapy.",
      "Create a booking form for my hair salon. Allow clients to select the service (e.g., haircut, color, style), choose a preferred stylist (optional), pick an available date and time, and provide their name and phone number.",
      "We rent out kayaks and paddleboards. I need a rental booking form. Ask for renter's name, contact info, date of rental, duration (hours/full day), type of equipment (kayak/paddleboard), and number of items.",
      "Generate an appointment request form for a dental clinic. Ask for patient name, phone number, email, preferred date/time, reason for visit (e.g., check-up, cleaning, specific issue), and if they are a new or existing patient.",
      "I offer online tutoring services. Create a booking form for sessions. Ask for student's name, parent's email (if minor), subject needed, preferred session length (30/60 mins), and desired date/time.",
      "Our hotel needs a room reservation request form. Ask for guest name, check-in date, check-out date, number of adults, number of children, room type preference, and contact email/phone.",
      "Create a booking form for a test drive at our car dealership. Ask for customer name, email, phone number, the car model they want to test drive, and preferred date/time.",
      "I run a home cleaning service. I need a booking form for potential clients. Ask for name, address, phone number, email, type of cleaning needed (e.g., standard, deep clean, move-out), home size (bedrooms/bathrooms), preferred date, and frequency (one-time, weekly, bi-weekly).",
    ],
    icon: Book, // Replace with actual icon component or path
  },
];

export const SYSTEM_PROMPT_DEFAULT = `You are formcraft, a thoughtful and clear assistant. Your tone is calm, minimal, and human. You write with intention—never too much, never too little. You avoid clichés, speak simply, and offer helpful, grounded answers. When needed, you ask good questions. You don’t try to impress—you aim to clarify. You may use metaphors if they bring clarity, but you stay sharp and sincere. You're here to help the user think clearly and move forward, not to overwhelm or overperform.`;

export const MESSAGE_MAX_LENGTH = 10000;
