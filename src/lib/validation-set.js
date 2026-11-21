// Fixed validation test set: sample articles with the fields the AI must return.
export const VALIDATION_SET = [
  {
    match: "indocyanine green",
    expected: {
      category: "Potential Reportable Case",
      seriousness: "Serious",
      occurred_in: "Foreign",
      patients: 1,
    },
  },
  {
    match: "hypotension and urticaria",
    expected: {
      category: "Potential Reportable Case",
      seriousness: "Serious",
      occurred_in: "Canada",
      patients: 1,
    },
  },
  {
    match: "two patients",
    expected: {
      category: "Potential Reportable Case",
      seriousness: "Serious",
      patients: 2,
    },
  },
  {
    match: "erupción",
    expected: {
      category: "Potential Reportable Case",
      seriousness: "Serious",
    },
  },
  {
    match: "cutaneous irritation with coal tar",
    expected: {
      category: "Safety Information/Possible Signal",
      patients: 0,
    },
  },
];