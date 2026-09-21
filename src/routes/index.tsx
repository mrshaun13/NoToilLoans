import { createFileRoute } from "@tanstack/react-router";
import { LoanCalculator } from "@/components/loan-calculator";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <main className="min-h-dvh overflow-x-hidden bg-background text-foreground">
      <LoanCalculator />
    </main>
  );
}
