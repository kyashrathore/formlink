import { dirname } from "path"
import { fileURLToPath } from "url"
import { FlatCompat } from "@eslint/eslintrc"
import noComments from "eslint-plugin-no-comments"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    plugins: {
      "no-comments": noComments,
    },
    rules: {
      "no-comments/disallowComments": "error",
      "no-console": "error",
    },
  },
]

export default eslintConfig
