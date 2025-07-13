"use client"

import { ChevronDown, ChevronUp } from "lucide-react"
import React, { useState } from "react"

interface FaqItemProps {
  question: string
  answer: React.ReactNode
  isOpen: boolean
  toggleOpen: () => void
}

const FaqItem = ({ question, answer, isOpen, toggleOpen }: FaqItemProps) => (
  <div className="border-border border-b last:border-0">
    <button
      onClick={toggleOpen}
      className="flex w-full items-center justify-between py-5 text-left focus:outline-none"
    >
      <h3 className="text-lg font-medium">{question}</h3>
      <div className="ml-4 flex-shrink-0">
        {isOpen ? (
          <ChevronUp className="text-muted-foreground h-5 w-5" />
        ) : (
          <ChevronDown className="text-muted-foreground h-5 w-5" />
        )}
      </div>
    </button>
    <div
      className={`overflow-hidden transition-all duration-300 ${
        isOpen ? "max-h-[500px] pb-5" : "max-h-0"
      }`}
    >
      <div className="text-muted-foreground">{answer}</div>
    </div>
  </div>
)

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  const faqs = [
    {
      question: "What makes Formlink.ai different from other form builders?",
      answer: (
        <div className="space-y-3">
          <p>
            Formlink.ai is fundamentally different from traditional form
            builders because it uses AI to translate your natural language
            descriptions into fully functional forms. Instead of dragging,
            dropping, and configuring elements, you simply describe what you
            need in a conversation.
          </p>
          <p>
            This approach eliminates the learning curve, technical complexity,
            and time investment required by traditional form builders, while
            still producing sophisticated forms with advanced logic,
            calculations, and validations.
          </p>
        </div>
      ),
    },
    {
      question: "How accurate is the AI at understanding my form requirements?",
      answer: (
        <div className="space-y-3">
          <p>
            Our AI has been trained on thousands of form structures and use
            cases, allowing it to understand and implement a wide range of form
            requirements with high accuracy. It can interpret context, infer
            needs, and implement best practices automatically.
          </p>
          <p>
            The conversational interface also allows for clarification and
            refinement. If the AI misunderstands something or you want to make
            changes, you can simply explain what you want differently or request
            specific adjustments through natural conversation.
          </p>
        </div>
      ),
    },
    {
      question: "What types of forms can I create with Formlink.ai?",
      answer: (
        <div className="space-y-3">
          <p>
            You can create virtually any type of form with Formlink.ai,
            including but not limited to:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Contact forms</li>
            <li>Lead generation forms</li>
            <li>Event registration forms</li>
            <li>Surveys and feedback forms</li>
            <li>Application forms</li>
            <li>Multi-page forms with complex logic</li>
            <li>Forms with calculations (pricing, scoring, etc.)</li>
            <li>File upload forms</li>
            <li>Appointment booking forms</li>
            <li>Payment forms (integration with payment processors)</li>
          </ul>
          <p>
            If you have a specific form need that's not listed here, just
            describe it to our AI and it will likely be able to create it for
            you.
          </p>
        </div>
      ),
    },
    {
      question: "Can I customize the design of my forms?",
      answer: (
        <div className="space-y-3">
          <p>
            Yes, absolutely. You can customize the appearance of your forms
            through conversation with the AI. Simply describe the styling you
            want or ask for specific design elements, and the AI will implement
            them.
          </p>
          <p>
            You can request changes to colors, fonts, spacing, layout, and other
            visual elements. You can also ask for your form to match your
            brand's visual identity or website design. For more precise control,
            you can still access a visual editor to make manual adjustments
            after the AI has created your form.
          </p>
        </div>
      ),
    },
    {
      question: "What happens to the data collected through my forms?",
      answer: (
        <div className="space-y-3">
          <p>
            All data collected through your forms is securely stored in your
            Formlink.ai account. You can access, export, or delete this data at
            any time. We implement industry-standard encryption and security
            practices to protect your data.
          </p>
          <p>
            We never sell or share your form data with third parties. You retain
            full ownership of all data collected. For forms that handle
            sensitive information, we offer additional security features and
            compliance options (e.g., HIPAA, GDPR).
          </p>
          <p>
            You can also connect your forms to external services like CRMs,
            email marketing platforms, spreadsheets, and other tools through our
            integrations.
          </p>
        </div>
      ),
    },
    {
      question: "How much technical knowledge do I need to use Formlink.ai?",
      answer: (
        <div className="space-y-3">
          <p>
            Virtually none. If you can have a conversation and describe what you
            want, you can use Formlink.ai. Our platform is designed to eliminate
            the technical barriers that typically come with creating
            sophisticated forms.
          </p>
          <p>
            You don't need to know HTML, CSS, JavaScript, or any programming
            language. You don't need to understand conditional logic programming
            or form validation rules. The AI handles all the technical aspects
            based on your natural language descriptions.
          </p>
          <p>
            This makes Formlink.ai accessible to everyone in your organization,
            from marketers and product managers to founders and customer support
            teams.
          </p>
        </div>
      ),
    },
    {
      question: "Can I integrate Formlink.ai forms with my existing tools?",
      answer: (
        <div className="space-y-3">
          <p>
            Yes, Formlink.ai integrates with a wide range of popular business
            tools and platforms, including:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>CRM systems (Salesforce, HubSpot, etc.)</li>
            <li>Email marketing platforms (Mailchimp, ConvertKit, etc.)</li>
            <li>Spreadsheet applications (Google Sheets, Airtable, etc.)</li>
            <li>Payment processors (Stripe, PayPal, etc.)</li>
            <li>Team communication tools (Slack, Microsoft Teams, etc.)</li>
            <li>Project management software (Asana, Trello, etc.)</li>
            <li>Automation platforms (Zapier, Make, etc.)</li>
          </ul>
          <p>
            You can set up these integrations through conversation with the AI
            or through our intuitive integration interface. We also offer
            webhook support and an API for custom integrations.
          </p>
        </div>
      ),
    },
    {
      question: "How much does Formlink.ai cost?",
      answer: (
        <div className="space-y-3">
          <p>
            Formlink.ai offers flexible pricing to meet the needs of
            individuals, teams, and enterprises:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>A free tier with core features for getting started</li>
            <li>Professional tiers for individuals and small teams</li>
            <li>Business tiers for larger organizations with advanced needs</li>
            <li>
              Enterprise options with custom solutions and dedicated support
            </li>
          </ul>
          <p>
            Start with our free tier to experience the power of conversational
            form building, then upgrade as your needs grow.
          </p>
        </div>
      ),
    },
    {
      question: "Can I embed forms on my website or share them via link?",
      answer: (
        <div className="space-y-3">
          <p>Yes, you can share your forms in multiple ways:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Direct link to a hosted form page</li>
            <li>Embed code to integrate the form into your website</li>
            <li>QR code that opens the form when scanned</li>
            <li>Email campaigns with form links</li>
            <li>Social media sharing</li>
          </ul>
          <p>
            For embedded forms, we ensure they adapt to your website's styling
            and are responsive on all devices. You can also control the form's
            behavior, such as what happens after submission.
          </p>
        </div>
      ),
    },
    {
      question:
        "What happens if the AI doesn't understand what I'm asking for?",
      answer: (
        <div className="space-y-3">
          <p>
            Our AI is designed to seek clarification when it doesn't fully
            understand your requirements. It will ask follow-up questions to
            better understand what you need, similar to how a human
            form-building expert would.
          </p>
          <p>
            If you ever encounter a situation where the AI seems stuck or isn't
            understanding, you can:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Try describing your requirements differently</li>
            <li>Break down complex requests into smaller, simpler parts</li>
            <li>Provide examples of what you're looking for</li>
            <li>
              Use our human support team for assistance (available during
              business hours)
            </li>
          </ul>
          <p>
            We're constantly improving our AI based on these interactions, so it
            gets better with every conversation.
          </p>
        </div>
      ),
    },
  ]

  return (
    <section id="faq" className="section-padding">
      <div className="container-custom">
        <div className="mx-auto mb-16 max-w-3xl text-center">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">
            Frequently Asked Questions
          </h2>
          <p className="text-muted-foreground text-lg">
            Everything you need to know about Formlink.ai and AI-powered form
            building
          </p>
        </div>

        <div className="bg-card/50 subtle-glow mx-auto max-w-3xl rounded-lg border p-6 shadow-lg">
          {faqs.map((faq, index) => (
            <FaqItem
              key={index}
              question={faq.question}
              answer={faq.answer}
              isOpen={openIndex === index}
              toggleOpen={() => toggleFaq(index)}
            />
          ))}
        </div>

        <div className="mt-12 text-center">
          <div className="bg-card border-border inline-block rounded-full border px-5 py-3">
            <p className="text-muted-foreground text-sm">
              Have more questions?{" "}
              <a
                href="mailto:support@formlink.ai"
                className="text-foreground hover:text-primary font-medium transition-colors"
              >
                Contact our support team
              </a>
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
