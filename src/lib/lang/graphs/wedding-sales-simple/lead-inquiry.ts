export function isGenericWeddingLeadInquiry(text: string) {
  const normalized = text.trim().toLowerCase().replace(/[\u2019]/g, "'");

  if (
    [
      "inquiry about wedding videography",
      "wedding videography inquiry",
      "inquiry about wedding video",
      "interested in wedding videography",
      "i'm interested in wedding videography",
    ].includes(normalized)
  ) {
    return true;
  }

  return (
    /\b(?:wedding\s+videography|wedding\s+video|videographer)\b/.test(normalized) &&
    /\b(?:inquiry|interested|info|information|get\s+info|learn\s+more)\b/.test(normalized)
  );
}
