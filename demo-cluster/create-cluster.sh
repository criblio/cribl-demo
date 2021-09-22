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

${EKSCTL} create cluster -f demo-eks.yml 

echo "Sleeping for 60 seconds to allow cluster stabilization"
sleep 60
#eksctl get labels --cluster ${CLUSTERNAME} --nodegroup ${CLUSTERNAME}

# Install the Metrics server (needed for autoscale)
${KUBECTL} apply -f https://github.com/kubernetes-sigs/metrics-server/releases/download/v0.4.1/components.yaml

# Install the ebs CSI driver (for persistent storage), and create a new xfs ebs default storage class
${KUBECTL} apply -k "github.com/kubernetes-sigs/aws-ebs-csi-driver/deploy/kubernetes/overlays/stable/?ref=master"
${KUBECTL} apply -f sclass.yml
${KUBECTL} delete sc/gp2


# Install and config the node group auto-scaler
${KUBECTL} apply -f https://raw.githubusercontent.com/kubernetes/autoscaler/master/cluster-autoscaler/cloudprovider/aws/examples/cluster-autoscaler-autodiscover.yaml
${KUBECTL} -n kube-system annotate deployment.apps/cluster-autoscaler cluster-autoscaler.kubernetes.io/safe-to-evict="false"

# Hack to use perl to inject the correct values into the autoscaler config
EDITOR='perl -pi.bak -e "s/\<YOUR/$CLUSTERNAME/g;" -e "s/  CLUSTER NAME\>/- --balance-similar-node-groups\n        - --skip-nodes-with-system-pods=false/g;"' kubectl -n kube-system edit deployment.apps/cluster-autoscaler
${KUBECTL} -n kube-system set image deployment.apps/cluster-autoscaler cluster-autoscaler=us.gcr.io/k8s-artifacts-prod/autoscaling/cluster-autoscaler:v1.17.4

for gp in a b c; do 
  # Interrogate the security groups, and add the corporate net to be able to access nodes.
  secgroup=$(${AWS} ec2 describe-instances --filter Name=tag:Name,Values=${CLUSTERNAME}-${gp}-Node --query 'Reservations[].Instances[].SecurityGroups' | grep eksctl-${CLUSTERNAME}-nodegroup | uniq | awk -F\" '{print $4}')
  groupid=$(${AWS} ec2 describe-security-groups --filter Name=group-name,Values=$secgroup --query 'SecurityGroups[0].GroupId' --output text)
  ${AWS} ec2 authorize-security-group-ingress \
      --group-id $groupid \
      --ip-permissions IpProtocol=tcp,FromPort=1025,ToPort=65535,IpRanges=[{CidrIp=10.0.0.0/8}]
done

