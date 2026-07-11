import type { Metadata } from "next";

import { legalPages } from "../legal-content";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = {
  title: "Data Deletion Instructions",
  description: "Learn how to request deletion of data processed by Behalfy.",
  alternates: {
    canonical: "/data-deletion",
  },
};

export default function DataDeletionPage() {
  return <LegalPage page={legalPages["data-deletion"]} />;
}
