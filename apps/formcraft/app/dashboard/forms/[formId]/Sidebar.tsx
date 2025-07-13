"use client"

import { useDataTableStore } from "@/app/components/data-table/dataTableStore"
import FormlinkLogo from "@/app/components/FormlinkLogo"
import UserMenu from "@/app/components/layout/user-menu"
import { useScrollSpy } from "@/app/hooks/useScrollSpy"
import { cn } from "@/app/lib"
import { APP_NAME } from "@/app/lib/config"
import type { Form } from "@formlink/schema"
import { Button, Tabs, TabsList, TabsTrigger } from "@formlink/ui"
import Link from "next/link"
import React from "react"
import { useMobile } from "../../../../hooks/use-mobile"
import ShareTabContent from "./FormEditor/ShareTabContent"
import ResponsesFilter from "./responses/ResponsesFilter"

const TAB_SECTIONS = {
  content: [
    { id: "form-journey-step", label: "Form Journey" },
    { id: "form-start-step", label: "Form Start Step" },
    { id: "questions-step", label: "Questions" },
    { id: "form-end-step", label: "End Step" },
    { id: "additional-fields-step", label: "Additional Fields" },
    { id: "redirect-on-submission-step", label: "Redirect On Submission" },
  ],
  share: [
    { id: "link", label: "Link" },
    { id: "embed", label: "Embed Code & Preview" },
  ],
  settings: [{ id: "webhook-step", label: "Setup Webhook" }],
  responses: [{ id: "responses", label: "Responses" }],
}

type TabKey = keyof typeof TAB_SECTIONS

export default function Sidebar({
  selectedTab,
  onTabChange,
  formId,
  shortId,
  form,
  user,
}: {
  selectedTab: TabKey
  onTabChange: (tab: TabKey) => void
  formId: string
  shortId?: string
  form: Form
  user: any | null
}) {
  const scrollContainerId = "form-section-container"
  const activeSection = useScrollSpy(scrollContainerId, 72)
  const activeLinkClass = "text-lg activelink bg-muted rounded-xl"
  const inactiveLinkClass = "text-lg inactivelink"

  const isMobile = useMobile()
  const shouldHideSidebar = isMobile && selectedTab === "content"

  const profileData = {
    anonymous: user?.anonymous ?? null,
    created_at: user?.created_at ?? null,
    daily_message_count: user?.daily_message_count ?? null,
    daily_reset: user?.daily_reset ?? null,
    display_name: user?.user_metadata?.name ?? user?.display_name ?? null,
    email: user?.email ?? "",
    id: user?.id ?? "",
    message_count: user?.message_count ?? null,
    preferred_model: user?.preferred_model ?? null,
    premium: user?.premium ?? null,
    profile_image:
      user?.user_metadata?.avatar_url ?? user?.profile_image ?? null,
  }

  if (shouldHideSidebar) {
    return null
  }
  return (
    <aside className="bg-background flex w-120 min-w-64 flex-col border-r">
      <Tabs
        orientation="vertical"
        value={selectedTab}
        onValueChange={(val) => onTabChange(val as TabKey)}
        className="flex flex-row"
      >
        <div className="bg-muted flex h-screen w-22 flex-col justify-between border border-r">
          <div>
            <div className="mb-4">
              <Link href="/dashboard">
                <FormlinkLogo />
              </Link>
            </div>

            <TabsList className="flex h-40 flex-col space-y-2 p-0">
              <TabsTrigger value="content" className="w-full justify-start">
                Form
              </TabsTrigger>
              <TabsTrigger value="share" className="w-full justify-start">
                Share
              </TabsTrigger>
              <TabsTrigger value="responses" className="w-full justify-start">
                Responses
              </TabsTrigger>
              <TabsTrigger value="settings" className="w-full justify-start">
                Settings
              </TabsTrigger>
            </TabsList>
          </div>
          <div className="flex justify-center p-2">
            <UserMenu user={profileData} />
          </div>
        </div>
        <div className="min-w-0 flex-1 overflow-auto pt-4">
          {selectedTab === "share" ? (
            <ShareTabContent formId={formId} shortId={shortId} />
          ) : selectedTab === "responses" ? (
            <ResponsesFilter />
          ) : (
            <nav>
              <ul className="flex flex-col gap-2">
                {TAB_SECTIONS[selectedTab].map((section) => (
                  <li
                    data-spy-section-link={section.id}
                    className={`block transition-all duration-200`}
                    key={section.id}
                  >
                    <Button
                      variant="link"
                      asChild
                      className="hover:bg-muted no-underline hover:no-underline"
                    >
                      <a
                        className={cn(
                          `block transition-all duration-200`,
                          activeSection === section.id
                            ? activeLinkClass
                            : inactiveLinkClass
                        )}
                        href={`#${section.id}`}
                      >
                        {section.label}
                      </a>
                    </Button>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>
      </Tabs>
    </aside>
  )
}
