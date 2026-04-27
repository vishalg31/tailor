export const MODELS = {
  parsing: 'gemini-3.1-flash-lite-preview',    // primary: 500 RPD free tier, 15 RPM
  parsingFallback: 'gemini-2.5-flash',         // fallback: 20 RPD free / unlimited paid
  parsingBackup: 'gemini-2.5-flash-lite',      // final backup
  tailoring: 'gemini-3.1-flash-lite-preview',  // primary: 500 RPD free tier, 15 RPM
  tailoringFallback: 'gemini-2.5-flash',       // fallback: 20 RPD free / unlimited paid
  tailoringBackup: 'gemini-2.5-flash-lite',    // final backup
  scoring: 'gemini-3.1-flash-lite-preview',    // primary: 500 RPD free tier
  scoringFallback: 'gemini-2.5-flash',         // fallback: 20 RPD free / unlimited paid
  scoringBackup: 'gemini-2.5-flash-lite',      // final backup
} as const
