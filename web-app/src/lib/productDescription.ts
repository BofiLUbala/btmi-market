/**
 * Category-aware product description layout.
 *
 * The API stores a product description as one free-text string, and that stays
 * the contract: nothing here changes what the backend receives or validates.
 * What changes is the *shape* of that string. While creating a product the
 * seller fills a short intro plus a few sections chosen for the category
 * (fabric & care for fashion, what's in the box for electronics, ingredients
 * for food…). They are serialised as
 *
 *     Intro paragraph
 *
 *     ## Section heading
 *     Section body
 *
 * and the buyer page parses the `## ` headings back into accordions. A legacy
 * description without headings parses as a single intro, so every product that
 * already exists keeps rendering exactly as before.
 *
 * This file is framework-free and mirrored verbatim in
 * android/src/lib/productDescription.ts — keep the two in sync.
 */

export type DescLang = 'fr' | 'en'
type Localized = Record<DescLang, string>

export type DescriptionTone =
  | 'fashion'
  | 'shoes'
  | 'children'
  | 'electronics'
  | 'home'
  | 'beauty'
  | 'food'
  | 'sport'
  | 'automotive'
  | 'services'
  | 'default'

export interface DescriptionSection {
  key: string
  label: Localized
  placeholder: Localized
}

export interface DescriptionTemplate {
  tone: DescriptionTone
  introPlaceholder: Localized
  sections: DescriptionSection[]
}

const SLUG_TO_TONE: Record<string, DescriptionTone> = {
  fashion: 'fashion', clothing: 'fashion', apparel: 'fashion', mode: 'fashion',
  shoes: 'shoes', footwear: 'shoes', chaussures: 'shoes',
  children: 'children', kids: 'children', baby: 'children', enfants: 'children',
  electronics: 'electronics', technology: 'electronics', tech: 'electronics', phones: 'electronics',
  home: 'home', furniture: 'home', decor: 'home', maison: 'home',
  beauty: 'beauty', cosmetics: 'beauty', 'personal-care': 'beauty', beaute: 'beauty',
  food: 'food', grocery: 'food', restaurant: 'food', alimentation: 'food',
  sport: 'sport', sports: 'sport', fitness: 'sport',
  automotive: 'automotive', auto: 'automotive', car: 'automotive', vehicle: 'automotive',
  services: 'services', service: 'services',
}

export function descriptionTone(slug?: string | null): DescriptionTone {
  if (!slug) return 'default'
  return SLUG_TO_TONE[slug.toLowerCase()] ?? 'default'
}

const s = (key: string, fr: string, en: string, pfr: string, pen: string): DescriptionSection => ({
  key,
  label: { fr, en },
  placeholder: { fr: pfr, en: pen },
})

