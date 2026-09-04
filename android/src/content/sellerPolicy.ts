/** Seller policy content — authored once in French, the app's reference
 *  language for legal text. Kept out of the t() locale files on purpose:
 *  this is long-form document content, not UI chrome, and the FR/EN i18n
 *  parity test only tracks keys that go through t(). */
export interface SellerPolicyArticle {
  id: string
  title: string
  paragraphs: string[]
  list?: string[]
}

export const SELLER_POLICY_VERSION = '1.0'
export const SELLER_POLICY_UPDATED_AT = '2026-09-04'

export const SELLER_POLICY_ARTICLES: SellerPolicyArticle[] = [
  {
    id: 'objet',
    title: '1. Objet',
    paragraphs: [
      "La présente Politique des Vendeurs (« Politique ») régit l'accès et l'utilisation de la marketplace TBK par toute personne physique ou morale disposant d'un compte de type Vendeur. Elle complète les Conditions Générales d'Utilisation de TBK et s'applique dès l'activation du compte vendeur, que la vente ait lieu en ligne ou dans un point de vente physique géré depuis l'espace vendeur.",
      "En créant un compte vendeur ou en ajoutant un produit au catalogue, le vendeur déclare avoir lu, compris et accepté l'intégralité de cette Politique.",
    ],
  },
  {
    id: 'compte',
    title: '2. Ouverture du compte vendeur',
    paragraphs: [
      "L'inscription se fait via le formulaire d'inscription vendeur et n'est activée qu'après confirmation du lien envoyé par e-mail, valable 24 heures. Le vendeur s'engage à :",
    ],
    list: [
      'fournir des informations exactes, complètes et à jour sur son identité et, le cas échéant, son entreprise ;',
      'maintenir un seul compte vendeur actif par personne ou entreprise, sauf autorisation écrite de TBK ;',
      'protéger ses identifiants et signaler immédiatement tout accès non autorisé ;',
      'être joignable au numéro de téléphone déclaré pour la coordination des commandes et livraisons.',
    ],
  },
  {
    id: 'catalogue',
    title: '3. Boutiques & catalogue produits',
    paragraphs: ['Chaque fiche produit publiée par le vendeur doit :'],
    list: [
      'correspondre à un produit réellement disponible, avec un niveau de stock exact ;',
      "utiliser des photos réelles du produit vendu (pas de visuel d'un autre article ou d'un fabricant tiers sans lien avec l'annonce) ;",
      "indiquer un nom, une catégorie et — si le produit existe en plusieurs variantes (taille, couleur…) — des options cohérentes avec ce qui est réellement en stock ;",
      "afficher un prix, une devise (FC ou USD) et, en cas de promotion, une période de validité claire.",
    ],
  },
  {
    id: 'commission',
    title: '4. Prix, commission & frais',
    paragraphs: [
      'Le vendeur fixe librement ses prix de vente. TBK prélève une commission de 10 % sur le montant de chaque commande finalisée, hors frais de livraison.',
      "Cette commission s'applique aussi bien aux ventes réalisées en ligne qu'aux ventes enregistrées en point de vente physique via une session de caisse.",
    ],
  },
  {
    id: 'commandes',
    title: '5. Commandes & exécution',
    paragraphs: ['Dès réception d’une commande, le vendeur s’engage à :'],
    list: [
      'confirmer ou préparer la commande dans un délai raisonnable et communiqué à l’acheteur ;',
      'ne pas annuler une commande confirmée sans motif valable (rupture de stock imprévue, fraude suspectée) ;',
      "emballer le produit de façon à préserver son état jusqu'à la livraison.",
    ],
  },
  {
    id: 'livraison',
    title: '6. Livraison & suivi',
    paragraphs: [
      "Selon le mode choisi à la commande, la livraison est assurée via un point de livraison partenaire ou organisée directement par le vendeur. Dans tous les cas, le vendeur doit :",
    ],
    list: [
      'mettre à jour le statut de la commande dans son espace vendeur dès qu’il change ;',
      'fournir une preuve de remise (numéro de suivi ou confirmation) lorsque le mode de livraison le permet ;',
      'informer l’acheteur sans délai en cas de retard significatif.',
    ],
  },
  {
    id: 'retours',
    title: '7. Retours, remboursements & annulations',
    paragraphs: [
      "L'acheteur dispose de 3 jours après la livraison pour demander un retour lorsque le produit reçu est non conforme, défectueux, ou différent de la fiche publiée, à condition qu'il soit dans son emballage d'origine, sans trace d'usage, avec ses accessoires et sa notice.",
      "Le vendeur accepte cette politique de retour commune à la marketplace et ne peut imposer de conditions plus restrictives sur ses propres fiches. Si le retour est validé, le remboursement à l'acheteur est prioritaire ; le vendeur peut ensuite contester le motif auprès du support TBK avec preuves à l'appui.",
    ],
  },
  {
    id: 'avis',
    title: '8. Avis clients',
    paragraphs: [
      "Les avis affichés sur une fiche produit ne peuvent provenir que d'un achat vérifié sur la plateforme. Il est interdit au vendeur de :",
    ],
    list: [
      'publier ou faire publier de faux avis, y compris via des comptes tiers ou des proches ;',
      'offrir une compensation (remise, cadeau, remboursement partiel) en échange d’un avis positif ;',
      'menacer, harceler ou tenter de faire retirer un avis négatif légitime.',
    ],
  },
  {
    id: 'interdits',
    title: '9. Comportements interdits',
    paragraphs: ['Sont strictement interdits, et exposent le compte à une suspension immédiate :'],
    list: [
      'la vente de contrefaçons ou de produits contrefaits ;',
      'les produits illégaux, dangereux ou réglementés sans autorisation ;',
      "les fiches ou photos trompeuses sur l'origine, l'état ou les caractéristiques ;",
      'la manipulation des avis ou des évaluations ;',
      "le détournement d'un acheteur hors de la plateforme pour éviter la commission ;",
      "l'usage abusif des coordonnées d'un client (démarchage non sollicité) ;",
      'les comptes multiples non déclarés pour contourner une sanction.',
    ],
  },
  {
    id: 'employes',
    title: '10. Employés & gestion de la boutique',
    paragraphs: [
      "Un vendeur peut inviter des employés à gérer une ou plusieurs de ses boutiques (commandes, stock, caisse). Le vendeur reste seul responsable, vis-à-vis de TBK et des acheteurs, des actions effectuées par ses employés dans son espace, y compris les ventes enregistrées en session de caisse dans un point de vente physique.",
    ],
  },
  {
    id: 'versements',
    title: '11. Versements au vendeur',
    paragraphs: [
      "Le montant dû au vendeur correspond au total des commandes livrées et non retournées, diminué de la commission (article 4). TBK verse ce montant chaque semaine, selon le mode de paiement enregistré dans l'espace vendeur.",
    ],
  },
  {
    id: 'suspension',
    title: '12. Suspension & résiliation',
    paragraphs: [
      "TBK peut, selon la gravité du manquement, avertir le vendeur, suspendre temporairement une fiche ou une boutique, ou résilier le compte vendeur, notamment en cas de :",
    ],
    list: [
      "violation répétée de l'article 9 ;",
      'fraude avérée ou tentative de fraude au paiement ;',
      'taux anormal de commandes annulées, non honorées ou retournées pour non-conformité ;',
      'inactivité prolongée sans catalogue actif.',
    ],
  },
  {
    id: 'donnees',
    title: '13. Données personnelles',
    paragraphs: [
      "Le vendeur ne peut utiliser les coordonnées d'un acheteur (nom, téléphone, adresse) que pour l'exécution de la commande concernée. Toute utilisation à d'autres fins — prospection, revente, partage avec un tiers — est interdite et engage la seule responsabilité du vendeur vis-à-vis de l'acheteur concerné.",
    ],
  },
  {
    id: 'modification',
    title: '14. Modification & contact',
    paragraphs: [
      "TBK peut faire évoluer cette Politique ; toute modification substantielle sera notifiée aux vendeurs par e-mail ou via l'espace vendeur avant son entrée en vigueur. La poursuite de l'activité de vente après cette date vaut acceptation.",
      'Pour toute question sur cette Politique, le vendeur peut contacter le support TBK depuis son espace vendeur.',
    ],
  },
]
