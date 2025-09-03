import { isValidPhoneNumber } from "libphonenumber-js";

// A single, reliable source of truth for text input validation.
export const validateTextValue = (
  value: string,
  format?: string,
  validations?: any,
) => {
  if (validations?.required?.value && value.trim() === "") {
    return validations?.required?.message || "This field is required";
  }

  // If the field is not required and empty, it's valid.
  if (!validations?.required?.value && value.trim() === "") {
    return null;
  }

  const minL = validations?.minLength?.value;
  if (typeof minL === "number" && value.length < minL) {
    return `Minimum length is ${minL} characters`;
  }

  const maxL = validations?.maxLength?.value;
  if (typeof maxL === "number" && value.length > maxL) {
    return `Maximum length is ${maxL} characters`;
  }

  const pattern = validations?.pattern?.value;
  if (pattern && value) {
    try {
      const re = new RegExp(pattern);
      if (!re.test(value)) {
        return validations?.pattern?.message || "Invalid format";
      }
    } catch {
      // ignore invalid regex
    }
  } else if (value && format) {
    switch (format) {
      case "email":
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return "Please enter a valid email address";
        }
        break;
      case "url":
        if (!/^https?:\/\/.+\..+/.test(value)) {
          return "Please enter a valid URL (starting with http:// or https://)";
        }
        break;
      case "tel":
        try {
          if (value.trim().startsWith("+")) {
            if (!isValidPhoneNumber(value)) {
              return "Please enter a valid phone number";
            }
          } else {
            const digitCount = (value.match(/\d/g) || []).length;
            if (digitCount < 7) {
              return "Please enter a valid phone number";
            }
          }
        } catch {
          const digitCount = (value.match(/\d/g) || []).length;
          if (digitCount < 7) {
            return "Please enter a valid phone number";
          }
        }
        break;
      case "number":
        if (!/^-?\d+(\.\d+)?$/.test(value)) {
          return "Please enter a valid number";
        }
        break;
    }
  }

  return null; // No error
};
