"use client"

import NavigationBar from "@/app/dashboard/forms/[formId]/components/NavigationBar"
import TabContentManager from "@/app/dashboard/forms/[formId]/components/TabContentManager"
import { useFormEditorStore } from "@/app/dashboard/forms/[formId]/stores/useFormEditorStore"
import { Form } from "@formlink/schema"
import { User } from "@supabase/supabase-js"
import { useEffect } from "react"

interface FormPageClientProps {
  form: Form
  user: User
}

export default function FormPageClient({ form }: FormPageClientProps) {
  useEffect(() => {
    useFormEditorStore.getState().setForm(form)
  }, [form])

  return (
    <div className="flex h-full flex-col">
      <NavigationBar formId={form.id} />
      <main className="flex-1 overflow-y-auto">
        <TabContentManager formId={form.id} />
      </main>
    </div>
  )
}
