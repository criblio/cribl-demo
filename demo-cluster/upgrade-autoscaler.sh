#!/bin/bash

if [ -n $1 ]; then
  CLUSTER=$1
else 
  CLUSTER=demo
fi

echo "Working on Cluster: $CLUSTER"

CLUSTER_VERSION=$(kubectl version --short | grep "Server Version:" | awk -F: '{print $2}')

if [[ $CLUSTER_VERSION =~ "v1.19" ]]; then
  ASVERS="v1.19.1"
elif [[ $CLUSTER_VERSION =~ "v1.20" ]]; then
  ASVERS="v1.20.0"
elif [[ $CLUSTER_VERSION =~ "v1.21" ]]; then
  ASVERS="v1.21.0"
fi

echo "ASVERS: $ASVERS"

ACCT_ID=$(aws sts get-caller-identity | jq '.Account' -r)
aws iam get-policy --policy-arn arn:aws:iam::${ACCT_ID}:policy/AmazonEKSClusterAutoscalerPolicy > /dev/null
if [ $? -ne 0 ]; then
  cat > ./cluster-autoscaler-policy.json << EOU
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Action": [
                "autoscaling:DescribeAutoScalingGroups",
                "autoscaling:DescribeAutoScalingInstances",
                "autoscaling:DescribeLaunchConfigurations",
                "autoscaling:DescribeTags",
                "autoscaling:SetDesiredCapacity",
                "autoscaling:TerminateInstanceInAutoScalingGroup",
                "ec2:DescribeLaunchTemplateVersions"
            ],
            "Resource": "*",
            "Effect": "Allow"
        }
    ]
}
EOU
  aws iam create-policy --policy-name AmazonEKSClusterAutoscalerPolicy --policy-document file://cluster-autoscaler-policy.json
fi
   

eksctl create iamserviceaccount --cluster=${CLUSTER} --namespace=kube-system \
    --name=cluster-autoscaler \
    --attach-policy-arn=arn:aws:iam::${ACCT_ID}:policy/AmazonEKSClusterAutoscalerPolicy \
    --override-existing-serviceaccounts --approve
kubectl apply -f https://raw.githubusercontent.com/kubernetes/autoscaler/master/cluster-autoscaler/cloudprovider/aws/examples/cluster-autoscaler-autodiscover.yaml

ROLEARN=$(aws cloudformation describe-stacks --stack-name eksctl-${CLUSTER}-addon-iamserviceaccount-kube-system-cluster-autoscaler | jq '.Stacks[0].Outputs[0].OutputValue' -r)

kubectl annotate serviceaccount cluster-autoscaler -n kube-system eks.amazonaws.com/role-arn=${ROLEARN} --overwrite
kubectl patch deployment cluster-autoscaler \
  -n kube-system \
  -p '{"spec":{"template":{"metadata":{"annotations":{"cluster-autoscaler.kubernetes.io/safe-to-evict": "false"}}}}}'

EDITOR='perl -pi.bak -e "s/\<YOUR/$CLUSTER/g;" -e "s/  CLUSTER NAME\>/- --balance-similar-node-groups\n        - --skip-nodes-with-system-pods=false/g;"' kubectl -n kube-system edit deployment.apps/cluster-autoscaler

kubectl set image deployment cluster-autoscaler \
  -n kube-system \
  cluster-autoscaler=k8s.gcr.io/autoscaling/cluster-autoscaler:${ASVERS}
