# Pandemic: In the Lab — implementation research

Primary rule source: https://cdn.svc.asmodee.net/production-zman/uploads/2024/09/In-the-Lab_Rules_Web.pdf
Downloaded exact PDF: research/lab.pdf; raw extraction research/lab-raw.txt.
Official search source ref in agent: turn8search7 / turn23search8. Official rules pages 2–5 and 8.
Publisher product https://www.zmangames.com/game/pandemic-in-the-lab/ (agent ref turn8search0).
Designer primary explanation https://boardgamegeek.com/blog/1/blogpost/21607/designer-preview-pandemic-in-the-lab (agent ref turn23search6; authored Tom Lehmann, expands rationale and CDC).

## Lab setup

Use five dishes: sample 1, sample 2, centrifuge, separator, growth. Shuffle fourteen Sequence cards and reveal one to upper research line. Lower line starts empty. Five cure vials replace markers (purple relevant only when Mutation/Bio-Terrorist). Exclude Field Operative role. Use revised Researcher and Epidemiologist, plus Local Liaison's lab-specific power. Lab works with base alone or other requested challenges; not Team game.

## Actions and dependency order

All four lab actions normally cost one of player's four actions and require that player's pawn at ANY research station. No need to be at a specific station or on a physical lab space. Different players can contribute cards and processing to a shared line.

- Treat Disease remains normal. Of cubes removed by that ONE Treat action, at most ONE may go to either sample dish instead of supply. All others return to supply. Cubes removed by events, Containment Specialist, Virologist, or Medic AUTO ability never become samples. Medic using actual Treat action can take one sample.
- Build Research Station gives builder an immediate optional bonus one lab action for free. Government Grant also gives playing player a bonus lab action, even when new station is in a different city from that player's pawn.
- Characterize a Disease: play City card onto chosen line's characterize space, choose cure matching one of Sequence card's vial icons (normally card color). Purple needs a City card whose city presently has ≥1 purple cube. Set disease cure vial to this line. Can't process cubes onto sequence until characterized. A disease can only belong to ONE line; characterizing same disease on other line moves its vial and closes old line (discard old sequence and character/test city cards; all cubes return supply).
- Process a Sample: move ALL cubes from exactly ONE dish along exactly ONE drawn arrow to a destination. Contents already in destination dish unaffected. Cannot discard arbitrary cubes freely.
  * sample dish → centrifuge: choose ONE color; retain all cubes of this color, return every other moved cube to supply.
  * sample dish → separator: keep ONE cube of EACH color present, return excess moved cubes to supply.
  * centrifuge OR separator → growth: move all source cubes and DOUBLE every moved cube using supply. Insufficient supply is immediate loss.
  * centrifuge OR separator OR growth → ONE characterized sequence: fill empty spots with matching cube colors, one cube each, return unused moved cubes to supply. Never split batch between lines. Gray spots require cure color. A printed spot of an eradicated disease color may take any color. Cubes of eradicated diseases in lab remain usable. Need choose allocations carefully when wildcard/gray competes; UI may need explicit allocation.
- Test a Cure: must have ≥1 cube already on chosen characterized sequence; play City card matching cure color to test space, then remove one cube of cure color from ANY city to supply. For standard purple Mutation any City card; for Worldwide Panic purple, played City card's city must have ≥1 purple cube (can remove a different purple cube elsewhere). No sample from removed cube. Testing need not wait for complete sequence.
- Discover Cure (regular action): line must be characterized + all spots filled + tested. At research station discard THREE cure-color City cards (Scientist TWO). Card count modifiers apply to THREE instead of five. Purple final discards any city colors with NO requirement purple in those cities (characterize/test conditions are separate). Cure vial goes to normal cure indicator; discard sequence AND characterization/test cards and final cure discards; sequence cubes return to supply; draw replacement Sequence to reopen that same line automatically.
- Sequence a Disease: draw one Sequence, reshuffling sequence discards if needed. After viewing choose discard; replace either existing line; or open empty lower line if ≥2 research stations exist. Placing second station does not automatically open lower line: need Sequence action, potentially build's bonus action. If replacement eligible for existing cure vial retain characterization/test and reallocate old cubes onto new card, leftovers supply. If ineligible discard character/test cards, return vial and all cubes supply. Sequence action is optional reroll/opening, NOT mandatory as separate step for initial line which already has a card.

### Rare ending exception
If loss would result from inability to draw needed Player cards AND one or more disease cube colors NEVER appeared in any city during setup/play, players instead win if all other diseases cured. Need persistent everAppeared color set.

## Exact role powers (p8)

Field Director: Treat Disease in connected city instead of own. Once during own turn may move another player's pawn, currently in own city OR connected city, by one Drive/Ferry as free bonus action; needs consent, cannot move Pilot.

Virologist: When Discover Cure may replace one cure-color card with two City cards sharing a color; can use multiple pairs. E.g. 2 yellow +2 blue +3 red cures red normally. As action discard City card to remove one cube matching card color from any city to SUPPLY.

Local Liaison: Once during own turn as action give City card matching own current city's COLOR (not name) to any player in city of that same COLOR. Lab: once own turn at research station free Characterize OR Test.

Pilot: Cannot do normal movement actions (Drive/Ferry or any flights), cannot build research stations. As action fly to any city within ≤3 graph connections, ignoring intermediate cities; may carry ONE other pawn in same starting city with consent. Enter-city powers apply only destination, not skipped cities. If moved by Dispatcher or Special Orders, Pilot uses normal movement actions instead (cannot use pilot flight ability through those). Can use Regional Response Team bonus cards.

