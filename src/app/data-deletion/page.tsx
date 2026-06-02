import type { Metadata } from "next";

import { legalPages } from "../legal-content";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = {
  title: "Data Deletion Instructions | Behalfy",
  description: "Data deletion instructions for Behalfy by Stafless.",
};

export default function DataDeletionPage() {
  return <LegalPage page={legalPages["data-deletion"]} />;
}
