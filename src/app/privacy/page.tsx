import type { Metadata } from "next";

import { legalPages } from "../legal-content";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy | Behalfy",
  description: "Privacy policy for Behalfy by Stafless.",
};

export default function PrivacyPage() {
  return <LegalPage page={legalPages.privacy} />;
}
