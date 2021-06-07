#!/usr/bin/env python3

import boto3
import json
from optparse import OptionParser

ssm = boto3.client("ssm")

def recurseParams(ssmpath, output, next=""):
  if len(next) > 0:
    params = ssm.get_parameters_by_path(Path=ssmpath, Recursive=True, WithDecryption=True,
                                        MaxResults=10, NextToken=next)
  else:
    params = ssm.get_parameters_by_path(Path=ssmpath, Recursive=True, WithDecryption=True,
                                        MaxResults=10)
  #print("type: %s" % type(output))

  for param in params['Parameters']:
    key = param['Name'].replace("%s/" % ssmpath,"")

    if not  key.startswith("creds"):
      #print("Key: %s" % key)
      kys = key.split("/")
      if kys[0] not in output:
        output[kys[0]] = {}      
      
      output[kys[0]][kys[1]] = param['Value']
    #print("Param: %s, %s" % (param['Name'], param['Value']))
  if "NextToken" in params:
    recurseParams(ssmpath, output, params['NextToken'])
  

    
     

# Set up Command Line Parsing
parser = OptionParser()
parser.add_option("-r", "--region", dest="region", default="us-west-2", help="AWS Region to deploy to")
parser.add_option("-s", "--ssm-path", dest="ssmpath", default="/cribl/demo", help="SSM path for Environment options")
parser.add_option("-j", "--job", dest="job", default="daily", help="Which job tag to find")
(options, args) = parser.parse_args()

output = {}
recurseParams(options.ssmpath, output)

#print(json.dumps(output))

for ns in output.keys():
  if ("job" in output[ns]) and  (output[ns]['job'] == options.job):
    if ("branch" in output[ns]):
      print("%s-%s-%s" % (ns, output[ns]['cluster'], output[ns]['branch']))
    else:
      print("%s-%s-master" % (ns, output[ns]['cluster']))

