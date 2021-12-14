#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
WD=$(pwd)

if [ $DIR != $WD ]; then
  echo "Must Run from the top level directory of the repository"
  exit 255
fi

FIND=$(which gfind)
if [ -z "${FIND}" ]; then
    FIND=$(which find)
fi


# Options (with defaults) for namespace, branch name and admin password.
while getopts "a:b:n:p:s" opt; do
  case ${opt} in
    n ) 
      namespace=$OPTARG
      ;;
    p )
      adminpass=$OPTARG
      ;;
    b )
      branch=$OPTARG
      ;;
    a )
      authsecret=$OPTARG
      ;;
    s )
      enablescope=true
      ;;
      
  esac
done
shift $((OPTIND -1))

if [ -z "$namespace" ]; then
  namespace=default
fi

if [ -z "$adminpass" ]; then
  adminpass="cribldemo"
fi

if [ -z "$branch" ]; then
  branch=$(git branch --show-current)
fi

# make sure the namespace exists
kubectl get namespace $namespace >/dev/null 2>&1 
if [ $? -gt 0 ]; then
  kubectl create namespace $namespace
fi

# Create Kustomization files.
echo "Creating Kustomization Files"
for dir in cribl/worker cribl/master; do
  tempname=$(echo $dir | sed -e "s/\//-/g")
  echo "Tempname: $tempname"
  (cd $dir;
    if [ ! -d "tmp" ]; then
      mkdir tmp
    fi
    echo "resources:" > kustomization.yml
    ls *yml | egrep -v "${tempname}-rendered.yml|kustomization.yml" | awk '{printf("- %s\n", $1)}' >> kustomization.yml
    

    if [ -n "$CRIBL_TAG" ]; then
      cat >> kustomization.yml<<EOU
images:
- name: cribl/cribl
  newTag: ${CRIBL_TAG}
EOU
    fi
    kustomize build > tmp/$tempname-rendered.yml
    
  )
done

CFG="demo-config"
SEC="demo-admin"
echo "Creating $CFG configmap"
kubectl get configmap $CFG -n $namespace >/dev/null 2>&1
if [ $? -eq 0 ]; then
  kubectl delete configmap $CFG -n $namespace >/dev/null 2>&1
fi
kubectl get secret $SEC -n $namespace >/dev/null 2>&1
if [ $? -eq 0 ]; then
  kubectl delete secret $SEC -n $namespace >/dev/null 2>&1
fi
dir="/tmp/demo$$"
mkdir -p $dir
sed -e "s/{{PASS}}/${adminpass}/g" cribl/master/local/cribl/auth/users.json > $dir/users.json
echo "$adminpass" > $dir/admin.pass
echo "$branch"> $dir/branch
kubectl create configmap $CFG -n $namespace --from-file=$dir/ >/dev/null 2>&1
kubectl create secret generic $SEC -n $namespace --from-literal=adminpass=$adminpass
rm -rf $dir


CFG="master-config"
echo "Creating $CFG configmap"
# Create the Master ConfigMap
kubectl get configmap $CFG -n $namespace >/dev/null 2>&1
if [ $? -eq 0 ]; then
  kubectl delete configmap $CFG -n $namespace >/dev/null 2>&1
fi

kubectl create configmap $CFG -n $namespace --from-file=cribl/master/local/cribl/ >/dev/null 2>&1

CFG="scripts-config"
echo "Creating $CFG configmap"
# Create the Scripts ConfigMap
kubectl get configmap $CFG -n $namespace >/dev/null 2>&1
if [ $? -eq 0 ]; then
  kubectl delete configmap $CFG -n $namespace >/dev/null 2>&1
fi

kubectl create configmap $CFG -n $namespace --from-file=cribl/master/scripts/ >/dev/null 2>&1

CFG="elastic-config"
echo "Creating $CFG ConfigMap"
kubectl get configmap $CFG -n $namespace >/dev/null 2>&1
if [ $? -eq 0 ]; then
  kubectl delete configmap $CFG -n $namespace >/dev/null 2>&1
fi
kubectl create configmap $CFG -n $namespace --from-file=elastic/setup/ >/dev/null 2>&1


CFG="group-config"
echo "Creating $CFG ConfigMap"
kubectl get configmap $CFG -n $namespace >/dev/null 2>&1
if [ $? -eq 0 ]; then
  kubectl delete configmap $CFG -n $namespace >/dev/null 2>&1
fi
( cd cribl/master/groups; 
  mkdir -p $dir; 
  for i in $(ls -1); do
    tar czf $dir/groups-$i.tgz $i
  done
)
kubectl create configmap $CFG -n $namespace --from-file=$dir/
rm -rf $dir


# SA Config
CFG="sa-config"
echo "Creating $CFG ConfigMap"
kubectl get configmap $CFG -n $namespace >/dev/null 2>&1
if [ $? -eq 0 ]; then
  kubectl delete configmap $CFG -n $namespace >/dev/null 2>&1
fi
( cd cribl/sa
  mkdir -p $dir; 
  for i in cribl; do
    tar czf $dir/sa.tgz $i
  done
)
kubectl create configmap $CFG -n $namespace --from-file=$dir/
rm -rf $dir



# Build all the Gogen Configs
( cd gogen; 
  for gdir in $(${FIND} . -maxdepth 1 -mindepth 1 -type d -printf "%f\n"| egrep -v "forwarder|filebeat"); do
    ( cd $gdir/gogen
    mkdir -p $dir
    CFG=$gdir
    tar czf $dir/gogen.tgz .
    kubectl get configmap $CFG -n $namespace >/dev/null 2>&1
    if [ $? -eq 0 ]; then
      kubectl delete configmap $CFG -n $namespace >/dev/null 2>&1
    fi
    kubectl create configmap $CFG -n $namespace --from-file=$dir/
    rm -rf $dir
    )
  done
)

# Set Influx Template(s)
CFG="influx-templates"
echo "Creating $CFG ConfigMap"
kubectl get configmap $CFG -n $namespace >/dev/null 2>&1
if [ $? -eq 0 ]; then
  kubectl delete configmap $CFG -n $namespace >/dev/null 2>&1
fi
kubectl create configmap $CFG -n $namespace --from-file=influxdb-kustomize/templates/


if [ -n "$enablescope" ]; then
  echo "Enabling AppScope for $namespace"
  kubectl label namespace $namespace scope=enabled --overwrite
  # Build the Scope Config
  CFG="scope"
  echo "Creating $CFG configmap"
  kubectl get configmap $CFG -n $namespace >/dev/null 2>&1
  if [ $? -eq 0 ]; then
    kubectl delete configmap $CFG -n $namespace >/dev/null 2>&1
  fi
  kubectl create configmap $CFG -n $namespace --from-file=scope.yml=scope/scope.yml 

fi
  

if [ -n "$authsecret" ]; then
  kubectl patch serviceaccount default -p "{\"imagePullSecrets\": [{\"name\": \"$authsecret\"}]}" -n $namespace
fi
