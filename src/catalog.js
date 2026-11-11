import { CITIES, COLORS } from "./data.js";

export const ROLES = {
  medic: [
    "Medic",
    "Treat Disease removes all cubes of one color. The Medic automatically removes and prevents cubes of cured diseases in their city.",
  ],
  scientist: [
    "Scientist",
    "Discover a Cure with one fewer matching City card.",
  ],
  researcher: [
    "Researcher",
    "Give any City card to a player in your city with Share Knowledge. In the Lab Challenge, take a free Sequence a Disease action at a research station once per turn.",
  ],
  dispatcher: [
    "Dispatcher",
    "Move other pawns with permission using your own cards, or move a pawn to a city containing another pawn.",
  ],
  operations_expert: [
    "Operations Expert",
    "Build a research station without a City card. Once per turn, discard any City card to move from a research station to any city.",
  ],
  quarantine_specialist: [
    "Quarantine Specialist",
    "Prevent disease cubes and outbreaks in your city and all connected cities.",
  ],
  contingency_planner: [
    "Contingency Planner",
    "Use an action to store one Event card from the Player Discard Pile outside your hand. Remove it from the game after playing it.",
  ],
  archivist: [
    "Archivist",
    "Your hand limit is eight cards. Once per turn, spend an action to retrieve your current City card from the Player Discard Pile.",
  ],
  generalist: ["Generalist", "Take up to five actions per turn."],
  containment_specialist: [
    "Containment Specialist",
    "When you enter a city, remove one cube of each disease that has at least two cubes there.",
  ],
  epidemiologist: [
    "Epidemiologist",
    "Once per turn, take any City card from another player in your city without spending an action. In the Lab Challenge, you can also Process a Sample for free at a research station once per turn.",
  ],
  field_operative: [
    "Field Operative",
    "Once per turn, take one disease cube from your city as a sample for one action. Three samples of a disease can replace two City cards when you Discover a Cure for it.",
  ],
  troubleshooter: [
    "Troubleshooter",
    "At the start of your turn, look at the next Infection cards up to the current infection rate. Reveal the destination City card instead of discarding it for Direct Flight.",
  ],
  field_director: [
    "Field Director",
    "Treat Disease in your city or a connected city. Once per turn, move another pawn in either location one Drive / Ferry connection for free.",
  ],
  virologist: [
    "Virologist",
    "A pair of City cards of the same color can replace a required card when you Discover a Cure. As an action, discard a City card to remove one cube of that color from any city.",
  ],
  local_liaison: [
    "Local Liaison",
    "Once per turn, use an action to give a City card matching your city's color to a player in a city of that color. In the Lab Challenge, take one free Characterize a Disease or Test a Cure action at a research station per turn.",
  ],
  pilot: [
    "Pilot",
    "Fly up to three connections in one action and optionally carry another pawn from the departure city. The Pilot cannot use standard movement actions or Build a Research Station.",
  ],
};
export const BASE_ROLES = Object.keys(ROLES).slice(0, 7);

// Pawn colors follow the components and Role card icons in the three rulebooks.
export const ROLE_PAWN_COLORS = {
  medic: "#f78325",
  scientist: "#f7f7f2",
  researcher: "#9b6744",
  dispatcher: "#da4ca5",
  operations_expert: "#8bc64a",
  quarantine_specialist: "#146448",
  contingency_planner: "#64c6c3",
  archivist: "#508fdb",
  generalist: "#a5a6a5",
  containment_specialist: "#efd4a3",
  epidemiologist: "#ed8a9f",
  field_operative: "#e9e72b",
  troubleshooter: "#dc242c",
  field_director: "#9d0759",
  virologist: "#00ae63",
  local_liaison: "#f3a6cc",
  pilot: "#75cae9",
};

