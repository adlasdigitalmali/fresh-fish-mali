FRESH FISH MALI — FICHIERS DE DÉMARRAGE

CONTENU
- index.html : boutique publique
- style.css : style responsive et animations
- script.js : chargement des produits et interactions du panier (prototype)
- config.js : paramètres de connexion Supabase et coordonnées
- admin.html / admin.css / admin.js : panneau d'administration de départ
- images/ : placez vos visuels locaux ici

DÉMARRAGE
1. Décompressez le dossier.
2. Ouvrez config.js avec votre éditeur de texte.
3. Remplacez COLLER_ICI_LA_PROJECT_URL et COLLER_ICI_LA_PUBLISHABLE_KEY par les valeurs du projet Fresh Fish Mali.
4. N'insérez jamais de clé service_role ou secret dans ces fichiers.
5. Ouvrez index.html dans le navigateur pour voir le design. Pour une connexion Supabase fiable, servez le dossier avec un serveur local (par exemple l'extension Live Server de VS Code, ou python -m http.server).
6. Ouvrez admin.html pour accéder au panneau.

IMPORTANT — ÉTAT ACTUEL
Il s'agit d'un socle initial, pas encore d'une boutique prête à accepter de vraies commandes.
- Les quatre produits de secours sur la page publique sont des exemples de présentation, pas des tarifs réels.
- Le panier est visuel et n'enregistre pas encore de commande.
- Le compte administrateur doit être créé dans Supabase Authentication, puis un rôle administrateur doit être attribué et protégé par des règles RLS/politiques serveur. Ne rendez pas les tables modifiables par tous les utilisateurs.
- L'admin peut ajouter/activer/désactiver des produits si le compte possède les droits RLS appropriés.
- Le panneau ne permet pas encore de changer les statuts de commande, de téléverser directement des images, de générer des factures PDF ou de gérer les dépenses comptables.
- Le bucket products est public pour la lecture des images ; les téléversements doivent être protégés par des politiques Storage réservées aux administrateurs.
- Avant la mise en production, il faudra ajouter la validation sécurisée des commandes et des prix côté serveur (Edge Function ou fonction SQL), les politiques RLS adaptées, les règles de stock, la création de commandes, la livraison/paiement et les tests.

PHOTOS
Placez le logo officiel dans images/logo.png.
Placez une image large de poissons dans images/hero-fish.jpg.
Placez une image secondaire dans images/quality-fish.jpg.
Les espaces réservés s'affichent si ces images ne sont pas présentes.

COORDONNÉES
Renseignez WHATSAPP_NUMBER et PHONE_NUMBER dans config.js.
