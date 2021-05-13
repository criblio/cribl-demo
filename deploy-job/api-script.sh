#!/bin/bash  -x

# This works off a secret exposed as an env var in the pod CRIBL_ADMIN_PASSWORD
if [ -z "$CRIBL_ADMIN_PASSWORD" ] || [ -z "$CRIBL_URL" ]; then
  echo "Both CRIBL_ADMIN_PASSWORD AND CRIBL_URL need to be set"
  exit 255
fi

if [ -z "$CRIBL_HOME" ]; then
  echo "No CRIBL_HOME Set - defaulting to /opt/cribl"
  export CRIBL_HOME=/opt/cribl
fi

if [ -n "$CRIBL_VOLUME_DIR" ]; then
  export CRIBL_CONF_DIR=$CRIBL_VOLUME_DIR
fi

$CRIBL_HOME/bin/cribl auth login -u admin -p $CRIBL_ADMIN_PASSWORD -h $CRIBL_URL
if [ $? -gt 0 ]; then
  echo "Failed LogStream Login"
  exit 254
fi


while IFS=, read -r pack group; do
  if [[ "$pack" != "pack" ]]; then
    echo "Installing $pack in $group"
    if ! [[ "${CRIBL_GROUPS[@]}" =~ $group ]]; then
      last=${#CRIBL_GROUPS[@]}
      CRIBL_GROUPS[last]=$group
    fi
    $CRIBL_HOME/bin/cribl pack install -d -g $group ../packs/build/$pack
    if [ $? -gt 0 ]; then
      echo "Pack: $pack install failed on $group"
    else
      echo "Pack: $pack installed on $group"
    fi
    echo "Status: $STATUS"
  fi
done < pack-manifest.csv



for grp in ${CRIBL_GROUPS[@]}; do
  echo "Deploying $grp"
  $CRIBL_HOME/bin/cribl groups commit -g $grp -m "init"
  $CRIBL_HOME/bin/cribl groups deploy -g $grp
done

