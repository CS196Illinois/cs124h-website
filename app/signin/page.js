"use client";

import { signIn } from "next-auth/react";
import { useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function SignInInner() {
  const searchParams = useSearchParams();
  const error = searchParams?.get("error");

  useEffect(() => {
    if (error) return;
    const callbackUrl = searchParams?.get("callbackUrl") || "/user";
    signIn("cilogon", { callbackUrl });
  }, [error]);

  if (error) {
    return (
      <div>
        <p>Sign-in failed: {error}</p>
        <button onClick={() => signIn("cilogon", { callbackUrl: "/user" })}>
          Try again
        </button>
      </div>
    );
  }

  return <p>Signing you in</p>;
}

export default function SignIn() {
  return (
    <Suspense fallback={<p>Signing you in</p>}>
      <SignInInner />
    </Suspense>
  );
}
