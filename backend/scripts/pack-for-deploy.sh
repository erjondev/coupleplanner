#!/usr/bin/env bash
# Prépare un paquet de déploiement du backend, prêt à être uploadé tel quel
# sur un serveur à quota disque limité (ex: alwaysdata) : aucune installation
# ni build n'est nécessaire côté serveur, seulement `node dist/server.js`.
#
# Usage : ./scripts/pack-for-deploy.sh
# Produit : backend/coupleplanner-backend-deploy.tar.gz
set -euo pipefail
cd "$(dirname "$0")/.."

STAGING="$(mktemp -d)"
trap 'rm -rf "$STAGING"' EXIT

echo "==> Installation des dépendances (dev incluses, nécessaires pour generate/build)"
yarn install

echo "==> Génération du client Prisma (natif + variantes debian pour le serveur)"
npx prisma generate

echo "==> Compilation TypeScript"
yarn build

echo "==> Copie vers le paquet de déploiement"
cp -r dist package.json yarn.lock node_modules "$STAGING/"

echo "==> Suppression des dépendances de dev (inutiles à l'exécution)"
rm -rf \
  "$STAGING/node_modules/typescript" \
  "$STAGING/node_modules/ts-node" \
  "$STAGING/node_modules/ts-node-dev" \
  "$STAGING/node_modules/prisma" \
  "$STAGING/node_modules/@types"

echo "==> Suppression du moteur Prisma natif (macOS) — seuls ceux du serveur sont gardés"
find "$STAGING/node_modules/.prisma/client" -iname "libquery_engine-*" ! -iname "*debian-openssl*" -delete

OUT="coupleplanner-backend-deploy.tar.gz"
# COPYFILE_DISABLE évite que le tar de macOS n'ajoute des fichiers "._xxx"
# (métadonnées AppleDouble) qui polluent l'archive une fois extraite sur le serveur.
COPYFILE_DISABLE=1 tar czf "$OUT" -C "$STAGING" .

echo "==> Vérification du contenu de l'archive (évite un déploiement d'un paquet cassé)"
VERIFY="$(mktemp -d)"
tar xzf "$OUT" -C "$VERIFY"
if [ ! -f "$VERIFY/dist/server.js" ]; then
  echo "ERREUR : dist/server.js est absent de l'archive générée !" >&2
  rm -rf "$VERIFY"
  exit 1
fi
if ! find "$VERIFY/node_modules/.prisma/client" -iname "libquery_engine-debian-*" -print -quit | grep -q .; then
  echo "ERREUR : aucun moteur Prisma Debian n'est présent dans l'archive générée !" >&2
  rm -rf "$VERIFY"
  exit 1
fi
rm -rf "$VERIFY"
echo "==> OK : dist/server.js et le(s) moteur(s) Prisma Debian sont bien présents dans l'archive."

echo
echo "==> Paquet prêt : backend/$OUT ($(du -sh "$OUT" | cut -f1))"
echo "    Pour l'envoyer :"
echo "    scp $OUT coupleplanner@ssh-coupleplanner.alwaysdata.net:~/coupleplanner-backend-deploy.tar.gz"
