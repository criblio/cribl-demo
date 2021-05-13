#!/usr/bin/env python3

from optparse import OptionParser
from kubernetes import client, config
from yaml import load, dump
import sys
import boto3
import json
import botocore.exceptions
import subprocess
import os
import re
import time
import docker
import base64
import urllib3
import collections
import json
import tempfile
import shutil
import tarfile
from urllib.parse import quote_plus



try:
    from yaml import CLoader as Loader, CDumper as Dumper
except ImportError:
    from yaml import Loader, Dumper

#config objects
services = { 
  "cribl": "Cribl LogStream UI", 
  "grafana": "Grafana Visualization Tool",  
  "influxdb2": "InfluxData's InfluxDB v2",
  "splunk": "Splunk UI"}
allowed_ports = [ 3000, 8000, 8086, 9000 ]

def gen_demo_config(params,options):
  configmap = "demo-config"
  print("Setting up Auth ConfigMap")
  # Delete first, in case there's already one present.
    # Check for and delete if already present.
  kbctlcheck = "kubectl get configmap %s -n %s >/dev/null 2>&1" % (configmap, options.ns)
  kbctlchkout = subprocess.call(kbctlcheck, shell=True)
  if (kbctlchkout == 0):
    print("Deleting Existing Auth Configmap")
    kbctldel = "kubectl delete configmap %s -n %s" % (configmap, options.ns)
    kubectlout = subprocess.call(kbctldel,  shell=True)

  #f = tempfile.TemporaryDirectory(dir="/var/tmp")
  dir = tempfile.mkdtemp(dir = "/var/tmp")

  print("Temp Dir: %s" % dir)
  # Write the users.json file
  with open("%s/users.json" % dir, "w") as fp:

    for cred in params['creds']:
      thiscred = params['creds'][cred];
      if cred == "admin":
        fp.write ("{\"username\":\"admin\",\"first\":\"admin\",\"last\":\"admin\",\"email\":\"admin\",\"roles\":[\"admin\"],\"password\":\"%s\"}\n" % thiscred['password'])
      else:
        fp.write("{\"first\":\"%s\",\"last\":\"%s\",\"email\":\"%s\",\"roles\":[%s],\"username\":\"%s\",\"password\":\"%s\"}\n" % (thiscred['first'], thiscred['last'],thiscred['email'],re.sub(r',', '","', re.sub(r'^|$','"',thiscred['rolestring'])),cred,thiscred['password']))
  # Write the branch file
  with open("%s/branch" % dir, "w") as fp:
    if "branch" in params:
      fp.write(params['branch'])
    else:
      fp.write("master")
  # Write the admin.pass file
  with open("%s/admin.pass" % dir, "w") as fp:
    if "creds" in params and "admin" in params['creds'] and "password" in params['creds']['admin']:
      fp.write(params['creds']['admin']['password'])
    else:
      fp.write("cribl-demo")
  
  # Create the configmap (need to add error handling)
  kbctlcr = "kubectl create configmap demo-config -n %s --from-file=%s " % (options.ns, dir)
  kubectlout = subprocess.call(kbctlcr,  shell=True)
  if (kubectlout != 0):
    print("Auth Configmap Failed: %s" % kubectlout)
  
  print("Creating general secret")
  secret = "demo-admin"
  
  # Check for and delete if already present.
  kbctlcheck = "kubectl get secret %s -n %s " % (secret, options.ns)
  kbctlchkout = subprocess.call(kbctlcheck, shell=True)
  if (kbctlchkout == 0):
    kbctldel = "kubectl delete secret %s -n %s" % (secret, options.ns)
    kubectlout = subprocess.call(kbctldel,  shell=True)
  kbctlsecret = "kubectl create secret generic %s -n %s --from-literal=adminpass=%s" % (secret, options.ns, params['creds']['admin']['password'])
  kbctlout = subprocess.call(kbctlsecret,  shell=True)
  if (kbctlout != 0):
    print("Error creating Secret")
  shutil.rmtree(dir)