const TEMPLATES: Record<DescriptionTone, Omit<DescriptionTemplate, 'tone'>> = {
  fashion: {
    introPlaceholder: {
      fr: 'Ex. : Manteau droit en laine mélangée, coupe légèrement oversize, idéal pour la mi-saison.',
      en: 'e.g. Straight wool-blend coat with a slightly oversized fit, ideal between seasons.',
    },
    sections: [
      s('materials', 'Matières & entretien', 'Materials & care', 'Ex. : 70 % laine, 30 % polyester. Nettoyage à sec.', 'e.g. 70% wool, 30% polyester. Dry clean only.'),
      s('fit', 'Coupe & taille', 'Fit & sizing', 'Ex. : Taille normalement. Le mannequin mesure 1,75 m et porte un M.', 'e.g. True to size. Model is 175 cm and wears an M.'),
      s('details', 'Détails', 'Details', 'Ex. : Deux poches plaquées, doublure satinée, boutons en corne.', 'e.g. Two patch pockets, satin lining, horn buttons.'),
    ],
  },
  shoes: {
    introPlaceholder: {
      fr: 'Ex. : Sneakers en cuir lisse, semelle légère pour marcher toute la journée.',
      en: 'e.g. Smooth leather sneakers with a light sole for all-day walking.',
    },
    sections: [
      s('materials', 'Matières', 'Materials', 'Ex. : Tige en cuir, doublure textile, semelle caoutchouc.', 'e.g. Leather upper, textile lining, rubber sole.'),
      s('fit', 'Pointure & ajustement', 'Size & fit', 'Ex. : Chausse petit, prenez une pointure au-dessus.', 'e.g. Runs small, go one size up.'),
      s('care', 'Entretien', 'Care', 'Ex. : Nettoyer avec un chiffon humide, ne pas passer en machine.', 'e.g. Wipe with a damp cloth, do not machine wash.'),
    ],
  },
  children: {
    introPlaceholder: {
      fr: 'Ex. : Ensemble en coton doux, pensé pour le confort des tout-petits.',
      en: 'e.g. Soft cotton set designed for little ones’ comfort.',
    },
    sections: [
      s('age', 'Âge recommandé', 'Recommended age', 'Ex. : De 2 à 4 ans.', 'e.g. Ages 2 to 4.'),
      s('safety', 'Sécurité & normes', 'Safety & standards', 'Ex. : Sans petites pièces. Conforme aux normes CE.', 'e.g. No small parts. CE compliant.'),
      s('care', 'Matières & entretien', 'Materials & care', 'Ex. : 100 % coton, lavable à 30 °C.', 'e.g. 100% cotton, machine wash at 30 °C.'),
    ],
  },
  electronics: {
    introPlaceholder: {
      fr: 'Ex. : Casque sans fil à réduction de bruit, 30 h d’autonomie.',
      en: 'e.g. Wireless noise-cancelling headphones, 30 h battery life.',
    },
    sections: [
      s('specs', 'Caractéristiques techniques', 'Technical specs', 'Ex. : Bluetooth 5.3, USB-C, 250 g.', 'e.g. Bluetooth 5.3, USB-C, 250 g.'),
      s('box', 'Contenu de la boîte', 'What’s in the box', 'Ex. : Casque, câble USB-C, étui de transport.', 'e.g. Headphones, USB-C cable, carry case.'),
      s('warranty', 'Garantie', 'Warranty', 'Ex. : Garantie vendeur 6 mois.', 'e.g. 6-month seller warranty.'),
    ],
  },
  home: {
    introPlaceholder: {
      fr: 'Ex. : Fauteuil au design épuré, assise profonde et confortable.',
      en: 'e.g. Clean-lined armchair with a deep, comfortable seat.',
    },
    sections: [
      s('dimensions', 'Dimensions', 'Dimensions', 'Ex. : L 80 × P 75 × H 90 cm, 12 kg.', 'e.g. W 80 × D 75 × H 90 cm, 12 kg.'),
      s('materials', 'Matériaux & entretien', 'Materials & care', 'Ex. : Structure en bois massif, tissu déhoussable.', 'e.g. Solid wood frame, removable fabric cover.'),
      s('assembly', 'Montage', 'Assembly', 'Ex. : Livré monté. / Montage simple en 10 minutes.', 'e.g. Delivered assembled. / Easy 10-minute assembly.'),
    ],
  },
  beauty: {
    introPlaceholder: {
      fr: 'Ex. : Sérum hydratant léger au fini non gras.',
      en: 'e.g. Lightweight hydrating serum with a non-greasy finish.',
    },
    sections: [
      s('benefits', 'Bienfaits', 'Benefits', 'Ex. : Hydrate 24 h, unifie le teint.', 'e.g. 24 h hydration, evens skin tone.'),
      s('usage', 'Conseils d’utilisation', 'How to use', 'Ex. : Appliquer matin et soir sur peau propre.', 'e.g. Apply morning and evening on clean skin.'),
      s('ingredients', 'Ingrédients', 'Ingredients', 'Ex. : Aqua, glycérine, acide hyaluronique…', 'e.g. Aqua, glycerin, hyaluronic acid…'),
    ],
  },
  food: {
    introPlaceholder: {
      fr: 'Ex. : Miel d’acacia récolté localement, texture fluide.',
      en: 'e.g. Locally harvested acacia honey, runny texture.',
    },
    sections: [
      s('ingredients', 'Ingrédients', 'Ingredients', 'Ex. : 100 % miel d’acacia.', 'e.g. 100% acacia honey.'),
      s('allergens', 'Allergènes', 'Allergens', 'Ex. : Aucun. / Contient : arachides.', 'e.g. None. / Contains: peanuts.'),
      s('storage', 'Conservation', 'Storage', 'Ex. : À conserver au sec. À consommer avant 12 mois.', 'e.g. Keep dry. Best before 12 months.'),
    ],
  },
  sport: {
    introPlaceholder: {
      fr: 'Ex. : Ballon de football taille 5, toucher doux et trajectoire stable.',
      en: 'e.g. Size 5 football with a soft touch and stable flight.',
    },
    sections: [
      s('performance', 'Performance', 'Performance', 'Ex. : Conçu pour un usage intensif sur gazon.', 'e.g. Built for intensive use on grass.'),
      s('specs', 'Caractéristiques', 'Specs', 'Ex. : Taille 5, 420 g, cousu main.', 'e.g. Size 5, 420 g, hand-stitched.'),
      s('care', 'Entretien', 'Care', 'Ex. : Nettoyer à l’eau claire, sécher à l’air libre.', 'e.g. Rinse with water, air dry.'),
    ],
  },
  automotive: {
    introPlaceholder: {
      fr: 'Ex. : Kit de plaquettes de frein avant haute endurance.',
      en: 'e.g. High-endurance front brake pad kit.',
    },
    sections: [
      s('compatibility', 'Compatibilité', 'Compatibility', 'Ex. : Toyota Corolla 2014–2019, Yaris 2017+.', 'e.g. Toyota Corolla 2014–2019, Yaris 2017+.'),
      s('specs', 'Caractéristiques', 'Specs', 'Ex. : Référence OEM 04465-02220.', 'e.g. OEM ref. 04465-02220.'),
      s('installation', 'Installation', 'Installation', 'Ex. : Pose conseillée par un professionnel.', 'e.g. Professional fitting recommended.'),
    ],
  },
  services: {
    introPlaceholder: {
      fr: 'Ex. : Installation et configuration de votre réseau Wi-Fi à domicile.',
      en: 'e.g. Home Wi-Fi network installation and setup.',
    },
    sections: [
      s('included', 'Ce qui est inclus', 'What’s included', 'Ex. : Déplacement, installation, test complet.', 'e.g. Travel, installation, full test.'),
      s('process', 'Déroulement', 'How it works', 'Ex. : Prise de rendez-vous sous 24 h, intervention d’1 h.', 'e.g. Booking within 24 h, 1-hour visit.'),
      s('area', 'Zone d’intervention', 'Service area', 'Ex. : Kinshasa – Gombe, Limete, Ngaliema.', 'e.g. Kinshasa – Gombe, Limete, Ngaliema.'),
    ],
  },
  default: {
    introPlaceholder: {
      fr: 'Décrivez le produit en une ou deux phrases simples.',
      en: 'Describe the product in one or two simple sentences.',
    },
    sections: [
      s('features', 'Points forts', 'Highlights', 'Ex. : Résistant, léger, facile à utiliser.', 'e.g. Durable, lightweight, easy to use.'),
      s('usage', 'Utilisation', 'How to use', 'Ex. : Mode d’emploi rapide.', 'e.g. Quick instructions.'),
    ],
  },
}

