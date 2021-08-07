# StateChange
----

This pack is for cribl-demo, to show an example of the Code feature in action. It operates on nagios input (which we generate via gogen), and basically filters the state messages ("<hostname> is <UP|DOWN>") down to just the ones that are different
than the previous event. Thus, the only events that get through are actually when that state has changed. 

## Requirements Section

Before you begin, ensure that you have met the following requirements:

* To Use this inline, you'd need nagios log data coming into LogStream. If not, the samples tell the story.

## Using The Pack

To use this Pack, follow these steps:

1. Go to pipelines, click on the "statechange" pipeline.
1. In the sample files pane, click "Simple" next to the "nagios-state.log" file.
1. Toggle between In and Out view to see the result of the pipeline.
1. Click on the gear in the sample files pane and enable "Show Internal Fields" to see the under the covers stuff:
    * `__state` and `__host` fields are extracted by the regex_extract function.
    * the Code function uses a global variable "prev" to store cached state, and evaluates it against each events state, resulting in a __stateflag field that contains either "new state" or "no change".


## Release Notes

### Version 0.01 - 2021-08-06
Initial Version


## Contributing to the Pack
To contribute to the Pack, please do the following:

You can contribute via a pull request to the cribl-demo repo.


## Contact
To contact us please email <technical_marketing@cribl.io>.


