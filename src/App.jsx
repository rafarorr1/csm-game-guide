import { useState } from "react";
const UNITS = {
"Chaos Terminators":{name:"Chaos Terminators",role:"Elite Infantry",stats:{M:'4"',T:5,Sv:"2+",W:3,Ld:"6+",OC:1,InvSv:"4+"},abilities:[{name:"DEEP STRIKE",desc:'Can be set up in Reserves. In the Reinforcements step, set up anywhere 9"+ from all enemy models.'},{name:"VETERANS OF THE LONG WAR",desc:"Each time a model targets an enemy unit with a melee attack, re-roll a Wound roll of 1. If that enemy unit is within range of an objective marker, re-roll the Wound roll instead."},{name:"DARK PACTS",desc:"Before shooting or fighting, make a Dark Pact (roll 2D6 vs Ld — fail = D3 mortal wounds; pass = choose [LETHAL HITS] or [SUSTAINED HITS 1])."}],weapons:[{name:"Combi-bolter",range:'24"',A:2,ws:"3+",S:4,AP:0,D:1,keywords:"[RAPID FIRE 2]"},{name:"Accursed weapon",range:"Melee",A:4,ws:"3+",S:5,AP:-2,D:1,keywords:""},{name:"Power fist (optional)",range:"Melee",A:3,ws:"3+",S:8,AP:-2,D:2,keywords:""},{name:"Chainfist (optional)",range:"Melee",A:3,ws:"3+",S:8,AP:-4,D:2,keywords:"[ANTI-VEHICLE 4+]"}],keywords:["INFANTRY","CHAOS","HERETIC ASTARTES","TERMINATOR"],notes:'Primary Deep Strike hammer. Attach Abaddon or Huron for devastating combat. Land 9"+ from target, charge next turn.'},
"Chosen":{name:"Chosen",role:"Elite Infantry",stats:{M:'6"',T:4,Sv:"3+",W:2,Ld:"6+",OC:1,InvSv:"4+"},abilities:[{name:"CHOSEN MARAUDERS",desc:"This unit is eligible to shoot and declare a charge in a turn in which it Advanced or Fell Back. Built-in — does NOT require REAVERS' HASTE."},{name:"DARK PACTS",desc:"Before shooting or fighting, make a Dark Pact (roll 2D6 vs Ld — fail = D3 mortal wounds; pass = choose [LETHAL HITS] or [SUSTAINED HITS 1])."}],weapons:[{name:"Bolt pistol",range:'12"',A:1,ws:"3+",S:4,AP:0,D:1,keywords:"[PISTOL]"},{name:"Boltgun",range:'24"',A:2,ws:"3+",S:4,AP:0,D:1,keywords:""},{name:"Accursed weapon",range:"Melee",A:4,ws:"3+",S:5,AP:-2,D:1,keywords:""},{name:"Power fist (optional)",range:"Melee",A:3,ws:"3+",S:8,AP:-2,D:2,keywords:""},{name:"Combi-weapon (optional)",range:'24"',A:1,ws:"3+",S:4,AP:0,D:1,keywords:"[RAPID FIRE 1], [ANTI-INFANTRY 4+]"}],keywords:["INFANTRY","CHAOS","HERETIC ASTARTES","CHOSEN"],notes:"CHOSEN MARAUDERS: advance+charge is built-in. Use REAVERS' HASTE only for the +1 charge roll near an objective, or when Chaos Lord is not attached. Ride in Rhino, disembark before it moves."},
"Obliterators":{name:"Obliterators",role:"Heavy Infantry",stats:{M:'4"',T:8,Sv:"2+",W:4,Ld:"6+",OC:1,InvSv:"4+"},abilities:[{name:"DEEP STRIKE",desc:'Can be set up in Reserves. Set up anywhere 9"+ from all enemy models.'},{name:"WARP RIFT FIREPOWER",desc:"Once per battle, during the Shooting phase, this unit can use this ability. If it does, until the end of the phase, ranged weapons models in this unit are equipped with have the [INDIRECT FIRE] ability."},{name:"DARK PACTS",desc:"Before shooting or fighting, make a Dark Pact (roll 2D6 vs Ld — fail = D3 mortal wounds; pass = choose [LETHAL HITS] or [SUSTAINED HITS 1])."}],weapons:[{name:"Fleshmetal guns - focused malice",range:'18"',A:"D3",ws:"3+",S:12,AP:-3,D:4,keywords:"[MELTA 2]"},{name:"Fleshmetal guns - ruinous salvo",range:'24"',A:"D6",ws:"3+",S:8,AP:-2,D:2,keywords:"[BLAST]"},{name:"Fleshmetal guns - warp hail",range:'24"',A:"D6+3",ws:"3+",S:5,AP:-1,D:1,keywords:"[SUSTAINED HITS 1]"},{name:"Crushing fists",range:"Melee",A:4,ws:"3+",S:9,AP:-2,D:2,keywords:""}],keywords:["INFANTRY","CHAOS","HERETIC ASTARTES","DAEMON","OBLITERATORS"],notes:'T8 with 4++ — very durable. Deep Strike near a contested objective. Focused malice at 18" destroys vehicles. M4" means they must Deep Strike into position.'},
"Forgefiend":{name:"Forgefiend",role:"Monster / Heavy Support",stats:{M:'8"',T:9,Sv:"3+",W:12,Ld:"6+",OC:3,InvSv:"5+"},abilities:[{name:"DAEMONIC ORDNANCE",desc:"Each time this model shoots and is not within Engagement Range of any enemy, it can fire all Ectoplasma cannons. Each fires separately."},{name:"DEADLY DEMISE D3",desc:"When destroyed, roll D6 before removing. On a 6, each unit within 6\" suffers D3 mortal wounds."},{name:"DARK PACTS",desc:"Before shooting or fighting, make a Dark Pact (roll 2D6 vs Ld — fail = D3 mortal wounds; pass = choose [LETHAL HITS] or [SUSTAINED HITS 1])."}],weapons:[{name:"Ectoplasma cannon (standard)",range:'36"',A:1,ws:"3+",S:7,AP:-2,D:3,keywords:"[BLAST], [HAZARDOUS]"},{name:"Ectoplasma cannon (supercharge)",range:'36"',A:1,ws:"3+",S:8,AP:-3,D:4,keywords:"[BLAST], [HAZARDOUS]"},{name:"Hades autocannon",range:'36"',A:6,ws:"3+",S:9,AP:-1,D:3,keywords:""},{name:"Forgefiend maw",range:"Melee",A:3,ws:"4+",S:8,AP:-1,D:2,keywords:""}],keywords:["MONSTER","CHAOS","HERETIC ASTARTES","DAEMON","DAEMON ENGINE","FORGEFIEND"],notes:"Has HERETIC ASTARTES — benefits from RAIDERS AND REAVERS +1AP and [ASSAULT] on ranged weapons. Three Ectoplasma cannons via DAEMONIC ORDNANCE. Never charge unless desperate."},
"Rhino":{name:"Chaos Rhino",role:"Dedicated Transport",stats:{M:'12"',T:9,Sv:"3+",W:10,Ld:"6+",OC:2,InvSv:"—"},abilities:[{name:"TRANSPORT",desc:"Capacity: 12 HERETIC ASTARTES INFANTRY models. Cannot transport TERMINATOR, JUMP PACK, OBLITERATOR or POSSESSED models."},{name:"SELF REPAIR",desc:"At the start of your Command phase, this model regains 1 lost wound."},{name:"DEADLY DEMISE D3",desc:"When destroyed, roll D6 before removing. On a 6, each unit within 6\" suffers D3 mortal wounds."},{name:"FIRING DECK 2",desc:"Core ability — up to 2 models embarked on this transport can shoot in the Shooting phase."},{name:"DARK PACTS",desc:"Faction ability."} ],weapons:[{name:"Combi-bolter",range:'24"',A:2,ws:"3+",S:4,AP:0,D:1,keywords:"[RAPID FIRE 2]"},{name:"Combi-weapon",range:'24"',A:1,ws:"4+",S:4,AP:0,D:1,keywords:"[ANTI-INFANTRY 4+], [DEVASTATING WOUNDS], [RAPID FIRE 1]"},{name:"Havoc launcher",range:'48"',A:"D6",ws:"3+",S:5,AP:0,D:1,keywords:"[BLAST]"}],keywords:["VEHICLE","CHAOS","HERETIC ASTARTES","CHAOS RHINO","TRANSPORT"],notes:"Has HERETIC ASTARTES — benefits from DARK PACTS and RAIDERS AND REAVERS. SELF REPAIR regains 1 wound per Command phase. Always disembark passengers BEFORE the Rhino moves."},
"Legionaries":{name:"Legionaries",role:"Battleline Infantry",stats:{M:'6"',T:4,Sv:"3+",W:2,Ld:"6+",OC:2,InvSv:"—"},abilities:[{name:"VETERANS OF THE LONG WAR",desc:"Each time a model targets an enemy unit with a melee attack, re-roll a Wound roll of 1. If that enemy unit is within range of an objective, re-roll the Wound roll instead."},{name:"DARK PACTS",desc:"Before shooting or fighting, make a Dark Pact (roll 2D6 vs Ld — fail = D3 mortal wounds; pass = choose [LETHAL HITS] or [SUSTAINED HITS 1])."}],weapons:[{name:"Boltgun",range:'24"',A:2,ws:"3+",S:4,AP:0,D:1,keywords:"[RAPID FIRE 1]"},{name:"Bolt pistol",range:'12"',A:1,ws:"3+",S:4,AP:0,D:1,keywords:"[PISTOL]"},{name:"Astartes chainsword",range:"Melee",A:4,ws:"3+",S:4,AP:-1,D:1,keywords:""},{name:"Plasma gun (standard)",range:'24"',A:1,ws:"3+",S:7,AP:-2,D:1,keywords:"[RAPID FIRE 1]"},{name:"Plasma gun (supercharge)",range:'24"',A:1,ws:"3+",S:8,AP:-3,D:2,keywords:"[RAPID FIRE 1], [HAZARDOUS]"}],keywords:["INFANTRY","CHAOS","HERETIC ASTARTES","LEGIONARIES"],notes:"OC 2 makes these excellent objective holders. All ranged weapons gain [ASSAULT] from detachment. Sticky objectives with RENEGADE CLAIM (1CP)."},
"Possessed":{name:"Possessed",role:"Elite Infantry / Fast Assault",stats:{M:'9"',T:6,Sv:"3+",W:3,Ld:"6+",OC:1,InvSv:"5+"},abilities:[{name:"UNHOLY BLOODSHED",desc:"Once per battle, when this unit makes a Dark Pact, until end of phase all weapons equipped by models in this unit gain [DEVASTATING WOUNDS]."},{name:"DARK PACTS",desc:"Before shooting or fighting, make a Dark Pact (roll 2D6 vs Ld — fail = D3 mortal wounds; pass = choose [LETHAL HITS] or [SUSTAINED HITS 1])."},{name:"CHAOS ICON (Wargear)",desc:"Each time the bearer's unit takes a Leadership test for the Dark Pacts ability, you can re-roll that test."}],weapons:[{name:"Hideous mutations",range:"Melee",A:4,ws:"3+",S:5,AP:-1,D:2,keywords:""}],keywords:["INFANTRY","CHAOS","HERETIC ASTARTES","POSSESSED","DAEMON"],notes:'T6 with 5++. UNHOLY BLOODSHED once per battle gives [DEVASTATING WOUNDS] — save for a decisive fight. 9" move + SCOUTS 6" from Chaos Lord = excellent threat range.'},
"Vindicator":{name:"Chaos Vindicator",role:"Vehicle / Heavy Support",stats:{M:'9"',T:11,Sv:"2+",W:11,Ld:"6+",OC:3,InvSv:"—"},abilities:[{name:"SIEGE SHIELD",desc:"When making ranged attacks with its demolisher cannon, this model can target enemy units within Engagement Range of it (provided no other friendly units are also within Engagement Range of that enemy unit). In addition, when making ranged attacks, this model does not suffer the penalty to its Hit rolls for being within Engagement Range of one or more enemy units."},{name:"DEADLY DEMISE D3",desc:"When destroyed, roll D6 before removing. On a 6, each unit within 6\" suffers D3 mortal wounds."},{name:"DAMAGED: 1-4 WOUNDS REMAINING",desc:"While this model has 1-4 wounds remaining, each time this model makes an attack, subtract 1 from the Hit roll."},{name:"DARK PACTS",desc:"Faction ability."}],weapons:[{name:"Combi-bolter",range:'24"',A:2,ws:"3+",S:4,AP:0,D:1,keywords:"[RAPID FIRE 2]"},{name:"Combi-weapon",range:'24"',A:1,ws:"4+",S:4,AP:0,D:1,keywords:"[ANTI-INFANTRY 4+], [DEVASTATING WOUNDS], [RAPID FIRE 1]"},{name:"Demolisher cannon",range:'24"',A:"D6+3",ws:"3+",S:14,AP:-3,D:"D6",keywords:"[BLAST]"},{name:"Havoc launcher",range:'48"',A:"D6",ws:"3+",S:5,AP:0,D:1,keywords:"[BLAST]"}],keywords:["VEHICLE","CHAOS","HERETIC ASTARTES","CHAOS VINDICATOR"],notes:"M corrected to 9\", Sv corrected to 2+. Has HERETIC ASTARTES — benefits from DARK PACTS and RAIDERS AND REAVERS. SIEGE SHIELD lets it fire demolisher cannon even in Engagement Range. Pure fire support, never charge."},
"Cultist Mob":{name:"Cultist Mob",role:"Battleline Infantry (Huron Build)",stats:{M:'6"',T:3,Sv:"6+",W:1,Ld:"8+",OC:1,InvSv:"—"},abilities:[{name:"FOR THE DARK GODS",desc:"At end of your Command phase, if this unit is within range of an objective you control, that objective remains under your control even with no models on it — until opponent controls it."},{name:"DARK PACTS",desc:"Ld 8+ makes failing very likely — avoid making Dark Pacts with Cultists."}],weapons:[{name:"Autogun",range:'24"',A:1,ws:"4+",S:3,AP:0,D:1,keywords:"[RAPID FIRE 1]"},{name:"Autopistol",range:'12"',A:1,ws:"4+",S:3,AP:0,D:1,keywords:"[PISTOL]"},{name:"Brutal assault weapon",range:"Melee",A:2,ws:"4+",S:3,AP:0,D:1,keywords:""}],keywords:["INFANTRY","CHAOS","HERETIC ASTARTES","CULTIST MOB","DAMNED"],notes:"FOR THE DARK GODS is always-on sticky — just be on the objective at end of Command phase, no CP needed. DAMNED keyword: do NOT benefit from Abaddon's Warmaster auras. Use purely as objective campers."},
};
const CHARACTERS = {
"Abaddon":{fullName:"Abaddon the Despoiler",faction:"HERETIC ASTARTES",role:"Warlord · Epic Hero · Supreme Commander",stats:{M:'5"',T:5,Sv:"2+",W:9,Ld:"5+",OC:4,InvSv:"4+"},abilities:[{name:"THE WARMASTER",desc:"In your Command phase, select one Warmaster ability until your next Command phase: (1) PARAGON OF HATRED — re-roll Hit rolls for HERETIC ASTARTES within 6\". (2) MARK OF CHAOS ASCENDANT — 4+ invuln for HERETIC ASTARTES INFANTRY/MOUNTED within 6\". (3) LORD OF THE TRAITOR LEGIONS — re-roll Leadership and Battle-shock tests for HERETIC ASTARTES within 6\"."},{name:"DARK DESTINY",desc:"Each time this model's unit makes a Dark Pact and does not fail the Leadership test, if the result was 7+, gain 1CP."},{name:"LORD OF CHAOS",desc:"Once per battle round, when Abaddon's unit is targeted by a Stratagem, reduce the CP cost by 1."},{name:"DEEP STRIKE",desc:'Can be set up in Reserves. Set up anywhere 9"+ from all enemy models in your Reinforcement step.'},{name:"SUPREME COMMANDER",desc:"Must be your Warlord."},{name:"LEADER",desc:"Can be attached to: Chaos Terminator Squad only."}],weapons:[{name:"Talon of Horus (ranged)",range:'24"',A:4,ws:"2+",S:5,AP:-1,D:2,keywords:"[SUSTAINED HITS 1]"},{name:"Drach'nyen",range:"Melee",A:8,ws:"2+",S:14,AP:-4,D:3,keywords:"[DEVASTATING WOUNDS]"},{name:"Talon of Horus (melee)",range:"Melee",A:14,ws:"2+",S:7,AP:-3,D:1,keywords:"[DEVASTATING WOUNDS]"}],keywords:["CHARACTER","INFANTRY","EPIC HERO","TERMINATOR","CHAOS UNDIVIDED","HERETIC ASTARTES","ABADDON THE DESPOILER"]},
"Huron Blackheart":{fullName:"Huron Blackheart",faction:"HERETIC ASTARTES · RED CORSAIRS",role:"Warlord · Epic Hero",stats:{M:'6"',T:4,Sv:"3+",W:5,Ld:"6+",OC:1,InvSv:"4+"},abilities:[{name:"THE TYRANT OF BADAB",desc:"While this model is leading a unit, add 1 to the OC of models in that unit."},{name:"RED CORSAIRS",desc:"After both players deploy, select up to 3 HERETIC ASTARTES INFANTRY units and redeploy them. Can place into Strategic Reserves regardless of limit."},{name:"HAMADRYA'S KNOWLEDGE (Psychic)",desc:'Once per battle, when an enemy unit ends a Normal, Advance or Fall Back move within 9" of this model\'s unit and not in Engagement Range, this unit can make a Normal move of up to D6".'},{name:"LORD OF CHAOS",desc:"Once per battle round, when this model's unit is targeted by a Stratagem, reduce the CP cost by 1."},{name:"LEADER",desc:"Can be attached to: Chosen, Legionaries."}],weapons:[{name:"Tyrant's Claw (shooting)",range:'12"',A:"D6",ws:"N/A",S:5,AP:-1,D:1,keywords:"[PISTOL], [TORRENT], [IGNORES COVER]"},{name:"Tyrant's Claw (melee)",range:"Melee",A:5,ws:"2+",S:8,AP:-2,D:3,keywords:""},{name:"Exalted weapon",range:"Melee",A:4,ws:"2+",S:5,AP:-2,D:2,keywords:""}],keywords:["CHARACTER","INFANTRY","EPIC HERO","CHAOS UNDIVIDED","HERETIC ASTARTES","HURON BLACKHEART"]},
"Chaos Lord":{fullName:"Chaos Lord",faction:"HERETIC ASTARTES",role:"Character · Enhancement: Mark of the Hound",stats:{M:'6"',T:4,Sv:"3+",W:4,Ld:"6+",OC:1,InvSv:"4+"},abilities:[{name:"LORD OF CHAOS",desc:"Once per battle round, when this model's unit is targeted by a Stratagem, reduce the CP cost by 1."},{name:"MARK OF THE HOUND (Enhancement)",desc:'This model gains SCOUTS 6" — before Turn 1, this unit makes a Normal move of up to 6".'},{name:"VETERAN OF THE LONG WAR",desc:"While leading a unit, each time a model in that unit makes an attack, re-roll a Hit roll of 1."},{name:"LEADER",desc:"Can be attached to: Legionaries, Chosen, Possessed, Chaos Terminator Squad, Cultist Mob, Accursed Cultists."}],weapons:[{name:"Bolt pistol",range:'12"',A:1,ws:"3+",S:4,AP:0,D:1,keywords:"[PISTOL]"},{name:"Combi-weapon",range:'24"',A:1,ws:"3+",S:4,AP:0,D:1,keywords:"[RAPID FIRE 1], [ANTI-INFANTRY 4+]"},{name:"Thunder hammer",range:"Melee",A:4,ws:"3+",S:8,AP:-2,D:2,keywords:"[DEVASTATING WOUNDS]"}],keywords:["CHARACTER","INFANTRY","GRENADES","CHAOS","HERETIC ASTARTES","CHAOS LORD"]},
"Master of Executions":{fullName:"Master of Executions",faction:"HERETIC ASTARTES",role:"Character · Melee Specialist",stats:{M:'6"',T:4,Sv:"3+",W:4,Ld:"6+",OC:1,InvSv:"4+"},abilities:[{name:"WARP-SIGHTED BUTCHER",desc:"While leading a unit, each time a model makes a melee attack targeting a unit below its Starting Strength, re-roll the Hit roll. If also Below Half-strength, re-roll the Wound roll as well."},{name:"TROPHY TAKER",desc:"Each time this model destroys an enemy CHARACTER, gain 1CP."},{name:"LORD OF CHAOS",desc:"Once per battle round, when this model's unit is targeted by a Stratagem, reduce the CP cost by 1."},{name:"LEADER",desc:"Can be attached to: Legionaries, Chosen, Cultist Mob, Accursed Cultists."}],weapons:[{name:"Bolt pistol",range:'12"',A:1,ws:"3+",S:4,AP:0,D:1,keywords:"[PISTOL]"},{name:"Axe of dismemberment",range:"Melee",A:4,ws:"3+",S:6,AP:-2,D:3,keywords:"[DEVASTATING WOUNDS]"}],keywords:["CHARACTER","INFANTRY","GRENADES","CHAOS","HERETIC ASTARTES","MASTER OF EXECUTIONS"]},
"Cypher":{fullName:"Cypher",faction:"CHAOS · FALLEN",role:"Epic Hero · Lone Operative",stats:{M:'6"',T:4,Sv:"3+",W:5,Ld:"6+",OC:1,InvSv:"4+"},abilities:[{name:"AGENT OF DISCORD (Aura)",desc:'Each time your opponent targets a unit within 12" of this model with a Stratagem, increase the cost by 1CP.'},{name:"GUNS BLAZING",desc:"Once per turn, in your opponent's Shooting phase, when an enemy unit targets a friendly HERETIC ASTARTES unit within 3\" of this model, after that enemy unit has shot, Cypher can shoot back at that unit."},{name:"LONE OPERATIVE",desc:'Unless part of an Attached unit, can only be targeted by ranged attacks if the attacking model is within 12".'}],weapons:[{name:"Cypher's plasma pistol (standard)",range:'12"',A:3,ws:"2+",S:7,AP:-2,D:1,keywords:"[PISTOL]"},{name:"Cypher's plasma pistol (supercharge)",range:'12"',A:3,ws:"2+",S:8,AP:-3,D:2,keywords:"[PISTOL], [HAZARDOUS]"},{name:"Cypher's bolt pistol",range:'12"',A:4,ws:"2+",S:4,AP:0,D:1,keywords:"[PISTOL]"}],keywords:["CHARACTER","INFANTRY","EPIC HERO","CHAOS","FALLEN","CYPHER","LONE OPERATIVE"]},
};
const GLOSSARY = {
"[ASSAULT]":{cat:"Keyword",def:"Ranged weapons with this keyword can be used even if the bearer's unit Advanced this turn, with no penalty to hit."},
"[LETHAL HITS]":{cat:"Keyword",def:"Critical Hits (unmodified 6 to hit) automatically wound — no wound roll needed."},
"[SUSTAINED HITS 1]":{cat:"Keyword",def:"Each Critical Hit (unmodified 6 to hit) generates 1 additional hit."},
"[PRECISION]":{cat:"Keyword",def:"Critical Hits can be allocated to a CHARACTER in the target unit, even if not the closest model."},
"[HAZARDOUS]":{cat:"Keyword",def:"After shooting/fighting, roll one D6 per weapon. On a 1, a model suffers 3 mortal wounds (allocate to a CHARACTER first)."},
"[DEVASTATING WOUNDS]":{cat:"Keyword",def:"Critical Wounds (unmodified 6 to wound) cause mortal wounds equal to the weapon's Damage. Bypasses saves entirely."},
"[RAPID FIRE 1]":{cat:"Keyword",def:"If the target is within half the weapon's range, add 1 to the Attacks characteristic."},
"[RAPID FIRE 2]":{cat:"Keyword",def:"If the target is within half the weapon's range, add 2 to the Attacks characteristic."},
"[TORRENT]":{cat:"Keyword",def:"This weapon automatically hits — no Hit roll is made."},
"[BLAST]":{cat:"Keyword",def:"Add 1 to the Attacks for every 5 models in the target unit. Cannot target units within Engagement Range."},
"[EXTRA ATTACKS]":{cat:"Keyword",def:"Attacks made with this weapon are in addition to any other melee weapons the model is equipped with."},
"[MELTA 2]":{cat:"Keyword",def:"If the target is within half this weapon's range, improve the Damage characteristic by 2."},
"DARK PACTS":{cat:"Army Rule",def:"Before any HERETIC ASTARTES unit shoots or fights, roll 2D6 vs Ld. Fail = D3 mortal wounds. Pass = choose [LETHAL HITS] or [SUSTAINED HITS 1]."},
"DARK DESTINY":{cat:"Army Rule",def:"Each time Abaddon's unit makes a Dark Pact and does not fail the Leadership test, if the result was 7+, gain 1CP."},
"THE WARMASTER":{cat:"Ability (Abaddon)",def:'Mandatory Command phase selection: (1) PARAGON OF HATRED, (2) MARK OF CHAOS ASCENDANT, or (3) LORD OF THE TRAITOR LEGIONS.'},
"PARAGON OF HATRED":{cat:"Ability (Abaddon)",def:'Re-roll Hit rolls for HERETIC ASTARTES within 6" of Abaddon. Active in both Shooting AND Fight phases.'},
"MARK OF CHAOS ASCENDANT":{cat:"Ability (Abaddon)",def:'Friendly HERETIC ASTARTES INFANTRY or MOUNTED within 6" get a 4+ invulnerable save.'},
"LORD OF THE TRAITOR LEGIONS":{cat:"Ability (Abaddon)",def:'Re-roll Battle-shock and Leadership tests for HERETIC ASTARTES within 6" of Abaddon.'},
"LORD OF CHAOS":{cat:"Ability",def:"Once per battle round, when THIS MODEL'S UNIT is targeted with a Stratagem, reduce the CP cost by 1."},
"AGENT OF DISCORD":{cat:"Ability (Cypher)",def:'Aura (12"): each time opponent targets a unit within 12" of Cypher with a Stratagem, increase the cost by 1CP.'},
"THE TYRANT OF BADAB":{cat:"Ability (Huron)",def:"While Huron is leading a unit, add 1 to the OC of models in that unit."},
"RED CORSAIRS":{cat:"Ability (Huron)",def:"After deployment, redeploy up to 3 HERETIC ASTARTES INFANTRY units into Strategic Reserves regardless of limit."},
"WARP-SIGHTED BUTCHER":{cat:"Ability (Masters)",def:"Re-roll Hit rolls vs units below Starting Strength. Re-roll Wound rolls vs units Below Half-strength."},
"TROPHY TAKER":{cat:"Ability (Masters)",def:"Each time this model destroys an enemy CHARACTER, gain 1CP."},
"FOR THE DARK GODS":{cat:"Ability",def:"At end of Command phase, if this unit is on an objective you control, it stays under your control even with no models on it — until opponent controls it."},
"UNHOLY BLOODSHED":{cat:"Ability",def:"Once per battle, when Possessed makes a Dark Pact, all their weapons gain [DEVASTATING WOUNDS] until end of phase."},
"CHOSEN MARAUDERS":{cat:"Ability",def:"Chosen can shoot and charge in a turn they Advanced or Fell Back. Built-in — does not require REAVERS' HASTE."},
"RAIDERS AND REAVERS":{cat:"Detachment Rule",def:"(1) All HERETIC ASTARTES ranged weapons gain [ASSAULT]. (2) All attacks near objective markers by HERETIC ASTARTES get +1 AP."},
"UNFAILINGLY OBDURATE":{cat:"Stratagem — 1CP",def:"Opponent's Shooting or Fight phase. One HERETIC ASTARTES unit: worsen AP of all incoming attacks by 1."},
"SCOUR AND SEIZE":{cat:"Stratagem — 1CP",def:"Fight phase. One HERETIC ASTARTES unit that hasn't fought: all attacks near an objective gain [PRECISION]."},
"OPPORTUNISTIC RAIDERS":{cat:"Stratagem — 1CP",def:'End of Fight phase. One HERETIC ASTARTES unit not in Engagement Range: free 6" Normal move (12" if MOUNTED).'},
"WARPCHARGED ENGINES":{cat:"Stratagem — 1CP",def:'Your Movement phase. One HERETIC ASTARTES TRANSPORT or MOUNTED unit: add 6" flat to Move instead of rolling Advance. Rhino = 18".'},
"RUINOUS RAID":{cat:"Stratagem — 1CP",def:"Your Shooting or Fight phase. One HERETIC ASTARTES unit that disembarked from a Transport this turn: re-roll ALL Hit rolls AND Wound rolls near an objective."},
"REAVERS' HASTE":{cat:"Stratagem — 1CP",def:"Your Charge phase. One HERETIC ASTARTES INFANTRY or MOUNTED unit: charge even if it Advanced. +1 to Charge roll if target is near an objective. Note: Chosen have CHOSEN MARAUDERS built-in and don't need this to advance+charge."},
"RENEGADE CLAIM":{cat:"Stratagem — 1CP",def:"Your Movement phase. One HERETIC ASTARTES unit on an objective you control: sticky objective until opponent's OC exceeds yours."},
"RAPID INGRESS":{cat:"Stratagem — 1CP (Core)",def:'End of opponent\'s Movement phase. One unit in Strategic Reserves: set up anywhere 9"+ from enemies.'},
"UNDYING HATRED":{cat:"Stratagem — 1CP",def:"Enemy ends a charge into your HERETIC ASTARTES unit. Each model destroyed before it fights can fight on a 4+ before removal."},
"COUNTER-OFFENSIVE":{cat:"Stratagem — 2CP (Core)",def:"After an enemy unit finishes fighting, immediately select one of your units in Engagement Range — that unit fights next."},
"FIRE OVERWATCH":{cat:"Stratagem — 1CP (Core)",def:"When an enemy unit is set up or moves within 24\" of one of your units: shoot at that enemy unit as if it were your Shooting phase."},
"SMOKESCREEN":{cat:"Stratagem — 1CP",def:"Start of opponent's Shooting phase. One SMOKE LAUNCHERS model: ranged attacks subtract 1 from Hit rolls against it until end of phase. Once per battle per model."},
"GO TO GROUND":{cat:"Stratagem — 1CP (Core)",def:"When an enemy unit targets one of your INFANTRY with ranged attacks: until end of phase, that unit has a 6+ invulnerable save AND gains BENEFIT OF COVER."},
'SCOUTS 6"':{cat:"Ability",def:'Before Turn 1 starts, this unit makes a 6" Normal move. From Mark of the Hound on the Chaos Lord.'},
"DEEP STRIKE":{cat:"Ability",def:'Unit set up in Reserves. In your Reinforcement step, place anywhere 9"+ from all enemy models.'},
"LONE OPERATIVE":{cat:"Ability",def:'While fewer than 2 models, can only be targeted by ranged attacks if the attacking model is within 12".'},
"BATTLE-SHOCKED":{cat:"Game State",def:"Failed Battle-shock test: OC drops to 0, controlling player cannot use Stratagems on it. Until start of your next Command phase."},
"MORTAL WOUNDS":{cat:"Rule",def:"Each mortal wound inflicts 1 point of damage directly, bypassing hit rolls, wound rolls, and saving throws."},
"ENGAGEMENT RANGE":{cat:"Rule",def:"Within 1\" horizontally and 5\" vertically of an enemy model."},
"COMMAND POINT (CP)":{cat:"Rule",def:"Strategic resource. Both players gain 1CP per Command phase. Spent to use Stratagems."},
"HERETIC ASTARTES":{cat:"Keyword",def:"Primary faction keyword for Raiders and Reavers benefits. Rhinos and Vindicator are NOT HERETIC ASTARTES."},
"OBJECTIVE CONTROL (OC)":{cat:"Rule",def:"Each model has an OC value. The player with greater total OC on an objective controls it. Battle-shocked units have OC 0."},
};
const CAT_COLORS = {"Army Rule":"#4ade80","Detachment Rule":"#f87171","Keyword":"#3b82f6","Ability":"#a855f7","Ability (Abaddon)":"#e879f9","Ability (Huron)":"#34d399","Ability (Cypher)":"#e879f9","Ability (Masters)":"#34d399","Stratagem — 1CP":"#f59e0b","Stratagem — 1CP (Core)":"#d97706","Stratagem — 2CP (Core)":"#ef4444","Game State":"#ef4444","Rule":"#6b7280"};
const CHAR_ALIASES = {"Abaddon":["Abaddon the Despoiler","Abaddon"],"Huron Blackheart":["Huron Blackheart","Huron"],"Chaos Lord":["Chaos Lord"],"Master of Executions":["Master of Executions","Garreon","Masters"],"Cypher":["Cypher"]};
const UNIT_ALIASES = {"Chaos Terminators":["Chaos Terminators","Chaos Terminator Squad","Chaos Terminator Squad #1","Chaos Terminator Squad #2","Terminators"],"Chosen":["Chosen"],"Obliterators":["Obliterators"],"Forgefiend":["Forgefiend"],"Rhino":["Chaos Rhino","Rhino","Rhino #1","Rhino #2"],"Legionaries":["Legionaries"],"Possessed":["Possessed"],"Vindicator":["Chaos Vindicator","Vindicator"],"Cultist Mob":["Cultist Mob","Cultist Mobs"]};
const DEPLOYMENT = {
abaddon:{
first:[
'SET RESERVES: Abaddon + Chaos Terminators #1, Chaos Terminators #2, and Obliterators all go into Strategic Reserves (Deep Strike)',
'DEPLOY RHINO #1 centrally — it will rush forward Turn 1. Chosen + Chaos Lord deploy inside',
'DEPLOY RHINO #2 on a flank with Legionaries inside',
'DEPLOY FORGEFIEND: back field with clear sight lines to midboard. It advances and shoots Turn 1',
'DEPLOY VINDICATOR: behind cover, angled toward dense enemy infantry',
'DEPLOY POSSESSED: off to a flank. Chaos Lord is with them for SCOUTS 6"',
'SCOUTS 6" (Chosen + Chaos Lord): after all deployment, move Chosen + Chaos Lord 6" forward',
'Going first — push up aggressively. Rhino rushes midboard Turn 1. Abaddon drops Turn 2.',
],
second:[
'SET RESERVES: Abaddon + Chaos Terminators #1, Chaos Terminators #2, and Obliterators all go into Strategic Reserves',
'DEPLOY RHINO #1: hold slightly further back — opponent shoots first, don\'t over-expose it',
'DEPLOY RHINO #2 + Legionaries: anchor your home objectives, don\'t over-commit Turn 1',
'DEPLOY FORGEFIEND: back field with clear sight lines — shoots during YOUR Turn 1 after seeing their move',
'DEPLOY VINDICATOR: behind cover. You shoot after them, so position carefully',
'DEPLOY POSSESSED: keep behind cover — they charge on YOUR Turn 1 after seeing opponent\'s position',
'SCOUTS 6" (Chosen + Chaos Lord): move 6" cautiously — opponent moves and shoots before you',
'Going second — watch for FIRE OVERWATCH (1CP) and UNDYING HATRED (1CP) during their Turn 1. Score on YOUR Turn 1 after seeing everything.',
],
},
huron:{
first:[
'SET RESERVES: Huron Blackheart + Chaos Terminators #1, Chaos Terminators #2, and Obliterators into Strategic Reserves',
'DEPLOY RHINO #1 on the battlefield (required for RED CORSAIRS to trigger) — Chosen + Master of Executions inside',
'DEPLOY RHINO #2 + Legionaries: mid-flank, ready to push objectives',
'DEPLOY CULTIST MOBS: place each on a home/mid objective they\'ll hold all game — FOR THE DARK GODS kicks in end of Turn 1 Command phase',
'DEPLOY FORGEFIEND: back field, clear sight lines',
'DEPLOY VINDICATOR: behind cover',
'DEPLOY POSSESSED + Chaos Lord: flank position. SCOUTS 6" moves them 6" forward after all deployment',
'RED CORSAIRS: now that all is deployed, redeploy up to 3 units into better positions or Strategic Reserves',
'Going first — Rhino #1 rushes midboard Turn 1. Cultist Mobs claim home objectives. Huron drops Turn 2.',
],
second:[
'SET RESERVES: Huron Blackheart + Chaos Terminators #1, Chaos Terminators #2, Obliterators into Strategic Reserves',
'DEPLOY RHINO #1 on the battlefield — hold further back than normal',
'DEPLOY RHINO #2 + Legionaries: anchor home objectives',
'DEPLOY CULTIST MOBS: both on objectives — FOR THE DARK GODS stickies them at end of YOUR Turn 1 Command phase',
'DEPLOY FORGEFIEND + VINDICATOR: behind cover — they fire on YOUR Turn 1 after seeing opponent\'s position',
'DEPLOY POSSESSED + Chaos Lord: behind cover. SCOUTS 6" is still free but be cautious',
'RED CORSAIRS (BIG ADVANTAGE GOING SECOND): you see the full enemy deployment — redeploy aggressively to counter their positions',
'Consider placing a Legionaries unit into Reserves to RAPID INGRESS behind opponent\'s lines',
'Going second — RED CORSAIRS is a huge advantage here. Use it to completely counter their deployment.',
],
},
};
const mkChecklist = (listKey, goingFirst) => (round) => {
const isAbd = listKey === "abaddon";
const reactive = [
"OPPONENT'S MOVEMENT: RAPID INGRESS (1CP) — drop a Reserve unit 9\"+ anywhere on the board",
"OPPONENT'S MOVEMENT: SMOKESCREEN (1CP) — give your Rhino -1 to hit before they shoot it",
"OPPONENT'S SHOOTING: UNFAILINGLY OBDURATE (1CP) — worsen AP of all incoming attacks by 1",
"OPPONENT'S SHOOTING: GO TO GROUND (1CP) — give a threatened INFANTRY unit 6++ invuln + BENEFIT OF COVER",
"OPPONENT'S CHARGE: FIRE OVERWATCH (1CP) — shoot at a charging unit before it reaches you",
"OPPONENT'S CHARGE: UNDYING HATRED (1CP) — models fight on 4+ before removal if charged",
"OPPONENT'S FIGHT: COUNTER-OFFENSIVE (2CP) — after an enemy unit fights, immediately fight back",
round === 0 ? "→ Opponent's Turn 1 done. Press the button below to start YOUR Turn 1." : "→ Opponent's turn done. Press 'Next Round' to start your Command Phase.",
];
return {
command:[
isAbd?"THE WARMASTER (Abaddon — MANDATORY): (1) PARAGON OF HATRED — re-roll hits within 6\", (2) MARK OF CHAOS ASCENDANT — 4++ within 6\", (3) LORD OF THE TRAITOR LEGIONS — re-roll Battle-shock/Ld within 6\"":"TYRANT'S WILL (detachment rule — FREE every turn): pick +1 to hit OR re-roll charges for ALL HERETIC ASTARTES INFANTRY",
isAbd?"PARAGON OF HATRED on shooting/fight turns, MARK OF CHAOS ASCENDANT if you expect charges into Abaddon's unit":"Units visible to Huron Blackheart at start of each phase get BOTH Tyrant's Will buffs",
"Both players gain 1CP — track your total",
"BATTLE-SHOCK STEP: any units below half-strength? Roll 2D6 vs Leadership. Fail = BATTLE-SHOCKED (OC 0, no Stratagems)",
...(!isAbd?["THE TYRANT OF BADAB: while Huron Blackheart leads a unit, +1 OC to models in that unit"]:[]),
],
movement:round===1?[
isAbd?'SCOUTS 6" already happened pre-game — Chosen + Chaos Lord are pre-positioned':'SCOUTS 6" already happened pre-game — Possessed + Chaos Lord are pre-positioned',
"[ASSAULT] active on ALL HERETIC ASTARTES ranged weapons — ADVANCE freely",
isAbd?"Disembark Chosen from Rhino #1 BEFORE the Rhino moves — they keep their full Movement":"Disembark Chosen + Master of Executions from Rhino #1 BEFORE the Rhino moves",
'WARPCHARGED ENGINES (1CP): move Rhino #1 a guaranteed 18" toward the midboard',
isAbd?"No Deep Strike arrivals Turn 1 — save Abaddon + Terminators for Turn 2":"No Deep Strike arrivals Turn 1 — save Huron Blackheart + Terminators for Turn 2",
!isAbd?"FOR THE DARK GODS: Cultist Mobs on objectives? It stickies automatically at end of this Command phase":"Push Forgefiend + Vindicator toward firing positions",
]:[
"[ASSAULT] active on ALL HERETIC ASTARTES ranged weapons — ADVANCE freely",
round===2?(isAbd?'Turn 2 Priority: Deep Strike Abaddon + Chaos Terminators #1 — land 9"+ from prime target':'Turn 2 Priority: Deep Strike Huron Blackheart + Chaos Terminators #1 — 9"+ from objective. THE TYRANT OF BADAB +1 OC lands instantly'):"RAPID INGRESS (1CP) option: drop reserves in opponent's Reinforcement step instead of here",
"Rhino is likely empty — use it to screen lanes or contest objectives with OC 2",
round>=3?'Late game: prioritise objectives over aggression. Use Possessed + OPPORTUNISTIC RAIDERS to contest.':(isAbd?"Advance Possessed toward their flank target — threaten opponent's backfield objectives":"Advance Possessed + Chaos Lord toward opponent's flank objectives"),
...(!isAbd?["FOR THE DARK GODS: Cultist Mobs still on objectives? Sticky auto-applies end of Command phase"]:[]),
],
shooting:[
"Make DARK PACTS before selecting targets (fail = D3 mortals, no buff)",
isAbd?'Is THE WARMASTER set to PARAGON OF HATRED? Re-roll hits for all HERETIC ASTARTES within 6" of Abaddon':'Is TYRANT\'S WILL set to +1 to hit? Applies to all visible HERETIC ASTARTES INFANTRY',
"All attacks near objectives get +1 AP from RAIDERS AND REAVERS — fight on markers",
isAbd?"DARK DESTINY: did Abaddon's Dark Pact roll 7+? If yes, gain 1CP now":"Huron Blackheart's Tyrant's Claw is a PISTOL — can fire even in Engagement Range",
round===1?"Turn 1: Forgefiend + Vindicator are your main guns. Reserves still en route.":"Obliterators arrived? Melta at 18\" destroys vehicles. Bolter profile with [LETHAL HITS] vs elite infantry.",
],
charge:[
"Chosen have CHOSEN MARAUDERS — advance+charge natively, no stratagem needed",
isAbd?"REAVERS' HASTE (FREE via LORD OF CHAOS if Chaos Lord is attached): +1 to charge roll near objective":"REAVERS' HASTE (FREE via LORD OF CHAOS on Possessed + Chaos Lord): Advance then Charge",
round===1?(isAbd?"Turn 1: Chosen are your main chargers. Abaddon + Terminators arrive Turn 2.":"Turn 1: Possessed are your main chargers. Huron + Terminators arrive Turn 2."):(isAbd?"Abaddon + Terminators arrived? Charge now — use PARAGON OF HATRED re-rolls in Fight phase":"Huron Blackheart + Terminators arrived? Charge now — THE TYRANT OF BADAB +1 OC locks that objective"),
"Never charge Vindicator or Forgefiend — keep them shooting",
],
fight:[
"DARK PACTS before fighting"+(isAbd?" — DARK DESTINY: 7+ Ld = 1CP gained":" — no DARK DESTINY, no bonus CP"),
isAbd?"Is THE WARMASTER set to PARAGON OF HATRED? Re-roll hits within 6\" applies here too":"Huron Blackheart's Tyrant's Claw PISTOL can fire before fighting begins",
"All melee near objectives gets +1 AP from RAIDERS AND REAVERS",
"RUINOUS RAID (1CP): re-roll ALL hits AND wounds for disembarked unit near objective",
"SCOUR AND SEIZE (1CP): [PRECISION] near objectives — snipe enemy Leaders",
...(!isAbd?["TROPHY TAKER (Master of Executions): killed an enemy CHARACTER? Gain 1CP"]:[]),
"UNDYING HATRED (1CP): models fight on 4+ before removal if enemy charged them",
"COUNTER-OFFENSIVE (2CP): fight back immediately after enemy fights",
round===1?"Possessed: UNHOLY BLOODSHED is once per battle — save it, don't spend Turn 1":"Possessed still alive? UNHOLY BLOODSHED [DEVASTATING WOUNDS] if this is the decisive engagement",
],
end:[
"Score primary VP — check OC on each objective. BATTLE-SHOCKED units have OC 0",
...(!isAbd?["FOR THE DARK GODS: Cultist Mobs auto-sticky their objectives — no CP needed, just be on them"]:[]),
"RENEGADE CLAIM (1CP): sticky any objective you hold this Movement phase",
"OPPORTUNISTIC RAIDERS (1CP): 6\" free move after fighting to land on an objective",
round===1?(isAbd?"Turn 1 end: plan where Abaddon + Terminators Deep Strike next turn":"Turn 1 end: plan where Huron Blackheart + Terminators Deep Strike next turn"):"Check CP total — banking too much? Spend aggressively in late game",
"→ Your turn is done. Now watch for reactive plays during the opponent's turn.",
],
reactive,
};
};
const mkActivationOrder = (listKey, round) => {
const isAbd = listKey === "abaddon";
const reactive=[
'1. RAPID INGRESS (1CP) — use in opponent\'s Movement to drop reserves 9"+ anywhere',
"2. SMOKESCREEN (1CP) — use in opponent's Movement to give Rhino -1 to hit",
"3. UNFAILINGLY OBDURATE (1CP) — opponent's Shooting, worsen AP on a key unit",
"4. GO TO GROUND (1CP) — opponent's Shooting, give threatened INFANTRY 6++ + cover",
"5. FIRE OVERWATCH (1CP) — opponent's Charge, shoot at the charging unit",
"6. UNDYING HATRED (1CP) — opponent's Charge, models fight on 4+ before removal",
"7. COUNTER-OFFENSIVE (2CP) — opponent's Fight, fight back immediately",
];
return {
command:isAbd?[
"1. THE WARMASTER (Abaddon): select aura — PARAGON OF HATRED for fight/shoot turns",
"2. Both players gain 1CP",
"3. BATTLE-SHOCK STEP: check all units below half-strength",
round===1?"4. Plan Turn 1 — Rhino rush, Chosen disembark, Forgefiend forward":round===2?"4. Plan Deep Strike — where do Abaddon + Terminators land this turn?":"4. Late game — prioritise objectives over aggression",
]:[
"1. TYRANT'S WILL (FREE): pick +1 to hit or re-roll charges",
"2. Both players gain 1CP",
"3. BATTLE-SHOCK STEP: check all units below half-strength",
round===1?"4. Plan Turn 1 — Rhino rush, Chosen disembark, Cultist Mobs on objectives":round===2?"4. Plan Deep Strike — where do Huron Blackheart + Terminators land?":"4. Late game — shore up contested objectives, Huron's +1 OC is decisive",
],
movement:round===1?(isAbd?[
"1. Disembark Chosen from Rhino #1 BEFORE it moves",
'2. Move Rhino #1 forward — WARPCHARGED ENGINES (1CP) for guaranteed 18"',
"3. Move Rhino #2 + Legionaries toward mid objectives",
"4. Advance Forgefiend into firing position ([ASSAULT] — still shoots)",
"5. Advance Possessed toward flank target",
"6. Move Vindicator to best firing lane",
]:[
"1. Disembark Chosen + Master of Executions from Rhino #1 BEFORE it moves",
'2. Move Rhino #1 forward — WARPCHARGED ENGINES (1CP) for guaranteed 18"',
"3. Move Rhino #2 + Legionaries toward mid objectives",
"4. Advance Forgefiend into firing position ([ASSAULT] — still shoots)",
"5. Advance Possessed + Chaos Lord toward flank target",
"6. Move Huron Blackheart to central area for THE TYRANT OF BADAB +1 OC",
]):round===2?(isAbd?[
"1. Deep Strike Abaddon + Chaos Terminators #1 — land 9\"+ from prime target",
"2. Move Rhino #1 to contest/screen — it's likely empty, use OC 2",
"3. Move Rhino #2 + Legionaries to hold objectives",
"4. Advance Forgefiend toward firing position",
"5. Advance Possessed toward opponent's backfield objectives",
"6. RAPID INGRESS option: drop Terminators #2 in opponent's Reinforcement step instead",
]:[
"1. Deep Strike Huron Blackheart + Chaos Terminators #1 — 9\"+ from objective",
"2. Move Rhino #1 to screen or contest — it's empty, use OC 2",
"3. Move Rhino #2 + Legionaries to hold objectives",
"4. Advance Forgefiend toward firing position",
"5. Advance Possessed + Chaos Lord toward opponent's flank objectives",
"6. RAPID INGRESS option: drop Terminators #2 in opponent's Reinforcement step",
]):(isAbd?[
"1. Move Abaddon + Chaos Terminators toward contested objectives",
"2. Rhinos: screen, contest, or push late objectives with OC 2",
"3. Advance Forgefiend — keep it shooting every turn",
"4. Possessed: use OPPORTUNISTIC RAIDERS (1CP) after fight to jump objectives",
"5. Any remaining reserves: RAPID INGRESS (1CP) for surprise arrival",
]:[
"1. Move Huron Blackheart + Chaos Terminators to lock contested objectives",
"2. Rhinos: screen or contest with OC 2",
"3. Advance Forgefiend — keep shooting every turn",
"4. Possessed: OPPORTUNISTIC RAIDERS (1CP) after fight to grab objectives",
"5. Cultist Mobs: stay on objectives for FOR THE DARK GODS auto-sticky",
]),
shooting:isAbd?[
"1. Forgefiend — DARK PACTS [LETHAL HITS] vs T5+ targets",
round>=2?"2. Obliterators (if arrived) — DARK PACTS near objectives for +1 AP":"2. Vindicator — blast clumped infantry with Demolisher Cannon",
"3. Plasma Legionaries — DARK PACTS at elite infantry",
"4. Bolter Legionaries — sweep objectives",
"5. Rhino Combi-bolters last — chip shots only",
]:[
"1. Forgefiend — DARK PACTS [LETHAL HITS] vs T5+. TYRANT'S WILL +1 to hit if selected",
round>=2?"2. Obliterators (if arrived) — DARK PACTS near objectives for +1 AP":"2. Vindicator — blast clumped infantry",
"3. Plasma Legionaries — DARK PACTS at elite infantry",
"4. Bolter Legionaries — sweep objectives with TYRANT'S WILL +1 to hit",
"5. Rhino Combi-bolters last",
],
charge:isAbd?[
"1. Chosen — CHOSEN MARAUDERS advance+charge built-in. REAVERS' HASTE (FREE via LORD OF CHAOS) for +1 roll near objective",
round===1?"2. Possessed — REAVERS' HASTE (1CP) if they Advanced. Turn 1 main flankers.":"2. Abaddon + Chaos Terminators — charge after Deep Strike. PARAGON OF HATRED re-rolls active.",
"3. Never charge Vindicator or Forgefiend",
]:[
"1. Possessed + Chaos Lord — REAVERS' HASTE (FREE via LORD OF CHAOS) if Advanced",
"2. Chosen + Master of Executions — CHOSEN MARAUDERS advance+charge built-in. REAVERS' HASTE (1CP) for +1 roll",
round===1?"3. Turn 1 — Huron Blackheart + Terminators arrive Turn 2, not yet.":"3. Huron Blackheart + Chaos Terminators — charge to lock objective. THE TYRANT OF BADAB +1 OC instantly.",
"4. Never charge Vindicator or Forgefiend",
],
fight:isAbd?[
"1. Check opponent for FIGHTS FIRST units — they go before you",
round>=2?"2. Abaddon + Chaos Terminators — DARK PACT first. PARAGON OF HATRED re-rolls if active.":"2. Chosen — RUINOUS RAID (1CP) + DARK PACT near objective",
"3. Possessed — DARK PACT. Use UNHOLY BLOODSHED [DEVASTATING WOUNDS] if decisive engagement",
"4. OPPORTUNISTIC RAIDERS (1CP) after Possessed fight to reposition onto objective",
"5. COUNTER-OFFENSIVE (2CP) if a critical unit gets charged",
]:[
"1. Check opponent for FIGHTS FIRST units",
"2. Chosen + Master of Executions — RUINOUS RAID (1CP) + DARK PACT. Kill a CHARACTER for TROPHY TAKER 1CP",
round>=2?"3. Huron Blackheart + Chaos Terminators — DARK PACT, fire Tyrant's Claw before combat":"3. Possessed + Chaos Lord — DARK PACT. UNHOLY BLOODSHED if decisive.",
"4. OPPORTUNISTIC RAIDERS (1CP) after Possessed fight to grab objective",
"5. COUNTER-OPERATIVE (2CP) if a critical unit gets charged",
],
end:isAbd?[
"1. Score all objectives — check OC on each marker",
"2. RENEGADE CLAIM (1CP) on objectives you want to sticky",
"3. OPPORTUNISTIC RAIDERS (1CP) to land on nearby objectives",
round===1?"4. Plan Turn 2 Deep Strike — where do Abaddon + Terminators land?":"4. Check CP — banking too much? Spend aggressively",
]:[
"1. Score objectives — Huron Blackheart's THE TYRANT OF BADAB +1 OC helps near him",
"2. FOR THE DARK GODS: Cultist Mobs auto-sticky — no action needed if on objectives",
"3. RENEGADE CLAIM (1CP) on other objectives you want to sticky",
round===1?"4. Plan Turn 2 Deep Strike — where do Huron Blackheart + Terminators land?":"4. OPPORTUNISTIC RAIDERS (1CP) to land on nearby objectives",
],
reactive,
};
};
const ROSTER = {
abaddon:[
{unit:"Abaddon the Despoiler",role:"Warlord",pts:270,notes:"Deep Strike with Terminators #1"},
{unit:"Chaos Terminator Squad #1",role:"Elite",pts:200,notes:"Abaddon attaches here. Deep Strike Turn 2."},
{unit:"Chaos Terminator Squad #2",role:"Elite",pts:200,notes:"Deep Strike via RAPID INGRESS Turn 2-3."},
{unit:"Chaos Lord",role:"Character",pts:90,notes:'Mark of the Hound. Attaches to Chosen. SCOUTS 6".'},
{unit:"Chosen",role:"Elite",pts:150,notes:"Ride Rhino #1. CHOSEN MARAUDERS advance+charge."},
{unit:"Legionaries #1",role:"Battleline",pts:90,notes:"Plasma loadout. Ride Rhino #2."},
{unit:"Legionaries #2",role:"Battleline",pts:90,notes:"Bolter loadout. Hold mid objectives."},
{unit:"Possessed",role:"Elite",pts:140,notes:'Fast flank unit. Chaos Lord pre-game SCOUTS 6".'},
{unit:"Obliterators",role:"Heavy",pts:160,notes:"Deep Strike near contested objective Turn 2-3."},
{unit:"Forgefiend",role:"Heavy",pts:195,notes:"Back field fire support. Advance + shoot every turn."},
{unit:"Vindicator",role:"Heavy",pts:185,notes:"Park in cover. Demolisher Cannon at clumped infantry."},
{unit:"Rhino #1",role:"Transport",pts:75,notes:"Carries Chosen + Chaos Lord. Rush midboard Turn 1."},
{unit:"Rhino #2",role:"Transport",pts:75,notes:"Carries Legionaries #1. Flank approach."},
],
huron:[
{unit:"Huron Blackheart",role:"Warlord",pts:80,notes:"Deep Strike with Terminators #1. RED CORSAIRS pre-game."},
{unit:"Chaos Terminator Squad #1",role:"Elite",pts:200,notes:"Huron attaches here. Deep Strike Turn 2."},
{unit:"Chaos Terminator Squad #2",role:"Elite",pts:200,notes:"Deep Strike via RAPID INGRESS Turn 2-3."},
{unit:"Chaos Lord",role:"Character",pts:90,notes:'Mark of the Hound. Attaches to Possessed. SCOUTS 6".'},
{unit:"Master of Executions",role:"Character",pts:80,notes:"Attaches to Chosen. TROPHY TAKER: +1CP per CHARACTER killed."},
{unit:"Chosen",role:"Elite",pts:150,notes:"Ride Rhino #1. CHOSEN MARAUDERS advance+charge."},
{unit:"Legionaries #1",role:"Battleline",pts:90,notes:"Plasma loadout. Ride Rhino #2."},
{unit:"Legionaries #2",role:"Battleline",pts:90,notes:"Bolter loadout. Hold mid objectives."},
{unit:"Possessed",role:"Elite",pts:140,notes:'Fast flank. Chaos Lord attaches here. SCOUTS 6".'},
{unit:"Cultist Mob #1",role:"Battleline",pts:50,notes:"Home objective. FOR THE DARK GODS auto-sticky."},
{unit:"Cultist Mob #2",role:"Battleline",pts:50,notes:"Mid objective. FOR THE DARK GODS auto-sticky."},
{unit:"Obliterators",role:"Heavy",pts:160,notes:"Deep Strike near contested objective Turn 2-3."},
{unit:"Forgefiend",role:"Heavy",pts:195,notes:"Back field fire support. Advance + shoot every turn."},
{unit:"Vindicator",role:"Heavy",pts:185,notes:"Park in cover. Demolisher Cannon at clumped infantry."},
{unit:"Rhino #1",role:"Transport",pts:75,notes:"Carries Chosen + Master of Executions. Rush midboard."},
{unit:"Rhino #2",role:"Transport",pts:75,notes:"Carries Legionaries #1. Flank approach."},
],
};
const PHASE_REFERENCE = {
abaddon:{
command:["Both players gain 1CP. DARK DESTINY triggers when Abaddon's unit passes Dark Pact on 7+.","BATTLE-SHOCK STEP: units Below Half-Strength roll 2D6 vs Ld. Fail = BATTLE-SHOCKED.","CP Priority: RUINOUS RAID > REAVERS' HASTE (FREE on Chosen via LORD OF CHAOS) > UNFAILINGLY OBDURATE > SCOUR AND SEIZE > OPPORTUNISTIC RAIDERS."],
movement:["[ASSAULT]: ALL HERETIC ASTARTES ADVANCE and shoot freely — every turn.","Chosen have CHOSEN MARAUDERS — advance+charge built-in. REAVERS' HASTE only for +1 roll.",'WARPCHARGED ENGINES (1CP): Rhino guaranteed 18".',"DEEP STRIKE: place 9\"+ from enemies. RAPID INGRESS (1CP) arrives in opponent's Reinforcement step."],
shooting:["DARK PACTS before targets. Fail = D3 mortal wounds, no buff.","PARAGON OF HATRED (Abaddon, 6\"): re-roll hits in Shooting AND Fight phases.","All attacks near objectives gain +1 AP from RAIDERS AND REAVERS.","Forgefiend: DARK PACTS [LETHAL HITS] vs T5+. [ASSAULT] applies."],
charge:["Chosen: CHOSEN MARAUDERS advance+charge built-in. REAVERS' HASTE (FREE via LORD OF CHAOS) for +1 roll near objective.","Position units 7\" or less away to maximise charge odds."],
fight:["DARK PACTS before fighting. DARK DESTINY: 7+ Ld = 1CP.","PARAGON OF HATRED applies in Fight phase for units within 6\" of Abaddon.","All melee near objectives gains +1 AP from RAIDERS AND REAVERS.","RUINOUS RAID (1CP): re-roll ALL hits AND wounds for disembarked unit near objective.","UNDYING HATRED (1CP): models fight on 4+ before removal if charged.","COUNTER-OFFENSIVE (2CP): fight back after enemy fights."],
end:["Score Primary VP: OC > opponent on objective.","RENEGADE CLAIM (1CP): sticky an objective.","OPPORTUNISTIC RAIDERS (1CP): 6\" free move after fighting to land on objective."],
reactive:["RAPID INGRESS (1CP): drop Reserve unit 9\"+ during opponent's Movement.","SMOKESCREEN (1CP): Rhino subtracts 1 from Hit rolls against it.","UNFAILINGLY OBDURATE (1CP): worsen AP of all incoming attacks on one unit by 1.","GO TO GROUND (1CP): targeted INFANTRY gets 6++ invuln + BENEFIT OF COVER.","FIRE OVERWATCH (1CP): shoot at a charging unit within 24\".","UNDYING HATRED (1CP): opponent charges your HERETIC ASTARTES — models fight on 4+ before removal.","COUNTER-OFFENSIVE (2CP): fight back after an enemy unit finishes fighting."],
},
huron:{
command:["Both players gain 1CP. TYRANT'S WILL (FREE): +1 to hit OR re-roll charges for all HERETIC ASTARTES INFANTRY.","Units visible to Huron Blackheart get BOTH Tyrant's Will buffs simultaneously.","BATTLE-SHOCK STEP: units Below Half-Strength roll 2D6 vs Ld."],
movement:["[ASSAULT]: ALL HERETIC ASTARTES ADVANCE and shoot freely.","Chosen have CHOSEN MARAUDERS — advance+charge built-in. REAVERS' HASTE only for +1 roll.","RED CORSAIRS was pre-game. WARPCHARGED ENGINES (1CP): Rhino guaranteed 18\"."],
shooting:["TYRANT'S WILL +1 to hit applies to all HERETIC ASTARTES INFANTRY visible to Huron Blackheart.","DARK PACTS before targets. No DARK DESTINY — no bonus CP.","All attacks near objectives gain +1 AP from RAIDERS AND REAVERS.","Huron Blackheart's Tyrant's Claw PISTOL fires in Engagement Range."],
charge:["TYRANT'S WILL re-roll charges if selected this Command phase.","Chosen: CHOSEN MARAUDERS built-in. REAVERS' HASTE (FREE via LORD OF CHAOS) for +1 roll near objective."],
fight:["DARK PACTS before fighting. No DARK DESTINY.","All melee near objectives gains +1 AP from RAIDERS AND REAVERS.","RUINOUS RAID (1CP): re-roll ALL hits AND wounds for disembarked unit near objective.","TROPHY TAKER: Master of Executions gains 1CP each time it kills an enemy CHARACTER.","OPPORTUNISTIC RAIDERS (1CP): 6\" free move after Possessed fight to score."],
end:["Score Primary VP: OC > opponent.","THE TYRANT OF BADAB (+1 OC): position Huron Blackheart near contested objectives.","FOR THE DARK GODS: Cultist Mobs auto-sticky at end of Command phase.","RED CORSAIRS was one-time — capitalise on it in Turns 1-2."],
reactive:["RAPID INGRESS (1CP): drop Reserve unit 9\"+ during opponent's Movement.","SMOKESCREEN (1CP): Rhino subtracts 1 from Hit rolls against it.","UNFAILINGLY OBDURATE (1CP): worsen AP of all incoming attacks on one unit by 1.","GO TO GROUND (1CP): targeted INFANTRY gets 6++ invuln + BENEFIT OF COVER.","FIRE OVERWATCH (1CP): shoot at a charging unit within 24\".","UNDYING HATRED (1CP): opponent charges your HERETIC ASTARTES — models fight on 4+ before removal.","COUNTER-OFFENSIVE (2CP): fight back after an enemy unit finishes fighting."],
},
};
const BUILD_INFO = {
abaddon:{tagline:"THE WARMASTER'S LEGION",description:"CP-engine list. Abaddon generates bonus CPs through DARK DESTINY. Deep Strike hammer supported by Raiders and Reavers mobile assault.",strengths:["Strong CP generation","Re-roll auras every turn","Deep Strike threat","High single-combat power"],detachment:"Raiders and Reavers (Pactbound Zealots)",reserveUnits:["Terminators #1 + Abaddon","Terminators #2","Obliterators"]},
huron:{tagline:"THE MAELSTROM'S FIST",description:"Deployment scam list. RED CORSAIRS after seeing opponent's setup. TYRANT'S WILL FREE every turn. Tighter CP but more deployment flexibility.",strengths:["Deployment scam","FREE buff every turn","Red Corsairs redeploy","Double cultist auto-sticky objectives"],detachment:"Raiders and Reavers (Renegade Raiders)",reserveUnits:["Terminators #1 + Huron Blackheart","Terminators #2","Obliterators"]},
};
const STRATAGEMS = lk => [
{n:"Ruinous Raid",c:1,phase:"Shoot/Fight",desc:"Unit that disembarked from a Transport this turn: re-roll ALL hit and wound rolls while near an objective."},
{n:"Reavers' Haste",c:lk==="abaddon"?0:1,phase:"Charge",desc:"One INFANTRY or MOUNTED unit: charge even if it Advanced. +1 to the charge roll near an objective. Note: Chosen don't need this — use for the +1 roll."},
{n:"Warpcharged Engines",c:1,phase:"Movement",desc:'One TRANSPORT or MOUNTED unit: guaranteed +6" to Move instead of rolling. Rhino = 18".'},
{n:"Renegade Claim",c:1,phase:"Movement",desc:"One unit on an objective you control: sticky it. Opponent must exceed your OC to remove control."},
{n:"Unfailingly Obdurate",c:1,phase:"Opp turn",desc:"One HERETIC ASTARTES unit: worsen AP of ALL incoming attacks by 1 for the rest of the phase."},
{n:"Scour & Seize",c:1,phase:"Fight",desc:"One unit that hasn't fought: all attacks near an objective gain [PRECISION] — snipe enemy characters."},
{n:"Opportunistic Raiders",c:1,phase:"End Fight",desc:'One unit not in Engagement Range: free 6" Normal move (12" if MOUNTED) to land on an objective.'},
{n:"Fire Overwatch",c:1,phase:"Opp Charge",desc:"One of your units shoots at an enemy unit charging or moving within 24\" of it, as if it were your Shooting phase."},
{n:"Go to Ground",c:1,phase:"Opp Shoot",desc:"One of your INFANTRY units being targeted: gains 6++ invulnerable save + BENEFIT OF COVER until end of phase."},
{n:"Smokescreen",c:1,phase:"Opp Shoot",desc:"One SMOKE LAUNCHERS model (e.g. Rhino): ranged attacks subtract 1 from Hit rolls against it. Once per battle per model."},
{n:"Rapid Ingress",c:1,phase:"Opp Move",desc:'One unit in Strategic Reserves: deploy anywhere 9"+ from enemies during the opponent\'s Reinforcement step.'},
{n:"Undying Hatred",c:1,phase:"Opp Charge",desc:"Enemy charges into your HERETIC ASTARTES unit: each model destroyed before it fights can fight on a 4+ before removal."},
{n:"Counter-Offensive",c:2,phase:"Fight",desc:"CORE. After an enemy unit finishes fighting, immediately select one of your units in Engagement Range to fight next."},
];
const PHASES=["command","movement","shooting","charge","fight","end","reactive"];
const ALL_FLOW=["command","movement","shooting","charge","fight","end","reactive"];
const PHASE_LABELS={command:"Command Phase",movement:"Movement Phase",shooting:"Shooting Phase",charge:"Charge Phase",fight:"Fight Phase",end:"End of Round",reactive:"Opponent's Turn"};
const PHASE_COLORS={command:"#065f46",movement:"#1e3a5f",shooting:"#7c2d12",charge:"#831843",fight:"#7c2d12",end:"#065f46",reactive:"#4c1d95"};
const PHASE_ICONS={command:"⚙️",movement:"🏃",shooting:"🎯",charge:"⚔️",fight:"👊",end:"🏆",reactive:"🛡️"};
export default function App() {
const [screen, setScreen] = useState("select");
const [listKey, setListKey] = useState(null);
const [gameStarted, setGameStarted] = useState(false);
const [goingFirst, setGoingFirst] = useState(null);
const [tab, setTab] = useState("deploy");
const [cp, setCp] = useState(0);
const [cpLog, setCpLog] = useState([]);
const [round, setRound] = useState(1);
const [phase, setPhase] = useState("command");
const [checked, setChecked] = useState({});
const [activationStep, setActivationStep] = useState(0);
const [reserves, setReserves] = useState({});
const [activeTerm, setActiveTerm] = useState(null);
const [activeSheet, setActiveSheet] = useState(null);
const [openPhaseRef, setOpenPhaseRef] = useState(null);
const [glossFilter, setGlossFilter] = useState("All");
const [showGloss, setShowGloss] = useState(false);
const [showRoster, setShowRoster] = useState(true);
const [myVp, setMyVp] = useState(0);
const [oppVp, setOppVp] = useState(0);
const build = listKey ? BUILD_INFO[listKey] : null;
const modCp = (d,r) => { setCp(p=>Math.max(0,p+d)); if(r) setCpLog(l=>[...l.slice(-9),{d,r}]); };
const toggleCheck = id => setChecked(c=>({...c,[id]:!c[id]}));
const startGame = () => {
const r = {};
if(listKey) BUILD_INFO[listKey].reserveUnits.forEach((u,i)=>{r[listKey+"-"+i]=false;});
setReserves(r);
setGameStarted(true);
if(goingFirst === false) {
setPhase("reactive"); setRound(0); setTab("turn");
} else {
setPhase("command"); setRound(1); setTab("turn");
modCp(1,"Command phase +1CP (Round 1)");
}
};
const advancePhase = () => {
if(round === 0 && phase === "reactive") {
setRound(1); setPhase("command"); setChecked({}); setActivationStep(0);
modCp(1,"Command phase +1CP (Round 1)");
} else {
const idx = ALL_FLOW.indexOf(phase);
if(idx < ALL_FLOW.length - 1){ setPhase(ALL_FLOW[idx+1]); setActivationStep(0); }
}
};
const nextRound = () => {
if(round >= 5) return;
setRound(r=>r+1); setPhase("command"); setChecked({}); setActivationStep(0);
modCp(1,"Command phase +1CP");
};
const glossCats = ["All",...Array.from(new Set(Object.values(GLOSSARY).map(v=>v.cat)))];
const charAliasMap={};
Object.entries(CHAR_ALIASES).forEach(([k,al])=>al.forEach(a=>{charAliasMap[a]=k;}));
const unitAliasMap={};
Object.entries(UNIT_ALIASES).forEach(([k,al])=>al.forEach(a=>{unitAliasMap[a]=k;}));
const seen=new Set();
const clickable=[...Object.keys(charAliasMap),...Object.keys(unitAliasMap),...Object.keys(GLOSSARY)].sort((a,b)=>b.length-a.length).filter(t=>{if(seen.has(t))return false;seen.add(t);return true;});
const H = text => {
if(!clickable.length) return <span>{text}</span>;
const re=new RegExp(`(${clickable.map(t=>t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')})`,'g');
return text.split(re).map((p,i)=>{
if(charAliasMap[p]) return <span key={i} onClick={e=>{e.stopPropagation();setActiveSheet({key:charAliasMap[p],type:'char'});}} style={{color:"#60a5fa",cursor:"pointer",borderBottom:"1px dotted #60a5fa88",fontWeight:600}}>{p}</span>;
if(unitAliasMap[p]) return <span key={i} onClick={e=>{e.stopPropagation();setActiveSheet({key:unitAliasMap[p],type:'unit'});}} style={{color:"#34d399",cursor:"pointer",borderBottom:"1px dotted #34d39988",fontWeight:600}}>{p}</span>;
if(GLOSSARY[p]) return <span key={i} onClick={e=>{e.stopPropagation();setActiveTerm(p);}} style={{color:"#f59e0b",cursor:"pointer",borderBottom:"1px dotted #f59e0b88",fontWeight:500}}>{p}</span>;
return <span key={i}>{p}</span>;
});
};
const pc = PHASE_COLORS[phase]||"#374151";
const effectiveRound = round === 0 ? 1 : round;
const checklist = listKey ? mkChecklist(listKey, goingFirst)(effectiveRound) : {};
const checkItems = checklist[phase] || [];
const actItems = listKey ? (mkActivationOrder(listKey, effectiveRound)[phase]||[]) : [];
if(screen==="select") return (
<div style={{background:"#0a0a14",minHeight:"100vh",fontFamily:"'Segoe UI',sans-serif",color:"#fff",display:"flex",flexDirection:"column",alignItems:"center",padding:"0 16px 60px"}}>
<div style={{textAlign:"center",padding:"40px 0 24px"}}>
<div style={{fontSize:10,color:"#f87171",letterSpacing:4,fontWeight:700,marginBottom:10}}>WARHAMMER 40,000</div>
<div style={{fontSize:26,fontWeight:900,color:"#e879f9",letterSpacing:1,marginBottom:4}}>CSM GAME GUIDE</div>
<div style={{fontSize:11,color:"#6b7280",letterSpacing:2}}>CHAOS SPACE MARINES · RAIDERS AND REAVERS</div>
<div style={{width:50,height:2,background:"linear-gradient(90deg,transparent,#e879f9,transparent)",margin:"14px auto 0"}}/>
</div>
<div style={{fontSize:12,color:"#6b7280",marginBottom:22}}>Select your build to begin</div>
{Object.entries(BUILD_INFO).map(([key,info])=>(
<div key={key} onClick={()=>{setListKey(key);setGameStarted(false);setGoingFirst(null);setTab("deploy");setChecked({});setRound(1);setPhase("command");setCp(0);setCpLog([]);setMyVp(0);setOppVp(0);setScreen("guide");}}
style={{width:"100%",maxWidth:440,background:"#0d1117",border:"2px solid #f97316",borderRadius:14,marginBottom:16,cursor:"pointer",overflow:"hidden"}}
onMouseEnter={e=>e.currentTarget.style.boxShadow="0 0 24px #f9731440"}
onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}>
<div style={{background:"linear-gradient(135deg,#7c2d12,#3b0f05)",padding:"16px 20px"}}>
<div style={{fontSize:9,color:"#fb923c",letterSpacing:3,fontWeight:700,marginBottom:4}}>{info.detachment.split("(")[1]?.replace(")","") || ""} — {key==="abaddon"?"1975 pts":"1990 pts"}</div>
<div style={{fontSize:20,fontWeight:900,color:"#fff",marginBottom:2}}>{key==="abaddon"?"Abaddon Build":"Maelstrom Build"}</div>
<div style={{fontSize:11,color:"#fb923c",letterSpacing:1,fontWeight:600}}>{info.tagline}</div>
</div>
<div style={{padding:"14px 20px"}}>
<div style={{fontSize:12,color:"#d1d5db",lineHeight:1.6,marginBottom:12}}>{info.description}</div>
<div style={{display:"flex",flexWrap:"wrap",gap:5}}>{info.strengths.map((s,i)=><span key={i} style={{fontSize:10,padding:"3px 8px",borderRadius:4,background:"#1f2937",border:"1px solid #374151",color:"#9ca3af"}}>{s}</span>)}</div>
</div>
<div style={{padding:"10px 20px 14px",borderTop:"1px solid #1f2937",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
<div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:10,color:"#6b7280"}}>WARLORD</span><span style={{fontSize:13,fontWeight:700,color:"#60a5fa"}}>{key==="abaddon"?"Abaddon":"Huron Blackheart"}</span></div>
<div style={{fontSize:12,fontWeight:700,color:"#f97316"}}>SELECT →</div>
</div>
</div>
))}
<div style={{marginTop:4,padding:"12px 16px",background:"#0d1117",border:"1px solid #1f2937",borderRadius:10,width:"100%",maxWidth:440}}>
<div style={{fontSize:10,color:"#6b7280",letterSpacing:1,marginBottom:8}}>INTERACTIVE TEXT LEGEND</div>
<div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
<div style={{display:"flex",alignItems:"center",gap:6}}><span style={{color:"#f59e0b",fontSize:12,fontWeight:600,borderBottom:"1px dotted #f59e0b"}}>DARK PACTS</span><span style={{fontSize:11,color:"#6b7280"}}>Rule/Keyword</span></div>
<div style={{display:"flex",alignItems:"center",gap:6}}><span style={{color:"#60a5fa",fontSize:12,fontWeight:600,borderBottom:"1px dotted #60a5fa"}}>Abaddon</span><span style={{fontSize:11,color:"#6b7280"}}>Character</span></div>
<div style={{display:"flex",alignItems:"center",gap:6}}><span style={{color:"#34d399",fontSize:12,fontWeight:600,borderBottom:"1px dotted #34d399"}}>Chosen</span><span style={{fontSize:11,color:"#6b7280"}}>Unit</span></div>
</div>
</div>
</div>
);
const DatasheetDrawer = () => {
if(!activeSheet) return null;
const isChar=activeSheet.type==='char';
const data=isChar?CHARACTERS[activeSheet.key]:UNITS[activeSheet.key];
if(!data) return null;
const ac=isChar?"#3b82f6":"#10b981";
const hBg=isChar?"linear-gradient(135deg,#1e3a5f,#0c1f3a)":"linear-gradient(135deg,#064e3b,#022c22)";
const lc=isChar?"#60a5fa":"#34d399";
const aBg=isChar?"#4c1d95":"#065f46";
const aTc=isChar?"#e879f9":"#4ade80";
return (
<>
<div onClick={()=>setActiveSheet(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.65)",zIndex:200}}/>
<div style={{position:"fixed",top:0,right:0,bottom:0,width:"min(360px,100vw)",background:"#0a0a14",borderLeft:`2px solid ${ac}`,zIndex:201,overflowY:"auto",paddingTop:"env(safe-area-inset-top)"}}>
<div style={{background:hBg,padding:"18px 16px 14px",borderBottom:`1px solid ${ac}33`,position:"sticky",top:0,zIndex:10}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
<div>
<div style={{fontSize:9,color:lc,letterSpacing:3,fontWeight:700,marginBottom:4}}>{data.faction||"HERETIC ASTARTES"}</div>
<div style={{fontSize:17,fontWeight:900,color:"#fff",marginBottom:2}}>{data.fullName||data.name}</div>
<div style={{fontSize:11,color:lc}}>{data.role}</div>
</div>
<button onClick={()=>setActiveSheet(null)} style={{background:"transparent",border:`1px solid ${ac}55`,color:"#9ca3af",cursor:"pointer",fontSize:16,padding:"5px 9px",borderRadius:7,flexShrink:0,marginLeft:8}}>✕</button>
</div>
</div>
<div style={{padding:"12px 14px 50px"}}>
<div style={{background:"#0d1117",border:`1px solid ${ac}44`,borderRadius:10,marginBottom:12,overflow:"hidden"}}>
<div style={{background:isChar?"#1e3a5f":"#065f46",padding:"5px 12px",fontSize:9,fontWeight:700,letterSpacing:1,color:lc}}>CHARACTERISTICS</div>
<div style={{display:"grid",gridTemplateColumns:`repeat(${Object.keys(data.stats).length},1fr)`,padding:"10px 6px",gap:2}}>
{Object.entries(data.stats).map(([k,v])=>(
<div key={k} style={{textAlign:"center"}}>
<div style={{fontSize:14,fontWeight:900,color:k==="InvSv"?"#e879f9":k==="W"?"#ef4444":"#fff",lineHeight:1}}>{v}</div>
<div style={{fontSize:8,color:"#6b7280",marginTop:3}}>{k}</div>
</div>
))}
</div>
</div>
<div style={{background:"#0d1117",border:"1px solid #1f2937",borderRadius:10,marginBottom:12,overflow:"hidden"}}>
<div style={{background:"#7c2d12",padding:"5px 12px",fontSize:9,fontWeight:700,letterSpacing:1,color:"#fca5a5"}}>WEAPONS</div>
{data.weapons.map((w,i)=>(
<div key={i} style={{padding:"9px 12px",borderBottom:i<data.weapons.length-1?"1px solid #1f2937":"none"}}>
<div style={{fontSize:11,fontWeight:700,color:"#fff",marginBottom:5}}>{w.name}</div>
<div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:3,marginBottom:w.keywords?4:0}}>
{[["Range",w.range],["A",w.A],["WS/BS",w.ws],["S",w.S],["AP",w.AP],["D",w.D]].map(([label,val])=>(
<div key={label} style={{textAlign:"center",background:"#1f2937",borderRadius:4,padding:"4px 2px"}}>
<div style={{fontSize:12,fontWeight:700,color:"#e5e7eb"}}>{val}</div>
<div style={{fontSize:8,color:"#6b7280"}}>{label}</div>
</div>
))}
</div>
{w.keywords&&<div style={{fontSize:10,color:"#f59e0b",marginTop:3}}>{H(w.keywords)}</div>}
</div>
))}
</div>
<div style={{background:"#0d1117",border:"1px solid #1f2937",borderRadius:10,marginBottom:12,overflow:"hidden"}}>
<div style={{background:aBg,padding:"5px 12px",fontSize:9,fontWeight:700,letterSpacing:1,color:aTc}}>ABILITIES</div>
{data.abilities.map((a,i)=>(
<div key={i} style={{padding:"9px 12px",borderBottom:i<data.abilities.length-1?"1px solid #1f2937":"none"}}>
<div style={{fontSize:11,fontWeight:800,color:aTc,marginBottom:3}}>{a.name}</div>
<div style={{fontSize:12,color:"#d1d5db",lineHeight:1.6}}>{H(a.desc)}</div>
</div>
))}
</div>
{data.notes&&<div style={{background:"#0d1117",border:"1px solid #f59e0b44",borderRadius:10,marginBottom:12,overflow:"hidden"}}><div style={{background:"#78350f",padding:"5px 12px",fontSize:9,fontWeight:700,letterSpacing:1,color:"#fcd34d"}}>TACTICAL NOTES</div><div style={{padding:"10px 12px",fontSize:12,color:"#d1d5db",lineHeight:1.7}}>{H(data.notes)}</div></div>}
<div style={{background:"#0d1117",border:"1px solid #1f2937",borderRadius:10,overflow:"hidden"}}>
<div style={{background:"#1f2937",padding:"5px 12px",fontSize:9,fontWeight:700,letterSpacing:1,color:"#9ca3af"}}>KEYWORDS</div>
<div style={{padding:"10px 12px",display:"flex",flexWrap:"wrap",gap:5}}>
{data.keywords.map((k,i)=><span key={i} style={{fontSize:10,padding:"3px 8px",borderRadius:4,background:"#111827",border:"1px solid #374151",color:"#9ca3af"}}>{k}</span>)}
</div>
</div>
</div>
</div>
</>
);
};
const TermPopup = () => {
if(!activeTerm) return null;
const g=GLOSSARY[activeTerm]; if(!g) return null;
const col=CAT_COLORS[g.cat]||"#6b7280";
return (
<div style={{position:"sticky",top:8,zIndex:100,background:"#0d0d1a",border:`2px solid ${col}`,borderRadius:12,padding:"13px 16px",marginBottom:14,boxShadow:`0 0 20px ${col}44`}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
<div><div style={{fontSize:15,fontWeight:800,color:"#fff",marginBottom:2}}>{activeTerm}</div><div style={{fontSize:10,color:col,fontWeight:700,marginBottom:6,letterSpacing:1}}>{g.cat.toUpperCase()}</div></div>
<button onClick={()=>setActiveTerm(null)} style={{background:"transparent",border:"none",color:"#9ca3af",cursor:"pointer",fontSize:18,padding:"0 0 0 12px"}}>✕</button>
</div>
<div style={{fontSize:12,color:"#e5e7eb",lineHeight:1.6}}>{g.def}</div>
</div>
);
};
const DeployTab = () => {
const tips = goingFirst===null ? null : (goingFirst ? DEPLOYMENT[listKey].first : DEPLOYMENT[listKey].second);
return (
<div>
<div style={{background:"#0d1117",border:"2px solid #e879f9",borderRadius:10,padding:14,marginBottom:12}}>
<div style={{fontSize:11,color:"#e879f9",letterSpacing:1,fontWeight:700,marginBottom:10}}>WHO GOES FIRST?</div>
<div style={{display:"flex",gap:8}}>
<button onClick={()=>setGoingFirst(true)} style={{flex:1,padding:"12px 8px",borderRadius:10,border:`2px solid ${goingFirst===true?"#4ade80":"#374151"}`,background:goingFirst===true?"#064e3b":"transparent",color:goingFirst===true?"#4ade80":"#9ca3af",fontSize:13,fontWeight:800,cursor:"pointer"}}>⚔️ I GO FIRST</button>
<button onClick={()=>setGoingFirst(false)} style={{flex:1,padding:"12px 8px",borderRadius:10,border:`2px solid ${goingFirst===false?"#f87171":"#374151"}`,background:goingFirst===false?"#450a0a":"transparent",color:goingFirst===false?"#f87171":"#9ca3af",fontSize:13,fontWeight:800,cursor:"pointer"}}>🛡️ OPPONENT FIRST</button>
</div>
{goingFirst!==null&&(
<div style={{marginTop:10,padding:"8px 12px",borderRadius:8,background:goingFirst?"#064e3b22":"#450a0a22",border:`1px solid ${goingFirst?"#4ade80":"#f87171"}`,fontSize:11,color:goingFirst?"#4ade80":"#f87171"}}>
{goingFirst ? "Going first — play aggressively. Rush objectives, set up Turn 2 Deep Strike." : "Going second — play reactively. Your Turn 1 comes AFTER their full turn. Watch their patterns."}
</div>
)}
</div>
{tips ? (
<div style={{background:"#0d1117",border:"2px solid #f97316",borderRadius:10,marginBottom:12,overflow:"hidden"}}>
<div style={{background:"linear-gradient(135deg,#7c2d12,#3b0f05)",padding:"10px 14px"}}>
<div style={{fontWeight:800,fontSize:13,letterSpacing:1}}>📍 DEPLOYMENT CHECKLIST</div>
<div style={{fontSize:10,color:"#fb923c",marginTop:2}}>{goingFirst?"Going First":"Going Second"}</div>
</div>
<div style={{padding:10}}>
{tips.map((item,i)=>{
const id="deploy-"+i; const done=!!checked[id];
return (
<div key={i} onClick={()=>toggleCheck(id)} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"8px 6px",borderRadius:8,cursor:"pointer",background:done?"rgba(74,222,128,.08)":"transparent",marginBottom:4}}>
<div style={{width:22,height:22,borderRadius:6,border:`2px solid ${done?"#4ade80":"#374151"}`,background:done?"#4ade80":"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",marginTop:1}}>
{done&&<span style={{fontSize:13,color:"#000",fontWeight:900}}>✓</span>}
</div>
<span style={{fontSize:12,color:done?"#6b7280":"#e5e7eb",textDecoration:done?"line-through":"none",lineHeight:1.5}}>{H(item)}</span>
</div>
);
})}
</div>
</div>
) : (
<div style={{background:"#0d1117",border:"1px dashed #374151",borderRadius:10,padding:24,textAlign:"center",marginBottom:12}}>
<div style={{fontSize:13,color:"#6b7280"}}>Select who goes first to see deployment tips</div>
</div>
)}
<button onClick={startGame} disabled={goingFirst===null}
style={{width:"100%",padding:"16px",borderRadius:10,border:`2px solid ${goingFirst===null?"#374151":"#e879f9"}`,background:goingFirst===null?"transparent":"#4c1d95",color:goingFirst===null?"#374151":"#fff",fontSize:15,fontWeight:900,cursor:goingFirst===null?"not-allowed":"pointer",letterSpacing:1,marginBottom:4}}>
{goingFirst===null?"SELECT TURN ORDER FIRST":goingFirst?"⚔️ START GAME — I GO FIRST":"🛡️ START GAME — OPPONENT GOES FIRST"}
</button>
{goingFirst===false&&<div style={{fontSize:11,color:"#f87171",textAlign:"center",marginTop:4}}>You'll see Opponent's Turn 1 reactive plays first, then your Turn 1 begins.</div>}
</div>
);
};
const TurnTab = () => (
<div>
<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
<div style={{background:"#1a1a2e",border:"1px solid #4c1d95",borderRadius:8,padding:"4px 14px",display:"flex",alignItems:"center",gap:8}}>
{round===0
? <span style={{fontSize:13,fontWeight:900,color:"#f87171",letterSpacing:1}}>OPP TURN 1</span>
: <><span style={{fontSize:10,color:"#9ca3af",letterSpacing:1}}>ROUND</span><span style={{fontSize:22,fontWeight:900,color:"#e879f9",lineHeight:1}}>{round}</span><span style={{fontSize:10,color:"#9ca3af",letterSpacing:1}}>{phase==="reactive"?"OPP TURN":"MY TURN"}</span></>
}
</div>
<button onClick={advancePhase} style={{padding:"6px 14px",borderRadius:8,border:`1px solid ${pc}`,background:`${pc}33`,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer"}}>
{round===0?"→ MY TURN 1":phase==="end"?"→ OPP TURN":phase==="reactive"&&round>=5?"GAME OVER":phase==="reactive"?"→ NEXT ROUND":"→ NEXT PHASE"}
</button>
</div>
<div style={{display:"flex",gap:4,marginBottom:12,flexWrap:"wrap"}}>
{ALL_FLOW.map(p=>(
<button key={p} onClick={()=>{setPhase(p);setActivationStep(0);}} style={{flex:"1 1 auto",padding:"8px 4px",borderRadius:8,border:`2px solid ${PHASE_COLORS[p]}`,background:phase===p?PHASE_COLORS[p]:"transparent",color:phase===p?"#fff":PHASE_COLORS[p],fontSize:10,fontWeight:800,cursor:"pointer"}}>
{PHASE_ICONS[p]}<br/>{p==="reactive"?"OPP":PHASE_LABELS[p].split(" ")[0].toUpperCase()}
</button>
))}
</div>
<div style={{background:"#0d1117",border:`2px solid ${pc}`,borderRadius:10,marginBottom:12,overflow:"hidden"}}>
<div style={{background:pc,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
<span style={{fontWeight:800,fontSize:13,letterSpacing:1}}>{PHASE_ICONS[phase]} {PHASE_LABELS[phase].toUpperCase()} — CHECKLIST</span>
<span style={{fontSize:12,color:"rgba(255,255,255,.7)"}}>{checkItems.filter((_,i)=>checked[phase+"-"+i]).length}/{checkItems.length}</span>
</div>
<div style={{padding:10}}>
{checkItems.map((item,i)=>{
const id=phase+"-"+i; const done=!!checked[id];
return (
<div key={i} onClick={()=>toggleCheck(id)} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"8px 6px",borderRadius:8,cursor:"pointer",background:done?"rgba(74,222,128,.08)":"transparent",marginBottom:4}}>
<div style={{width:22,height:22,borderRadius:6,border:`2px solid ${done?"#4ade80":"#374151"}`,background:done?"#4ade80":"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",marginTop:1}}>
{done&&<span style={{fontSize:13,color:"#000",fontWeight:900}}>✓</span>}
</div>
<span style={{fontSize:12,color:done?"#6b7280":"#e5e7eb",textDecoration:done?"line-through":"none",lineHeight:1.5}}>{H(item)}</span>
</div>
);
})}
{checkItems.length>0&&<button onClick={()=>{const c={...checked};checkItems.forEach((_,i)=>{c[phase+"-"+i]=true;});setChecked(c);}} style={{width:"100%",marginTop:6,padding:"6px",borderRadius:6,border:"1px solid #374151",background:"transparent",color:"#6b7280",fontSize:11,cursor:"pointer"}}>Mark all done</button>}
</div>
</div>
<div style={{background:"#0d1117",border:`2px solid ${pc}55`,borderRadius:10,marginBottom:12,overflow:"hidden"}}>
<div style={{background:`${pc}88`,padding:"10px 14px"}}><span style={{fontWeight:800,fontSize:13,letterSpacing:1}}>🔢 ACTIVATION ORDER</span></div>
<div style={{padding:10}}>
{actItems.map((item,i)=>(
<div key={i} onClick={()=>setActivationStep(i)} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"8px 6px",borderRadius:8,cursor:"pointer",background:activationStep===i?`${pc}33`:"transparent",border:activationStep===i?`1px solid ${pc}`:"1px solid transparent",marginBottom:4}}>
<div style={{width:22,height:22,borderRadius:"50%",background:activationStep===i?pc:"#1f2937",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,marginTop:1}}>{i+1}</div>
<span style={{fontSize:12,color:activationStep===i?"#fff":"#d1d5db",lineHeight:1.5}}>{H(item)}</span>
</div>
))}
<div style={{display:"flex",gap:6,marginTop:8}}>
<button onClick={()=>setActivationStep(s=>Math.max(0,s-1))} style={{flex:1,padding:"8px",borderRadius:6,border:`1px solid ${pc}`,background:"transparent",color:pc,fontSize:12,cursor:"pointer"}}>← Prev</button>
<button onClick={()=>setActivationStep(s=>Math.min(actItems.length-1,s+1))} style={{flex:1,padding:"8px",borderRadius:6,border:`1px solid ${pc}`,background:pc,color:"#fff",fontSize:12,cursor:"pointer",fontWeight:700}}>Next →</button>
</div>
</div>
</div>
{phase==="end"&&<button onClick={advancePhase} style={{width:"100%",padding:"14px",borderRadius:10,border:"2px solid #4c1d95",background:"#2e1065",color:"#fff",fontSize:14,fontWeight:800,cursor:"pointer",marginBottom:12}}>🛡️ END MY TURN — START OPPONENT'S TURN</button>}
{phase==="reactive"&&<button onClick={round===0?advancePhase:nextRound} disabled={round>=5&&round!==0}
style={{width:"100%",padding:"14px",borderRadius:10,border:`2px solid ${round===0?"#f87171":round>=5?"#374151":"#4ade80"}`,background:round===0?"#450a0a":round>=5?"#1f2937":"#065f46",color:"#fff",fontSize:14,fontWeight:800,cursor:round>=5&&round!==0?"not-allowed":"pointer",marginBottom:12}}>
{round===0?"⚔️ OPP TURN 1 DONE — START MY TURN 1":round>=5?"🏁 GAME OVER — ROUND 5 COMPLETE":`✅ END ROUND ${round} — START ROUND ${round+1}`}
</button>}
</div>
);
const CpTab = () => (
<div>
<div style={{background:"#0d1117",border:"2px solid #f59e0b",borderRadius:12,padding:"20px 16px",marginBottom:12,textAlign:"center"}}>
<div style={{fontSize:11,color:"#6b7280",letterSpacing:2,marginBottom:8}}>CURRENT COMMAND POINTS</div>
<div style={{fontSize:64,fontWeight:900,color:"#f59e0b",lineHeight:1}}>{cp}</div>
<div style={{fontSize:12,color:"#6b7280",marginTop:4}}>Round {round===0?"(Opp Turn 1)":round} · {build?.detachment?.split("(")[0]}</div>
<div style={{display:"flex",gap:8,marginTop:14,justifyContent:"center"}}>
<button onClick={()=>modCp(-2,"Spent 2CP")} style={{width:50,height:50,borderRadius:10,border:"2px solid #ef4444",background:"#7f1d1d",color:"#fff",fontSize:20,fontWeight:900,cursor:"pointer"}}>−2</button>
<button onClick={()=>modCp(-1,"Spent 1CP")} style={{width:50,height:50,borderRadius:10,border:"2px solid #f87171",background:"#991b1b",color:"#fff",fontSize:24,fontWeight:900,cursor:"pointer"}}>−</button>
<button onClick={()=>modCp(1,"Gained 1CP")} style={{width:50,height:50,borderRadius:10,border:"2px solid #4ade80",background:"#065f46",color:"#fff",fontSize:24,fontWeight:900,cursor:"pointer"}}>+</button>
<button onClick={()=>modCp(2,"Gained 2CP")} style={{width:50,height:50,borderRadius:10,border:"2px solid #4ade80",background:"#064e3b",color:"#fff",fontSize:20,fontWeight:900,cursor:"pointer"}}>+2</button>
</div>
</div>
<div style={{background:"#0d1117",border:"1px solid #1f2937",borderRadius:10,padding:12,marginBottom:12}}>
<div style={{fontSize:11,color:"#6b7280",letterSpacing:1,marginBottom:10}}>QUICK SPEND</div>
<div style={{display:"flex",flexDirection:"column",gap:6}}>
{STRATAGEMS(listKey).map(s=>(
<div key={s.n} style={{display:"flex",alignItems:"stretch",borderRadius:8,border:`1px solid ${s.c===0?"#4ade80":"#f59e0b"}`,overflow:"hidden"}}>
<button onClick={()=>modCp(-s.c,`Spent: ${s.n}`)} style={{width:54,flexShrink:0,background:s.c===0?"#064e3b":"#1a1200",border:"none",color:s.c===0?"#4ade80":"#f59e0b",fontSize:s.c===0?9:13,fontWeight:900,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1,padding:"8px 4px",borderRight:`1px solid ${s.c===0?"#4ade80":"#f59e0b"}`}}>
<span>{s.c===0?"FREE":s.c+"CP"}</span><span style={{fontSize:8,opacity:.5}}>TAP</span>
</button>
<div style={{padding:"7px 10px",flex:1}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
<span style={{fontSize:11,fontWeight:800,color:"#e5e7eb"}}>{s.n}</span>
<span style={{fontSize:9,color:"#6b7280"}}>{s.phase}</span>
</div>
<span style={{fontSize:10,color:"#9ca3af",lineHeight:1.4}}>{s.desc}</span>
</div>
</div>
))}
</div>
</div>
<div style={{background:"#0d1117",border:"1px solid #1f2937",borderRadius:10,padding:12,marginBottom:12}}>
<div style={{fontSize:11,color:"#6b7280",letterSpacing:1,marginBottom:8}}>CP INCOME</div>
{(listKey==="abaddon"
?["Base: +1CP per Command phase","DARK DESTINY: +1CP when Abaddon's Dark Pact rolls 7+","LORD OF CHAOS (Chaos Lord): REAVERS' HASTE costs 0CP on his unit","LORD OF CHAOS (Abaddon): −1CP on Stratagems targeting his unit"]
:["Base: +1CP per Command phase","TROPHY TAKER (Master of Executions): +1CP each time it kills an enemy CHARACTER","LORD OF CHAOS (Chaos Lord): REAVERS' HASTE costs 0CP on his unit","No DARK DESTINY — CP is tighter. Spend carefully."]
).map((t,i,a)=><div key={i} style={{fontSize:12,color:"#d1d5db",padding:"4px 0",borderBottom:i<a.length-1?"1px solid #1f2937":"none"}}>✦ {t}</div>)}
<button onClick={()=>modCp(1,"Command phase +1CP")} style={{width:"100%",marginTop:10,padding:"10px",borderRadius:8,border:"2px solid #4ade80",background:"#065f46",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ COMMAND PHASE: Gain 1CP</button>
{listKey==="abaddon"&&<button onClick={()=>modCp(1,"Dark Destiny triggered")} style={{width:"100%",marginTop:6,padding:"10px",borderRadius:8,border:"2px solid #e879f9",background:"#4c1d95",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ DARK DESTINY triggered</button>}
</div>
<div style={{background:"#0d1117",border:"1px solid #1f2937",borderRadius:10,padding:12}}>
<div style={{fontSize:11,color:"#6b7280",letterSpacing:1,marginBottom:8}}>CP LOG</div>
{cpLog.length===0&&<div style={{fontSize:12,color:"#374151",textAlign:"center",padding:"8px 0"}}>No actions yet</div>}
{[...cpLog].reverse().map((l,i)=>(
<div key={i} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid #1f2937",fontSize:12}}>
<span style={{color:"#9ca3af"}}>{l.r}</span>
<span style={{color:l.d>0?"#4ade80":"#f87171",fontWeight:700}}>{l.d>0?"+":""}{l.d}CP</span>
</div>
))}
{cpLog.length>0&&<button onClick={()=>setCpLog([])} style={{width:"100%",marginTop:8,padding:"6px",borderRadius:6,border:"1px solid #374151",background:"transparent",color:"#6b7280",fontSize:11,cursor:"pointer"}}>Clear log</button>}
</div>
</div>
);
const ReservesTab = () => (
<div>
<div style={{background:"#0d1117",border:"2px solid #1e3a5f",borderRadius:10,marginBottom:12,overflow:"hidden"}}>
<div style={{background:"#1e3a5f",padding:"10px 14px",display:"flex",justifyContent:"space-between"}}>
<span style={{fontWeight:800,fontSize:13,letterSpacing:1}}>📡 RESERVE TRACKER</span>
<span style={{fontSize:12,color:"rgba(255,255,255,.7)"}}>Round {round===0?"(Opp T1)":round}</span>
</div>
<div style={{padding:10}}>
{(build?.reserveUnits||[]).map((unit,i)=>{
const key=listKey+"-"+i; const arrived=reserves[key];
return (
<div key={i} onClick={()=>setReserves(r=>({...r,[key]:!r[key]}))} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 10px",borderRadius:10,background:arrived?"rgba(74,222,128,.08)":"#111122",border:`2px solid ${arrived?"#4ade80":"#374151"}`,marginBottom:8,cursor:"pointer"}}>
<div style={{width:36,height:36,borderRadius:8,background:arrived?"#065f46":"#1f2937",border:`2px solid ${arrived?"#4ade80":"#374151"}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:18}}>{arrived?"✅":"🚀"}</span></div>
<div style={{flex:1}}>
<div style={{fontSize:13,fontWeight:700,color:arrived?"#4ade80":"#e5e7eb"}}>{unit}</div>
<div style={{fontSize:11,color:"#6b7280",marginTop:2}}>{arrived?"ARRIVED":"In Reserve — tap when deployed"}</div>
</div>
</div>
);
})}
</div>
</div>
<div style={{background:"#0d1117",border:"1px solid #1f2937",borderRadius:10,padding:12,marginBottom:12}}>
<div style={{fontSize:11,color:"#6b7280",letterSpacing:1,marginBottom:8}}>DEEP STRIKE RULES</div>
{['Place 9"+ from ALL enemy models in your Reinforcement step.',"RAPID INGRESS (1CP): arrive in OPPONENT'S Reinforcement step — Turn 2 surprise.","A failed charge after Deep Strike: unit sits 9\"+ away with no fight that turn.",'Tip: land as close to 9" as legally possible to maximise charge options.'].map((t,i)=>(
<div key={i} style={{fontSize:12,color:"#d1d5db",padding:"4px 0",borderBottom:i<3?"1px solid #1f2937":"none"}}>• {t}</div>
))}
</div>
</div>
);
const PhasesTab = () => {
const refData=PHASE_REFERENCE[listKey];
const roster=ROSTER[listKey];
const total=roster.reduce((s,u)=>s+u.pts,0);
const roleColors={"Warlord":"#e879f9","Character":"#60a5fa","Elite":"#f59e0b","Battleline":"#4ade80","Heavy":"#f87171","Transport":"#94a3b8"};
return (
<div>
<div style={{background:"#0d1117",border:"2px solid #f97316",borderRadius:10,marginBottom:12,overflow:"hidden"}}>
<div onClick={()=>setShowRoster(s=>!s)} style={{background:"linear-gradient(135deg,#7c2d12,#3b0f05)",padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}>
<span style={{fontWeight:800,fontSize:13,letterSpacing:1}}>📋 ARMY ROSTER</span>
<div style={{display:"flex",alignItems:"center",gap:10}}>
<span style={{fontSize:12,color:"#fb923c",fontWeight:700}}>{total} pts</span>
<span style={{color:"#fb923c",fontSize:18,transform:showRoster?"rotate(180deg)":"none",transition:".2s"}}>▾</span>
</div>
</div>
{showRoster&&<div style={{padding:"8px 10px"}}>
{roster.map((entry,i)=>(
<div key={i} style={{display:"flex",alignItems:"flex-start",gap:8,padding:"6px 4px",borderBottom:i<roster.length-1?"1px solid #1f2937":"none"}}>
<span style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:"#1f2937",border:`1px solid ${roleColors[entry.role]||"#374151"}`,color:roleColors[entry.role]||"#9ca3af",fontWeight:700,whiteSpace:"nowrap",marginTop:1}}>{entry.role.toUpperCase()}</span>
<div style={{flex:1,minWidth:0}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
<span style={{fontSize:12,fontWeight:700,color:"#fff"}}>{H(entry.unit)}</span>
<span style={{fontSize:10,color:"#6b7280",flexShrink:0,marginLeft:6}}>{entry.pts}pts</span>
</div>
<div style={{fontSize:10,color:"#9ca3af",marginTop:1,lineHeight:1.4}}>{entry.notes}</div>
</div>
</div>
))}
</div>}
</div>
<button onClick={()=>setShowGloss(s=>!s)} style={{width:"100%",background:showGloss?"#1a1a00":"#111100",border:"2px solid #f59e0b",borderRadius:10,padding:"10px 16px",color:"#fcd34d",fontWeight:700,fontSize:13,cursor:"pointer",marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
<span>📖 GLOSSARY & DATASHEETS</span><span style={{transform:showGloss?"rotate(180deg)":"none",transition:".2s"}}>▾</span>
</button>
{showGloss&&(
<div style={{background:"#0f0f00",border:"1px solid #78350f",borderRadius:10,marginBottom:12,padding:12}}>
<div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
{glossCats.map(c=><button key={c} onClick={()=>setGlossFilter(c)} style={{padding:"4px 10px",borderRadius:6,border:"1px solid #f59e0b",background:glossFilter===c?"#f59e0b":"transparent",color:glossFilter===c?"#000":"#f59e0b",fontSize:11,fontWeight:700,cursor:"pointer"}}>{c}</button>)}
</div>
<div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:12}}>
{Object.entries(GLOSSARY).filter(([,v])=>glossFilter==="All"||v.cat===glossFilter).map(([term,g])=>(
<div key={term} onClick={()=>setActiveTerm(term)} style={{background:"#0d0d14",borderLeft:`3px solid ${CAT_COLORS[g.cat]||"#6b7280"}`,borderRadius:6,padding:"7px 12px",cursor:"pointer",display:"flex",justifyContent:"space-between"}}>
<span style={{fontSize:12,fontWeight:700,color:"#fff"}}>{term}</span>
<span style={{fontSize:10,color:CAT_COLORS[g.cat]||"#6b7280"}}>{g.cat}</span>
</div>
))}
</div>
<div style={{borderTop:"1px solid #374151",paddingTop:10,marginBottom:10}}>
<div style={{fontSize:10,color:"#6b7280",letterSpacing:1,marginBottom:8}}>CHARACTER DATASHEETS</div>
{Object.entries(CHARACTERS).map(([key,char])=>(
<div key={key} onClick={()=>setActiveSheet({key,type:'char'})} style={{background:"#0d0d14",borderLeft:"3px solid #3b82f6",borderRadius:6,padding:"7px 12px",cursor:"pointer",display:"flex",justifyContent:"space-between",marginBottom:5}}>
<span style={{fontSize:12,fontWeight:700,color:"#fff"}}>{char.fullName}</span>
<span style={{fontSize:10,color:"#60a5fa"}}>{char.role.split(" · ")[0]}</span>
</div>
))}
</div>
<div style={{borderTop:"1px solid #374151",paddingTop:10}}>
<div style={{fontSize:10,color:"#6b7280",letterSpacing:1,marginBottom:8}}>UNIT DATASHEETS</div>
{Object.entries(UNITS).map(([key,unit])=>(
<div key={key} onClick={()=>setActiveSheet({key,type:'unit'})} style={{background:"#0d0d14",borderLeft:"3px solid #10b981",borderRadius:6,padding:"7px 12px",cursor:"pointer",display:"flex",justifyContent:"space-between",marginBottom:5}}>
<span style={{fontSize:12,fontWeight:700,color:"#fff"}}>{unit.name}</span>
<span style={{fontSize:10,color:"#34d399"}}>{unit.role}</span>
</div>
))}
</div>
</div>
)}
{PHASES.map(p=>{
const isOpen=openPhaseRef===p; const col=PHASE_COLORS[p]; const items=refData[p]||[];
return (
<div key={p} style={{marginBottom:8}}>
<div onClick={()=>setOpenPhaseRef(isOpen?null:p)} style={{borderRadius:10,padding:"12px 16px",cursor:"pointer",background:isOpen?col:"#111122",border:`2px solid ${col}`,display:"flex",justifyContent:"space-between",alignItems:"center",boxShadow:isOpen?`0 0 12px ${col}55`:"none"}}>
<span style={{fontWeight:900,fontSize:13,letterSpacing:1,color:isOpen?"#fff":col}}>{PHASE_ICONS[p]} {PHASE_LABELS[p].toUpperCase()}</span>
<span style={{color:col,fontSize:18,transform:isOpen?"rotate(180deg)":"none",transition:".2s"}}>▾</span>
</div>
{isOpen&&<div style={{background:"#0d0d1f",border:`1px solid ${col}55`,borderTop:"none",borderRadius:"0 0 10px 10px",padding:12}}><ul style={{paddingLeft:18}}>{items.map((item,i)=><li key={i} style={{fontSize:13,color:"#e5e7eb",marginBottom:7,lineHeight:1.6}}>{H(item)}</li>)}</ul></div>}
{p!=="reactive"&&<div style={{display:"flex",flexDirection:"column",alignItems:"center",margin:"3px 0"}}><div style={{width:2,height:10,background:"#1e3a5f"}}/><div style={{width:0,height:0,borderLeft:"5px solid transparent",borderRight:"5px solid transparent",borderTop:"7px solid #1e3a5f"}}/></div>}
</div>
);
})}
</div>
);
};
const tabs = [
...(!gameStarted?[{id:"deploy",icon:"📍",label:"DEPLOY"}]:[]),
{id:"turn",icon:"⚡",label:"ACTIVE TURN"},
{id:"cp",icon:"💰",label:"CP TRACKER"},
{id:"reserves",icon:"🚀",label:"RESERVES"},
{id:"phases",icon:"📖",label:"REFERENCE"},
];
return (
<div style={{background:"#0a0a14",minHeight:"100vh",fontFamily:"'Segoe UI',sans-serif",color:"#fff"}}>
<div style={{background:"#0d1117",borderBottom:"1px solid #1e3a5f",padding:"10px 14px 0"}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
<div style={{display:"flex",alignItems:"center",gap:10}}>
<button onClick={()=>setScreen("select")} style={{background:"transparent",border:"1px solid #374151",color:"#6b7280",fontSize:11,padding:"4px 8px",borderRadius:6,cursor:"pointer"}}>← Builds</button>
<div>
<div style={{fontSize:9,color:"#f87171",letterSpacing:2,fontWeight:700}}>CHAOS SPACE MARINES</div>
<div style={{fontSize:13,fontWeight:900,color:"#e879f9"}}>{listKey==="abaddon"?"Abaddon Build · 1975 pts":"Maelstrom Build · 1990 pts"}</div>
</div>
</div>
</div>
<div style={{display:"flex",alignItems:"stretch",gap:5,marginBottom:8}}>
<div style={{flex:1,background:"#0a1a0a",border:"2px solid #4ade80",borderRadius:10,padding:"4px 6px",textAlign:"center"}}>
<div style={{fontSize:9,color:"#4ade80",letterSpacing:1,fontWeight:700}}>MY VP</div>
<div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
<button onClick={()=>setMyVp(v=>Math.max(0,v-1))} style={{background:"transparent",border:"none",color:"#4ade80",fontSize:16,fontWeight:900,cursor:"pointer",padding:"0 2px",lineHeight:1}}>−</button>
<div style={{fontSize:22,fontWeight:900,color:"#4ade80",lineHeight:1,minWidth:28,textAlign:"center"}}>{myVp}</div>
<button onClick={()=>setMyVp(v=>v+1)} style={{background:"transparent",border:"none",color:"#4ade80",fontSize:16,fontWeight:900,cursor:"pointer",padding:"0 2px",lineHeight:1}}>+</button>
</div>
</div>
<div onClick={()=>setTab("cp")} style={{background:"#1a1a00",border:"2px solid #f59e0b",borderRadius:10,padding:"4px 12px",cursor:"pointer",textAlign:"center",minWidth:58}}>
<div style={{fontSize:9,color:"#6b7280",letterSpacing:1}}>CP</div>
<div style={{fontSize:22,fontWeight:900,color:"#f59e0b",lineHeight:1}}>{cp}</div>
<div style={{fontSize:8,color:"#6b7280"}}>R{round===0?"0":round}</div>
</div>
<div style={{flex:1,background:"#1a0a0a",border:"2px solid #f87171",borderRadius:10,padding:"4px 6px",textAlign:"center"}}>
<div style={{fontSize:9,color:"#f87171",letterSpacing:1,fontWeight:700}}>OPP VP</div>
<div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
<button onClick={()=>setOppVp(v=>Math.max(0,v-1))} style={{background:"transparent",border:"none",color:"#f87171",fontSize:16,fontWeight:900,cursor:"pointer",padding:"0 2px",lineHeight:1}}>−</button>
<div style={{fontSize:22,fontWeight:900,color:"#f87171",lineHeight:1,minWidth:28,textAlign:"center"}}>{oppVp}</div>
<button onClick={()=>setOppVp(v=>v+1)} style={{background:"transparent",border:"none",color:"#f87171",fontSize:16,fontWeight:900,cursor:"pointer",padding:"0 2px",lineHeight:1}}>+</button>
</div>
</div>
</div>
<div style={{display:"flex",borderTop:"1px solid #1e3a5f"}}>
{tabs.map(t=>(
<button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:"8px 2px",background:"transparent",border:"none",borderBottom:tab===t.id?"3px solid #f97316":"3px solid transparent",color:tab===t.id?"#f97316":"#6b7280",fontSize:9,fontWeight:700,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
<span style={{fontSize:15}}>{t.icon}</span>{t.label}
</button>
))}
</div>
</div>
<div style={{padding:"14px 14px 100px"}}>
<TermPopup/>
{tab==="deploy"&&<DeployTab/>}
{tab==="turn"&&<TurnTab/>}
{tab==="cp"&&<CpTab/>}
{tab==="reserves"&&<ReservesTab/>}
{tab==="phases"&&<PhasesTab/>}
</div>
<DatasheetDrawer/>
</div>
);
}
