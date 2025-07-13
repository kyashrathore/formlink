import React, { useCallback, useEffect, useRef, useState } from "react"

export function useScrollSpy(documentId: string, offset = 0) {
  const [containerElement, setContainerElement] = useState<HTMLElement | null>(
    null
  )
  const [currentInViewSection, setCurrentInViewSection] = useState<
    string | null
  >(null)
  const sectionsRef = useRef<{ id: string; element: HTMLElement }[]>([])
  const observerRef = useRef<MutationObserver | null>(null)
  const isMounted = useRef(false)

  useEffect(() => {
    isMounted.current = true
    const element = document.getElementById(documentId)
    setContainerElement(element)

    return () => {
      isMounted.current = false
    }
  }, [documentId])

  const handleScroll = useCallback(() => {
    if (
      !isMounted.current ||
      sectionsRef.current.length === 0 ||
      !containerElement
    ) {
      return
    }

    const containerTop = containerElement.getBoundingClientRect().top
    let activeSectionId: string | null = null

    for (let i = sectionsRef.current.length - 1; i >= 0; i--) {
      const section = sectionsRef.current[i]
      if (section?.element) {
        const { id, element } = section
        const elementTop = element.getBoundingClientRect().top
        const elementTopRelativeToContainer = elementTop - containerTop
        if (elementTopRelativeToContainer <= offset) {
          activeSectionId = id
          break
        }
      }
    }

    setCurrentInViewSection((prevId) =>
      prevId !== activeSectionId ? activeSectionId : prevId
    )
  }, [containerElement, offset])

  const findSections = useCallback(() => {
    if (!containerElement || !isMounted.current) {
      sectionsRef.current = []
      return
    }
    const sectionElements =
      containerElement.querySelectorAll("[data-spy-section]")
    sectionsRef.current = Array.from(sectionElements).map((el) => {
      const id = (el as HTMLElement).dataset.spySection || ""
      return { id, element: el as HTMLElement }
    })
    requestAnimationFrame(() => {
      if (isMounted.current) {
        handleScroll()
      }
    })
  }, [containerElement, handleScroll])

  useEffect(() => {
    if (!containerElement) {
      return
    }

    findSections()

    observerRef.current = new MutationObserver(() => {
      if (isMounted.current) {
        findSections()
      }
    })

    observerRef.current.observe(containerElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-spy-section"],
    })

    let rafId: number | null = null
    const rafScrollHandler = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
      rafId = requestAnimationFrame(() => {
        if (isMounted.current) {
          handleScroll()
        }
        rafId = null
      })
    }

    containerElement.addEventListener("scroll", rafScrollHandler)

    return () => {
      containerElement.removeEventListener("scroll", rafScrollHandler)
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
      if (observerRef.current) {
        observerRef.current.disconnect()
        observerRef.current = null
      }
    }
  }, [containerElement, findSections, handleScroll])

  return currentInViewSection
}
