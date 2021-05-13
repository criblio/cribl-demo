#!/bin/bash

for dir in cribl/worker cribl/master; do
  (cd $dir;
    echo "resources:" > kustomization.yml
    ls *yml | grep -v kustomization.yml | awk '{printf("- %s\n", $1)}' >> kustomization.yml
    

    if [ -n "$CRIBL_TAG" ]; then
      cat >> kustomization.yml<<EOU
images:
- name: cribl/cribl
  newTag: ${CRIBL_TAG}
EOU
    fi
  )
done
