export const devLog = (...a: unknown[]) => {
  if (process.env.NODE_ENV !== "production") console.log(...a);
};
