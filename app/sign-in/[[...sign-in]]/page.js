import { SignIn } from "@clerk/nextjs";
import { COLORS, pageWrap } from "../../../lib/theme";

export default function SignInPage() {
  return (
    <div style={{ ...pageWrap, display: "flex", justifyContent: "center", alignItems: "center" }}>
      <SignIn
        appearance={{
          variables: {
            colorPrimary: COLORS.berry,
            colorText: COLORS.ink,
            colorBackground: COLORS.card,
            fontFamily: "'Inter', sans-serif",
            borderRadius: "10px",
          },
        }}
      />
    </div>
  );
}
