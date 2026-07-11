import type { Metadata } from "next";

import { legalPages } from "../legal-content";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Learn how Behalfy collects, uses, protects, and deletes data.",
  alternates: {
    canonical: "/privacy",
  },
};

export default function PrivacyPage() {
  return <LegalPage page={legalPages.privacy} />;
}