def gen_master_config(params,options):
  configmap = "master-config"
  # This configmap includes the files in cribl/master/local/cribl
  # direct call to kubectl to create the configmap from those files.
  dir="cribl/master/local/cribl/"

  if not os.path.exists(dir):
    print("Error: Not in the Repo Top Level")
    sys.exit(255)

  print("Setting up ConfigMap %s" % configmap)
  # Check for and delete if already present.
  kbctlcheck = "kubectl get configmap %s -n %s > /dev/null 2>&1" % (configmap, options.ns)
  kbctlchkout = subprocess.call(kbctlcheck, shell=True)
  if (kbctlchkout == 0):
    kbctldel = "kubectl delete configmap %s -n %s" % (configmap, options.ns)
    kubectlout = subprocess.call(kbctldel,  shell=True)

  # Create the configmap (need to add error handling)
  kbctlcr = "kubectl create configmap %s -n %s --from-file=%s" % (configmap, options.ns, dir)
  kubectlout = subprocess.call(kbctlcr,  shell=True)
  if (kubectlout != 0):
    print("Failed to Create ConfigMap %s: %s" % (configmap, kubectlout))

def gen_group_config(params,options):
  configmap = "group-config"
  running_dir = os.getcwd()
  conf_dir="cribl/master/groups"

  if not os.path.exists(conf_dir):
    print("Error: Not in the Repo Top Level")
    sys.exit(255)
  #change to the source directory
  os.chdir(conf_dir)
  # Check for and delete if already present.
  kbctlcheck = "kubectl get configmap %s -n %s > /dev/null 2>&1" % (configmap, options.ns)
  kbctlchkout = subprocess.call(kbctlcheck, shell=True)
  if (kbctlchkout == 0):
    kbctldel = "kubectl delete configmap %s -n %s" % (configmap, options.ns)
    kubectlout = subprocess.call(kbctldel,  shell=True)

  source_contents = os.listdir(".")
  dir = tempfile.mkdtemp(dir = "/var/tmp")
  print("Temp Dir: %s" % dir)

  for source_dir in source_contents:
    if os.path.isdir(source_dir):
  
      print("Tarring up %s" % source_dir)
      with tarfile.open("%s/groups-%s.tgz" % (dir,source_dir), "w:gz") as tar:
        tar.add(source_dir)

  # Create the configmap (need to add error handling)
  kbctlcr = "kubectl create configmap %s -n %s --from-file=%s" % (configmap, options.ns, dir)
  kubectlout = subprocess.call(kbctlcr,  shell=True)
  if (kubectlout != 0):
    print("Failed to Create ConfigMap %s: %s" % (configmap, kubectlout))

  # Change back to the original directory
  os.chdir(running_dir)
  shutil.rmtree(dir)
  
def gen_sa_config(params,options):
  configmap = "sa-config"
  running_dir = os.getcwd()
  conf_dir="cribl/sa"

  if not os.path.exists(conf_dir):
    print("Error: Not in the Repo Top Level")
    sys.exit(255)
  #change to the source directory
  os.chdir(conf_dir)
  # Check for and delete if already present.
  kbctlcheck = "kubectl get configmap %s -n %s > /dev/null 2>&1" % (configmap, options.ns)
  kbctlchkout = subprocess.call(kbctlcheck, shell=True)
  if (kbctlchkout == 0):
    kbctldel = "kubectl delete configmap %s -n %s" % (configmap, options.ns)
    kubectlout = subprocess.call(kbctldel,  shell=True)

  source_contents = ['cribl']
  dir = tempfile.mkdtemp(dir = "/var/tmp")
  print("Temp Dir: %s" % dir)

  for source_dir in source_contents:
    if os.path.isdir(source_dir):
  
      print("Tarring up %s" % source_dir)
      with tarfile.open("%s/sa.tgz" % dir, "w:gz") as tar:
        tar.add(source_dir)

  # Create the configmap (need to add error handling)
  kbctlcr = "kubectl create configmap %s -n %s --from-file=%s" % (configmap, options.ns, dir)
  kubectlout = subprocess.call(kbctlcr,  shell=True)
  if (kubectlout != 0):
    print("Failed to Create ConfigMap %s: %s" % (configmap, kubectlout))

  shutil.rmtree(dir)
  # Change back to the original directory
  os.chdir(running_dir)


def dict_merge(dct, merge_dct):
    """ Recursive dict merge. Inspired by :meth:``dict.update()``, instead of
    updating only top-level keys, dict_merge recurses down into dicts nested
    to an arbitrary depth, updating keys. The ``merge_dct`` is merged into
    ``dct``.
    :param dct: dict onto which the merge is executed
    :param merge_dct: dct merged into dct
    :return: None
    """
    for k, v in merge_dct.items():
        if (k in dct and isinstance(dct[k], dict)
                and isinstance(merge_dct[k], collections.abc.Mapping)):
            dict_merge(dct[k], merge_dct[k])
        else:
            dct[k] = merge_dct[k]


