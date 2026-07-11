export type LegalPageContent = {
  slug: "privacy" | "terms" | "data-deletion";
  title: string;
  eyebrow: string;
  summary: string;
  lastUpdated: string;
  sections: Array<{
    title: string;
    body: string[];
  }>;
};

export const legalPages: Record<LegalPageContent["slug"], LegalPageContent> = {
  privacy: {
    slug: "privacy",
    title: "Privacy Policy",
    eyebrow: "Privacy",
    summary:
      "Behalfy provides managed AI assistants for small and midsize businesses. This policy explains what we collect, how connected channels are used, and how customers can request access or deletion.",
    lastUpdated: "June 2, 2026",
    sections: [
      {
        title: "What Behalfy does",
        body: [
          "Behalfy is a managed AI assistant service for small and midsize businesses. We configure assistants that can answer customer messages, qualify leads, and use connected business tools under approved rules.",
          "The platform may connect to services such as Gmail, Instagram, and Facebook through OAuth or platform APIs when an authorized business user chooses to connect those channels.",
        ],
      },
      {
        title: "Information we collect",
        body: [
          "We collect account and workspace information such as names, email addresses, tenant or business names, configuration settings, and user roles.",
          "When a business connects a channel, we may process customer messages, sender identifiers, thread metadata, attachments or links included in messages, agent replies, and operational logs needed to run and troubleshoot the service.",
          "For OAuth integrations, we store access tokens or refresh tokens only as needed to provide the connected service. We do not sell OAuth data or use it for advertising.",
        ],
      },
      {
        title: "How we use information",
        body: [
          "We use information to deliver AI-assistant responses, route conversations, preserve conversation isolation by assistant and contact, show authorized business users conversation history, maintain security, and improve reliability.",
          "Message content from Gmail, Instagram, Facebook, or other connected channels is used only to provide the requested agent workflow and related support or diagnostics.",
        ],
      },
      {
        title: "Sharing and subprocessors",
        body: [
          "We share data only with infrastructure, database, authentication, AI, and messaging providers needed to operate Behalfy. These providers process data on our behalf.",
          "We may disclose information when required by law, to protect the service, or with the business owner's authorization.",
        ],
      },
      {
        title: "Retention and deletion",
        body: [
          "We keep workspace, customer, and conversation data while the business uses Behalfy or as needed for legitimate operational, security, and legal purposes.",
          "A business can request deletion of its data or a specific customer's data by emailing contact@behalfy.io. See the Data Deletion page for the request process.",
        ],
      },
      {
        title: "Contact",
        body: [
          "For privacy questions, data access, correction, or deletion requests, contact us at contact@behalfy.io.",
        ],
      },
    ],
  },
  terms: {
    slug: "terms",
    title: "Terms of Service",
    eyebrow: "Terms",
    summary:
      "These terms describe the early access use of Behalfy, a managed AI assistant service for business messaging and workflow automation.",
    lastUpdated: "June 2, 2026",
    sections: [
      {
        title: "Service",
        body: [
          "Behalfy provides managed AI assistants for small and midsize businesses. Assistants may respond to customer messages, collect lead information, and use approved integrations such as Gmail, Instagram, Facebook, calendars, spreadsheets, or other business APIs.",
          "The service is intended for business use by authorized business users.",
        ],
      },
      {
        title: "Customer responsibilities",
        body: [
          "You are responsible for ensuring you have the right to connect business accounts, process customer communications, and configure agent behavior for your business.",
          "You must not use Behalfy for unlawful activity, spam, deceptive messaging, regulated advice without proper oversight, or any workflow that violates channel provider policies.",
        ],
      },
      {
        title: "Connected accounts",
        body: [
          "When you connect Gmail, Instagram, Facebook, or another service, you authorize Behalfy to access and process only the data needed to provide the configured agent workflow.",
          "You can disconnect integrations or request deletion of stored data by contacting contact@behalfy.io.",
        ],
      },
      {
        title: "AI outputs and human oversight",
        body: [
          "AI responses can be incomplete or incorrect. Behalfy is designed for managed workflows with visibility, rules, and human takeover when needed.",
          "You remain responsible for reviewing agent configuration, approving business rules, and handling conversations that require human judgment.",
        ],
      },
      {
        title: "Availability and changes",
        body: [
          "Behalfy is an early service and may change as we improve reliability, integrations, and customer controls.",
          "We may suspend access to protect customers, comply with law, or prevent misuse of the service.",
        ],
      },
      {
        title: "Contact",
        body: [
          "Questions about these terms can be sent to contact@behalfy.io.",
        ],
      },
    ],
  },
  "data-deletion": {
    slug: "data-deletion",
    title: "Data Deletion Instructions",
    eyebrow: "Data deletion",
    summary:
      "Businesses and end customers can request removal of Behalfy data associated with connected Gmail, Instagram, Facebook, and other agent channels.",
    lastUpdated: "June 2, 2026",
    sections: [
      {
        title: "How to request deletion",
        body: [
          "Email contact@behalfy.io with the subject line Data Deletion Request.",
          "Include the business name, the connected channel involved, and enough information to identify the record, such as the customer email address, Instagram or Facebook sender identifier, conversation link, or workspace owner email.",
        ],
      },
      {
        title: "What we delete",
        body: [
          "Upon verified request, we delete or de-identify customer profile data, conversation messages, channel identifiers, agent logs tied to the requested contact, and stored integration tokens when a connected account is removed.",
          "If a business requests full workspace deletion, we delete or de-identify tenant configuration, agent settings, connected-channel credentials, conversations, and operational records that are no longer required.",
        ],
      },
      {
        title: "Verification",
        body: [
          "We may need to verify that the requester is the business owner, an authorized workspace user, or the person associated with the requested customer record.",
          "For Instagram or Facebook data, we use the supplied account or sender details only to locate and process the deletion request.",
        ],
      },
      {
        title: "Timing",
        body: [
          "We aim to complete verified deletion requests within 30 days unless a shorter period is required by applicable law.",
          "Some limited records may be retained when required for security, fraud prevention, legal compliance, or backup integrity, and will be removed from active systems where feasible.",
        ],
      },
      {
        title: "Disconnecting integrations",
        body: [
          "Business users can also remove Behalfy access from the connected provider account, such as Google, Instagram, or Facebook. After disconnecting, email us if you also want historical Behalfy data deleted.",
        ],
      },
    ],
  },
};