export const EVENTS = {
  airlift: ["Airlift", "Move a pawn to any city with its player's permission."],
  forecast: [
    "Forecast",
    "Look at up to six cards on top of the Infection Deck and reorder them.",
  ],
  government_grant: [
    "Government Grant",
    "Build a research station in any city without spending an action or City card.",
  ],
  one_quiet_night: ["One Quiet Night", "Skip the next Infect Cities step."],
  resilient_population: [
    "Resilient Population",
    "Remove one City card in the Infection Discard Pile from the game.",
  ],
  borrowed_time: [
    "Borrowed Time",
    "The current player takes two extra actions this turn.",
  ],
  commercial_travel_ban: [
    "Commercial Travel Ban",
    "The effective infection rate is one until the current player's next turn.",
  ],
  mobile_hospital: [
    "Mobile Hospital",
    "Remove one disease cube each time a Drive / Ferry move arrives in a city this turn.",
  ],
  new_assignment: [
    "New Assignment",
    "Replace a player's role with an unused role.",
  ],
  rapid_vaccine_deployment: [
    "Rapid Vaccine Deployment",
    "Immediately after Discover a Cure, remove up to five cubes of that disease. If selecting multiple cities, each must connect to another selected city.",
  ],
  reexamined_research: [
    "Re-Examined Research",
    "Return one City card from the Player Discard Pile to a player's hand.",
  ],
  remote_treatment: [
    "Remote Treatment",
    "Remove two disease cubes from the board.",
  ],
  special_orders: [
    "Special Orders",
    "The current player may move one chosen pawn this turn.",
  ],
  infection_zone_ban: [
    "Infection Zone Ban",
    "Ignore chain reaction outbreaks until the start of your next turn.",
  ],
  improved_sanitation: [
    "Improved Sanitation",
    "Remove one additional cube of the same color whenever Treat Disease is used until your next turn.",
  ],
  sequencing_breakthrough: [
    "Sequencing Breakthrough",
    "The next Discover a Cure action requires one fewer City card.",
  ],
};
export const BASE_EVENTS = Object.keys(EVENTS).slice(0, 5);
export const STRAINS = {
  chronic_effect: ["Chronic Effect", true],
  complex_molecular_structure: ["Complex Molecular Structure", true],
  government_interference: ["Government Interference", true],
  rate_effect: ["Rate Effect", true],
  slippery_slope: ["Slippery Slope", true],
  hidden_pocket: ["Hidden Pocket", false],
  unacceptable_loss: ["Unacceptable Loss", false],
  uncounted_populations: ["Uncounted Populations", false],
  highly_contagious: ["Highly Contagious", true],
  resistant_to_treatment: ["Resistant to Treatment", true],
};

export const MUTATION_EVENT_NAMES = {
  threatens: "The Mutation Threatens!",
  spreads: "The Mutation Spreads",
  intensifies: "The Mutation Intensifies!",
};

export const LAB_ACTION_NAMES = {
  characterize: "Characterize a Disease",
  process: "Process a Sample",
  test: "Test a Cure",
  sequence: "Sequence a Disease",
};
const mono = ["blue", "yellow", "black", "red"].map((c) => ({
  eligible: [c],
  slots: Array(4).fill(c),
}));
const pair = (a, n, b, m) => ({
  eligible: [a, b],
  slots: ["gray", "gray", ...Array(n).fill(a), ...Array(m).fill(b)],
});
const wild = (a, b, c) => ({
  eligible: COLORS,
  slots: ["gray", "gray", ...Array(4).fill(a), b, c],
});
export const SEQUENCES = [
  ...mono,
  pair("blue", 1, "yellow", 3),
  pair("blue", 1, "red", 3),
  pair("blue", 3, "black", 1),
  pair("yellow", 1, "red", 3),
  pair("yellow", 1, "black", 3),
  pair("red", 1, "black", 3),
  wild("yellow", "red", "blue"),
  wild("black", "red", "yellow"),
  wild("red", "blue", "black"),
  wild("blue", "black", "yellow"),
].map((s, i) => ({ id: i, ...s }));
export const DISHES = [
  "sample1",
  "sample2",
  "centrifuge",
  "separator",
  "growth",
];

export function cardName(id) {
  if (id === "hidden") return "Hidden card";
  if (CITIES[id]) return CITIES[id].name;
  if (id?.startsWith("event:")) return EVENTS[id.slice(6)]?.[0] ?? id;
  if (id?.startsWith("mutation:"))
    return MUTATION_EVENT_NAMES[id.slice(9)] ?? "Mutation Event";
  if (id?.startsWith("mutation-")) return "Mutation";
  if (id === "epidemic:normal") return "Epidemic";
  if (id?.startsWith("epidemic:"))
    return STRAINS[id.slice(9)]?.[0] ?? "Virulent Strain Epidemic";
  return id ?? "";
}
