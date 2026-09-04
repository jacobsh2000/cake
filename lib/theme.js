// Shared design tokens — same palette/type as app/request/page.js.
// Import COLORS wherever a page needs the bakery theme instead of
// redefining colors locally.
export const COLORS = {
  bg: "#FAF4EC",
  card: "#FFFFFF",
  berry: "#7A2E45",
  berryDark: "#5E2135",
  gold: "#C98A2B",
  ink: "#332821",
  inkSoft: "#6B5E54",
  border: "#EDE1D3",
  error: "#B3261E",
  success: "#2E6B3E",
};

export const fontFamily = "'Inter', -apple-system, sans-serif";
export const headingFont = "'Fraunces', serif";

export const pageWrap = {
  minHeight: "100vh",
  background: COLORS.bg,
  padding: "48px 20px",
  fontFamily,
  color: COLORS.ink,
};

export const heading = {
  fontFamily: headingFont,
  fontWeight: 600,
  color: COLORS.berryDark,
  margin: 0,
};

export const card = {
  background: COLORS.card,
  borderRadius: 16,
  border: `1px solid ${COLORS.border}`,
  boxShadow: "0 2px 12px rgba(122,46,69,0.06)",
  padding: 24,
  marginBottom: 20,
};

export const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  fontSize: 14,
  fontFamily,
  color: COLORS.ink,
  border: `1.5px solid ${COLORS.border}`,
  borderRadius: 8,
  marginBottom: 14,
  boxSizing: "border-box",
  background: "#FFFDFB",
  outline: "none",
};

export const labelStyle = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: COLORS.ink,
  marginBottom: 6,
};

export function primaryBtn(extra) {
  return {
    padding: "10px 18px",
    fontSize: 14,
    fontWeight: 600,
    fontFamily,
    color: "#fff",
    background: COLORS.berry,
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
    ...extra,
  };
}

export function outlineBtn(color, extra) {
  return {
    padding: "7px 14px",
    fontSize: 12,
    fontWeight: 500,
    fontFamily,
    color: color || COLORS.berry,
    background: "#fff",
    border: `1.5px solid ${color || COLORS.berry}`,
    borderRadius: 8,
    cursor: "pointer",
    ...extra,
  };
}

export function dangerBtn(extra) {
  return {
    padding: "10px 18px",
    fontSize: 13,
    fontWeight: 600,
    fontFamily,
    color: COLORS.error,
    background: "#fff",
    border: `1.5px solid ${COLORS.error}`,
    borderRadius: 10,
    cursor: "pointer",
    ...extra,
  };
}

// The human-facing request number, styled to read as a reference code
// rather than as part of the request's title.
export const requestNumberStyle = {
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: 6,
  background: COLORS.bg,
  border: `1px solid ${COLORS.border}`,
  color: COLORS.inkSoft,
  fontFamily,
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.02em",
};

export function tabBtn(active) {
  return {
    padding: "10px 16px",
    border: "none",
    borderBottom: active ? `2px solid ${COLORS.berry}` : "2px solid transparent",
    background: "none",
    fontWeight: active ? 600 : 400,
    fontFamily,
    color: active ? COLORS.berry : COLORS.inkSoft,
    cursor: "pointer",
    fontSize: 14,
  };
}
