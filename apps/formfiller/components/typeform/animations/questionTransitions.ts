export const questionVariants = {
  enter: (direction: number) => ({
    y: direction > 0 ? 100 : -100,
    opacity: 0,
  }),
  center: {
    y: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    y: direction < 0 ? 100 : -100,
    opacity: 0,
  }),
};

export const questionTransition = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
};
