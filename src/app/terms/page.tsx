import type { Metadata } from "next";

import { legalPages } from "../legal-content";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Read the terms that govern business use of Behalfy.",
  alternates: {
    canonical: "/terms",
  },
};

export default function TermsPage() {
  return <LegalPage page={legalPages.terms} />;
}
