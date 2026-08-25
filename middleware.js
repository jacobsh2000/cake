import { clerkMiddleware, createRouteMatcher, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// /volunteer requires any signed-in user.
// /admin requires sign-in AND publicMetadata.role === "admin" on the
// Clerk user (set manually in the Clerk dashboard — see README).
const isProtectedRoute = createRouteMatcher(["/volunteer(.*)", "/admin(.*)"]);
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    auth().protect();
  }

  if (isAdminRoute(req)) {
    const { userId } = auth();
    const user = await clerkClient().users.getUser(userId);
    if (user.publicMetadata?.role !== "admin") {
      return NextResponse.redirect(new URL("/volunteer", req.url));
    }
  }
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/(api|trpc)(.*)"],
};
