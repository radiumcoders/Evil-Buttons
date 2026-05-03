import { generateAllOgImages } from "./generator";

generateAllOgImages().catch((error) => {
  console.error("OG generation failed:", error);
  process.exit(1);
});