def param_parse(paramtmp, path):
  tmpparam = {}

  # Write a simpler dict to work with...
  for i in paramtmp:
    #print("I: %s" % i)
    i['Name'] = i['Name'].replace(path + "/","")

    if "/" in i['Name']:
      tmp = i['Name'].split("/")
      #print("Break")
      myparam = tmpparam
      for ent in range(0, len(tmp)-1):

        #print("Entry: %s" % tmp[ent])
        if tmp[ent] not in myparam:
          myparam[tmp[ent]] = {}
        myparam = myparam[tmp[ent]]
      myparam[tmp[len(tmp)-1]]=i['Value']

    else:
      #print("Param: %s - %s" % (i['Name'], i['Value']))
      tmpparam[i['Name']] = i['Value']

  return(tmpparam)


def pull_params(parampath, namespace):
  ssm = boto3.client("ssm")
  params = {}

  fullpath = "%s/%s" % (parampath, namespace)
  print("Full: %s" % fullpath)

  try:
    pass_param = ssm.get_parameters_by_path(Path=fullpath, Recursive=True, WithDecryption=True, MaxResults=10)
  except botocore.exceptions.ClientError as e:
    if e.response['Error']['Code'] == 'ParameterNotFound':
      print('Parameter tree does not exist, Will use command line args exclusively')
    print(e)

  #params.update(param_parse(pass_param['Parameters']))
  dict_merge(params, param_parse(pass_param['Parameters'], fullpath))

  while("NextToken" in pass_param):
    try:
      pass_param = ssm.get_parameters_by_path(Path=fullpath, Recursive=True, WithDecryption=True, MaxResults=10, NextToken=pass_param['NextToken'])
    except botocore.exceptions.ClientError as e:
      if e.response['Error']['Code'] == 'ParameterNotFound':
        print('Parameter tree does not exist, Will use command line args exclusively')
      print(e)

    dict_merge(params, param_parse(pass_param['Parameters'], fullpath))
  return params

def base64_encode(string):
    """
    Removes any `=` used as padding from the encoded string.
    """
    encoded = base64.urlsafe_b64encode(string)
    return encoded.rstrip(b"=")


def base64_decode(string):
    """
    Adds back in the required padding before decoding.
    """
    padding = 4 - (len(string) % 4)
    string = string + ("=" * padding)
    return base64.urlsafe_b64decode(string)

def get_cluster_name():
  kubectlout = subprocess.run(["kubectl", "config", "current-context"],capture_output=True)
  cluster = kubectlout.stdout.decode()[:-1]
  return cluster

def docker_login(options, acct):
  client = docker.from_env()
  ecr = boto3.client('ecr')
  token = ecr.get_authorization_token()

  username, password = base64.b64decode(token['authorizationData'][0]['authorizationToken']).decode().split(':')
  registry = token['authorizationData'][0]['proxyEndpoint']
  #print("Token: %s - %s - %s" % (username,password,registry))
  resp = client.login(username, password, registry=registry, reauth=True)
  logincmd = "aws ecr get-login-password | docker login --username AWS --password-stdin %s" % registry
  subprocess.run(["docker", "login", "--username", "AWS", "--password-stdin", registry], input=password.encode('utf-8'))
  print(resp['Status'])


# Functions
# Set up ECR Repos for all the images in the skaffold.yaml file.
def setup_ecr(options,acct):
  ecr = boto3.client('ecr') 

  print("Ensuring ECR Repo is Setup...")
  with open('skaffold.yaml') as skf:
    skafcfg = load(skf, Loader=Loader)
    #print (json.dumps(skafcfg['build']['artifacts']))
    for art in skafcfg['build']['artifacts']:

      try:
        ecr.create_repository(repositoryName="%s/%s" % (options.repohead, art['image']))
      except botocore.exceptions.ClientError as error:
        if error.response['Error']['Code'] == "RepositoryAlreadyExistsException":
          #print("Repo Exists")
          pass
        else:
          print("Unhandled Error: %s" % error.response['Error']['Code'])

  print("Done")
  docker_login(options,acct)

