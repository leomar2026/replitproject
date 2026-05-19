import { useGetSettings } from "@workspace/api-client-react";
import defaultLogoSrc from "@assets/Logo_1778397631519.png";

export function useCompany() {
  const { data: settings } = useGetSettings();
  return {
    name: settings?.companyName || "Electro Power",
    logo: settings?.companyLogo || defaultLogoSrc,
    address: settings?.companyAddress || "",
    phone: settings?.companyPhone || "",
    email: settings?.companyEmail || "",
  };
}
