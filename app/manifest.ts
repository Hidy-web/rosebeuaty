import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "로즈 출장 헤어·메이크업 예약",
    short_name: "로즈 예약",
    description: "하객·혼주·행사·촬영 출장 헤어메이크업 예약",
    start_url: "/",
    display: "standalone",
    background_color: "#F7F5F6",
    theme_color: "#8E2B55",
    lang: "ko",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
