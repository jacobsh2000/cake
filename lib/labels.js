// Display labels for values stored as raw strings in the database.
// Shared so the volunteer board and the admin dashboard can't drift.

export const STATUS_LABELS = {
  claimed: "Claimed — not yet contacted",
  contacted: "Contacted recipient",
  confirmed: "Confirmed delivery day/time",
  no_response: "No response from recipient",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const CAKE_FORMAT_LABELS = {
  cake: "cake",
  cupcakes: "cupcakes",
  no_preference: "cake or cupcakes",
};

// How far a volunteer will travel to deliver. Ordered nearest-first;
// the stored value is the key, so re-labelling never rewrites data.
export const TRAVEL_DISTANCE_OPTIONS = [
  ["0_5", "Up to 5 miles"],
  ["5_10", "5–10 miles"],
  ["10_20", "10–20 miles"],
  ["20_plus", "20+ miles"],
];

const TRAVEL_DISTANCE_LABELS = Object.fromEntries(TRAVEL_DISTANCE_OPTIONS);

export function travelDistanceLabel(value) {
  return TRAVEL_DISTANCE_LABELS[value] || value;
}

export function cakeFormatLabel(value) {
  return CAKE_FORMAT_LABELS[value] || value;
}

export function statusLabel(value) {
  return STATUS_LABELS[value] || value;
}
