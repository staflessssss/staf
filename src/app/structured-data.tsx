const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://behalfy.io/#organization",
      name: "Behalfy",
      url: "https://behalfy.io/",
      email: "contact@behalfy.io",
      logo: {
        "@type": "ImageObject",
        url: "https://behalfy.io/assets/landing/behalfy-gold-mark.png",
      },
    },
    {
      "@type": "Service",
      "@id": "https://behalfy.io/#service",
      name: "Behalfy Managed AI Assistant",
      url: "https://behalfy.io/",
      serviceType:
        "Managed AI customer operations, channel integration, and business workflow automation",
      description:
        "Fully managed AI agents for small and midsize businesses that connect customer channels with CRM, calendars, booking tools, data, and custom business systems through native integrations or APIs.",
      provider: {
        "@id": "https://behalfy.io/#organization",
      },
      audience: {
        "@type": "BusinessAudience",
        audienceType: "Small and midsize businesses",
      },
    },
  ],
};

export function BehalfyStructuredData() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
      }}
    />
  );
}