export function descriptionTemplateFor(slug?: string | null): DescriptionTemplate {
  const tone = descriptionTone(slug)
  return { tone, ...TEMPLATES[tone] }
}

export interface ParsedSection {
  heading: string
  body: string
}

export interface ParsedDescription {
  intro: string
  sections: ParsedSection[]
}

const HEADING = /^##\s+(.+?)\s*$/

/** Splits a stored description into its intro and `## ` sections. */
export function parseDescription(text?: string | null): ParsedDescription {
  const lines = (text ?? '').replace(/\r\n/g, '\n').split('\n')
  const intro: string[] = []
  const sections: ParsedSection[] = []
  let current: { heading: string; body: string[] } | null = null
  for (const line of lines) {
    const match = HEADING.exec(line)
    if (match) {
      if (current) sections.push({ heading: current.heading, body: current.body.join('\n').trim() })
      current = { heading: match[1], body: [] }
    } else if (current) {
      current.body.push(line)
    } else {
      intro.push(line)
    }
  }
  if (current) sections.push({ heading: current.heading, body: current.body.join('\n').trim() })
  return { intro: intro.join('\n').trim(), sections: sections.filter((x) => x.body) }
}

export interface DescriptionDraft {
  intro: string
  values: Record<string, string>
  /** Sections that do not belong to the current template (another category,
   *  or written by hand). Kept so switching the form never loses text. */
  extra: ParsedSection[]
}

export function emptyDescriptionDraft(): DescriptionDraft {
  return { intro: '', values: {}, extra: [] }
}

/** Maps a stored description back onto a template's fields, matching section
 *  headings in either language so a product written in French can be edited
 *  from an English UI. */
export function draftFromDescription(text: string | null | undefined, template: DescriptionTemplate): DescriptionDraft {
  const parsed = parseDescription(text)
  const values: Record<string, string> = {}
  const extra: ParsedSection[] = []
  for (const section of parsed.sections) {
    const needle = section.heading.trim().toLowerCase()
    const match = template.sections.find(
      (x) => x.label.fr.toLowerCase() === needle || x.label.en.toLowerCase() === needle
    )
    if (match && !values[match.key]) values[match.key] = section.body
    else extra.push(section)
  }
  return { intro: parsed.intro, values, extra }
}

/** Serialises a draft back to the single string the API stores. */
export function composeDescription(draft: DescriptionDraft, template: DescriptionTemplate, lang: DescLang): string {
  const parts: string[] = []
  if (draft.intro.trim()) parts.push(draft.intro.trim())
  for (const section of template.sections) {
    const body = (draft.values[section.key] ?? '').trim()
    if (body) parts.push(`## ${section.label[lang]}\n${body}`)
  }
  for (const section of draft.extra) {
    if (section.body.trim()) parts.push(`## ${section.heading}\n${section.body.trim()}`)
  }
  return parts.join('\n\n')
}
