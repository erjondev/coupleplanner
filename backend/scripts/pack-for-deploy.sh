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

echo "==> Génération du client Prisma (natif + debian-openssl-3.0.x pour le serveur)"
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

echo "==> Suppression du moteur Prisma natif (macOS) — seul celui du serveur est gardé"
find "$STAGING/node_modules/.prisma/client" -iname "libquery_engine-*" ! -iname "*debian-openssl-3.0.x*" -delete

OUT="coupleplanner-backend-deploy.tar.gz"
tar czf "$OUT" -C "$STAGING" .

echo
echo "==> Paquet prêt : backend/$OUT ($(du -sh "$OUT" | cut -f1))"
echo "    Pour l'envoyer :"
echo "    scp $OUT <user>@ssh-<compte>.alwaysdata.net:~/coupleplanner-backend-deploy.tar.gz"
