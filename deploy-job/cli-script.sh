#!/bin/bash

if [ -z "$CRIBL_HOME" ]; then
  CRIBL_HOME=/opt/cribl
fi

# This works off a secret exposed as an env var in the pod CRIBL_ADMIN_PASSWORD
if [ -z "$CRIBL_ADMIN_PASSWORD" ] || [ -z "$CRIBL_URL" ]; then
  echo "Both CRIBL_ADMIN_PASSWORD AND CRIBL_URL need to be set"
  exit 255
fi

# Login
$CRIBL_HOME/bin/cribl auth login -u admin -p $CRIBL_ADMIN_PASSWORD -H $CRIBL_URL

# Read the Manifest File and install each pack specified in it.
while IFS=, read -r pack group; do
  if [[ "$pack" != "pack" ]]; then
    echo "Installing $pack in $group"
    if ! [[ "${CRIBL_GROUPS[@]}" =~ $group ]]; then
      last=${#CRIBL_GROUPS[@]}
      CRIBL_GROUPS[last]=$group
    fi
    $CRIBL_HOME/bin/cribl pack install -g $group $pack
  fi
done < pack-manifest.csv
