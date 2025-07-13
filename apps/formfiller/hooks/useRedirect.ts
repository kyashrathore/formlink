import { useState, useEffect } from "react";

/**
 * Custom hook to handle conditional redirection with a delay.
 * @param shouldRedirectCondition - Boolean condition that must be true to initiate redirection.
 * @param redirectUrl - The URL to redirect to. Must be a non-empty string.
 * @param delay - Delay in milliseconds before the redirect occurs. Defaults to 500ms.
 * @returns boolean - True if the redirect process has been initiated, false otherwise.
 */
export function useRedirect(
  shouldRedirectCondition: boolean,
  redirectUrl?: string,
  delay: number = 500,
): boolean {
  const [isActuallyRedirecting, setIsActuallyRedirecting] = useState(false);

  useEffect(() => {
    let timerId: NodeJS.Timeout | undefined;

    if (shouldRedirectCondition && redirectUrl && redirectUrl.trim() !== "") {
      setIsActuallyRedirecting(true);
      console.log(
        `[useRedirect] Conditions met. Will attempt redirect to "${redirectUrl}" in ${delay}ms.`,
      );

      timerId = setTimeout(() => {
        console.log(
          `[useRedirect] Timeout fired. Redirecting to "${redirectUrl}".`,
        );
        try {
          window.location.href = redirectUrl;
          // If redirect succeeds, the component typically unmounts, so no need to set isActuallyRedirecting to false.
        } catch (e) {
          console.error(
            `[useRedirect] Error during window.location.href assignment to "${redirectUrl}":`,
            e,
          );
          setIsActuallyRedirecting(false); // Reset on error to allow potential re-attempts or UI updates.
        }
      }, delay);
    } else {
      // If conditions are not met (e.g., shouldRedirectCondition is false, or URL is invalid),
      // ensure we are not in a redirecting state.
      if (isActuallyRedirecting) {
        console.log(
          `[useRedirect] Conditions for redirect no longer met or URL invalid. Resetting isActuallyRedirecting state.`,
        );
        setIsActuallyRedirecting(false);
      }
    }

    return () => {
      if (timerId) {
        console.log(
          `[useRedirect] Cleanup: Clearing timer for URL "${redirectUrl}".`,
        );
        clearTimeout(timerId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldRedirectCondition, redirectUrl, delay]); // isActuallyRedirecting is intentionally not a dependency here

  return isActuallyRedirecting;
}
