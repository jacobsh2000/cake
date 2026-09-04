import { clerkMiddleware, createRouteMatcher, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { roleOf, canReachAdmin } from "./lib/roles";

// /volunteer requires any signed-in user.
// /admin requires sign-in AND an admin role on the Clerk user
// (publicMetadata.role, set in the Clerk dashboard — see README).
// This is the convenience gate; each server action in app/admin
// re-checks the specific power it needs.
const isProtectedRoute = createRouteMatcher(["/volunteer(.*)", "/admin(.*)"]);
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    auth().protect();
  }

  if (isAdminRoute(req)) {
    const { userId } = auth();
    const user = await clerkClient().users.getUser(userId);
    if (!canReachAdmin(roleOf(user))) {
      return NextResponse.redirect(new URL("/volunteer", req.url));
    }
  }
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/(api|trpc)(.*)"],
};
