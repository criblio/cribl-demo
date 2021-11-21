#!/bin/bash
export PAGER=cat

# check pre-requisites
ENVSUBST=$(which envsubst)
if [ -z "$ENVSUBST" ]; then
  echo "envsubst not installed. Exiting"
  exit 201
fi

AWS=$(which aws)
if [ -z "$AWS" ]; then
  echo "AWS CLI not installed. Exiting"
  exit 202
fi

KUBECTL=$(which kubectl)
if [ -z "$KUBECTL" ]; then
  echo "kubectl not installed. Exiting"
  exit 203
fi

EKSCTL=$(which eksctl)
if [ -z "$EKSCTL" ]; then
  echo "eksctl not installed. Exiting"
fi

# parse options
while [ -n "$1" ]; do
  case "$1" in
    -r) AWS_REGION=$2 && shift && shift;;
    -n) export CLUSTERNAME=$2 && shift && shift;;
  esac
done

if [ -z "$AWS_REGION" ]; then
  export AWS_REGION="us-west-2"
fi

if [ -z "$CLUSTERNAME" ]; then
  export CLUSTERNAME=demo
fi

export KEYPAIR=ssh-${CLUSTERNAME}

${AWS} ec2 describe-key-pairs --key-name ${KEYPAIR} > /dev/null 2>&1
if [ $? -gt 0 ]; then
  echo "Creating KeyPair $KEYPAIR"
  ${AWS} ec2 create-key-pair --key-name $KEYPAIR --query "KeyMaterial" --output text > ${KEYPAIR}.pem
else 
  echo "Found keypair, not creating..."
fi

# Discover Control Tower Created Subnets
export PRIVATE_NETS=$(${AWS} ec2 describe-subnets --filters "Name=tag:Network,Values=Private" --filters "Name=tag:Name,Values=*A" --query 'Subnets[].[AvailabilityZone,SubnetId]' --output text | awk '{printf ("      %s: { id: %s }\n", $1, $2)}')
export PUBLIC_NETS=$(${AWS} ec2 describe-subnets --filters "Name=tag:Network,Values=Public" --query 'Subnets[].[AvailabilityZone,SubnetId]' --output text | awk '{printf ("      %s: { id: %s }\n", $1, $2)}')

if [ -z "$PRIVATE_NETS" ] || [ -z "$PUBLIC_NETS" ]; then
  echo "Can't locate appropriate subnets - exiting"
  exit 254
fi

# Grab the first three AZ's in the account
ZONES=($(${AWS} ec2 describe-availability-zones --query 'AvailabilityZones[].ZoneName'  | head -4 | tail -3 | perl -pe 's/\"|,| //g;'))
export AZ_A=${ZONES[0]}
export AZ_B=${ZONES[1]}
export AZ_C=${ZONES[2]}

# Execute Substituion on the YML file. 
${ENVSUBST} < demo-eks.yml.in > demo-eks.yml

${EKSCTL} create nodegroup -f demo-eks.yml 


