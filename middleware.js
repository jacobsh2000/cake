import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Both the volunteer portal and the admin queue require sign-in.
// Note: this only enforces "signed in" — it doesn't distinguish
// Emily (admin) from a regular volunteer. See the "admin role check"
// note in README before treating /admin as truly secure.
const isProtectedRoute = createRouteMatcher(["/volunteer(.*)", "/admin(.*)"]);

export default clerkMiddleware((auth, req) => {
  if (isProtectedRoute(req)) {
    auth().protect();
  }
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/(api|trpc)(.*)"],
};