# Check that the specified namespace exists, and create it if it doesn't
def check_namespace(options, kubeclient):
  nslist = kubeclient.list_namespace()
  found = 0
  for ns in nslist.items:
    if (ns.metadata.name == options.ns):
      found = 1
      print (ns.metadata.name)
  
  if found == 0:
    print("Need to create the namespace")
    kubeclient.create_namespace(client.V1Namespace(metadata=client.V1ObjectMeta(name=options.ns)))
  
  patch = {'metadata': { 
          'annotations': {'description': options.description}}}
  kubeclient.patch_namespace(options.ns, patch)

# Lookup the zoneid of the hosted zone - die if it doesn't exist.
def get_hosted_zone(options):
  r53 = boto3.client("route53")

  print ("Finding Domain %s" % options.domain)
  retzones = r53.list_hosted_zones_by_name(DNSName=options.domain)
  for zone in retzones['HostedZones']:
    print ("Name; %s" % zone['Name'])
    if (zone['Name'] == "%s." % options.domain):
      return zone['Id']  
  
    print("No Zone Found - Not Continuing")
    sys.exit(0)

# Set up Command Line Parsing
parser = OptionParser()
parser.add_option("-n", "--namespace", dest="ns", default="default", help="Namespace to Interrogate")
parser.add_option("-d", "--domain", dest="domain", default="demo.cribl.io", help="Hosted Zone to Use")
parser.add_option("-r", "--region", dest="region", default="us-west-2", help="AWS Region to deploy to")
parser.add_option("-s", "--ssm-path", dest="ssmpath", default="/cribl/demo", help="SSM path for Environment options")
parser.add_option("-a", "--description", dest="description", default="Demo Environment")
parser.add_option("-c", "--container-repo-head", dest="repohead", default="cribl-demo", help="ECR Repo top level")
parser.add_option("-p", "--profile", dest="profile", help="Skaffold Profile to run with")
(options, args) = parser.parse_args()


# Set default env variables
if "CRIBL_TAG" not in os.environ:
  os.environ['CRIBL_TAG'] = "latest"

# Set up AWS objects
s3 = boto3.client('s3')
sts = boto3.client('sts')
r53 = boto3.client("route53")
ssm = boto3.client("ssm")

parampath=options.ssmpath + "/" + options.ns
#print("Parampath: %s" % parampath)
parameters = pull_params(options.ssmpath, options.ns)

chpass=False


if "creds" in parameters and "admin" in parameters["creds"] and "password" in parameters["creds"]["admin"]:
  chpass = True
  print('Credential param exists, using it')
else: 
  chpass = False
  print('Using Default Credentials')

if ("repo" in parameters):
  print("Found Repo")
  options.repohead = parameters['repo']

if ("description" in parameters):
  options.description = parameters['description']

if ("domain" in parameters):
  options.domain = parameters['domain']

if ("profile" in parameters):
  options.profile = parameters['profile']

if ("tag" in parameters):
  os.environ['CRIBL_TAG'] = parameters['tag']

#print("Options: %s" % options)

if chpass:
  cmd="perl -pi.bak -e 's{cribldemo([\"\\\]+)}{" + parameters['creds']['admin']['password'] + "$1}g;' ./grafana/grafana.k8s.yml"
  rval = subprocess.call(cmd,  shell=True)
  if rval == 0:
    print("Password Set Succeeded")

# print("before call: %s" % parameters)
gen_demo_config(parameters,options)
gen_master_config(parameters,options)
gen_group_config(parameters,options)
gen_sa_config(parameters,options)

# get acct id and hosted zone id
acct = sts.get_caller_identity()
(id,email) = acct['UserId'].split(':')
mtch = re.match(r'@', email)
if mtch:
  options.description += "<br><font size=-1>(Created by <a href=mailto:%s>%s</a>)</font>" % (email, email)
else:
  options.description += "<br><font size=-1>(Created by Automation)</font>"
zoneid = get_hosted_zone(options)

# Make sure the ECR repos are setup.
setup_ecr(options,acct)

# Setup the K8s API Client
config.load_kube_config()
kubeclient = client.CoreV1Api()

# ensure that the specified namespace is set up
check_namespace(options, kubeclient)

# Set up the SKAFFOLD env var
os.environ['SKAFFOLD_DEFAULT_REPO'] = "%s.dkr.ecr.%s.amazonaws.com/%s" % (acct['Account'], options.region, options.repohead)

