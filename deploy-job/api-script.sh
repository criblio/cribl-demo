#!/bin/bash 

function install_pack() {

  group=$1
  pack=$2

  echo "Installing $pack in $group"

  # Upload the crbl file
  if [[ $pack =~ ^git\+https: ]]; then
    PACK_SOURCE=$pack
  else
    PACK_SOURCE=$(curl -s -X PUT \
       -T ../packs/build/$pack $CRIBL_URL/api/v1/m/$group/packs\?filename\=$pack \
       -H "accept: application/json" \
       -H "Authorization: Bearer $TOKEN" |\
    jq '.source' -r)
  fi
  # Install the pack
  STATUS=$(curl -s -X POST -d "{\"source\": \"$PACK_SOURCE\"}" \
       -H "Content-Type: application/json" \
       -H "Authorization: Bearer $TOKEN"  $CRIBL_URL/api/v1/m/$group/packs | \
  jq '.count' -r)
  echo "Status: $STATUS"
}

# This works off a secret exposed as an env var in the pod CRIBL_ADMIN_PASSWORD
if [ -z "$CRIBL_ADMIN_PASSWORD" ] || [ -z "$CRIBL_URL" ]; then
  echo "Both CRIBL_ADMIN_PASSWORD AND CRIBL_URL need to be set"
  exit 255
fi

# Authenticate against the API
export TOKEN=$(curl -sq -X POST "$CRIBL_URL/api/v1/auth/login" \
               -H  "accept: application/json" \
               -H  "Content-Type: application/json" \
               -d "{\"username\":\"admin\",\"password\":\"$CRIBL_ADMIN_PASSWORD\"}" |\
               jq '.token' -r)


# Read the Manifest File and install each pack specified in it. 
while IFS=, read -r pack group; do
  if [[ "$pack" != "pack" ]]; then
    echo "Installing $pack in $group"
    if ! [[ "${CRIBL_GROUPS[@]}" =~ $group ]]; then
      last=${#CRIBL_GROUPS[@]}
      CRIBL_GROUPS[last]=$group
    fi
    install_pack $group $pack

  fi
done < pack-manifest.csv

# Find all of the repos currently in the Packs Dispensary, and puff puff pass.
PACKS=$(curl https://api.github.com/users/criblpacks/repos | jq '.[].clone_url' -r)
for pack in $PACKS; do
  echo $pack
  install_pack "default" "git+$pack"

done

# Commit all changes 
commit=$(curl -s -X POST "$CRIBL_URL/api/v1/version/commit" \
              -H  "accept: application/json" \
              -H  "Authorization: Bearer $TOKEN" |\
         jq -r '.items[0].commit')
if [ -z "$commit" ]; then
  echo "No Commit Found, exiting"
  exit 255
fi

# Deploy in each worker group that we've installed anything into. 
for grp in ${CRIBL_GROUPS[@]}; do

  echo "Deploying $grp"
  patchdata="{\"version\": \"$commit\", \"id\": \"$grp\"}"
  # Run commit and deploy separately for each worker group (commit-deploy will fail if
  # there is nothing to commit, but we want to push a deploy either way.
  echo $patchdata > /tmp/patch$$
  STATUS=$(curl -s -X PATCH -d@/tmp/patch$$ "$CRIBL_URL/api/v1/master/groups/$grp/deploy" \
       -H "accept: application/json" \
       -H "Authorization: Bearer $TOKEN" \
       -H "Content-Type: application/json" |\
  jq '.items[0].configVersion' -r)
  echo "Deployed $STATUS on $grp"
  rm /tmp/patch$$
done


