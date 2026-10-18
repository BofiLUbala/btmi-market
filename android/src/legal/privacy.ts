// Privacy policy shown in the app (/privacy). Keep it in step with what the app
// really collects: see the App Privacy table in store-assets/app-store-listing.md.

export type PolicySection = { title: string; body: string[] }
export type Policy = { title: string; updated: string; sections: PolicySection[] }

/** Set to a real mailbox before publishing; when empty the policy points to the in-app Help screen only. */
export const PRIVACY_CONTACT_EMAIL = 'bofibendedji@gmail.com'

const contactFr = PRIVACY_CONTACT_EMAIL
  ? `Pour toute question ou demande sur vos données, écrivez à ${PRIVACY_CONTACT_EMAIL} ou utilisez l’écran Aide de l’application.`
  : 'Pour toute question ou demande sur vos données, utilisez l’écran Aide de l’application.'
const contactEn = PRIVACY_CONTACT_EMAIL
  ? `For any question or request about your data, write to ${PRIVACY_CONTACT_EMAIL} or use the Help screen in the app.`
  : 'For any question or request about your data, use the Help screen in the app.'

export const PRIVACY_POLICY: Record<'fr' | 'en', Policy> = {
  fr: {
    title: 'Politique de confidentialité de TBK',
    updated: 'Dernière mise à jour : 13 octobre 2026',
    sections: [
      {
        title: 'Qui sommes-nous',
        body: ['TBK est une place de marché qui met en relation des acheteurs, des vendeurs et des livreurs. TBK est responsable des données décrites ci-dessous.'],
      },
      {
        title: 'Données que nous collectons',
        body: [
          'Compte : nom, adresse e-mail, numéro de téléphone, mot de passe (conservé sous forme chiffrée) et photo de profil facultative.',
          'Livraison : adresses de livraison que vous enregistrez, et vos commandes (articles, montants, état de la livraison).',
          'Position : pour un livreur, la position précise pendant une livraison en cours, y compris écran éteint, afin que l’acheteur suive le trajet. Pour un acheteur, la position seulement quand il demande à indiquer son point de livraison.',
          'Photos et caméra : une photo que vous choisissez pour rechercher un produit similaire, et la caméra pour scanner le QR code de remise du colis.',
          'Messages : les conversations entre acheteur, vendeur, livreur et le support à propos d’une commande.',
          'Appareil : un identifiant de notification pour vous envoyer les alertes de votre commande.',
        ],
      },
      {
        title: 'Pourquoi nous les utilisons',
        body: [
          'Créer et sécuriser votre compte, traiter vos commandes, organiser la livraison et le paiement, vous envoyer des notifications utiles, et répondre au support.',
          'Nous ne vendons pas vos données et nous ne les utilisons pas pour de la publicité ciblée ni pour vous suivre sur d’autres applications.',
        ],
      },
      {
        title: 'Avec qui nous les partageons',
        body: [
          'Le vendeur reçoit votre nom, votre contact et votre adresse pour préparer et livrer votre commande. Le livreur reçoit l’adresse et le contact nécessaires à la livraison. L’acheteur voit la position du livreur pendant la livraison seulement.',
          'Des prestataires techniques traitent des données pour notre compte : hébergement, notifications, cartes, et opérateurs de paiement mobile pour les paiements.',
        ],
      },
      {
        title: 'Durée de conservation',
        body: [
          'La position d’un livreur n’est conservée que le temps utile à la livraison et à la résolution d’un litige, puis supprimée.',
          'Les commandes et les paiements sont conservés sans vos informations personnelles après la suppression de votre compte, pour les obligations comptables et la lutte contre la fraude.',
        ],
      },
      {
        title: 'Vos droits et la suppression du compte',
        body: [
          'Vous pouvez modifier vos informations dans l’application, et supprimer votre compte à tout moment depuis Profil → Supprimer mon compte. Votre nom, e-mail, téléphone et photo sont alors effacés et vous êtes déconnecté partout.',
          'La suppression est impossible tant qu’une commande est en cours ou que vous possédez une entreprise active.',
        ],
      },
      {
        title: 'Sécurité',
        body: ['Les échanges avec nos serveurs sont chiffrés et les mots de passe ne sont jamais conservés en clair.'],
      },
      {
        title: 'Enfants',
        body: ['TBK n’est pas destinée aux enfants de moins de 13 ans et nous ne collectons pas sciemment leurs données.'],
      },
      {
        title: 'Modifications et contact',
        body: ['Nous pouvons mettre à jour cette politique ; la date en haut de page indique la dernière version.', contactFr],
      },
    ],
  },
  en: {
    title: 'TBK privacy policy',
    updated: 'Last updated: October 13, 2026',
    sections: [
      {
        title: 'Who we are',
        body: ['TBK is a marketplace that connects buyers, sellers and couriers. TBK is responsible for the data described below.'],
      },
      {
        title: 'Data we collect',
        body: [
          'Account: name, email address, phone number, password (stored encrypted) and an optional profile photo.',
          'Delivery: the delivery addresses you save, and your orders (items, amounts, delivery status).',
          'Location: for a courier, precise location during an active delivery, including when the screen is off, so the buyer can follow the route. For a buyer, location only when they ask to set their delivery point.',
          'Photos and camera: a photo you choose to search for a similar product, and the camera to scan the parcel hand-over QR code.',
          'Messages: conversations between buyer, seller, courier and support about an order.',
          'Device: a notification identifier so we can send your order alerts.',
        ],
      },
      {
        title: 'Why we use it',
        body: [
          'To create and secure your account, process orders, arrange delivery and payment, send useful notifications and answer support requests.',
          'We do not sell your data and we do not use it for targeted advertising or to track you across other apps.',
        ],
      },
      {
        title: 'Who we share it with',
        body: [
          'The seller receives your name, contact and address to prepare and deliver your order. The courier receives the address and contact needed for delivery. The buyer sees the courier’s location during delivery only.',
          'Service providers process data on our behalf: hosting, notifications, maps, and mobile money operators for payments.',
        ],
      },
      {
        title: 'How long we keep it',
        body: [
          'A courier’s location is kept only as long as needed for the delivery and to resolve a dispute, then deleted.',
          'Orders and payments are kept without your personal details after you delete your account, for accounting duties and fraud prevention.',
        ],
      },
      {
        title: 'Your rights and account deletion',
        body: [
          'You can edit your details in the app, and delete your account at any time from Profile → Delete my account. Your name, email, phone and photo are then erased and you are signed out everywhere.',
          'Deletion is not possible while an order is in progress or while you own an active business.',
        ],
      },
      {
        title: 'Security',
        body: ['Traffic to our servers is encrypted and passwords are never stored in clear text.'],
      },
      {
        title: 'Children',
        body: ['TBK is not meant for children under 13 and we do not knowingly collect their data.'],
      },
      {
        title: 'Changes and contact',
        body: ['We may update this policy; the date at the top shows the latest version.', contactEn],
      },
    ],
  },
}
