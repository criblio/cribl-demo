# HelloPacks
----
This is a sample pack that ships by default with LogStream with the goal of helping users get started with a simple example.
     
Packs enable LogStream administrators and developers to pack up and share configurations across multiple Worker Groups, or across deployments. Packs = Portability.
A pack can can be as simple as a single Pipeline or contain multiple Routes, Pipelines, Functions, Sample files, Lookups, Parsers etc. Packs are easily referenced at the sytem level and monitored as if they were a normal pipeline.  


## Requirements
----
Before you begin, ensure that you have met the following requirements:

* LogStream +3.0

## Using The Pack
----

In a single instance, Packs are global. In a distributed deployment, Packs are associated with (and installed within) Worker Groups.

- Work with the Pack as you'd normally do at the system level.    

- Reference the Pack at the system level anywhere a pipeline can. E.g., 

  - Referencing a Pack in lieu of a pre-processing pipeline: `|-> Source -> [ (Pre-Processing) Pack] -> Routes etc...`

  - Referencing a Pack, instead of Pipeline, from a Route: `|-> Source -> Routes -> [Pack] -> Destination`

## Learn More 
----
To get started creating your own packs and exporting them across your LogStream deployment check out the [Packs Documentation](https://docs.cribl.io/docs/packs).


## Release Notes
----

### Version 1.0.0 - 2021-05-18
First version. 

## Contact
----
Join us in our [community](https://cribl.io/community/). We've goat you covered!

## Credits
----
Made with ♡ by the Engineering Team @Cribl - 2021