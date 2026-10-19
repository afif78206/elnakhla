import logoAsset from "@/assets/logo-medjadja.png.asset.json";

// The asset endpoint is hosted by Lovable, not by external hosts such as Vercel.
export const logoUrl = new URL(logoAsset.url, "https://medjadja-olive.lovable.app").href;