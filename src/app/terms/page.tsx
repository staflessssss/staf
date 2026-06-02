import type { Metadata } from "next";

import { legalPages } from "../legal-content";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = {
  title: "Terms of Service | Behalfy",
  description: "Terms of service for Behalfy by Stafless.",
};

export default function TermsPage() {
  return <LegalPage page={legalPages.terms} />;
}
