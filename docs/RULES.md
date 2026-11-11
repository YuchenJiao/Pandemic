# Rule implementation notes

## Primary sources

- Base game: <https://cdn.svc.asmodee.net/production-zman/uploads/2024/09/Pandemic_Rulebook.pdf>
- On the Brink: <https://cdn.svc.asmodee.net/production-zman/uploads/2024/09/On-the-Brink_Rules_Web.pdf>
- In the Lab: <https://cdn.svc.asmodee.net/production-zman/uploads/2024/09/In-the-Lab_Rules_Web.pdf>
- Map topology: official Bio-Terrorist location sheet, <https://cdn.svc.asmodee.net/production-zman/uploads/2024/09/Bio_Terroist_Location-Sheet.pdf>.
- Sequence component photographs: <https://boardgamegeek.com/image/7726502/pandemic-in-the-lab>, <https://boardgamegeek.com/image/1733910/pandemic-in-the-lab>, <https://boardgamegeek.com/image/1722845/pandemic-in-the-lab>, <https://boardgamegeek.com/image/1785414/pandemic-in-the-lab>.

Official rulebooks were the mechanical reference. Component photographs supplied color-slot counts that the rulebook does not enumerate. The application contains numeric data and original UI only, not the photographic/card artwork.

## Topology

`src/data.js` contains reciprocal adjacency and the unique undirected edge list. The tests verify 48 vertices, 93 edges, 12 cities of each native color, reciprocal routes and the three wrapping routes. Geographic coordinates are original layout coordinates; they do not define movement distance. Every distance uses the route graph.

## Turn windows

| State | Permitted progress |
| --- | --- |
| Actions | Action, legal free ability, event, immediate hand-limit handling, or finish actions |
| Player draw | Draw two together; resolve Mutation events before epidemics; allow a choice between two Mutation events |
| Epidemic infect completed | Resilient Population may intervene; then Intensify |
| Draw effects resolved | Finish hand-limit discards/events before Infection |
| Infection | Resolve one whole infection card and its outbreak chains; allow events between cards |
| Sequence / Forecast / station bonus | Finish the explicit pending decision before normal progress |

Each outbreak chain carries its own visited set. A city can hold three cubes of each color. Growth in the laboratory uses the same physical cube supply as the map; samples, sequence cubes and Field Operative samples are included in conservation checks.

## Sequence card data

Gray means the disease being researched. Pair cards accept either named disease. Wildcard cards accept any of the five diseases; purple eligibility only matters with Mutation enabled.

| Code index (UI number) | Cure eligibility | Required slots |
| --- | --- | --- |
| 0 (1) | Blue | 4 blue |
| 1 (2) | Yellow | 4 yellow |
| 2 (3) | Black | 4 black |
| 3 (4) | Red | 4 red |
| 4 (5) | Blue / Yellow | 2 gray + 1 blue + 3 yellow |
| 5 (6) | Blue / Red | 2 gray + 1 blue + 3 red |
| 6 (7) | Blue / Black | 2 gray + 3 blue + 1 black |
| 7 (8) | Yellow / Red | 2 gray + 1 yellow + 3 red |
| 8 (9) | Yellow / Black | 2 gray + 1 yellow + 3 black |
| 9 (10) | Red / Black | 2 gray + 1 red + 3 black |
| 10 (11) | Any | 2 gray + 4 yellow + 1 red + 1 blue |
| 11 (12) | Any | 2 gray + 4 black + 1 red + 1 yellow |
| 12 (13) | Any | 2 gray + 4 red + 1 blue + 1 black |
| 13 (14) | Any | 2 gray + 4 blue + 1 black + 1 yellow |

The final wildcard was directly checked against component photograph 1785414: four blue printed spots, one yellow printed spot, one black printed spot, and two gray spots. Sequence indices are internal labels, not publisher card numbers. Drawn connecting artwork does not enforce an order for filling slots.

## Implementation choices visible to players

- One human controls two to four ordinary roles for solo play; this is not the distinct CDC variant.
- Roles may be selected in the lobby or dealt randomly. Challenges and expansion cards are separate controls.
- Introductory games show hands; harder games reveal each human's own roles' hands. Conversation about cards is unrestricted, but cards are not automatically disclosed to other humans.
- Card-sharing and other-player movement use explicit consent. A pending consent request locks the room state until accepted or rejected. This replaces verbal table consent.
- The game does not advance timers automatically. Players close each legal event window themselves.
- When replacing a compatible sequence, the UI automatically retains the maximum feasible number of old cubes, preferring strictly matching slots before eradicated-color wildcards. The engine also accepts explicit slot allocation. Normal Process actions expose per-slot allocation in the UI.
- A Mobile Hospital move without an explicitly selected removal color removes the first available color in the fixed color list; the UI lets the player choose the color.

## Validation

`npm test` checks the printed map graph, initial distribution and epidemic stacks; all eight combinations of the three main challenges over 15 seeds each; legal/illegal actions and transactional rejection; all base and expansion roles; mutation placement and victory; Virulent Strain interactions; sample processing, growth exhaustion, characterization/test/cure, second-line opening and replacement; event timing and privacy; server ownership, consent, stale state rejection, SSE updates and persistence across process restart.

These checks are executable evidence for covered scenarios. They are not a claim that every theoretical combination of expansion cards has been manually play-tested. The research files retained alongside this document record the underlying rules investigation.


## Board presentation

The base game rulebook's setup spread establishes the track and deck positions. The Outbreaks Track is vertical on the left, the Infection Deck and Infection Discard Pile are above the map, and the Infection Rate Track progresses from left to right under those decks. The Player Deck, Player Discard Pile, and Discovered Cure Indicators are below the map. The original cure marker's eradication face is represented by the slashed-circle symbol.

Role pawn colors were checked against the base game Role card icons on page 8 and the component illustrations in the On the Brink and In the Lab rulebooks. The three Pacific routes each have two visible edge segments. Their west and east endpoints align across the map seam. The artwork is independently drawn.
