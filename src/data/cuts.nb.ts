import type { CutId, CutInfo } from './cuts'

type CutText = Pick<CutInfo, 'name' | 'sub' | 'blurb' | 'bestFor' | 'plant'>

export const CUTS_NB: Record<CutId, CutText> = {
  head: {
    name: 'Hode',
    blurb: 'Beinrikt, fullt av kollagen og smak. Kokes til kraft, eller deles og stekes helt på japansk vis.',
    bestFor: ['Kraft og suppe', 'Helstekt', 'Kabutoyaki'],
    plant: 'Kappes av ved hodekapping — 11 % av hver sløyd fisk med hode. Selges på fisken når bestillingen er HOG.',
  },
  cheek: {
    name: 'Kjake',
    blurb: 'En liten medaljong rett bak øyet. Mør, søt og berømt som kokkens godbit — to per fisk.',
    bestFor: ['Pannestekt', 'Confit'],
    plant: 'Anlegget skjærer ikke ut kjaker; de følger hodet ved hodekapping.',
  },
  collar: {
    name: 'Krage',
    sub: 'Kama',
    blurb: 'Stripen bak gjellene som bærer brystfinnen. Fet, gelatinøs og umulig å oversteke.',
    bestFor: ['Grill', 'Saltgrillet', 'Shio-yaki'],
    plant: 'Blir sittende på ryggbeinet når filetene løftes — det er ikke et eget produkt i kuttmønsteret.',
  },
  upperFillet: {
    name: 'Øvre filet',
    blurb: 'Den tykke skulderblokken. Jevn i formen, mager men ikke tørr — stykket som skjæres renest til sashimi.',
    bestFor: ['Sashimi', 'Langtidsstekt', 'Gravet'],
    plant: 'Fremre del av trim A-fileten. Trimming til C eller D beholder skinnet og tar ut tverrbeina.',
  },
  loin: {
    name: 'Ryggstykke',
    blurb: 'Det fineste midtstykket. Jevn tykkelse gjør at det stekes jevnt — restaurantporsjonen.',
    bestFor: ['Pannestekt', 'Sous vide', 'Gravet'],
    plant: 'Midten av fileten er der porsjonene skjæres fra — linjen trim E → porsjon.',
  },
  fillet: {
    name: 'Filet',
    blurb: 'Den avsmalnende bakre halvdelen. Tynnere og magrere enn ryggstykket, så den tar varme raskt og røykes vakkert.',
    bestFor: ['Posjert', 'Varmrøkt', 'Pannestekt'],
    plant: 'Skinnfri trim E er fileten med skinnet tatt av; skinnet blir sitt eget biprodukt.',
  },
  steak: {
    name: 'Kotelett',
    blurb: 'Et tverrsnitt med bein gjennom hele fisken. Ryggbeinet holder den saftig på grillen og skinnet holder den sammen.',
    bestFor: ['Grill', 'Stekeplate', 'Ovnsbakt'],
    plant: 'Skjæres rett over den sløyde fisken uten hode, før filetering — så den går forbi filetbordet.',
  },
  tail: {
    name: 'Spord',
    blurb: 'Tynn, muskuløs og mager — fisken svømte mye med denne. Rask varme eller lang graving.',
    bestFor: ['Gravlaks', 'Grill', 'Fiskekaker'],
    plant: 'Den tynne sporden trimmes av og går til farse — restsluket i mønsteret.',
  },
  belly: {
    name: 'Buk',
    blurb: 'Den tynne flappen langs undersiden, stripet med fett. Blir sprø som bacon under grillelementet.',
    bestFor: ['Grillelement', 'Tare-glasert', 'Grillspyd'],
    plant: 'Faller av ved trimming: 7 % av fileten på C-mønsteret, 9 % på D og E — hvis/eller-utbyttet.',
  },
  toro: {
    name: 'Buk',
    sub: 'Toro',
    blurb: 'Den feteste skiven av buken. Smøraktig, marmorert og smelter ved kroppstemperatur — server den rå.',
    bestFor: ['Sashimi', 'Nigiri', 'Aburi'],
    plant: 'På C-trim blir buken på fileten; på D og E trimmes den til bukflapp.',
  },
  spine: {
    name: 'Ryggbein',
    blurb: 'Bein, og det søte skrapte kjøttet mellom dem (nakaochi). Stekes sprøtt eller kokes til dashi.',
    bestFor: ['Dashi', 'Sprøstekt', 'Nakaochi'],
    plant: 'Ryggbeinet: 18 % av fisken uten hode etter at filetene er løftet.',
  },
}
