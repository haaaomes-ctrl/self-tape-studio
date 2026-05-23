export type MuxStaticRenditionsLike = {
  status?: string | null;
  files?: Array<{
    name?: string | null;
    resolution?: string | null;
    status?: string | null;
  }> | null;
};

export function isMuxStaticRenditionReady(
  staticRenditions: MuxStaticRenditionsLike | null | undefined,
): boolean {
  if (!staticRenditions) return false;
  if (staticRenditions.status === "ready") return true;
  return (
    staticRenditions.files?.some((file) => {
      const isHighest = file.name === "highest.mp4" || file.resolution === "highest";
      return isHighest && file.status === "ready";
    }) ?? false
  );
}
