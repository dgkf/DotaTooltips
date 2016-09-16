# Builds for import end up here

Running ```build.py``` should produce packaged extensions in this folder. Build details specified in ```build_targets.json```. Chrome is kept as the last build target so that the manifest file in the dev folder is the chrome manifest since chrome allows loading of unpacked development extensions. 
