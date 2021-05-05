#!/bin/bash 

# This works off a secret exposed as an env var in the pod CRIBL_ADMIN_PASSWORD
if [ -z "$CRIBL_ADMIN_PASSWORD" ]; then
  CRIBL_ADMIN_PASSWORD=l0gstr3am
fi

if [ -z "$CRIBL_URL" ]; then
  CRIBL_URL=http://cribl.logstreamnext.demo.cribl.io:9000
fi

export TOKEN=$(curl -sq -X POST "$CRIBL_URL/api/v1/auth/login" \
               -H  "accept: application/json" \
               -H  "Content-Type: application/json" \
               -d "{\"username\":\"admin\",\"password\":\"$CRIBL_ADMIN_PASSWORD\"}" |\
               jq '.token' -r)


while IFS=, read -r pack group; do
  if [[ "$pack" != "pack" ]]; then
    echo "Installing $pack in $group"
    if ! [[ "${CRIBL_GROUPS[@]}" =~ $group ]]; then
      last=${#CRIBL_GROUPS[@]}
      CRIBL_GROUPS[last]=$group
    fi
    # Upload the crbl file
    PACK_SOURCE=$(curl -s -X PUT \
         -T ../packs/build/$pack $CRIBL_URL/api/v1/m/$group/packs\?filename\=$pack \
         -H "accept: application/json" \
         -H "Authorization: Bearer $TOKEN" |\
    jq '.source' -r)
    # Install the pack
    STATUS=$(curl -s -X POST -d "{\"source\": \"$PACK_SOURCE\"}" \
         -H "Content-Type: application/json" \
         -H "Authorization: Bearer $TOKEN"  $CRIBL_URL/api/v1/m/$group/packs | \
    jq '.count' -r)
    echo "Status: $STATUS"
  fi
done < pack-manifest.csv

#echo ${CRIBL_GROUPS[@]}


commit=$(curl -s -X POST "$CRIBL_URL/api/v1/version/commit" \
              -H  "accept: application/json" \
              -H  "Authorization: Bearer $TOKEN" |\
         jq -r '.items[0].commit')
if [ -z "$commit" ]; then
  echo "No Commit Found, exiting"
  exit 255
fi
for grp in ${CRIBL_GROUPS[@]}; do

  echo "Deploying $grp"
  patchdata="{\"version\": \"$commit\", \"id\": \"$grp\"}"
  # Run commit and deploy separately for each worker group (commit-deploy will fail if
  # there is nothing to commit, but we want to push a deploy either way.
  echo $patchdata > /tmp/patch$$
  #echo "pdata: $patchdata"
  STATUS=$(curl -s -X PATCH -d@/tmp/patch$$ "$CRIBL_URL/api/v1/master/groups/$grp/deploy" \
       -H "accept: application/json" \
       -H  "Authorization: Bearer $TOKEN" \
       -H "Content-Type: application/json" |\
  jq '.items[0].configVersion' -r)
  echo "Deployed $STATUS on $grp"
  rm /tmp/patch$$
done

