import { redirect } from "next/navigation";
import { FileCheck2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession } from "@/lib/auth/session";
import { SignInForm } from "./sign-in-form";

export const instant = false;

interface SignInPageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const session = await getSession();
  if (session?.user) redirect("/dashboard");

  const { next } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader className="space-y-3">
          <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileCheck2 className="size-6" />
          </div>
          <div>
            <CardTitle className="text-2xl">Document Tracking</CardTitle>
            <CardDescription>Transmittal Management System</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <SignInForm nextPath={next ?? "/dashboard"} />
          <p className="mt-6 text-xs text-muted-foreground">
            Accounts are issued by the system administrator. Focal persons review paper documents and do not use
            application accounts.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
