#!/usr/bin/env python3

import boto3
import base64


def main(event, context): 
  userdata="""#!/bin/bash


export AWS_DEFAULT_REGION=us-west-2
export HOME=/root

# Setup
cd /home/ubuntu
apt update
apt remove -y python3.6
rm /usr/bin/python3
apt install -y python3.8 python3-pip unzip docker.io software-properties-common
ln -s /usr/bin/python3.8 /usr/bin/python3
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
usermod -aG docker ubuntu
./aws/install

# Dependencies
curl -Lo skaffold https://storage.googleapis.com/skaffold/releases/v1.17.2/skaffold-linux-amd64 && chmod +x skaffold && mv skaffold /usr/local/bin

curl -LO https://storage.googleapis.com/kubernetes-release/release/$(curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt)/bin/linux/amd64/kubectl \
&& install kubectl /usr/local/bin && rm kubectl

curl https://baltocdn.com/helm/signing.asc | apt-key add - && \
apt-get install apt-transport-https --yes && \
echo "deb https://baltocdn.com/helm/stable/debian/ all main" | tee /etc/apt/sources.list.d/helm-stable-debian.list && \
apt-get update && \
apt-get install -y helm

# Repo & Run
git clone https://github.com/criblio/cribl-demo.git
cd cribl-demo/
git checkout eks-improvements
git pull
pip3 install -r ./requirements.txt  -t .
./scripts/deploy_envs.sh daily


# Cleanup
TOKEN=`curl -sq -X PUT "http://169.254.169.254/latest/apec2-metadata-token-ttl-seconds: 21600"`
export INSTANCEID=$(curl -sq -H "X-aws-ec2-metadata-token: $TOKEN"  http://169.254.169.254/latest/meta-data/instance-id)

aws ec2 terminate-instances --instance-id $INSTANCEID
"""

  ec2_client = boto3.client("ec2", region_name="us-west-2")
  instances = ec2_client.run_instances(
    MinCount=1,
    MaxCount=1,
    InstanceType="t3.large",
    KeyName="cribl-lab",
    UserData=userdata,
    ImageId="ami-02701bcdc5509e57b",
    IamInstanceProfile={
      'Arn': 'arn:aws:iam::586997984287:instance-profile/DemoEnvRefresh'
    },
    BlockDeviceMappings= [
      {
        'DeviceName': "/dev/sda1",
        'Ebs': {
          'Encrypted': True,
          'VolumeSize': 60,
          'VolumeType': 'gp2'
        }
      }
    ],
    TagSpecifications=[
      { 
        'ResourceType': 'instance',
        'Tags': [
          {
            "Key": "Name",
            "Value": "Demo Env Refresh"
          }
        ]
      }
    ],
    NetworkInterfaces=[
      {
        'DeviceIndex':0,
        'SubnetId': 'subnet-0e1b4f53dd6ecea8d',
        'Groups': ['sg-015de7434a2e3946e']
      }
    ]
  )

  print("Instances: %s" % instances)

