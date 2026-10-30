FRESH FISH MALI — VERSION CORRIGEE (30-10-2026)

FICHIERS MODIFIES
- script.js : récupération du stock public, suppression du catalogue fictif en cas d'erreur réseau, lecture robuste des favoris, contrôle du stock dans le panier, formulaire de commande, appel RPC create_order, confirmation WhatsApp à déclencher par le client, suivi de commande via RPC track_order.
- index.html : ajout du formulaire public de suivi de commande.
- style.css : styles du formulaire de commande et de suivi.
- admin.js : téléversement d'images dans le bucket Storage products, modification des images, changement du statut des commandes, gestion activation/masquage catégories, indicateurs comptables et rapports simples.
- admin.html : champs de téléversement d'images, gestion des catégories, indicateurs comptables et rapports.
- admin.css : styles des sélecteurs de statut.
- supabase-fix.sql : script de référence des fonctions SQL, index et protections ajoutés.

SUPABASE
Les modifications SQL ont été appliquées directement au projet Fresh Fish Mali (vgrggboizhdgqefqbzeh) :
- index sur les clés étrangères et les dates de commande ;
- fonction create_order avec validation serveur, recalcul des prix depuis products, contrôle et verrouillage du stock, création atomique de orders et order_items, numéro de commande unique ;
- fonction track_order qui exige le numéro de commande et le téléphone ;
- fonctions privilégiées rangées dans le schéma private et wrappers REST SECURITY INVOKER ;
- limitation à 3 commandes réussies par numéro sur une fenêtre de 10 minutes.

LIMITES A CONNAITRE AVANT PRODUCTION
1. Les frais de livraison sont actuellement enregistrés à 0 FCFA car aucune grille de zones/quartiers et de tarifs n'existe dans la base. Ne pas considérer le total comme définitif avant de configurer les frais.
2. Le bouton WhatsApp ouvre une conversation préremplie vers le numéro commercial. Le client doit appuyer sur Envoyer. L'envoi automatique d'un message WhatsApp au client nécessite l'API WhatsApp Business Cloud et ses identifiants officiels.
3. La comptabilité ajoutée est une synthèse du chiffre d'affaires des commandes livrées. Elle ne gère pas encore les dépenses, achats, fournisseurs, factures PDF ou rapprochement de paiements.
4. La gestion des fournisseurs n'est pas connectée : aucune table fournisseurs/achats n'était présente dans le schéma audité. Aucun schéma métier n'a été inventé sans validation.
5. L'annulation d'une commande ne réintègre pas encore automatiquement les quantités dans le stock. Traiter cette règle avant utilisation commerciale.
6. Les images hero-fish.jpg et quality-fish.jpg restent des emplacements à compléter dans le dossier images/.
7. Le numéro WhatsApp et le téléphone dans config.js doivent être vérifiés avant publication.

VERIFICATIONS EFFECTUEES
- node --check script.js : OK
- node --check admin.js : OK
- node --check config.js : OK
- identifiants HTML dupliqués : aucun détecté dans index.html et admin.html
- fonctions SQL create_order / track_order présentes et wrappers publics SECURITY INVOKER confirmés.
- index SQL créés et confirmés.
- Aucun test de commande réelle n'a été effectué afin de ne pas créer de fausse commande ni modifier le stock.

MISE A JOUR DU 30/10/2026
- Refonte visuelle de la boutique : interface plus moderne, épurée, responsive et lisible.
- Recherche publique corrigée : recherche sans distinction d'accents dans le nom, la description, l'unité et la catégorie ; message de résultat vide et effacement rapide.
- Recherche du catalogue admin améliorée (nom, slug, unité, sans distinction d'accents).
- Suppression du champ de saisie d'URL d'image : les images se choisissent désormais uniquement par téléversement de fichier.
- Ajout de l'action Supprimer dans le catalogue administrateur avec confirmation.
- Protection de l'historique : un produit référencé dans une ancienne commande ne peut pas être supprimé ; il doit être désactivé.
- Lorsqu'un produit supprimable est effacé, son image associée dans le bucket public « products » est également supprimée si son URL correspond au bucket.
- Lors du remplacement d'une image, l'ancienne image est supprimée après enregistrement réussi.
