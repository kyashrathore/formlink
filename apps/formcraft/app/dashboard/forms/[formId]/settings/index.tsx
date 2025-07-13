import { Form } from "@formlink/schema"
import Integrations from "../FormEditor/Integrations"

interface SettingsProps {
  form: Form
  userId: string | undefined
}
export default function Settings({ form, userId }: SettingsProps) {
  return (
    <div className="pb-[100vh]">
      <Integrations userId={userId || ""} />
    </div>
  )
}
