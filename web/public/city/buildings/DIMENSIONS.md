# OrbitX City mega-expansion — building dimensions

Units are meters. Y-up, -Z forward, feet at y=0. All buildings centered at local x=0.
Door = open gap on the **+z face**, local x from → to. `—` = no enclosed door (open plaza).

| file | footprint (w × d) | height | door x from | door x to | notes |
|---|---|---|---|---|---|
| mcorbits.glb | 12 × 8 | 8.4 | -1.2 | 1.2 | red/yellow; golden orbit-ring roof sign (parody rings, not arches); drive-thru window on +x |
| burgerkhan.glb | 10 × 8 | 6.9 | -1.1 | 1.1 | dark blue/orange; flame-grill emissive sign |
| wendas.glb | 10 × 7 | 5.6 | -1.1 | 1.1 | red/white; striped awning; original text sign (no real logo) |
| wallorbit.glb | 24 × 14 | 7.7 | -3 | 3 | big-box blue/yellow; wide glass facade; cart corral on +z |
| bank.glb | 10 × 8 | 6.6 | -1.2 | 1.2 | stone facade; 4 front columns; portico + steps |
| hotel.glb | 11 × 9 | 40.6 | -1.5 | 1.5 | 12-story tower; lit window strips all faces; canopy entrance |
| gasstation.glb | 14 × 16 | 9.3 | -1 | 1 | canopy forecourt at +z; 2 pump islands; mart at back; price pole |
| laundromat.glb | 10 × 6 | 5.1 | -1 | 1 | washer rows visible through storefront glass |
| officetower2.glb | 10 × 10 | 20 | -1.5 | 1.5 | glass block; entry canopy |
| pizzashack.glb | 8 × 6 | 4.8 | -1 | 1 | checkered awning; pizza-disc emblem |
| coffeeshop.glb | 8 × 6 | 5.2 | -1 | 1 | green/white; crescent-moon emblem (parody) |
| plaza.glb | 20 × 20 | 6.0 | — | — | 20×20 plaza; animated fountain (`fountain_water`); orbit-ring statue; 4 benches |

## Props (`web/public/city/props/`)

One shared file each, reused across buildings: tv (`screen`), desk, chair, shelf (stocked),
counter, plant, lamp (shade + emissive `lampbulb`), table, stool, register,
menuboard (emissive `menu`), couch, bed, fridge, grill, fryer, cart, atm, bench,
hydrant, trashcan.

## NPCs (`web/public/city/npcs/`)

cop (dark-blue uniform, cap, emissive badge), copcar (emissive `lightbar_r` / `lightbar_b`),
civilian1/2/3 (varied colors), worker (apron + cap).

## Contractual part names (engine substring search)

- emissive signs → part name contains `sign` or `neon`
- lights → `lampbulb`
- TV/monitor screens → `screen`
- animated → `fountain_water` (plaza fountain)