Researcher Lab: baseline any-city-card Share Knowledge retained; once own turn at station free Sequence action.

Epidemiologist Lab: baseline once own turn free take any City card from consenting colocated player retained; once own turn at station free Process action.

## Three new events (p2)

Infection Zone Ban: ignore ALL chain-reaction outbreaks until playing player's next turn begins. Initial outbreaks still occur. Cannot be played between revealing and resolving an infection/epidemic card. Place faceup reminder in front of player; not discarded yet; not hand-limit card or Contingency Planner target until expiry.

Improved Sanitation: each Treat Disease action removes ONE additional same-color cube if present, until playing player's next turn begins. Not other cube removal powers. Faceup reminder not yet discard. Even with extra removed cubes one sample maximum per Treat.

Sequencing Breakthrough: next Discover Cure needs ONE fewer City card. Remains faceup near discard until triggered. Purple prerequisite 1/2 cities holding purple still applies outside lab.

## Virulent Strain additions (can include irrespective of Lab challenge)

Two extra epidemic effects shuffle with original eight when using this expansion:
- Highly Contagious (continuing): original virulent outbreak, NOT chain outbreak, adds TWO cubes to EACH connected city. If connected city currently has ≥2 virulent cubes, set to three and do ONE chain outbreak there. Chain outbreak spreads usual one, unless other effects. Need infection-prevention roles/eradication handling.
- Resistant to Treatment (continuing): until strain cured, removing its cubes by Treat requires TWO actions in SAME TURN. Discard effect when cured. Still one Treat action execution for samples etc; role interactions follow card wording.
Other normal modifiers remain; Complex Molecular Structure's +1 means Lab cure final needs four rather than six (Scientist three). Card-count effects modify three.

## Worldwide Panic (optional variant of standard Mutation)

24 purple supply. Replace two old Mutation infection cards by two red-titled cards. During setup also put 1 purple in FIRST drawn city, 2 purple in FOURTH drawn, 3 purple in SEVENTH drawn (in addition to original colored setup cubes). Start 24 total cubes on map, six purple; infection discard holds nine city +2 Mutation cards.

During infection Mutation card places TWO purple instead of one. Purple Discover Cure normally five arbitrary-color City cards, at least TWO of those cities currently contain ≥1 purple cube. With Lab override final cure three arbitrary colors no current-purple prerequisite; characterize still needs one purple city card; Test now also needs purple city card.

When combined with Virulent, purple may become strain (not standard Mutation). If purple Complex Molecular Structure applies, its extra card must be a city with purple outside Lab; Hidden Pocket does nothing; Rate Effect counts drawn Mutation cards.

## Official Solo (p6) if implementing genuine one-role solo rather than multi-hand play

Set up as two players but no pawn for CDC. Before mixing events discard 8/12/14/16 random city cards for easy/standard/heroic/legendary; retry if >6 same color discarded. Four Events, exclude Special Orders. Exclude Dispatcher/Researcher/Epidemiologist/Local Liaison roles. Player four initial cards; CDC four initial cards faceup. One player's normal turn then after infection CDC ONE action. No automatic CDC card/infection draws, no Share Knowledge with CDC.
CDC actions: normal pawn movement with CDC card payments; at station reassign player to chosen unused role, old role removed except New Assignment; at station swap one CDC City card for one player City card matching current city's COLOR; draw one Player card resolve epidemic and CDC handlimit7; or Discover Cure with five CDC cards (when Lab, instead one lab action). CDC events any time. Re-examined Research/Borrowed Time may affect CDC.

## Sequence card component evidence

Rulebook p1 illustrates only four example faces, NOT all 14. Primary component photos can supply exact color bars:
https://boardgamegeek.com/image/7726502/pandemic-in-the-lab — original 3024×4032 photograph of all14 cards fanned, most count bars visible. Downloaded research/7726502-original.jpg; rotated crop research/sequence-stack.png.
https://boardgamegeek.com/image/1733910/pandemic-in-the-lab — high clarity blue/red pair and black wildcard faces (research/1733910.jpg).
https://boardgamegeek.com/image/1722845/pandemic-in-the-lab — blue/yellow pair (research/1722845.jpg).
https://boardgamegeek.com/image/1722846/pandemic-in-the-lab — mono blue (research/1722846.jpg).
Component photos are primary artifacts; use shapes/counts only, do not copy copyrighted artwork.

Observed dataset so far (gray=cure color):
- Four mono: each blue/red/yellow/black has 4 fixed-color slots and sole same-color vial.
- Six pair: 2gray +blue1/yellow3;2gray+blue1/red3;2gray+blue3/black1;2gray+yellow1/red3;2gray+yellow1/black3;2gray+red1/black3. Vial eligibility both corresponding fixed colors. Counts read from visible count strips and full-face examples.
- Four all-five-color-eligible wildcard: 2gray+yellow4+red1+blue1;2gray+black4+red1+yellow1;2gray+red4+blue1+black1; fourth 2gray+blue4+black1+yellow1 (directly confirmed in component photograph 1785414; four blue spots, one black, one yellow, two gray).

Gray/fixed spots do NOT require particular sequential order; drawings' lines are decorative. Only aggregate required colors and eligibility matter mechanically.

Final component check: https://boardgamegeek.com/image/1785414/pandemic-in-the-lab confirms the fourth wildcard. Photographs were used for component counts only; no photographs or publisher artwork are bundled with the app.
