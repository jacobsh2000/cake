// Shared filtering and sorting for the volunteer board and the admin
// dashboard, so "cake" means the same thing on both.
//
// Both lists are filtered in memory rather than in the query. Request
// volume here is dozens, not thousands, and the useful search fields
// span the requests/recipients join — expressing that as a PostgREST
// filter on an embedded resource is fragile for no gain at this size.
// If the board ever grows past a few hundred open requests, this is the
// thing to push back down into SQL.

export const SORT_OPTIONS = [
  ["soonest", "Needed soonest"],
  ["latest", "Needed latest"],
  ["newest", "Recently submitted"],
  ["oldest", "Waiting longest"],
];

export const CAKE_FILTER_OPTIONS = [
  ["", "Cake or cupcakes"],
  ["cake", "Cake"],
  ["cupcakes", "Cupcakes"],
];

export const ALLERGY_FILTER_OPTIONS = [
  ["", "Any allergy status"],
  ["none", "No allergies"],
  ["any", "Has allergies"],
  ["severe", "Severe allergies only"],
];

// A request marked "no preference" satisfies a volunteer looking for
// either format, so it appears under both filters rather than being
// hidden from both.
export function matchesCakeFormat(value, filter) {
  if (!filter) return true;
  return value === filter || value === "no_preference";
}

export function matchesAllergy(request, filter) {
  if (!filter) return true;
  if (filter === "none") return !request.has_allergies;
  if (filter === "any") return !!request.has_allergies;
  if (filter === "severe") return request.has_allergies && request.allergy_severity === "severe";
  return true;
}

// Case-insensitive match of every whitespace-separated term against the
// combined haystack, so "43215 chocolate" narrows rather than widens.
// Each caller passes the fields that make sense for what it shows.
export function matchesQuery(parts, query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return true;
  const haystack = parts.filter(Boolean).join(" ").toLowerCase();
  return q.split(/\s+/).every((term) => haystack.includes(term));
}

export function sortRequests(rows, sort) {
  const time = (v) => (v ? new Date(v).getTime() : 0);
  const copy = [...rows];
  switch (sort) {
    case "latest":
      return copy.sort((a, b) => time(b.requested_datetime) - time(a.requested_datetime));
    case "newest":
      return copy.sort((a, b) => time(b.created_at) - time(a.created_at));
    case "oldest":
      return copy.sort((a, b) => time(a.created_at) - time(b.created_at));
    case "soonest":
    default:
      return copy.sort((a, b) => time(a.requested_datetime) - time(b.requested_datetime));
  }
}
