"use client";

import { useParams } from "next/navigation";
import { StallPayPage } from "@/components/buyer/StallPayPage";

export default function StallRoute() {
  const params = useParams<{ code: string }>();
  const code = typeof params.code === "string" ? params.code : "";
  if (!code) return null;
  return <StallPayPage code={code} />;
}
