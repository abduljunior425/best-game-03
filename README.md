[![make.fun](https://make.fun/badge/best-game-01.svg)](https://make.fun/c/best-game-01)
[![rank](https://make.fun/badge/best-game-01/abduljunior425/best-game-03/rank.svg)](https://make.fun/c/best-game-01)
[![reward](https://make.fun/badge/best-game-01/abduljunior425/best-game-03/reward.svg)](https://make.fun/c/best-game-01)

# Emberhold — Defense of the Last Lantern

A tower-defense game for the [make.fun best-game-01 bounty](https://make.fun/c/best-game-01) ($1,000, escrow). Invaders march the ember road toward the last lantern. Build spires on the stone plots, hold the road, and survive all 12 waves — the final wave brings the Ash Titan.

## How to play

- **Goal:** stop every wave before it reaches the Lantern Core. The Core has 20 HP; if it falls, the light goes out.
- **Build:** click a stone plot, then pick a tower below (or press `1` / `2` / `3`) and click the plot again to build.
  - **Spark Spire** (◆50) — fast bolts, cheap and cheerful.
  - **Frost Obelisk** (◆75) — chills enemies to 55% speed.
  - **Ember Cannon** (◆120) — slow shells with big splash damage.
- **Upgrade & sell:** click one of your towers to see its range, then upgrade it (`U`, up to level 3) or sell it back (`X`, 70% refund).
- **Waves:** press `SPACE` or the SEND WAVE button to start the next wave early (it auto-sends after 12 seconds). Kills pay gold; clearing a wave pays a bonus.
- **Win:** clear wave 12 and the Ash Titan. **Lose:** the Core reaches 0 HP.
- **Other keys:** `P` pause · `M` mute · `R` restart.

## How to run

No build step, no network, no libraries — plain static files.

```sh
node serve.ts
# open http://localhost:8080
```

Or serve `game/` with any static file server and open `game/index.html`. Sound is synthesized with Web Audio (no sound files). Screenshots in `screenshots/` are real frames the game renders itself (`?shot=start|play|clear|end&seed=1`).

## License

MIT — see [LICENSE](LICENSE).
