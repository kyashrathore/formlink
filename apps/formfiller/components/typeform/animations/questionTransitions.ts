export const questionVariants = {
  enter: (direction: number) => ({
    y: direction > 0 ? 100 : -100,
    opacity: 0,
    pointerEvents: "none",
  }),
  center: {
    y: 0,
    opacity: 1,
    pointerEvents: "auto",
  },
  exit: (direction: number) => ({
    y: direction < 0 ? 100 : -100,
    opacity: 0,
    pointerEvents: "none",
  }),
};

export const questionTransition = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
};