# Run skaffold build with the namespace as the tag (this allows us to have different images for different deployments/namespaces)
skaffbuildcall = "skaffold build --tag=%s" % options.ns
skaffdeploycall = "skaffold deploy --status-check --tag=%s -n %s" % (options.ns, options.ns)
if (options.profile):
  skaffbuildcall = "skaffold build --tag=%s --profile=%s" % (options.ns, options.profile)
  skaffdeploycall = "skaffold deploy --status-check --tag=%s --profile=%s -n %s" % (options.ns, options.profile, options.ns)

rval = subprocess.call(skaffbuildcall,  shell=True)
if rval == 0:
  print("Skaffold Build Succeeded")
else:
  print("Skaffold Build Failed")
  sys.exit(rval)

# Run Skaffold Deploy with the namespace as tag and namespace to deploy in
rval = subprocess.call(skaffdeploycall,  shell=True)
if rval == 0:
  print("Skaffold Deploy Succeeded")
else:
  print("Skaffold Deploy Failed")
  sys.exit(rval)

time.sleep(60)

# Setup the R53 JSON
chgbatch = { "Comment": "Upserting for the %s.%s domain" % (options.ns, options.domain), "Changes": []}



# Reverse the specified domain to make the bucket name
domrev = options.domain.split('.')
domrev.reverse()
revhost = ".".join(domrev)

print("Creating HTML Service View")

style = '''
<style>
      img {
        max-width: 15%;
        height: auto;
      }
      body {
        background-color: black;
        color: white;
      }
      h1, h2, h3, h4, h5 {
        color: white;
      }
      table {
        width:90%;
      }
      table, th, td {
        border: 1px solid #C9D0D4;
        text-align: left;
        padding: 10px;
      }
    </style>
'''
# Get the Service info, and generate an index.html to post for the namespace.
htmlout = """
<HTML>
  <HEAD>
    <TITLE>Services in %s</TITLE>
    <link rel=stylesheet href=https://cribl.io/wp-content/themes/cribl/assets/css/main.css?ver=1608242659>
    %s
  
  </HEAD>
  <BODY>
    <H2><img height=100 src=https://cribl.io/wp-content/themes/cribl/assets/images/logo-cribl-new.svg><br>Services in %s</H2>
    <p>%s</p>
    <table>
    <tr><th>Service</th><th>Service Description</th></tr>
""" % (options.ns, style, options.ns, options.description)

for svc in services.keys():
  print ("Checking svc %s service" % svc)
  ret = kubeclient.read_namespaced_service(svc, options.ns)
  for host in ret.status.load_balancer.ingress:
    chg = { "Action": "UPSERT", "ResourceRecordSet": { "Name": "%s.%s.%s" % ( svc, options.ns, options.domain ), "Type": "CNAME", "TTL": 300, "ResourceRecords": [ { "Value": host.hostname } ] } }
    chgbatch['Changes'].append(chg)
    for port in ret.spec.ports:
      if port.port in allowed_ports:
        htmlout += "<tr><td><A HREF=http://%s.%s.%s:%d/>%s</A></td><td>%s</td></tr>" % ( svc, options.ns, options.domain, port.port, svc, services[svc])

htmlout += "</table></body></HTML>"

htmlb = htmlout.encode("utf8")

desc = options.description
#desc=options.description.replace("@","-").replace("<br>"," - ")
#desc = re.sub(r'Created by A[^:]+:', 'Created by', desc)
#tagset=quote_plus({"namespace-description":  options.description})
#options.description+="na"h
tdat = base64.urlsafe_b64encode(options.description.encode('utf-8')).decode('utf-8')
cluster_name = get_cluster_name()
cname = base64.urlsafe_b64encode(cluster_name.encode('utf-8')).decode('utf-8')
tagset="cluster=%s&namespace-description=%s" % (cname, tdat)

#print("Tagset: %s" % tagset)

# put the index.html file up.
resp = s3.put_object(Bucket=revhost, Body=htmlb, Key="ns-%s/index.html" % options.ns, ACL='public-read', ContentType='text/html', Tagging=tagset)
print("Done")

print ("Updating R53")
response = r53.change_resource_record_sets(HostedZoneId=zoneid, ChangeBatch = chgbatch)
print("%s - %s" % (response['ChangeInfo']['Status'], response['ChangeInfo']['Comment']))

if (chpass):
  cmd="git checkout ./grafana/grafana.k8s.yml"
  rval = subprocess.call(cmd,  shell=True)
  if rval == 0:
    print("Password Unset Succeeded")
