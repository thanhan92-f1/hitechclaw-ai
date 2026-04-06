import { Suspense } from "react";
import { DocsToolScreen } from "@/components/mission-control/tools";

export default function ToolDocsPage() {
  return (
    <Suspense fallback={<div className="min-h-[40vh]" />}>
      <DocsToolScreen />
    </Suspense>
  );
}
