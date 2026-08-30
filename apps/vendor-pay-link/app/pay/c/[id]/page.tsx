"use client";

import { useParams } from "next/navigation";
import { ChargePayPage } from "@/components/buyer/ChargePayPage";

export default function ChargeRoute() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : "";
  if (!id) return null;
  return <ChargePayPage id={id} />;
}
