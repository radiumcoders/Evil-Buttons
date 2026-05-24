// import type { Metadata } from "next";
// import { LandingPage } from "@/components/landing/landing-page";

// export const metadata: Metadata = {
//   alternates: {
//     canonical: "/",
//   },
//   openGraph: {
//     url: "/",
//   },
// };

// export default function HomePage() {
//   return <LandingPage />;
// }

import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/docs");
}
