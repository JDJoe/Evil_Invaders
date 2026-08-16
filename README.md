# Village Defense – Silly Sniper Edition

A first-person village holdout. You are the sniper. A small squad holds the roads. Waves of ridiculous invaders try to smash the cottages and reach the well.

## Play

Serve the folder (textures load more reliably than from `file://`):

```bash
python3 -m http.server 8000
```

Open http://localhost:8000

## How to play

1. **Deploy** on the title screen.
2. Place your **sniper nest** (blue) and at least **one soldier post** (green). You can mark up to three posts; extras wait for later waves.
3. **Start mission**, click the view to lock the mouse.

### Controls

| Action | Input |
|---|---|
| Look | Mouse |
| Move | WASD |
| Sprint | Shift |
| Fire | Left mouse |
| Scope + charge shot | Hold right mouse, then fire |
| Order soldiers | Click the mini-map |
| Hold posts / clear orders | Right-click the mini-map |
| Rally on you | Q |
| Plant mine | F |
| Mute | M |
| Unlock mouse | Esc |
| Open shop after a wave | Enter or Space |

### The loop

- Regular shots are bolt-action. Headshots (the nose) hit regulars harder. **Tanky** needs **2** hits. **Boss** needs **4**. A charged shot still drops them.
- You get **3 charged shots** per wave. Hold RMB to scope and charge, then fire.
- Hits splat. Invaders yell **“Oy vey.”**
- **Friendly fire costs you:** villager −150, soldier −250. Combo resets.
- Soldiers hold their posts unless you send them. They only shoot nearby targets.
- Squad size follows the wave: **1** soldier while there are fewer than 10 invaders, **2** from 10, **3** from 16.
- Houses sit **beside** the roads. Invaders start wrecking a cottage when they draw level with it (not only at the well). Smashed houses sink.
- When the wave is clear, look around and read the score. Press **Enter** for the shop. Village HP mends a little between waves.
- Shop: repairs, extra charges, medics, hotter ammo, mines, airstrikes.
- A **boss** arrives every 5 waves. He slams the village and **spills 3–4 bean minions** (and can spill again later). The wave is not over until the beans are gone too.
- Crates drop mid-fight: village patches, extra charges, short damage buffs.

### Invaders

| Type | Look | Notes |
|---|---|---|
| Regular | Purple tunic, red nose | 1 hit |
| Sprinty | Magenta, skinny, running | Fast, zig-zags, 1 hit |
| Tanky | Padded shoulders | At least 2 hits |
| Boss | Crown and cape | At least 4 hits; slams; spills beans |
| Bean | Black bean, mad eyes, nappy hair | Spawned by the boss; run like Sprinties; 1 hit |

Do not shoot the villagers (baker, farmer, woman with the basket) or your own squad.

## Files

- `index.html` — UI, HUD, shop, overlays
- `game.js` — world, combat, waves, audio
- `assets/` — sprites and tile textures
- `tools/process_assets.py` — optional chromakey / tile helper
- `EI_winsflag.jpeg` — defeat portrait

Best score is stored in the browser (`localStorage`).

## License

Play it. Don’t let the sideburns reach the well.
