// The papers each organism is built on. `use` says what the engine takes from it, `at` points at the code that does it
// (file + a string found on that line), `role` is "model" (equations or numbers in the code) or "background".
// verify.mjs looks every entry up on Crossref / OpenLibrary and writes data/sources.json; nothing here is trusted as typed.
export const SOURCES = [
  { org: "physarum", role: "model", q: "A mathematical model for adaptive transport network in path finding by true slime mold", au: "Tero", year: 2007,
    use: "Kirchhoff pressure solve, flux and the tube adaptation law dD/dt = f(|Q|) − γD", at: ["server/solver.mjs", "Tero, Kobayashi & Nakagaki"] },
  { org: "physarum", role: "background", q: "Maze-solving by an amoeboid organism", au: "Nakagaki", year: 2000,
    use: "The experiment showing a real slime mold finds the shortest path through a maze" },
  { org: "physarum", role: "background", q: "Rules for biologically inspired adaptive network design", au: "Tero", year: 2010,
    use: "Slime mold rebuilds the Tokyo rail network; the same adaptation rule at city scale" },

  { org: "worm", role: "model", q: "Whole-animal connectomes of both Caenorhabditis elegans sexes", au: "Cook", year: 2019,
    use: "The 302-neuron wiring diagram: every chemical synapse and gap junction the worm runs on", at: ["server/league/vendor/worm-brain.mjs", "Cook et al. 2019"] },
  { org: "worm", role: "model", q: "A Drosophila computational brain model reveals sensorimotor processing", au: "Shiu", year: 2024,
    use: "Leaky integrate-and-fire parameters (rest, threshold, time constants). Taken from this fruit-fly whole-brain model, not from a worm paper", at: ["server/league/vendor/worm-brain.mjs", "Shiu et al. 2024"] },
  { org: "worm", role: "background", q: "The structure of the nervous system of the nematode Caenorhabditis elegans", au: "White", year: 1986,
    use: "The first complete map of the worm's nervous system" },

  { org: "fry", role: "model", q: "Ultrasensitive fluorescent proteins for imaging neuronal activity", au: "Chen", year: 2013,
    use: "GCaMP6s calcium kinetics: rise, decay and dF/F ceiling of the simulated sensor", at: ["server/league/vendor/fry-circuit.mjs", "Chen et al. 2013"] },
  { org: "fry", role: "model", q: "The nature and origin of synaptic inputs to vestibulospinal neurons in the larval zebrafish", au: "Hamling", year: 2023, venue: "eneuro",
    use: "Resting voltage, input resistance and rheobase of larval zebrafish neurons, which set rest and threshold", at: ["server/league/vendor/fry-circuit.mjs", "Hamling, Harmon & Schoppik"] },
  { org: "fry", role: "model", q: "Direction selectivity in the larval zebrafish tectum is mediated by asymmetric inhibition", au: "Grama", year: 2012,
    use: "Membrane time constant of larval tectal neurons (21 ± 7 ms)", at: ["server/league/vendor/fry-circuit.mjs", "Grama & Engert 2012"] },
  { org: "fry", role: "model", book: true, q: "The Organization of Behavior", au: "Hebb", year: 1949,
    use: "Hebbian learning: cells that fire together strengthen their synapse", at: ["server/league/vendor/fry-circuit.mjs", "Hebbian synapses"] },
  { org: "fry", role: "background", q: "Whole-brain functional imaging at cellular resolution using light-sheet microscopy", au: "Ahrens", year: 2013,
    use: "Imaging nearly every neuron of a larval zebrafish brain at once" },

  { org: "ant", role: "model", q: "Ant colony system: a cooperative learning approach to the traveling salesman problem", au: "Dorigo", year: 1997,
    use: "Pheromone deposit, evaporation and probabilistic choice", at: ["server/league/orgs.mjs", "Dorigo & Gambardella 1997"] },
  { org: "ant", role: "model", q: "MAX-MIN Ant System Future Generation Computer Systems", au: "Stützle", year: 2000, venue: "future generation", title: "MAX–MIN Ant System",
    use: "Upper and lower bounds on pheromone so no trail dies or dominates for good", at: ["server/league/orgs.mjs", "Stützle & Hoos 2000"] },
  { org: "ant", role: "background", q: "Self-organized shortcuts in the Argentine ant", au: "Goss", year: 1989,
    use: "Real ants pick the shorter bridge through pheromone alone" },

  { org: "bee", role: "model", q: "Group decision making in swarms of honey bees", au: "Seeley", year: 1999,
    use: "Scouts dance in proportion to site quality; recruits follow dances", at: ["server/league/orgs.mjs", "Seeley & Buhrman 1999"] },
  { org: "bee", role: "model", q: "Modeling and analysis of nest-site selection by honeybee swarms: the speed and accuracy trade-off", au: "Passino", year: 2006,
    use: "Dance decay and the quorum threshold that triggers a move", at: ["server/league/orgs.mjs", "Passino & Seeley 2006"] },
  { org: "bee", role: "background", book: true, q: "Honeybee Democracy", au: "Seeley", year: 2010,
    use: "Book-length account of how swarms choose a home" },

  { org: "ecoli", role: "model", q: "Chemotaxis in Escherichia coli analysed by three-dimensional tracking", au: "Berg", year: 1972,
    use: "Run-and-tumble: swim straight, then tumble to a random new heading", at: ["server/league/orgs.mjs", "Berg & Brown 1972"] },
  { org: "ecoli", role: "model", q: "The gradient-sensing mechanism in bacterial chemotaxis", au: "Macnab", year: 1972,
    use: "Temporal comparison: the cell compares food now with a short memory of the past", at: ["server/league/orgs.mjs", "Macnab & Koshland 1972"] },
  { org: "ecoli", role: "background", q: "Physics of chemoreception", au: "Berg", year: 1977,
    use: "Why a cell that small must sense gradients over time, not space" },
];
