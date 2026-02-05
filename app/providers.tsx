"use client";

import React from "react";
import {
  BusiboxApiProvider,
  CustomizationProvider,
  ThemeProvider,
} from "@jazzmind/busibox-app";
import type { PortalCustomization } from "@jazzmind/busibox-app";

const defaultCustomization: PortalCustomization = {
  companyName: "Busibox",
  siteName: "AI Initiative Status",
  slogan: "Track project progress with intelligent updates",
  logoUrl: null,
  faviconUrl: null,
  primaryColor: "#2563eb", // blue-600
  secondaryColor: "#1d4ed8", // blue-700
  textColor: "#ffffff",
  addressLine1: "",
  addressLine2: null,
  addressCity: null,
  addressState: "",
  addressZip: null,
  addressCountry: "",
  supportEmail: null,
  supportPhone: null,
  customCss: null,
};

export function Providers({ children }: { children: React.ReactNode }) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

  return (
    <ThemeProvider>
      <BusiboxApiProvider
        value={{ nextApiBasePath: basePath, services: {}, serviceRequestHeaders: {} }}
      >
        <CustomizationProvider initialCustomization={defaultCustomization}>
          {children}
        </CustomizationProvider>
      </BusiboxApiProvider>
    </ThemeProvider>
  );
}
